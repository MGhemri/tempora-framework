import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {
  ProjectionError,ref,refKey,refs,selection,diagnostics,projection
}=require('../../bridge/visualization/contracts.cjs');

const empty={evidence:[],transformations:[]};
const profile={
  profile_schema_version:'1.0.0',version:'1.0.0',id:'synthetic-history',
  display_name:'Synthetic history — testing only',namespace:'SYNTHETIC_HISTORY',
  framework:'>=3.0.0 <4.0.0',default_locale:'en',locales:['en','es'],
  time:{calendar:'gregorian',coverage:{earliest:'1600-01-01',latest:'1899-12-31'}},
  spatial:{crs:'EPSG:4326'},taxonomies:['event_types'],
  aliases:[{taxonomy:'event_types',language:'es',value:'reunión ficticia',canonical:'fictional assembly'}],
  parameters:{coverage:{from_year:1600,to_year:1899}},
  rules:[
    {id:'event-id',type:'required',field:'id',severity:'error'},
    {id:'date-window',type:'date_range',field:'start_date',severity:'error'},
    {id:'event-type',type:'vocabulary',field:'event_type',taxonomy:'event_types',severity:'warning'}
  ],exports:['json','csv']
};
const date={
  kind:'exact',calendar:'gregorian',original:'1784-06-12',
  earliest:'1784-06-12',latest:'1784-06-12',precision:'day',certainty:'documented'
};
const valid= {
  schema_version:'3.0.0',profile,
  events:[{
    schema_version:'3.0.0',id:'EVENT_001',namespace:'SYNTHETIC_HISTORY',
    editorial_status:'proposed',provenance:empty,extensions:{},kind:'event',
    title:{en:'Fictional scientific assembly'},
    description:{en:'Invented historical event solely for tests'},
    start_date:date,end_date:date,event_type:['fictional assembly'],
    spatial_refs:[],territory_refs:[],participant_refs:[],review_refs:[]
  }],sources:[],claims:[],entities:[],spatial_assertions:[],relations:[],
  reviews:[],assessments:[],releases:[],extensions:{},
  taxonomies:{event_types:['fictional assembly']}
};
const meta={
  corpus:valid,algorithm:{id:'tvrw.synthetic-list',version:'1.0.0',parameters:{limit:2,sort:'canonical'}},
  mode:'validated',filters:{view:'chronos',language:'en'},totalMatched:2,
  result:[{id:'EVENT_001'}],
  diagnostics:[{code:'TRUNCATED',severity:'warning',count:1}],
  generatedAt:'2026-11-07T00:00:00Z'
};
const throwsCode=(fn,code)=>assert.throws(fn,e=>e instanceof ProjectionError&&e.code===code);

