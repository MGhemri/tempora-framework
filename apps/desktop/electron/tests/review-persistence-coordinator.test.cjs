'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const sdk=require('tempora-framework');
const {createReviewPersistenceCoordinator}=require('../review-persistence-coordinator.cjs');
const {createTransaction,inspectTransactions}=require('../transaction-store.cjs');
const HANDLE='a'.repeat(48);
function fixture(t){
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,'../../examples/synthetic-canonical-v3.json'),'utf8'));
 const mapping={mapping_schema_version:'1.0.0',id:'synthetic-coordinator',
  version:'1.0.0',profile_id:corpus.profile.id,profile_version:corpus.profile.version,
  format:'json',fields:{id:'/id',title:{en:'/name'},start_date:'/date',event_type:'/type'}};
 const bytes=Buffer.from(JSON.stringify([{id:'COORDINATED_01',name:'Fictional event',
  date:'1701',type:'fictional assembly'}]));
 const sourceName='synthetic.json';
 const bundle=sdk.ingestion.preview({corpus,mapping,bytes,sourceName,observedAt:null});
 const review={batch_id:bundle.report.batch_id,ids:['COORDINATED_01'],
  reviewer:'Synthetic reviewer',reason:'Second local save decision',
  reviewed_at:'2026-11-09T00:00:00Z'};
 const outcome=sdk.ingestion.accept({corpus,bundle,review});
 const stage={scope:'in_memory_staging_only',canonical_validated:true,
  scientific_approval:false,saved_to_disk:false,published:false,
  import_performed:false,persistence_required:true,
  batch_id:bundle.report.batch_id,source_sha256:bundle.report.source.sha256,
  base_sha256:bundle.report.base_sha256,snapshot_sha256:outcome.journal.output_sha256,
  journal:outcome.journal};
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-coordinate-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 let writes=0;
 const coordinator=createReviewPersistenceCoordinator({persist:verified=>{
  writes++;return createTransaction(root,verified,sdk.canonical);
 }});
 const reread=async()=>({bytes,corpus,mapping,sourceName});
 return {coordinator,stage,reread,root,get writes(){return writes;}};
}
test('verified real SDK staging + second confirmation yields exactly one transaction',async t=>{
 const f=fixture(t),intent=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 assert.equal(intent.saved_to_disk,false);
 const receipt=await f.coordinator.commit({handle:HANDLE,token:intent.token,confirmed:true});
 assert.equal(receipt.saved_to_disk,true);assert.equal(f.writes,1);
 assert.deepEqual(inspectTransactions(f.root,sdk.canonical),
  {complete:[receipt.transaction_id],invalid:[],pending:[]});
 await assert.rejects(()=>f.coordinator.commit({handle:HANDLE,token:intent.token,confirmed:true}),
  {code:'PERSIST_GATE_EXPIRED'});
 assert.equal(f.writes,1);
});
test('false second consent never invokes reread or persistence',async t=>{
 const f=fixture(t);let reads=0;
 const intent=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:async()=>{reads++;return f.reread();}});
 await assert.rejects(()=>f.coordinator.commit({handle:HANDLE,token:intent.token,confirmed:false}),
  {code:'PERSIST_GATE_CONFIRMATION_REQUIRED'});
 assert.equal(reads,0);assert.equal(f.writes,0);
});
test('a changed source is rejected before persist with consumed consent',async t=>{
 const f=fixture(t);
 const intent=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:async()=>{
  const data=await f.reread();
  data.bytes=Buffer.from('invalid replacement');
  return data;
 }});
 await assert.rejects(()=>f.coordinator.commit({handle:HANDLE,token:intent.token,confirmed:true}),
  {code:'PERSIST_SOURCE_CHANGED'});
 assert.equal(f.writes,0);
 await assert.rejects(()=>f.coordinator.commit({handle:HANDLE,token:intent.token,confirmed:true}),
  {code:'PERSIST_GATE_EXPIRED'});
});
test('a forged review is not read from the renderer during commit',async t=>{
 const f=fixture(t);
 const intent=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 const malicious={handle:HANDLE,token:intent.token,confirmed:true,
  review:{ids:['OTHER'],reviewer:'attacker'}};
 const receipt=await f.coordinator.commit(malicious);
 assert.equal(receipt.saved_to_disk,true);
 assert.equal(f.writes,1);
});
test('session-crossing and close invalidate pending authorization',async t=>{
 const f=fixture(t);
 const intent=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 await assert.rejects(()=>f.coordinator.commit({handle:'b'.repeat(48),token:intent.token,confirmed:true}),
  {code:'PERSIST_GATE_EXPIRED'});
 assert.equal(f.writes,0);
 const next=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 f.coordinator.revoke(HANDLE);
 await assert.rejects(()=>f.coordinator.commit({handle:HANDLE,token:next.token,confirmed:true}),
  {code:'PERSIST_GATE_EXPIRED'});
});
test('new simulation revokes previous consent',async t=>{
 const f=fixture(t),old=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 const next=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 await assert.rejects(()=>f.coordinator.commit({handle:HANDLE,token:old.token,confirmed:true}),
  {code:'PERSIST_GATE_EXPIRED'});
 const receipt=await f.coordinator.commit({handle:HANDLE,token:next.token,confirmed:true});
 assert.equal(receipt.saved_to_disk,true);assert.equal(f.writes,1);
});
test('review identity is snapshotted before the UI can modify an old receipt',async t=>{
 const f=fixture(t),intent=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 f.stage.journal.selected_ids=['MALICIOUS'];
 f.stage.journal.reviewer='changed';
 const receipt=await f.coordinator.commit({handle:HANDLE,token:intent.token,confirmed:true});
 assert.equal(receipt.saved_to_disk,true);assert.equal(f.writes,1);
});

test('a second save is refused while the first privileged read is in flight',async t=>{
 const f=fixture(t);
 let release,entered;
 const enteredPromise=new Promise(resolve=>entered=resolve);
 const block=new Promise(resolve=>release=resolve);
 const first=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:async()=>{
  entered();
  await block;
  return f.reread();
 }});
 const secondHandle='b'.repeat(48);
 const second=f.coordinator.offer({handle:secondHandle,stage:f.stage,reread:f.reread});
 const work=f.coordinator.commit({handle:HANDLE,token:first.token,confirmed:true});
 await enteredPromise;
 try {
  await assert.rejects(()=>f.coordinator.commit({
   handle:secondHandle,token:second.token,confirmed:true
  }),{code:'PERSIST_COORDINATOR_BUSY'});
  assert.throws(()=>f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:f.reread}),
   {code:'PERSIST_COORDINATOR_BUSY'});
  assert.equal(f.writes,0);
 } finally {release();}
 const receipt=await work;
 assert.equal(receipt.saved_to_disk,true);
 assert.equal(f.writes,1);
 // A rejected concurrent attempt did not consume another session's consent.
 f.coordinator.revoke(secondHandle);
});
test('a failed privileged reread releases the in-process save guard',async t=>{
 const f=fixture(t);
 const bad=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:async()=>{
  throw Object.assign(new Error('TEST_DISK_READ_FAILED'),{code:'TEST_DISK_READ_FAILED'});
 }});
 await assert.rejects(()=>f.coordinator.commit({
  handle:HANDLE,token:bad.token,confirmed:true
 }),{code:'TEST_DISK_READ_FAILED'});
 const next=f.coordinator.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 const receipt=await f.coordinator.commit({
  handle:HANDLE,token:next.token,confirmed:true
 });
 assert.equal(receipt.saved_to_disk,true);
 assert.equal(f.writes,1);
});
