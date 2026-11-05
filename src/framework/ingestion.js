const {assertCorpus,collections,digest}=require('./canonical');
const {resolveProfile}=require('./profile');
const {createValidator}=require('./validation');
const {parseInput,select,MAX_BYTES,object}=require('./ingestion-formats');
const {checkMapping,mapRecord,idPattern}=require('./ingestion-mapping');
const {IngestionError,fail}=require('./ingestion-error');
const VERSION='1.0.0';
const clone=structuredClone;
function stamp(value,optional=false){
 if(optional&&value===null)return null;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,19)!==value.slice(0,19))fail('INGESTION_TIMESTAMP','Use an explicit valid UTC timestamp');
 return value;
}
function validateBase(corpus){try{assertCorpus(corpus);}catch(e){fail('INGESTION_BASE_INVALID','Working corpus is not valid',e.details??[]);}}
function createWorkingCorpus(manifest,taxonomies){
 const profile=resolveProfile(manifest),corpus={schema_version:'3.0.0',profile:clone(profile),taxonomies:clone(taxonomies),...Object.fromEntries(Object.keys(collections).map(k=>[k,[]])),extensions:{}};
 validateBase(corpus);return corpus;
}
function logical(event,spatial){
 return {title:event.title,description:event.description,start_date:event.start_date,end_date:event.end_date,event_type:event.event_type,
  evidence:event.provenance.evidence,territory_refs:event.territory_refs,participant_refs:event.participant_refs,
  spatial:spatial.map(s=>({label:s.label,geometry:s.geometry,crs:s.crs,geometry_role:s.geometry_role,precision_meters:s.precision_meters,
   geocoding_method:s.geocoding_method,reference_version:s.reference_version,place:s.place,evidence:s.provenance.evidence}))};
}
const issue=(code,message)=>({code,message});
function prepareImport({bytes,mapping:manifest,corpus,sourceName,observedAt=null}){
 validateBase(corpus);stamp(observedAt,true);
 if(typeof sourceName!=='string'||!sourceName.trim()||sourceName.length>512||/[\x00-\x1f]/.test(sourceName))fail('INPUT_SOURCE_NAME','Supply an explicit source name without control characters');
 const {profile,taxonomies}=corpus,mapping=checkMapping(manifest,profile),{input,rows}=parseInput(bytes,mapping);
 const profile_sha256=digest(profile),mapping_sha256=digest(mapping),base_sha256=digest(corpus),batch_id=digest({version:VERSION,input_sha256:input.sha256,profile_sha256,mapping_sha256,taxonomies_sha256:digest(taxonomies)});
 const occupied=new Map(Object.keys(collections).flatMap(k=>corpus[k].map(r=>[r.id,r]))),spatialById=new Map(corpus.spatial_assertions.map(s=>[s.id,s]));
 const context={profile,inputSha:input.sha256,sourceIds:new Set(corpus.sources.map(s=>s.id)),territoryIds:new Set(corpus.entities.filter(e=>e.entity_type==='territory').map(e=>e.id)),rules:createValidator(profile,{taxonomies}),version:VERSION};
 const grouped=new Map(),invalidIds=new Set(),entries=[],owners=new Map();
 const claimId=(id,owner)=>{if(!owners.has(id))owners.set(id,new Map());owners.get(id).set(JSON.stringify(owner),owner.eventId);};
 for(const row of rows){
  const rawId=object(row.raw)?select(row.raw,mapping.fields.id):null;
  const id=typeof rawId==='string'&&idPattern.test(rawId.trim())?rawId.trim():null;
  const entry={index:row.index,line:row.line,source_path:row.source_path,id,status:'quarantined',diagnostics:clone(row.errors),changed_fields:[]};entries.push(entry);
  if(!entry.diagnostics.length){
   try{const candidate=mapRecord(row,mapping,context),value=logical(candidate.event,candidate.spatial);
    entry.id=candidate.event.id;entry.diagnostics.push(...candidate.warnings);const item={entry,candidate,value,fingerprint:digest(value)};
    if(!grouped.has(entry.id))grouped.set(entry.id,[]);grouped.get(entry.id).push(item);
    claimId(entry.id,{eventId:entry.id,kind:'event'});for(const s of candidate.spatial)claimId(s.id,{eventId:entry.id,kind:'spatial'});
    continue;
   }catch(e){if(!(e instanceof IngestionError))throw e;entry.diagnostics.push(issue(e.code,e.message),...e.details);}
  }
  if(id)invalidIds.add(id);
 }
 const collided=new Set();for(const owner of owners.values())if(owner.size>1)for(const id of owner.values())collided.add(id);
 const candidates=[];
 for(const [id,group]of grouped){
  const [first]=group,existing=occupied.get(id);let failure;
  if(invalidIds.has(id))failure=issue('BATCH_ID_QUARANTINED_PEER','Another row with this identifier is quarantined');
  else if(new Set(group.map(r=>r.fingerprint)).size>1)failure=issue('BATCH_ID_CONFLICT','Rows sharing this identifier disagree; no row was selected');
  else if(collided.has(id))failure=issue('BATCH_DERIVED_ID_CONFLICT','An imported identifier collides with a derived record');
  else if(existing&&existing.kind!=='event')failure=issue('BASE_ID_KIND_CONFLICT','Identifier belongs to another object kind');
  else if(!existing&&first.candidate.spatial.some(s=>occupied.has(s.id)))failure=issue('BASE_DERIVED_ID_CONFLICT','A derived spatial identifier already exists');
  if(failure){for(const {entry}of group){entry.status='conflict';entry.diagnostics.push(failure);}continue;}
  if(existing){
   const previous=logical(existing,existing.spatial_refs.map(r=>spatialById.get(r.id))),previousHash=digest(previous);
   for(const {entry,value,fingerprint}of group){
    entry.status=fingerprint===previousHash?'unchanged':'conflict';
    if(entry.status==='conflict'){entry.diagnostics.push(issue('BASE_ID_CONTENT_CONFLICT','Existing record differs; automatic replacement is disabled'));entry.changed_fields=Object.keys(previous).filter(k=>digest(previous[k])!==digest(value[k]));}
   }
   continue;
  }
  first.entry.status='create';candidates.push({index:first.entry.index,record_sha256:first.fingerprint,event:first.candidate.event,spatial:first.candidate.spatial});
  for(const {entry}of group.slice(1)){entry.status='unchanged';entry.diagnostics.push(issue('BATCH_EXACT_DUPLICATE','Equivalent mapped record already appears in this batch'));}
 }
 const summary={total:entries.length,create:0,unchanged:0,conflict:0,quarantined:0};for(const entry of entries)summary[entry.status]++;
 const report={scope:'technical_preview',version:VERSION,batch_id,base_sha256,observed_at:observedAt,source:{name:sourceName,format:mapping.format,encoding:input.encoding,sha256:input.sha256},
  profile:{id:profile.id,version:profile.version,namespace:profile.namespace,sha256:profile_sha256},mapping:{id:mapping.id,version:mapping.version,sha256:mapping_sha256},summary,rows:entries};
 return {kind:'tempora-ingestion-bundle',bundle_version:VERSION,report,mapping,original_input_base64:input.content_base64,candidates};
}
function acceptImport({corpus,bundle,review}){
 validateBase(corpus);
 if(!object(bundle)||bundle.kind!=='tempora-ingestion-bundle'||bundle.bundle_version!==VERSION||!object(bundle.report)||!object(bundle.report.source))fail('BUNDLE_INVALID','Unsupported or malformed ingestion bundle');
 if(digest(corpus)!==bundle.report.base_sha256)fail('BUNDLE_STALE','Working corpus changed; prepare a new preview before accepting');
 const raw=bundle.original_input_base64;if(typeof raw!=='string'||raw.length>Math.ceil(MAX_BYTES/3)*4)fail('BUNDLE_INVALID','Invalid staged input bytes');
 const bytes=Buffer.from(raw,'base64');if(bytes.toString('base64')!==raw)fail('BUNDLE_INVALID','Invalid staged input encoding');
 const expected=prepareImport({bytes,mapping:bundle.mapping,corpus,sourceName:bundle.report.source.name,observedAt:bundle.report.observed_at});
 let matches=false;try{matches=digest(expected)===digest(bundle);}catch{}if(!matches)fail('BUNDLE_CHANGED','Staged bundle differs from the reproducible preview');
 if(!object(review)||!Array.isArray(review.ids)||!review.ids.length||review.ids.some(id=>typeof id!=='string'||!idPattern.test(id))||new Set(review.ids).size!==review.ids.length)fail('REVIEW_SELECTION','Explicit unique identifiers are required for local acceptance');
 for(const [value,label,max]of [[review.reviewer,'reviewer',120],[review.reason,'reason',2000]])if(typeof value!=='string'||!value.trim()||value.length>max)fail('REVIEW_REQUIRED',`A valid ${label} is required for local acceptance`);
 stamp(review.reviewed_at);if(expected.report.observed_at&&Date.parse(review.reviewed_at)<Date.parse(expected.report.observed_at))fail('REVIEW_TIMESTAMP','Acceptance cannot precede the preview');
 const selected=new Set(review.ids),records=expected.candidates.filter(c=>selected.has(c.event.id));
 if(records.length!==selected.size)fail('REVIEW_SELECTION','Only records proposed for creation can be accepted');
 const next=clone(corpus);for(const r of records){next.events.push(clone(r.event));next.spatial_assertions.push(...clone(r.spatial));}
 validateBase(next);
 return {kind:'tempora-working-corpus',snapshot_version:VERSION,corpus:next,journal:{decision:'accepted_for_local_staging',batch_id:expected.report.batch_id,base_sha256:expected.report.base_sha256,output_sha256:digest(next),
  reviewer:review.reviewer,reason:review.reason,reviewed_at:review.reviewed_at,selected_ids:records.map(r=>r.event.id),editorial_status:'proposed',scientific_approval:false}};
}
const escape=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\r\n|]/g,' ').replace(/[\\`*_[\]]/g,'\\$&');
function renderMarkdown(report){
 const lines=['# TEMPORA — Prévisualisation locale','',`Source : ${escape(report.source.name)} (${report.source.format}, ${report.source.encoding})`,`Empreinte : ${report.source.sha256}`,`Lot : ${report.batch_id}`,`Date : ${report.observed_at??'non renseignée'}`,`Profil : ${escape(report.profile.id)} ${report.profile.version}`,`Mapping : ${escape(report.mapping.id)} ${report.mapping.version}`,'',`Lignes : ${report.summary.total} ; ajouts : ${report.summary.create} ; inchangées : ${report.summary.unchanged} ; conflits : ${report.summary.conflict} ; quarantaine : ${report.summary.quarantined}.`,'','| Ligne source | Identifiant | Résultat | Diagnostics |','|---|---|---|---|'];
 for(const row of report.rows)lines.push(`| ${escape(row.source_path)} | ${escape(row.id)} | ${row.status} | ${row.diagnostics.map(d=>escape(`${d.code}: ${d.message??d.field??''}`)).join(' ; ')} |`);
 return lines.join('\n')+'\n';
}
module.exports={VERSION,IngestionError,createWorkingCorpus,prepareImport,acceptImport,renderMarkdown};
