const Ajv=require('ajv/dist/2020'),addFormats=require('ajv-formats');
const ajv=new Ajv({allErrors:true,strict:true});addFormats(ajv);
const validateSchema=ajv.compile(require('../../schemas/tempora.profile.schema.json'));
const RUNTIME_VERSION='3.0.0',reserved=new Set(['__proto__','constructor','prototype']);
class ProfileError extends Error{constructor(code,message,details=[]){super(message);this.name='ProfileError';this.code=code;this.details=details;}}
function fail(code,message,details){throw new ProfileError(code,message,details);}
function safe(value,depth=0){
 if(depth>32)fail('PROFILE_DEPTH','Profile nesting exceeds limit');
 if(['undefined','function','symbol','bigint'].includes(typeof value)||(typeof value==='number'&&!Number.isFinite(value)))fail('PROFILE_VALUE_INVALID','Profile values must be JSON-compatible');
 if(value&&typeof value==='object'){
  if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('PROFILE_VALUE_INVALID','Profile objects must be plain JSON objects');
  for(const key of Object.keys(value)){if(reserved.has(key))fail('PROFILE_UNSAFE_KEY','Reserved configuration key');safe(value[key],depth+1);}
 }
}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function merge(parent,child){const result=structuredClone(parent);for(const [key,value]of Object.entries(child)){result[key]=value&&typeof value==='object'&&!Array.isArray(value)&&result[key]&&typeof result[key]==='object'&&!Array.isArray(result[key])?merge(result[key],value):structuredClone(value);}return result;}
function versionCompare(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]<y[i]?-1:1;return 0;}
function validDay(value){return typeof value==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)&&!value.startsWith('0000-')&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function resolveProfile(manifest,{parent={},parameters={},severities={}}={}){
 for(const value of [manifest,parent,parameters,severities])if(!value||typeof value!=='object'||Array.isArray(value))fail('PROFILE_SCHEMA_INVALID','Profile configuration must be an object');
 if(Object.hasOwn(manifest,'extends')&&!Object.keys(parent).length)fail('PROFILE_PARENT_UNRESOLVED','Parent must be resolved explicitly');
 safe(manifest);safe(parent);safe(parameters);safe(severities);
 const result=merge(parent,manifest);delete result.extends;
 if(!validateSchema(result))fail('PROFILE_SCHEMA_INVALID','Invalid profile manifest',structuredClone(validateSchema.errors));
 const [lower,upper]=result.framework.split(' ').map(v=>v.replace(/^[><=]+/,''));
 if(versionCompare(lower,upper)>=0||versionCompare(RUNTIME_VERSION,lower)<0||versionCompare(RUNTIME_VERSION,upper)>=0)fail('PROFILE_VERSION_INCOMPATIBLE','Profile and runtime versions are incompatible');
 if(!result.locales.includes(result.default_locale))fail('PROFILE_LOCALE_INVALID','Default locale must be declared');
 if(result.time.calendar!=='gregorian')fail('PROFILE_CALENDAR_UNSUPPORTED','Calendar is not supported by this runtime');
 if(result.spatial.crs!=='EPSG:4326')fail('PROFILE_CRS_UNSUPPORTED','Coordinate reference system is not supported');
 const {earliest,latest}=result.time.coverage;
 if([earliest,latest].some(v=>v!==null&&!validDay(v))||(earliest&&latest&&earliest>latest))fail('PROFILE_COVERAGE_INVALID','Invalid temporal coverage');
 const ids=new Set();for(const rule of result.rules){if(ids.has(rule.id))fail('PROFILE_RULE_DUPLICATE','Duplicate rule identifier');ids.add(rule.id);if(rule.field.split('.').some(p=>reserved.has(p)))fail('PROFILE_UNSAFE_FIELD','Reserved field path');if(rule.type==='vocabulary'&&!result.taxonomies.includes(rule.taxonomy))fail('PROFILE_TAXONOMY_MISSING','Rule references an undeclared taxonomy');}
 for(const [id,severity]of Object.entries(severities)){if(!ids.has(id)||!['error','warning','info'].includes(severity))fail('PROFILE_OVERRIDE_INVALID','Invalid severity override');result.rules.find(r=>r.id===id).severity=severity;}
 const aliases=new Map();for(const alias of result.aliases||[]){if(!result.taxonomies.includes(alias.taxonomy)||!result.locales.includes(alias.language)||!alias.value.trim()||!alias.canonical.trim())fail('PROFILE_ALIAS_INVALID','Alias must reference a declared taxonomy and language');const key=JSON.stringify([alias.taxonomy,alias.value]);if(aliases.has(key)&&aliases.get(key)!==alias.canonical)fail('PROFILE_ALIAS_AMBIGUOUS','Alias has conflicting targets');aliases.set(key,alias.canonical);}
 result.parameters=merge(result.parameters||{},parameters);return freeze(result);
}
module.exports={ProfileError,RUNTIME_VERSION,resolveProfile,validDay,freeze};
