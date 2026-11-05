const {resolveProfile,ProfileError,validDay}=require('./profile');
function createValidator(manifest,{taxonomies={}}={}){
 const profile=resolveProfile(manifest),vocabularies=new Map();
 for(const name of profile.taxonomies){if(!Array.isArray(taxonomies[name])||taxonomies[name].some(v=>typeof v!=='string'))throw new ProfileError('PROFILE_BINDING_MISSING','A declared taxonomy has no valid binding');vocabularies.set(name,new Set(taxonomies[name]));}
 for(const alias of profile.aliases||[])if(!vocabularies.get(alias.taxonomy).has(alias.canonical))throw new ProfileError('PROFILE_ALIAS_TARGET_MISSING','Alias target is absent from its bound taxonomy');
 const get=(event,field)=>field.split('.').reduce((value,key)=>value&&typeof value==='object'&&Object.hasOwn(value,key)?value[key]:undefined,event);
 return Object.freeze({profile,validate(event){
  const diagnostics=[];if(!event||typeof event!=='object'||Array.isArray(event))return {valid:false,profile_id:profile.id,profile_version:profile.version,diagnostics:[{code:'EVENT_TYPE_INVALID',severity:'error',field:null,rule_id:null}]};
  const add=(rule,code)=>diagnostics.push({code,severity:rule.severity,field:rule.field,rule_id:rule.id});
  for(const rule of profile.rules){if(rule.enabled===false)continue;const value=get(event,rule.field);
   if(rule.type==='required'){if(value===undefined||value===null||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&!value.length))add(rule,'FIELD_REQUIRED');}
   if(rule.type==='date_range'&&value!==undefined&&value!==null){
    if(typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(value,'earliest')||!Object.hasOwn(value,'latest')){add(rule,'DATE_INTERVAL_INVALID');continue;}
    const bounds=[value.earliest,value.latest];if(bounds.some(v=>v!==null&&!validDay(v))||(value.earliest&&value.latest&&value.earliest>value.latest)){add(rule,'DATE_INTERVAL_INVALID');continue;}
    const window=profile.time.coverage;if(bounds.some(v=>v&&((window.earliest&&v<window.earliest)||(window.latest&&v>window.latest))))add(rule,'DATE_OUTSIDE_PROFILE');
   }
   if(rule.type==='vocabulary'&&value!==undefined&&value!==null){const values=Array.isArray(value)?value:[value];const allowed=vocabularies.get(rule.taxonomy);if(values.some(v=>typeof v!=='string'||(!allowed.has(v)&&!(profile.aliases||[]).some(a=>a.taxonomy===rule.taxonomy&&a.value===v&&allowed.has(a.canonical)))))add(rule,'VOCABULARY_UNKNOWN');}
  }
  return {valid:!diagnostics.some(d=>d.severity==='error'),profile_id:profile.id,profile_version:profile.version,diagnostics};
 }});
}
function defineAdapter(adapter){if(!adapter||typeof adapter.id!=='string'||!adapter.id.trim()||!Array.isArray(adapter.formats)||!adapter.formats.length||adapter.formats.some(f=>typeof f!=='string'||!f.trim())||typeof adapter.parse!=='function'||typeof adapter.serialize!=='function')throw new ProfileError('ADAPTER_CONTRACT_INVALID','Adapter requires id, formats, parse and serialize');return Object.freeze({...adapter,formats:Object.freeze([...adapter.formats])});}
module.exports={createValidator,defineAdapter};
