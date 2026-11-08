'use strict';
// TEMPORA Assistant M1.2a — private, deterministic mapping suggestions and explicit
// confirmation-to-legacy-CSV compiler. Pure: no I/O, clocks, imports or inference.
const VERSION='0.1.0';
const RESERVED=new Set(['__proto__','prototype','constructor']);
const TARGETS=Object.freeze([
  'id','title','description','start_date','end_date','event_type',
  'source_ids','territory_ids','longitude','latitude','geometry_role',
  'location_label','precision_meters'
]);
const SYNONYMS=Object.freeze({
  id:['id','identifiant','identifier','event_id','identifiant_evenement','identifiant_operation'],
  title:['title','titre','name','nom','nom_operation','nom_evenement'],
  description:['description','details','resume','summary','commentaire'],
  start_date:['start_date','date_debut','date','date_operation','date_evenement','debut'],
  end_date:['end_date','date_fin','fin'],
  event_type:['event_type','type','type_action','type_evenement','categorie'],
  source_ids:['source_ids','sources','ids_sources'],
  territory_ids:['territory_ids','territoires','territoire_ids'],
  longitude:['longitude','lon','lng'],
  latitude:['latitude','lat'],
  geometry_role:['geometry_role','role_geometrie'],
  location_label:['location_label','lieu','localisation','place_name'],
  precision_meters:['precision_meters','precision_metres']
});
function fail(code){const e=new Error(code);e.code=code;throw e;}
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);}
function normalized(s){return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()
  .replace(/[\s-]+/g,'_');}
function checkHeaders(headers){
  if(!Array.isArray(headers)||headers.length<1||headers.length>512)
    fail('ASSIST_MAPPING_HEADERS');
  const seen=new Set();
  for(const h of headers){
    if(typeof h!=='string'||!h||h.length>256||/[\x00-\x1f]/.test(h)||RESERVED.has(h)||
       RESERVED.has(normalized(h))||seen.has(h))fail('ASSIST_MAPPING_HEADERS');
    seen.add(h);
  }
}
function checkProfile(profile){
  if(!plain(profile)||typeof profile.id!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(profile.id)||
     typeof profile.version!=='string'||!/^\d+\.\d+\.\d+$/.test(profile.version)||
     !Array.isArray(profile.locales)||profile.locales.length<1||
     profile.locales.some(x=>typeof x!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(x))||
     !profile.locales.includes(profile.default_locale))fail('ASSIST_MAPPING_PROFILE');
}
function targetParts(field,profile){
  if(typeof field!=='string')fail('ASSIST_MAPPING_TARGET');
  if(['title','description','location_label'].some(x=>field.startsWith(x+'.'))){
    const [base,...tail]=field.split('.');
    const locale=tail.join('.');
    if(!profile.locales.includes(locale)||tail.length!==1)fail('ASSIST_MAPPING_TARGET');
    return {base,locale};
  }
  if(!TARGETS.includes(field)||['title','description','location_label'].includes(field))
    fail('ASSIST_MAPPING_TARGET');
  return {base:field};
}
function suggestColumnMappings(headers,profile){
  checkHeaders(headers);checkProfile(profile);
  const suggestions=[];
  for(const source_column of headers){
    const key=normalized(source_column);
    if(!key)continue;
    for(const base of TARGETS){
      if(!SYNONYMS[base].includes(key))continue;
      const target_field=['title','description','location_label'].includes(base)
        ?base+'.'+profile.default_locale:base;
      suggestions.push(Object.freeze({
        source_column,target_field,algorithm_id:'header-exact-synonyms',
        algorithm_version:VERSION,reason_codes:Object.freeze(['EXACT_NORMALIZED_HEADER']),
        confidence_kind:'heuristic',state:'suggested'
      }));
    }
  }
  return Object.freeze({
    assistant_mapping_schema_version:VERSION,profile_id:profile.id,profile_version:profile.version,
    source_columns:Object.freeze([...headers]),confirmed_bindings:Object.freeze([]),
    suggestions:Object.freeze(suggestions),mapping_confirmed:false
  });
}
function pointer(column){return '/'+column.replace(/~/g,'~0').replace(/\//g,'~1');}
function compileConfirmedCsvMapping({headers,profile,bindings,id,version,delimiter}){
  checkHeaders(headers);checkProfile(profile);
  if(typeof id!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(id)||
     typeof version!=='string'||!/^\d+\.\d+\.\d+$/.test(version)||
     ![',',';','\t'].includes(delimiter))fail('ASSIST_MAPPING_METADATA');
  if(!Array.isArray(bindings)||bindings.length<2||bindings.length>headers.length)
    fail('ASSIST_MAPPING_CONFIRMATION_REQUIRED');
  const columns=new Set(headers),usedColumns=new Set(),usedTargets=new Set(),fields={};
  for(const binding of bindings){
    if(!plain(binding)||Object.keys(binding).some(k=>!['source_column','target_field','state'].includes(k))||
       binding.state!=='confirmed_by_user'||!columns.has(binding.source_column)||
       usedColumns.has(binding.source_column))fail('ASSIST_MAPPING_CONFIRMATION_REQUIRED');
    const target=targetParts(binding.target_field,profile);
    if(usedTargets.has(binding.target_field))fail('ASSIST_MAPPING_DUPLICATE_TARGET');
    usedColumns.add(binding.source_column);usedTargets.add(binding.target_field);
    if(target.locale){
      fields[target.base]??={};
      fields[target.base][target.locale]=pointer(binding.source_column);
    }else fields[target.base]=pointer(binding.source_column);
  }
  if(!fields.id||!fields.title||Object.keys(fields.title).length<1)
    fail('ASSIST_MAPPING_REQUIRED_FIELDS');
  // Return exactly ingestion mapping 1.0.0; no assistant-only properties leak.
  return {
    mapping_schema_version:'1.0.0',id,version,profile_id:profile.id,profile_version:profile.version,
    format:'csv',delimiter,fields
  };
}
module.exports=Object.freeze({VERSION,suggestColumnMappings,compileConfirmedCsvMapping});
