// ALNOP v2 compatibility adapter. Production data and public exporters are unchanged.
const {validateCorpus:validateOriginal}=require('../canonical');
const {resolveProfile}=require('../framework/profile');
const {temporal}=require('../framework/temporal');
const {CanonicalError,assertCorpus,digest,canonicalStringify}=require('../framework/canonical');
const Ajv=require('ajv/dist/2020'),addFormats=require('ajv-formats');
const releaseAjv=new Ajv({allErrors:true,strict:true});addFormats(releaseAjv);const validateRelease=releaseAjv.compile(require('../../schemas/release.schema.json'));
const MIGRATION_VERSION='1.0.0',clone=structuredClone;
const groups=['operations','sources','territorial_units','persons','organizations','places','claims','duplicate_assessments'];
function toTempora(input,manifest,{releases=[]}={}){
 // Ensure the integrity check also rejects non-JSON values before cloning.
 const inputHash=digest(input),profile=resolveProfile(manifest);
 if(profile.id!=='alnop'||profile.namespace!=='ALNOP')throw new CanonicalError('MIGRATION_PROFILE_INVALID','This adapter requires the ALNOP profile');
 let checks;try{checks=validateOriginal(input);}catch(e){throw new CanonicalError('MIGRATION_INPUT_INVALID','Malformed ALNOP corpus');}if(checks.errors.length)throw new CanonicalError('MIGRATION_INPUT_INVALID','Invalid ALNOP corpus',checks.errors);
 if(!Array.isArray(releases))throw new CanonicalError('MIGRATION_INPUT_INVALID','Releases must be supplied as an explicit array');
 digest(releases);
 for(const release of releases)if(!validateRelease(release))throw new CanonicalError('MIGRATION_RELEASE_INVALID','Invalid original release manifest',clone(validateRelease.errors));
 const out={schema_version:'3.0.0',profile:clone(profile),taxonomies:{...clone(input.vocabularies),territorial_units:input.territorial_units.map(t=>t.id)},events:[],sources:[],claims:[],entities:[],spatial_assertions:[],relations:[],reviews:[],assessments:[],releases:[],extensions:{}};
 const ref=(kind,id)=>({kind,namespace:profile.namespace,id});
 const evidence=ids=>(ids||[]).map(id=>({source:ref('source',id),locator:null,quotation:null}));
 const precise=items=>(items||[]).map(e=>({source:ref('source',e.source_id),locator:e.locator||null,quotation:e.quotation||null}));
 const base=(kind,id,original,sourcePath,ids=[])=>({schema_version:'3.0.0',kind,id,namespace:profile.namespace,editorial_status:original.editorial_status||'unspecified',provenance:{evidence:evidence(ids),transformations:[{method:'alnop-v2-to-tempora-v3',version:MIGRATION_VERSION,input_sha256:inputHash,source_path:sourcePath}]},extensions:{alnop:{original:clone(original)}}});
 const generated=(kind,subject,value,occurrence=0)=>`TMP_${kind}_${digest({subject,value,occurrence}).slice(0,40)}`;
 const transformTime=(d,raw=null)=>({kind:{day:'exact',year:'year',month:'month',range:'interval',unknown:'unknown'}[d.precision],calendar:'gregorian',original:raw,earliest:d.earliest,latest:d.latest,precision:d.precision,certainty:d.certainty});
 function reviews(original,subject,path){return (original.review_history||[]).map((review,i)=>{
  const id=generated('review',subject,review,(original.review_history||[]).slice(0,i).filter(x=>canonicalStringify(x)===canonicalStringify(review)).length);
  out.reviews.push({...base('review',id,review,path+'/review_history/'+i),subject:clone(subject),agent_type:'unspecified',agent:review.reviewer,method:'recorded_editorial_review',decision:review.decision,reason:review.reason,reviewed_at:review.reviewed_at,reference:review.reference,content_sha256:review.content_sha256||null});return ref('review',id);
 });}
 function spatial(original,subject,path,label,geometry,role,ids,place=null){
  const id=generated('spatial',subject,{original,path});
  out.spatial_assertions.push({...base('spatial',id,original,path,ids),subject:clone(subject),label,geometry:clone(geometry??null),crs:'EPSG:4326',geometry_role:geometry?role:'unknown',precision_meters:null,geocoding_method:null,reference_version:null,place});return ref('spatial',id);
 }
 for(const source of input.sources){const subject=ref('source',source.source_id),path='/sources/'+source.source_id;out.sources.push({...base('source',source.source_id,source,path),title:{fr:source.title??null},url:source.url||source.legacy?.url||null,classification:source.source_classification||null,review_refs:reviews(source,subject,path)});}
 for(const op of input.operations){const subject=ref('event',op.id),path='/operations/'+op.id;
  const locations=op.locations.map((l,i)=>spatial(l,subject,path+'/locations/'+i,{fr:l.label},l.geometry,l.geometry_role,l.source_ids||[],l.place_id?ref('entity',l.place_id):null));
  out.events.push({...base('event',op.id,op,path,op.source_ids),title:clone(op.title),description:clone(op.description||{fr:op.legacy?.description??null,ar:null}),start_date:transformTime(op.start_date,op.legacy?.date_debut??null),end_date:transformTime(op.end_date,op.legacy?.date_fin??null),event_type:clone(op.event_type||[op.legacy?.type_action].filter(Boolean)),spatial_refs:locations,territory_refs:op.territorial_assignments.map(t=>ref('entity',t.territory_id)),participant_refs:(op.participants||[]).map(p=>ref('entity',p.entity_id)),review_refs:reviews(op,subject,path)});
  for(const [i,t]of op.territorial_assignments.entries()){const object=ref('entity',t.territory_id),id=generated('territory',subject,t,i);out.relations.push({...base('relation',id,t,path+'/territorial_assignments/'+i,t.source_ids),editorial_status:op.editorial_status,subject,object,predicate:'territorial_assignment:'+t.role,valid_from:temporal(null),valid_to:temporal(null),review_refs:[]});}
  for(const [i,p]of (op.participants||[]).entries()){const id=generated('participant',subject,p,i);out.relations.push({...base('relation',id,p,path+'/participants/'+i,p.source_ids),editorial_status:op.editorial_status,subject,object:ref('entity',p.entity_id),predicate:'participant:'+p.role,valid_from:temporal(null),valid_to:temporal(null),review_refs:[]});}
 }
 for(const group of ['persons','organizations','places'])for(const entity of input[group]||[]){const subject=ref('entity',entity.id),path='/'+group+'/'+entity.id;
  out.entities.push({...base('entity',entity.id,entity,path,entity.source_ids),entity_type:entity.kind,label:clone(entity.label),names:entity.names.map(n=>({value:n.value,language:n.language,role:n.role,valid_from:temporal(n.valid_from),valid_to:temporal(n.valid_to),evidence:evidence(n.source_ids)})),valid_from:temporal(null),valid_to:temporal(null),spatial_refs:entity.geometry!==undefined?[spatial(entity,subject,path+'/geometry',clone(entity.label),entity.geometry,entity.geometry_role,entity.geometry_source_ids||[])]:[],review_refs:reviews(entity,subject,path)});
  for(const [i,r]of entity.relations.entries()){const id=generated('relation',subject,r,i),relation=ref('relation',id);out.relations.push({...base('relation',id,r,path+'/relations/'+i,r.source_ids),editorial_status:r.type==='same_as_candidate'?'proposed':entity.editorial_status,subject,object:ref('entity',r.target_id),predicate:r.type,valid_from:temporal(null),valid_to:temporal(null),review_refs:reviews(r,relation,path+'/relations/'+i)});}
 }
 for(const territory of input.territorial_units){const subject=ref('entity',territory.id),path='/territorial_units/'+territory.id;out.entities.push({...base('entity',territory.id,territory,path,territory.source_ids),entity_type:'territory',label:clone(territory.names),names:[],valid_from:temporal(territory.valid_from),valid_to:temporal(territory.valid_to),spatial_refs:[],review_refs:reviews(territory,subject,path)});}
 for(const claim of input.claims||[]){const subject=ref('claim',claim.id),path='/claims/'+claim.id,r={...base('claim',claim.id,claim,path),subject:ref('event',claim.subject),predicate:claim.predicate,value:clone(claim.value),unit:claim.unit??null,context:claim.context?{scope:claim.context.scope,population:claim.context.population,time_scope:claim.context.time_scope,start_date:temporal(claim.context.valid_from),end_date:temporal(claim.context.valid_to)}:null,assertion_status:claim.status,contradicts:claim.contradicts.map(id=>ref('claim',id)),review_refs:reviews(claim,subject,path)};r.provenance.evidence=precise(claim.evidence);out.claims.push(r);}
 for(const assessment of input.duplicate_assessments||[]){const path='/duplicate_assessments/'+assessment.id,subject=ref('assessment',assessment.id),r={...base('assessment',assessment.id,assessment,path),editorial_status:assessment.editorial_status==='reviewed'?'unspecified':assessment.editorial_status,subjects:[ref('event',assessment.left_id),ref('event',assessment.right_id)],method:'recorded_duplicate_assessment',result:{label:assessment.label,rationale:assessment.rationale},review_refs:reviews(assessment,subject,path)};r.provenance.evidence=precise(assessment.evidence);out.assessments.push(r);}
 for(const release of releases){out.releases.push({...base('release',release.id,release,'/releases/'+release.id),released_at:release.published_at,corpus_schema_version:release.schema_version,files:clone(release.files),source_commit:release.source_commit,canonical_sha256:release.canonical_sha256,archive_sha256:release.archive_sha256});}
 const envelope=Object.fromEntries(Object.entries(input).filter(([key])=>!groups.includes(key)));
 out.extensions.alnop={migration_version:MIGRATION_VERSION,input_sha256:inputHash,profile_sha256:digest(profile),releases_sha256:digest(releases),envelope:clone(envelope),groups:Object.fromEntries(groups.filter(g=>Object.hasOwn(input,g)).map(g=>[g,input[g].map(r=>g==='sources'?r.source_id:r.id)])),release_order:releases.map(r=>r.id)};
 assertCorpus(out);return out;
}
function fromTempora(document){
 assertCorpus(document);const m=document.extensions.alnop;
 if(!m||m.migration_version!==MIGRATION_VERSION)throw new CanonicalError('MIGRATION_VERSION_UNSUPPORTED','No supported reversible migration metadata');
 if(!m.envelope||typeof m.envelope!=='object'||Array.isArray(m.envelope)||!m.groups||typeof m.groups!=='object'||Array.isArray(m.groups)||!Array.isArray(m.release_order))throw new CanonicalError('MIGRATION_METADATA_INVALID','Invalid reverse metadata');
 const input=clone(m.envelope),all=[...document.events,...document.sources,...document.entities,...document.claims,...document.assessments];
 for(const [group,ids]of Object.entries(m.groups)){
  if(!groups.includes(group)||!Array.isArray(ids))throw new CanonicalError('MIGRATION_METADATA_INVALID','Unknown original collection');
  input[group]=ids.map(id=>{const kind=group==='operations'?'event':group==='sources'?'source':group==='claims'?'claim':group==='duplicate_assessments'?'assessment':'entity';const r=all.find(r=>r.kind===kind&&r.id===id);if(!r?.extensions.alnop?.original)throw new CanonicalError('MIGRATION_RECORD_MISSING','Original record is absent');return clone(r.extensions.alnop.original);});
 }
 const releases=m.release_order.map(id=>{const r=document.releases.find(r=>r.id===id);if(!r?.extensions.alnop?.original)throw new CanonicalError('MIGRATION_RECORD_MISSING','Original release is absent');return clone(r.extensions.alnop.original);});
 if(digest(document.profile)!==m.profile_sha256||digest(releases)!==m.releases_sha256)throw new CanonicalError('MIGRATION_INTEGRITY_MISMATCH','Profile or preserved release metadata was modified');
 if(digest(input)!==m.input_sha256)throw new CanonicalError('MIGRATION_INTEGRITY_MISMATCH','Preserved source content was modified');
 const expected=toTempora(input,document.profile,{releases});
 if(canonicalStringify(expected)!==canonicalStringify(document))throw new CanonicalError('MIGRATION_REVERSE_LOSS','Reverse migration would discard changes; use an explicit reviewed mapping');
 return {corpus:input,releases};
}
module.exports={MIGRATION_VERSION,toTempora,fromTempora};