test('synthetic input is canonically valid and its source is unchanged after a projection',()=>{
  const check=canonical.validateCorpus(valid);
  assert.equal(check.valid,true,JSON.stringify(check.errors));
  const before=canonical.digest(valid);
  const x=projection(meta);
  assert.equal(canonical.digest(valid),before);
  assert.equal(x.corpus.canonical_sha256,before);
  assert.equal(x.scope.total_matched,2);
  assert.equal(x.scope.returned,1);
  assert.equal(x.scope.truncated,true);
  assert.equal(x.source.mode,'validated');
  assert.match(x.scientific_sha256,/^[a-f0-9]{64}$/);
  assert.notEqual(x.algorithm.parameters_sha256,x.scientific_sha256);
});
test('scientific digest is deterministic despite timestamps and key ordering',()=>{
  const x=projection(meta);
  const y=projection({...meta,
    generatedAt:'2027-02-11T12:13:14Z',
    filters:{language:'en',view:'chronos'},
    algorithm:{version:'1.0.0',id:'tvrw.synthetic-list',parameters:{sort:'canonical',limit:2}}
  });
  assert.notEqual(x.source.generated_at,y.source.generated_at);
  assert.equal(x.scientific_sha256,y.scientific_sha256);
  assert.equal(x.algorithm.parameters_sha256,y.algorithm.parameters_sha256);
  const z=projection({...meta,filters:{language:'fr',view:'chronos'}});
  assert.notEqual(x.scientific_sha256,z.scientific_sha256);
  assert.notEqual(x.scientific_sha256,projection({...meta,algorithm:{...meta.algorithm,parameters:{limit:3}}}).scientific_sha256);
});
test('canonical reference key never conflates homonyms across namespaces and kinds',()=>{
  const one={kind:'event',namespace:'SYNTHETIC_HISTORY',id:'X'};
  const two={kind:'entity',namespace:'SYNTHETIC_HISTORY',id:'X'};
  const three={kind:'event',namespace:'ANOTHER',id:'X'};
  const four={kind:'event',namespace:'SYNTHETIC_HISTORY',id:'X|Y'};
  assert.notEqual(refKey(one),refKey(two));
  assert.notEqual(refKey(one),refKey(three));
  assert.notEqual(refKey(one),refKey(four));
  assert.deepEqual(JSON.parse(refKey(one)),['event','SYNTHETIC_HISTORY','X']);
  assert.equal(ref(one).id,'X');
  throwsCode(()=>ref({kind:'event',namespace:'A',id:'X',path:'C:\\private'}),'INVALID_ENVELOPE');
  throwsCode(()=>ref({kind:'unknown',namespace:'A',id:'X'}),'INVALID_REFERENCE');
});
test('selection is versioned, typed, ordered, deduplicated and locally bounded',()=>{
  const one={kind:'event',namespace:'demo',id:'A'};
  const two={kind:'claim',namespace:'demo',id:'A'};
  const state={
    selection_schema_version:'1.0.0',corpusKey:'a'.repeat(64),
    viewId:'graph',selectedRefs:[one,two,one],
    timeFilter:{mode:'possible-overlap',earliest:null,latest:null},
    spatialFilter:null,predicateFilter:null,statusFilter:null,
    evidenceFilter:null,algorithmContext:null,
    language:'fr',partialResult:false
  };
  const normalized=selection(state);
  assert.equal(normalized.selectedRefs.length,2);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.selectedRefs));
  assert.ok(Object.isFrozen(normalized.timeFilter));
  throwsCode(()=>selection({...state,selection_schema_version:'99'}),'UNSUPPORTED_SELECTION_SCHEMA');
  throwsCode(()=>selection({...state,spatialFilter:{arbitrary:'js'}}),'UNSUPPORTED_FILTER');
  throwsCode(()=>selection({...state,selectedRefs:Array(257).fill(one)}),'LIMIT_EXCEEDED');
  throwsCode(()=>selection({...state,timeFilter:{mode:'unbounded',earliest:null,latest:null}}),'INVALID_FILTER');
});
test('invalid canonical inputs never yield a validated scientific projection',()=>{
  const broken=structuredClone(valid);
  broken.events[0].schema_version='2.0.0';
  assert.equal(canonical.validateCorpus(broken).valid,false);
  throwsCode(()=>projection({...meta,corpus:broken}),'CORPUS_NOT_VALIDATED');
  throwsCode(()=>projection({...meta,mode:'unvalidated-preview'}),'UNSUPPORTED_PROJECTION_MODE');
  throwsCode(()=>projection({...meta,totalMatched:0}),'INVALID_TOTAL');
  throwsCode(()=>projection({...meta,result:Array(251).fill({id:'X'}),totalMatched:300}),'LIMIT_EXCEEDED');
  throwsCode(()=>projection({...meta,generatedAt:'not-a-date'}),'INVALID_TIMESTAMP');
  assert.deepEqual(diagnostics([{code:'Z_CODE',severity:'info'},{code:'A_CODE',severity:'warning'}]).map(d=>d.code),['A_CODE','Z_CODE']);
});
test('J1A standalone schemas exist without changes to canonical v3',()=>{
  const base=new URL('../../../../schemas/tempora/visualization/',import.meta.url);
  for(const file of ['projection-envelope.schema.json','selection-state.schema.json','typed-ref.schema.json']){
    const doc=JSON.parse(readFileSync(new URL(file,base),'utf8'));
    assert.equal(doc.$schema,'https://json-schema.org/draft/2020-12/schema');
    assert.equal(doc.additionalProperties,false);
  }
});
