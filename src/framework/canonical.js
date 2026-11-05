const crypto=require('node:crypto');
const Ajv=require('ajv/dist/2020'),addFormats=require('ajv-formats');
const {resolveProfile}=require('./profile');
const {createValidator}=require('./validation');
const {temporalErrors}=require('./temporal');
const {geometryErrors}=require('./spatial');
const ajv=new Ajv({allErrors:true,strict:true});addFormats(ajv);
ajv.addSchema(require('../../schemas/tempora.profile.schema.json'));
ajv.addSchema(require('../../schemas/tempora/v3/model.schema.json'));
const schemaNames=['event','source','claim','entity','temporal-expression','spatial-assertion','relation','review','assessment','corpus-release','corpus'];
const validators=Object.fromEntries(schemaNames.map(name=>[name,ajv.compile(require(`../../schemas/tempora/v3/${name}.schema.json`))]));
validators.geometry=ajv.getSchema('urn:tempora:schema:3.0.0:model#/$defs/Geometry');
const collections={events:'event',sources:'source',claims:'claim',entities:'entity',spatial_assertions:'spatial',relations:'relation',reviews:'review',assessments:'assessment',releases:'release'};
class CanonicalError extends Error{constructor(code,message,details=[]){super(message);this.name='CanonicalError';this.code=code;this.details=details;}}
function jsonValue(value,seen=new Set(),depth=0){
 if(depth>128)throw new CanonicalError('CANONICAL_JSON_INVALID','JSON nesting is too deep');
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'&&Number.isFinite(value))return;
 if(typeof value!=='object'||seen.has(value)||(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value))))throw new CanonicalError('CANONICAL_JSON_INVALID','Expected finite, acyclic JSON data');
 if(Array.isArray(value)&&(Object.keys(value).length!==value.length||Object.keys(value).some((k,i)=>k!==String(i))))throw new CanonicalError('CANONICAL_JSON_INVALID','Sparse or decorated arrays are not JSON data');
 for(const key of Reflect.ownKeys(value)){if(Array.isArray(value)&&key==='length')continue;const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))throw new CanonicalError('CANONICAL_JSON_INVALID','JSON data cannot contain symbols, accessors or hidden fields');}
 seen.add(value);for(const k of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(k))throw new CanonicalError('CANONICAL_JSON_INVALID','Reserved JSON key');jsonValue(value[k],seen,depth+1);}seen.delete(value);
}
function canonicalStringify(value){jsonValue(value);const order=v=>Array.isArray(v)?v.map(order):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,order(v[k])])):v;return JSON.stringify(order(value));}
const digest=value=>crypto.createHash('sha256').update(canonicalStringify(value)).digest('hex');
const identity=r=>JSON.stringify([r.kind,r.namespace,r.id]);
function validateObject(type,value){
 try{jsonValue(value);}catch(e){return {valid:false,errors:[{code:e.code,message:e.message}]};}
 const check=validators[type];if(!check)throw new CanonicalError('CANONICAL_SCHEMA_UNKNOWN','Unknown schema');
 const errors=[];if(!check(value))errors.push(...structuredClone(check.errors).map(e=>({code:'CANONICAL_SCHEMA_INVALID',path:e.instancePath,message:e.message})));
 if(!errors.length&&type!=='corpus'&&type!=='temporal-expression'){for(const key of ['start_date','end_date','valid_from','valid_to'])if(value?.[key])for(const message of temporalErrors(value[key]))errors.push({code:'CANONICAL_TIME_INVALID',path:key,message});}
 if(!errors.length&&type==='temporal-expression')for(const message of temporalErrors(value))errors.push({code:'CANONICAL_TIME_INVALID',message});
 if(!errors.length&&(type==='spatial-assertion'||type==='geometry'))for(const message of geometryErrors(type==='geometry'?value:value.geometry))errors.push({code:'CANONICAL_GEOMETRY_INVALID',message});
 return {valid:errors.length===0,errors};
}
function validateCorpus(corpus){
 const result=validateObject('corpus',corpus),errors=result.errors,warnings=[];
 if(errors.length)return {...result,warnings,scope:'technical_validation'};
 const add=(code,record,message)=>errors.push({code,id:record?.id||null,message});
 let profile;try{profile=resolveProfile(corpus.profile);}catch(e){add(e.code||'CANONICAL_PROFILE_INVALID',null,e.message);return {valid:false,errors,warnings,scope:'technical_validation'};}
 let rules;try{rules=createValidator(profile,{taxonomies:corpus.taxonomies});}catch(e){add(e.code||'CANONICAL_TAXONOMY_INVALID',null,e.message);return {valid:false,errors,warnings,scope:'technical_validation'};}
 const records=Object.keys(collections).flatMap(k=>corpus[k]),lookup=new Map(),unique=new Set();
 for(const r of records){
  const key=JSON.stringify([r.namespace,r.id]);if(unique.has(key))add('CANONICAL_DUPLICATE_ID',r,'ID already exists in this namespace');unique.add(key);lookup.set(identity(r),r);
  if(r.namespace!==profile.namespace)add('CANONICAL_NAMESPACE_MISMATCH',r,'Record belongs to another profile namespace');
 }
 const checkRef=(ref,owner,expected)=>{
  if(expected&&!expected.includes(ref.kind))add('CANONICAL_REFERENCE_KIND',owner,'Unexpected reference kind');
  const target=lookup.get(identity(ref));if(!target)add('CANONICAL_REFERENCE_MISSING',owner,`Missing ${ref.kind}: ${ref.id}`);
  else if(owner.editorial_status==='published'&&['proposed','under_review','withdrawn'].includes(target.editorial_status))add('CANONICAL_UNPUBLISHED_REFERENCE',owner,'Published record references unpublished data');
  return target;
 };
 const evidence=(list,owner)=>{for(const e of list)checkRef(e.source,owner,['source']);};
 const time=(t,r)=>{for(const message of temporalErrors(t))add('CANONICAL_TIME_INVALID',r,message);};
 for(const r of records){
  evidence(r.provenance.evidence,r);
  for(const ref of r.review_refs||[]){const review=checkRef(ref,r,['review']);if(review&&identity(review.subject)!==identity(r))add('CANONICAL_REVIEW_SUBJECT',r,'Review belongs to another subject');}
  if(r.kind==='event'){const checked=rules.validate({...r,territory_ids:r.territory_refs.map(t=>t.id)});for(const d of checked.diagnostics)(d.severity==='error'?errors:warnings).push({...d,id:r.id});}
  if(r.start_date){time(r.start_date,r);time(r.end_date,r);if(r.start_date.earliest&&r.end_date.latest&&r.start_date.earliest>r.end_date.latest)add('CANONICAL_TIME_INVALID',r,'Event ends before its start');}
  if(r.valid_from){time(r.valid_from,r);time(r.valid_to,r);if(r.valid_from.earliest&&r.valid_to.latest&&r.valid_from.earliest>r.valid_to.latest)add('CANONICAL_TIME_INVALID',r,'Inverted historical validity');}
  for(const name of r.names||[]){time(name.valid_from,r);time(name.valid_to,r);evidence(name.evidence,r);if(name.valid_from.earliest&&name.valid_to.latest&&name.valid_from.earliest>name.valid_to.latest)add('CANONICAL_TIME_INVALID',r,'Inverted name validity');}
  for(const ref of r.spatial_refs||[]) {const spatial=checkRef(ref,r,['spatial']);if(spatial&&identity(spatial.subject)!==identity(r))add('CANONICAL_SPATIAL_SUBJECT',r,'Spatial assertion belongs to another subject');}
  for(const ref of r.territory_refs||[]){const territory=checkRef(ref,r,['entity']);if(territory&&territory.entity_type!=='territory')add('CANONICAL_TERRITORY_TYPE',r,'Territory reference must identify a territory entity');}
  for(const ref of r.participant_refs||[])checkRef(ref,r,['entity']);
  if(r.context){time(r.context.start_date,r);time(r.context.end_date,r);if(r.context.start_date.earliest&&r.context.end_date.latest&&r.context.start_date.earliest>r.context.end_date.latest)add('CANONICAL_TIME_INVALID',r,'Inverted claim context');}
  if(r.subject)checkRef(r.subject,r);
  if(r.object)checkRef(r.object,r);
  if(r.place){const place=checkRef(r.place,r,['entity']);if(place&&place.entity_type!=='place')add('CANONICAL_PLACE_TYPE',r,'Place reference must identify a place entity');}
  for(const ref of r.subjects||[])checkRef(ref,r);
  for(const ref of r.contradicts||[]){const target=checkRef(ref,r,['claim']);if(target&&(identity(target)===identity(r)||identity(target.subject)!==identity(r.subject)||target.predicate!==r.predicate||target.assertion_status!=='contested'||r.assertion_status!=='contested'))add('CANONICAL_CONTRADICTION_INVALID',r,'Contradiction requires distinct contested assertions on the same subject and predicate');}
  if(r.kind==='claim'&&r.value&&typeof r.value==='object'&&r.value.type==='interval'&&(!Number.isFinite(r.value.lower)||!Number.isFinite(r.value.upper)||r.value.lower>r.value.upper))add('CANONICAL_VALUE_INVALID',r,'Inverted or invalid numeric interval');
  if(r.kind==='source'&&r.url!==null){try{if(!['https:','http:'].includes(new URL(r.url).protocol))throw Error();}catch{add('CANONICAL_SOURCE_URL_INVALID',r,'Unsupported source URL');}}
  if(r.kind==='spatial'){
   for(const message of geometryErrors(r.geometry))add('CANONICAL_GEOMETRY_INVALID',r,message);
   if((r.geometry===null)!==(r.geometry_role==='unknown'))add('CANONICAL_GEOMETRY_ROLE',r,'Geometry and declared role disagree');
  }
  if(r.editorial_status==='published'&&r.kind==='event'&&!r.review_refs.length)warnings.push({code:'NO_RECORDED_REVIEW',id:r.id,message:'Existing publication does not imply scientific approval'});
 }
 return {valid:errors.length===0,errors,warnings,scope:'technical_validation'};
}
function assertCorpus(corpus){const result=validateCorpus(corpus);if(!result.valid)throw new CanonicalError('CANONICAL_INVALID','Invalid TEMPORA corpus',result.errors);return result;}
module.exports={CanonicalError,collections,identity,canonicalStringify,digest,validateObject,validateCorpus,assertCorpus};
