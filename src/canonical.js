const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const {groups,validateEntities}=require('./entities');
const {approved}=require('./review');
const {validateAssessments}=require('./duplicate-assessments');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value, null, 2) + '\n';
const root = path.join(__dirname, '..');
const ajv = new Ajv({allErrors:true, strict:true});
addFormats(ajv);
const validateSchema = ajv.compile(require('../schemas/operation.schema.json'));
const validateClaim = ajv.compile(require('../schemas/claim.schema.json'));
const validateAssessment=ajv.compile(require('../schemas/duplicate-assessment.schema.json'));
const validateEntity = ajv.compile(require('../schemas/entity.schema.json'));
const validateSource = ajv.compile(require('../schemas/source.schema.json'));
const validateTerritory = ajv.compile(require('../schemas/territorial-unit.schema.json'));
const validateDataset = ajv.compile(require('../schemas/dataset.schema.json'));
const validateVocabulary = ajv.compile(require('../schemas/vocabularies.schema.json'));

function dateBounds(raw) {
  if (!raw) return {earliest:null,latest:null,precision:'unknown',certainty:'unknown'};
  if (!/^\d{4}(-\d{2}){0,2}$/.test(raw)) throw new Error(`Invalid legacy date: ${raw}`);
  const parts=raw.split('-');
  const [y,m,d] = parts.map(Number);
  if((parts.length>=2 && (m<1||m>12)) || (parts.length===3 && (d<1||d>31)))throw new Error(`Invalid date: ${raw}`);
  const precision = d ? 'day' : m ? 'month' : 'year';
  const first = `${y}-${String(m || 1).padStart(2,'0')}-${String(d || 1).padStart(2,'0')}`;
  const lastDay = new Date(Date.UTC(y,m || 12,0)).getUTCDate();
  const last = d ? first : `${y}-${String(m || 12).padStart(2,'0')}-${lastDay}`;
  if (new Date(first).toISOString().slice(0,10) !== first) throw new Error(`Invalid date: ${raw}`);
  return {earliest:first,latest:last,precision,certainty:'unknown'};
}
function migrate(document, sourceCommit) {
  const sources = new Map();
  const seen = new Set();
  const operations = document.operations.map(op => {
    if (!/^[A-Za-z0-9_-]+$/.test(op.id) || seen.has(op.id)) throw new Error(`Unsafe or duplicate ID: ${op.id}`);
    seen.add(op.id);
    const source_ids = (op.sources || []).map(source => {
      // Exact objects only: no bibliographical identity inferred from similar URLs/names.
      const source_id = `SRC_${hash(JSON.stringify(source)).slice(0,24)}`;
      sources.set(source_id,{source_id,title:source.titre || null,legacy:source,review_status:'needs_review'});
      return source_id;
    });
    const coords = op.localisation?.coordonnees_approximatives;
    const geometry = coords?.longitude != null && coords?.latitude != null
      ? {type:'Point',coordinates:[coords.longitude,coords.latitude]} : null;
    return {id:op.id,schema_version:'2.0.0',title:{fr:op.nom_operation,ar:null},
      start_date:dateBounds(op.date_debut),end_date:dateBounds(op.date_fin),
      locations:[{label:op.localisation?.region_ou_ville || null,geometry,
        geometry_role:geometry ? 'representative_point' : 'unknown',review_status:'needs_review'}],
      territorial_assignments:[], legacy_territorial_label:op.wilaya_concernee || null,
      source_ids:[...new Set(source_ids)], editorial_status:'published',
      quality_flags:['legacy_import_needs_review','territorial_assignment_needs_review',
        ...(geometry ? ['representative_location_needs_review'] : ['uncertain_location']),
        ...(source_ids.length ? [] : ['missing_source'])],
      provenance:{source_commit:sourceCommit,publication_basis:'previously_public_legacy_corpus',
        human_review_recorded:false},legacy:op};
  });
  const territorial_units=require('../api/v1/data-service').WILAYAS.map(w=>({id:w.id,names:{fr:w.label_fr,ar:w.label_ar},
    type:'editorial_category',valid_from:null,valid_to:null,source_ids:[],review_status:'needs_review'})).sort((a,b)=>a.id.localeCompare(b.id));
  return {operations,sources:[...sources.values()].sort((a,b)=>a.source_id.localeCompare(b.source_id)),territorial_units,
    vocabularies:{event_types:[...new Set(document.operations.map(op=>op.type_action))].sort()},
    metadata:{schema_version:'2.0.0',source_commit:sourceCommit,dataset_metadata:document.dataset_metadata,
      legacy_order:document.operations.map(op=>op.id)}};
}
function validateCorpus(corpus) {
  const errors=[], warnings=[], ids=new Set(), sourceIds=new Set(),territoryIds=new Set();
  if(!validateDataset(corpus.metadata))errors.push(`Dataset metadata: ${ajv.errorsText(validateDataset.errors)}`);
  if(!validateVocabulary(corpus.vocabularies))errors.push(`Vocabularies: ${ajv.errorsText(validateVocabulary.errors)}`);
  for (const s of corpus.sources) {
    if (!validateSource(s)) {errors.push(`Source ${s?.source_id}: ${ajv.errorsText(validateSource.errors)}`);continue;}
    if (!s.source_id || sourceIds.has(s.source_id)) errors.push(`Duplicate/missing source: ${s.source_id}`);
    sourceIds.add(s.source_id);
    if(['primary','secondary'].includes(s.source_classification)&&(s.review_status!=='reviewed'||!approved(s)))errors.push(`${s.source_id}: source classification requires a content-bound approved review`);
    const url=s.url||s.legacy?.url;
    if(url){try{if(!['http:','https:'].includes(new URL(url).protocol))errors.push(`${s.source_id}: unsafe source URL`);}catch{errors.push(`${s.source_id}: invalid source URL`);}}
  }
  for(const t of corpus.territorial_units||[]){
    if(!validateTerritory(t)){errors.push(`Territory ${t?.id}: ${ajv.errorsText(validateTerritory.errors)}`);continue;}
    if(territoryIds.has(t.id))errors.push(`Duplicate territory: ${t.id}`);territoryIds.add(t.id);
    for(const id of t.source_ids||[])if(!sourceIds.has(id))errors.push(`${t.id}: missing source ${id}`);
    if(t.valid_from && t.valid_to && t.valid_from>t.valid_to)errors.push(`${t.id}: inverted validity`);
  }
  const entities=validateEntities(corpus,validateEntity,sourceIds,errors);
  for (const op of corpus.operations) {
    if (!validateSchema(op)) {
      errors.push(`${op?.id}: ${ajv.errorsText(validateSchema.errors)}`);
      continue;
    }
    if (ids.has(op.id)) errors.push(`Duplicate operation: ${op.id}`);
    ids.add(op.id);
    if(op.legacy && op.legacy.id!==op.id)errors.push(`${op.id}: legacy identity mismatch`);
    for (const id of op.source_ids || []) if (!sourceIds.has(id)) errors.push(`${op.id}: missing source ${id}`);
    for(const alias of op.aliases||[]){if(!alias.value.trim())errors.push(`${op.id}: empty alias`);for(const id of alias.source_ids)if(!op.source_ids.includes(id))errors.push(`${op.id}: alias evidence not among operation sources`);}
    for(const t of op.territorial_assignments){
      if(!territoryIds.has(t.territory_id))errors.push(`${op.id}: unknown territory ${t.territory_id}`);
      for(const id of t.source_ids)if(!op.source_ids.includes(id))errors.push(`${op.id}: territorial evidence not among operation sources`);
    }
    if(op.territorial_assignments.filter(t=>t.role==='primary').length>1)errors.push(`${op.id}: multiple primary territories`);
    if(op.provenance.publication_basis==='previously_public_legacy_corpus'){
      if(op.participants?.length||op.aliases?.length||op.locations.some(l=>l.place_id))errors.push(`${op.id}: entity links and aliases require a reviewed revision`);
      try{
        const expected=migrate({dataset_metadata:{},operations:[op.legacy]},op.provenance.source_commit).operations[0];
        for(const key of ['title','start_date','end_date','locations','territorial_assignments','source_ids','legacy_territorial_label'])
          if(JSON.stringify(op[key])!==JSON.stringify(expected[key]))errors.push(`${op.id}: ${key} changed without a reviewed revision`);
      }catch{errors.push(`${op.id}: invalid legacy evidence`);}
      if(op.provenance.human_review_recorded)errors.push(`${op.id}: legacy import cannot claim a new review`);
    }else{
      for(const type of op.event_type)if(!Array.isArray(corpus.vocabularies?.event_types)||!corpus.vocabularies.event_types.includes(type))errors.push(`${op.id}: unknown event type ${type}`);
      if(op.editorial_status==='published' && (!op.provenance.human_review_recorded ||
          op.review_history.at(-1)?.decision!=='approved' || !op.source_ids.length))
        errors.push(`${op.id}: publication requires sources and an explicit approved review`);
      if(op.editorial_status==='published'&&!op.event_type.length)errors.push(`${op.id}: publication requires an event type from the controlled vocabulary`);
      if(op.editorial_status==='published'&&(!op.title.fr?.trim()||!op.description.fr?.trim()))errors.push(`${op.id}: publication through v1 requires reviewed French title and description`);
      if(op.editorial_status==='published')for(const id of op.source_ids){
        const source=corpus.sources.find(s=>s?.source_id===id);
        if(!source?.title?.trim())errors.push(`${op.id}: source ${id} needs a bibliographic title before publication`);
      }
      if(op.created_at>op.updated_at)errors.push(`${op.id}: inverted editorial timestamps`);
    }
    if (op.start_date?.earliest && op.end_date?.latest && op.start_date.earliest > op.end_date.latest)
      errors.push(`${op.id}: inverted dates`);
    for (const date of [op.start_date,op.end_date]) {
      if ((date.earliest===null)!==(date.latest===null) ||
          (date.earliest && date.latest && date.earliest>date.latest) ||
          (date.precision==='unknown' && (date.earliest!==null || date.latest!==null)))
        errors.push(`${op.id}: inconsistent date bounds`);
      if(date.precision!=='unknown' && !date.earliest)errors.push(`${op.id}: missing date bounds`);
      if(date.earliest && ['year','month','day'].includes(date.precision)){
        const raw=date.earliest.slice(0,date.precision==='year'?4:date.precision==='month'?7:10);
        const expected=dateBounds(raw);
        if(expected.earliest!==date.earliest || expected.latest!==date.latest)errors.push(`${op.id}: bounds disagree with date precision`);
      }
    }
    for (const location of op.locations || []) {
      const c=location.geometry?.coordinates;
      if((!c && location.geometry_role!=='unknown')||(c && location.geometry_role==='unknown'))errors.push(`${op.id}: geometry and role disagree`);
      if (c && (c.length!==2 || !c.every(Number.isFinite) || Math.abs(c[0])>180 || Math.abs(c[1])>90))
        errors.push(`${op.id}: invalid WGS84 coordinates`);
    }
    for(const link of [...(op.participants||[]),...op.locations.filter(l=>l.place_id)]){
      const id=link.entity_id||link.place_id,entity=entities.get(id);
      if(!entity)errors.push(`${op.id}: missing entity ${id}`);
      if(op.editorial_status==='published'&&entity?.editorial_status!=='published')errors.push(`${op.id}: published operation references a draft entity`);
      if(!link.source_ids?.length)errors.push(`${op.id}: entity link requires evidence`);
      for(const source of link.source_ids||[])if(!op.source_ids.includes(source))errors.push(`${op.id}: link evidence not among operation sources`);
    }
    for (const flag of op.quality_flags || []) warnings.push({id:op.id,code:flag});
  }
  const claims=new Map();
  for(const claim of corpus.claims||[]){
    if(!validateClaim(claim)){errors.push(`Claim ${claim?.id}: ${ajv.errorsText(validateClaim.errors)}`);continue;}
    if(claims.has(claim.id))errors.push(`Duplicate claim: ${claim.id}`);
    claims.set(claim.id,claim);
    if(!ids.has(claim.subject))errors.push(`${claim.id}: missing subject ${claim.subject}`);
    if(!claim.predicate.trim())errors.push(`${claim.id}: empty predicate`);
    if(claim.value?.type==='interval'&&claim.value.lower>claim.value.upper)errors.push(`${claim.id}: inverted value interval`);
    if(claim.context){const c=claim.context;
      if(!c.scope.trim()||!c.population.trim())errors.push(`${claim.id}: empty assertion context`);
      if(c.time_scope==='specific_period'&&(!c.valid_from||!c.valid_to||c.valid_from>c.valid_to))errors.push(`${claim.id}: invalid context period`);
      if(c.time_scope!=='specific_period'&&(c.valid_from!==null||c.valid_to!==null))errors.push(`${claim.id}: context dates disagree with time scope`);
    }
    if(claim.value && typeof claim.value==='object' && claim.value.type!=='interval'&&! [claim.value.fr,claim.value.ar].some(v=>v?.trim()))errors.push(`${claim.id}: missing assertion text`);
    if(Date.parse(claim.created_at)>Date.parse(claim.updated_at))errors.push(`${claim.id}: inverted editorial timestamps`);
    for(const e of claim.evidence){
      if(!sourceIds.has(e.source_id))errors.push(`${claim.id}: missing source ${e.source_id}`);
      if(!e.locator.trim())errors.push(`${claim.id}: empty evidence locator`);
    }
    if(claim.editorial_status==='published'){
      const op=corpus.operations.find(o=>o.id===claim.subject);
      if(op?.editorial_status!=='published')errors.push(`${claim.id}: publication requires a published subject`);
      if(claim.review_history.at(-1)?.decision!=='approved')errors.push(`${claim.id}: publication requires an explicit approved review`);
      if(!claim.evidence.length)errors.push(`${claim.id}: publication requires precise evidence`);
      for(const e of claim.evidence)if(!corpus.sources.find(s=>s.source_id===e.source_id)?.title?.trim())errors.push(`${claim.id}: evidence requires a bibliographic title`);
      if(claim.status==='withdrawn')errors.push(`${claim.id}: withdrawn assertions cannot be published`);
      for(const review of claim.review_history){
        try{if(!['http:','https:'].includes(new URL(review.reference).protocol))throw Error();}
        catch{errors.push(`${claim.id}: unsafe review reference`);}
        if(!review.reviewer.trim()||!review.reason.trim())errors.push(`${claim.id}: incomplete review`);
        if(Date.parse(review.reviewed_at)<Date.parse(claim.created_at)||Date.parse(review.reviewed_at)>Date.parse(claim.updated_at))errors.push(`${claim.id}: review outside editorial timestamps`);
      }
    }
    if(claim.status==='unverified')warnings.push({id:claim.subject,claim_id:claim.id,code:'unverified_assertion'});
  }
  for(const claim of claims.values())for(const id of claim.contradicts){
    const other=claims.get(id);
    if(!other){errors.push(`${claim.id}: missing contradicted claim ${id}`);continue;}
    if(id===claim.id)errors.push(`${claim.id}: self contradiction`);
    if(other.subject!==claim.subject||other.predicate!==claim.predicate)errors.push(`${claim.id}: contradiction requires the same subject and predicate`);
    if(claim.status!=='contested'||other.status!=='contested')errors.push(`${claim.id}: contradiction endpoints must be contested`);
    if(claim.editorial_status==='published'&&other.editorial_status!=='published')errors.push(`${claim.id}: public contradiction points to an unpublished assertion`);
  }
  validateAssessments(corpus,validateAssessment,errors,warnings);
  // Historical imported records have no invented retrospective approval.
  // Once a content-bound review exists, every build verifies it as well as Git CI.
  for(const record of [...corpus.operations,...(corpus.claims||[]),...Object.keys(groups).flatMap(g=>corpus[g]||[]),...corpus.sources,...(corpus.territorial_units||[])]){
    if((record?.editorial_status==='published'||record?.review_status==='reviewed')&&record?.review_history?.at(-1)?.content_sha256 && !approved(record))errors.push(`${record.id||record.source_id}: content changed after the recorded review`);
  }
  return {errors,warnings};
}
function restoreLegacy(corpus) {
  const byId = new Map(corpus.operations.map(op=>[op.id,op]));
  return {dataset_metadata:corpus.metadata.dataset_metadata,
    operations:corpus.metadata.legacy_order.map(id=>{
      if (!byId.has(id)) throw new Error(`Missing original ID: ${id}`);
      return byId.get(id).legacy;
    })};
}
function readCorpus(directory=path.join(root,'data')) {
  const read = name => JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
  const entries = (name,key='id') => (['claims','duplicate-assessments',...Object.keys(groups)].includes(name)&&!fs.existsSync(path.join(directory,name))?[]:fs.readdirSync(path.join(directory,name))).filter(n=>n.endsWith('.json')).sort()
    .map(n=>{const value=read(path.join(name,n));if(value[key]!==n.slice(0,-5))throw new Error(`Filename must equal ${key}: ${name}/${n}`);return value;});
  return {metadata:read('dataset.json'),operations:entries('operations'),sources:entries('sources','source_id'),
    territorial_units:entries('territorial-units'),vocabularies:read('vocabularies.json'),claims:entries('claims'),duplicate_assessments:entries('duplicate-assessments'),
    ...Object.fromEntries(Object.keys(groups).map(g=>[g,entries(g)]))};
}
module.exports = {migrate,dateBounds,validateCorpus,restoreLegacy,readCorpus,stable,hash,root};
