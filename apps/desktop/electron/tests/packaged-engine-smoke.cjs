'use strict';
// Executed on Windows CI against the *packaged* Node.js and TEMPORA Engine.
// Synthetic test fixtures only: no historical truth and no canonical writes.
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {spawnSync} = require('node:child_process');
const assert = require('node:assert/strict');

const resourceRoot = process.argv[2];
if (!resourceRoot) throw Error('PACKAGED_RESOURCE_DIR_REQUIRED');
const node = join(resourceRoot, 'engine', 'node.exe');
const worker = join(resourceRoot, 'engine', 'worker.cjs');
const manifest = JSON.parse(readFileSync(join(resourceRoot, 'engine', 'runtime-manifest.json'), 'utf8'));
assert.equal(manifest.engine, 'tempora-framework@3.0.0');
const pkg = JSON.parse(readFileSync(join(resourceRoot, 'engine', 'node_modules', 'tempora-framework', 'package.json'),'utf8'));
assert.equal(pkg.version,'3.0.0');

const profile = {
  profile_schema_version:'1.0.0',version:'1.0.0',id:'synthetic-history',
  display_name:'Synthetic history — test fixtures only',namespace:'SYNTHETIC_HISTORY',
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
const date = {
  kind:'exact',calendar:'gregorian',original:'1784-06-12',earliest:'1784-06-12',
  latest:'1784-06-12',precision:'day',certainty:'documented'
};
const base = {
  schema_version:'3.0.0',profile,
  events:[{
    schema_version:'3.0.0',id:'EVENT_001',namespace:'SYNTHETIC_HISTORY',
    editorial_status:'proposed',provenance:{evidence:[],transformations:[]},
    extensions:{},kind:'event',title:{en:'Fictional scientific assembly'},
    description:{en:'Invented event only for TEMPORA tests'},
    start_date:date,end_date:date,event_type:['fictional assembly'],
    spatial_refs:[],territory_refs:[],participant_refs:[],review_refs:[]
  }],sources:[],claims:[],entities:[],spatial_assertions:[],relations:[],
  reviews:[],assessments:[],releases:[],extensions:{},
  taxonomies:{event_types:['fictional assembly']}
};
// The Windows package must carry usable offline educational examples.
// ALNOP is a historical GeoJSON excerpt, NOT a canonical v3 corpus.
const readExample = name => JSON.parse(readFileSync(join(resourceRoot,'examples',name),'utf8'));
const installedCanonical = readExample('synthetic-canonical-v3.json');
const installedAlnop = readExample('alnop-geographic-sample.geojson');
assert.equal(installedCanonical.schema_version,'3.0.0');
assert.equal(installedAlnop.type,'FeatureCollection');
assert.equal(installedAlnop.features.length,5);
assert.equal(installedAlnop.properties.source_commit,'2428a693393a4a635d5eeac3e3c8542498b8b9d6');
assert.equal(installedAlnop.properties.license,'https://creativecommons.org/licenses/by/4.0/');
assert.deepEqual([...new Set(installedAlnop.features.map(f => f.properties.wilaya_code))].sort(),
  ['W1','W2','W3','W4','W5']);
assert.match(readFileSync(join(resourceRoot,'examples','README.md'),'utf8'),/CC BY 4\.0/);

const invalid = structuredClone(base);
invalid.events[0].schema_version = '2.0.0';

function invoke(operation,corpus,requestId) {
  const input = JSON.stringify({
    protocol_version:'1.0.0',request_id:requestId,operation,
    payload: corpus === undefined ? {} : {corpus}
  }) + '\n';
  const env={...process.env};
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  const proc=spawnSync(node,[worker],{
    cwd:join(resourceRoot,'engine'),input,encoding:'utf8',timeout:15000,
    windowsHide:true,shell:false,env
  });
  if(proc.error || proc.status !== 0) throw Error('PACKAGED_ENGINE_FAILED: '+(proc.error?.message||proc.stderr));
  const lines=proc.stdout.trim().split('\n');
  assert.equal(lines.length,1,'strict protocol: exactly one JSON line');
  const result=JSON.parse(lines[0]);
  assert.equal(result.protocol_version,'1.0.0');
  assert.equal(result.request_id,requestId);
  assert.equal(result.ok,true);
  return result.result;
}
assert.equal(invoke('health',undefined,'smoke_health').engine_version,'3.0.0');
const exampleValidation=invoke('corpus.validate',installedCanonical,'smoke_example');
assert.equal(exampleValidation.valid,true,'installed canonical example must validate');
assert.equal(exampleValidation.errors.length,0);
const yes=invoke('corpus.validate',base,'smoke_valid');
assert.equal(yes.valid,true,'synthetic v3 corpus must validate');
assert.equal(yes.errors.length,0);
const no=invoke('corpus.validate',invalid,'smoke_invalid');
assert.equal(no.valid,false,'tampered v3 event must fail');
assert.ok(no.errors.some(e=>String(e.path||e.instancePath||'').includes('events/0/schema_version')),
  'diagnostics must identify tampered event schema version');
const digestYes=invoke('corpus.digest',base,'smoke_digest_valid').sha256;
const digestNo=invoke('corpus.digest',invalid,'smoke_digest_invalid').sha256;
assert.match(digestYes,/^[a-f0-9]{64}$/);
assert.match(digestNo,/^[a-f0-9]{64}$/);
assert.notEqual(digestYes,digestNo);
console.log('PACKAGED_TEMPORA_ENGINE_3_0_0_VALIDATION_OK');
console.log('PACKAGED_OFFLINE_EXAMPLES_VALIDATED');
console.log('SYNTHETIC_VALID_SHA256='+digestYes);
console.log('SYNTHETIC_INVALID_SHA256='+digestNo);
