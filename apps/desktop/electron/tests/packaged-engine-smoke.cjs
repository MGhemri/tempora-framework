'use strict';
// Executed on Windows CI against the *packaged* Node.js and TEMPORA Engine.
// Synthetic test fixtures only: no historical truth and no canonical writes.
const {readFileSync} = require('node:fs');
const {join, resolve, isAbsolute} = require('node:path');
const {spawnSync} = require('node:child_process');
const assert = require('node:assert/strict');

const suppliedResourceRoot = process.argv[2];
if (!suppliedResourceRoot) throw Error('PACKAGED_RESOURCE_DIR_REQUIRED');
// Resolve before specifying cwd to spawnSync. Relative executable paths would
// otherwise be interpreted relative to cwd (engine/), causing ENOENT on Windows.
const resourceRoot = resolve(suppliedResourceRoot);
const node = join(resourceRoot, 'engine', 'node.exe');
const worker = join(resourceRoot, 'engine', 'worker.cjs');
assert.ok(isAbsolute(node) && isAbsolute(worker), 'packaged worker paths must be absolute');
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
const installedAlnopCanonical = readExample('alnop-canonical-v3-demo.json');
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
const alnopCanonicalValidation=invoke('corpus.validate',installedAlnopCanonical,'smoke_alnop_canonical_demo');
assert.equal(alnopCanonicalValidation.valid,true,'installed ALNOP canonical demonstrator must validate');
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

// The actual packaged worker must calculate authoritative canonical statuses.
// No user-supplied acceptance or normalization receipt is sent to the worker.
function invokePreview(payload){
  const input=JSON.stringify({protocol_version:'1.0.0',request_id:'canonical_smoke',
    operation:'ingestion.preview',payload})+'\n';
  const env={...process.env};delete env.NODE_OPTIONS;delete env.NODE_PATH;
  const proc=spawnSync(node,[worker],{cwd:join(resourceRoot,'engine'),input,
    encoding:'utf8',timeout:15000,windowsHide:true,shell:false,env});
  assert.ifError(proc.error);
  assert.equal(proc.status,0,proc.stderr);
  const frames=proc.stdout.trim().split('\n');
  assert.equal(frames.length,1);
  return JSON.parse(frames[0]);
}
const csvBytes=Buffer.from([
  'id,title,date,type',
  'EVENT_001,Changed fiction,1701,fictional assembly',
  'EVENT_002,New fiction,1702,fictional assembly',
  'EVENT_003,Bad date,29/02/1701,fictional assembly'
].join('\n')+'\n');
const mapping={mapping_schema_version:'1.0.0',id:'canonical-preview-smoke',version:'1.0.0',
  profile_id:profile.id,profile_version:profile.version,format:'csv',delimiter:',',
  fields:{id:'/id',title:{en:'/title'},start_date:'/date',event_type:'/type'}};
const payload={corpus:base,mapping,source_name:'fictional-preview.csv',
  input_base64:csvBytes.toString('base64'),
  source_sha256:require('node:crypto').createHash('sha256').update(csvBytes).digest('hex')};
const first=invokePreview(payload),second=invokePreview(payload);
assert.equal(first.ok,true,JSON.stringify(first.error));
assert.deepEqual(first,second,'repeated canonical preview must be deterministic');
const report=first.result;
assert.equal(report.scope,'canonical_technical_preview');
assert.equal(report.import_performed,false);
assert.equal(report.acceptance_enabled,false);
assert.equal(report.scientific_approval,false);
assert.match(report.batch_id,/^[a-f0-9]{64}$/);
assert.match(report.base_sha256,/^[a-f0-9]{64}$/);
assert.deepEqual(report.summary,{total:3,create:1,unchanged:0,conflict:1,quarantined:1});
assert.deepEqual(report.rows.map(r=>r.status),['conflict','create','quarantined']);
assert.equal(report.rows[2].id,'EVENT_003');
assert.ok(report.rows[2].diagnostic_codes.includes('ROW_DATE'));
assert.equal(report.rows_truncated,false);
assert.ok(!Object.hasOwn(report,'candidates')&&!Object.hasOwn(report,'original_input_base64'));
assert.deepEqual(base.events[0].id,'EVENT_001');
const changed=invokePreview({...payload,source_sha256:'0'.repeat(64)});
assert.equal(changed.ok,false);
assert.equal(changed.error.code,'SOURCE_DIGEST_MISMATCH');
const fakeApproval=invokePreview({...payload,review:{ids:['EVENT_002']}});
assert.equal(fakeApproval.ok,false);
assert.equal(fakeApproval.error.code,'INVALID_PAYLOAD');

