const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolveProfile}=require('../src/framework/profile');
const {checkMapping}=require('../src/framework/ingestion-mapping');
const {suggestColumnMappings,compileConfirmedCsvMapping,VERSION}=require('../src/framework/assist-mapping');
const manifest=require('../profiles/synthetic-history/profile.json');
const profile=resolveProfile(manifest);
const headers=['identifiant','nom_operation','date_debut','type_action'];
const bind=(source_column,target_field)=>({source_column,target_field,state:'confirmed_by_user'});
const data=()=>({headers,profile,bindings:[bind('identifiant','id'),bind('nom_operation','title.en'),
  bind('date_debut','start_date'),bind('type_action','event_type')],id:'csv-assistant-demo',version:'1.0.0',delimiter:';'});
const code=x=>e=>e.code===x;

test('M1.2a suggestions are deterministic, explanatory, frozen and never self-confirm',()=>{
 const a=suggestColumnMappings(headers,profile),b=suggestColumnMappings(headers,profile);
 assert.deepEqual(a,b);
 assert.equal(VERSION,'0.1.0');
 assert.equal(a.mapping_confirmed,false);
 assert.deepEqual(a.confirmed_bindings,[]);
 assert.deepEqual(a.suggestions.map(x=>[x.source_column,x.target_field]),[
  ['identifiant','id'],['nom_operation','title.en'],['date_debut','start_date'],
  ['type_action','event_type']]);
 assert.ok(a.suggestions.every(x=>x.state==='suggested'&&x.confidence_kind==='heuristic'));
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.suggestions));
 assert.equal(Object.hasOwn(a,'fields'),false);
});
test('M1.2a compiles only explicit human-confirmed fields to existing ingestion schema 1.0.0',()=>{
 const options=data(),before=structuredClone(options.bindings);
 const output=compileConfirmedCsvMapping(options);
 assert.deepEqual(options.bindings,before);
 assert.deepEqual(output,{
  mapping_schema_version:'1.0.0',id:'csv-assistant-demo',version:'1.0.0',
  profile_id:'synthetic-history',profile_version:'1.0.0',format:'csv',delimiter:';',
  fields:{id:'/identifiant',title:{en:'/nom_operation'},
    start_date:'/date_debut',event_type:'/type_action'}
 });
 assert.deepEqual(checkMapping(output,profile),output);
 assert.equal(Object.hasOwn(output,'list_separator'),false);
 assert.equal(Object.hasOwn(output,'normalization'),false);
});
test('M1.2a localised titles use profile-declared language and escape pointers exactly',()=>{
 const input={headers:['id','title~a/b'],profile,
  bindings:[bind('id','id'),bind('title~a/b','title.es')],
  id:'localized-demo',version:'1.0.0',delimiter:','};
 const out=compileConfirmedCsvMapping(input);
 assert.equal(out.fields.title.es,'/title~0a~1b');
 assert.deepEqual(checkMapping(out,profile),out);
 assert.throws(()=>compileConfirmedCsvMapping({...input,bindings:[
  bind('id','id'),bind('title~a/b','title.fr')]}),code('ASSIST_MAPPING_TARGET'));
});
test('M1.2a disallows implicit confirmation, duplicate sources and duplicate targets',()=>{
 const o=data();
 assert.throws(()=>compileConfirmedCsvMapping({...o,bindings:[
  bind('identifiant','id'),{source_column:'nom_operation',target_field:'title.en',state:'suggested'}]}),
  code('ASSIST_MAPPING_CONFIRMATION_REQUIRED'));
 assert.throws(()=>compileConfirmedCsvMapping({...o,bindings:[
  bind('identifiant','id'),bind('identifiant','title.en')]}),
  code('ASSIST_MAPPING_CONFIRMATION_REQUIRED'));
 assert.throws(()=>compileConfirmedCsvMapping({...o,bindings:[
  bind('identifiant','id'),bind('nom_operation','id')]}),
  code('ASSIST_MAPPING_DUPLICATE_TARGET'));
 assert.throws(()=>compileConfirmedCsvMapping({...o,bindings:[
  bind('identifiant','id'),bind('date_debut','start_date')]}),
  code('ASSIST_MAPPING_REQUIRED_FIELDS'));
});
test('M1.2a forbids prototype and unsafe headers and no matching header stays unmapped',()=>{
 assert.throws(()=>suggestColumnMappings(['id','__proto__'],profile),code('ASSIST_MAPPING_HEADERS'));
 assert.throws(()=>suggestColumnMappings(['id','constructor'],profile),code('ASSIST_MAPPING_HEADERS'));
 assert.throws(()=>suggestColumnMappings(['id','id'],profile),code('ASSIST_MAPPING_HEADERS'));
 assert.throws(()=>suggestColumnMappings(['id','bad\nname'],profile),code('ASSIST_MAPPING_HEADERS'));
 assert.deepEqual(suggestColumnMappings(['unrelated_column'],profile).suggestions,[]);
 assert.throws(()=>compileConfirmedCsvMapping({...data(),delimiter:'|'}),code('ASSIST_MAPPING_METADATA'));
 assert.throws(()=>compileConfirmedCsvMapping({...data(),bindings:[
  bind('identifiant','id'),bind('nonexistent','title.en')]}),
  code('ASSIST_MAPPING_CONFIRMATION_REQUIRED'));
});
test('M1.2a is locale-sensitive and refuses records or undeclared canonical fields',()=>{
 const o=data();
 assert.throws(()=>compileConfirmedCsvMapping({...o,bindings:[
  bind('identifiant','id'),bind('nom_operation','record')]}),
  code('ASSIST_MAPPING_TARGET'));
 assert.throws(()=>compileConfirmedCsvMapping({...o,bindings:[
  bind('identifiant','id'),bind('nom_operation','unknown')]}),
  code('ASSIST_MAPPING_TARGET'));
 const esProfile=resolveProfile({...manifest,default_locale:'es'});
 assert.deepEqual(suggestColumnMappings(['nom','identifiant'],esProfile)
   .suggestions.map(s=>s.target_field),['title.es','id']);
});