function invokeReview(payload){
 const input=JSON.stringify({protocol_version:'1.0.0',request_id:'human_stage_smoke',
   operation:'ingestion.stage-review',payload})+'\n';
 const env={...process.env};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const proc=spawnSync(node,[worker],{cwd:join(resourceRoot,'engine'),input,
   encoding:'utf8',timeout:15000,windowsHide:true,shell:false,env});
 assert.ifError(proc.error);assert.equal(proc.status,0,proc.stderr);
 const lines=proc.stdout.trim().split('\n');assert.equal(lines.length,1);
 return JSON.parse(lines[0]);
}
const validReview={ids:['EVENT_002'],reviewer:'Synthetic researcher',
 reason:'Controlled fictional local staging exercise',reviewed_at:'2026-11-09T05:00:00Z'};
const stagePayload={...payload,expected_base_sha256:report.base_sha256,
 expected_batch_id:report.batch_id,review:validReview};
const stage=invokeReview(stagePayload);
assert.equal(stage.ok,true,JSON.stringify(stage.error));
assert.equal(stage.result.scope,'in_memory_staging_only');
assert.equal(stage.result.canonical_validated,true);
assert.equal(stage.result.saved_to_disk,false);
assert.equal(stage.result.published,false);
assert.equal(stage.result.import_performed,false);
assert.equal(stage.result.scientific_approval,false);
assert.deepEqual(stage.result.journal.selected_ids,['EVENT_002']);
assert.match(stage.result.snapshot_sha256,/^[a-f0-9]{64}$/);
assert.ok(!Object.hasOwn(stage.result,'corpus'),'No unsaved corpus may leave the worker');
assert.deepEqual(stage,invokeReview(stagePayload),'staging receipt must be deterministic with explicit UTC time');
const wrongBase=invokeReview({...stagePayload,expected_base_sha256:'0'.repeat(64)});
assert.equal(wrongBase.ok,false);assert.equal(wrongBase.error.code,'REVIEW_PREVIEW_STALE');
const unauthorized=invokeReview({...stagePayload,review:{...validReview,ids:['EVENT_001']}});
assert.equal(unauthorized.ok,false);assert.equal(unauthorized.error.code,'REVIEW_SELECTION');
const quarantined=invokeReview({...stagePayload,review:{...validReview,ids:['EVENT_003']}});
assert.equal(quarantined.ok,false);assert.equal(quarantined.error.code,'REVIEW_SELECTION');
const insufficient=invokeReview({...stagePayload,review:{...validReview,reason:' '}});
assert.equal(insufficient.ok,false);assert.equal(insufficient.error.code,'REVIEW_REQUIRED');
const invalidEnvelope=invokeReview({...stagePayload,review:{...validReview,approved:true}});
assert.equal(invalidEnvelope.ok,false);assert.equal(invalidEnvelope.error.code,'REVIEW_PAYLOAD_INVALID');
console.log('PACKAGED_TEMPORA_IN_MEMORY_STAGING_REVIEW_OK');

console.log('PACKAGED_TEMPORA_CANONICAL_PREVIEW_NO_ACCEPTANCE_OK');

console.log('PACKAGED_TEMPORA_ENGINE_3_0_0_VALIDATION_OK');
console.log('PACKAGED_OFFLINE_EXAMPLES_VALIDATED');
console.log('SYNTHETIC_VALID_SHA256='+digestYes);
console.log('SYNTHETIC_INVALID_SHA256='+digestNo);
