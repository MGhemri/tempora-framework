'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const sdk=require('tempora-framework');
const {createNativePersistenceWorkflow}=require('../native-persistence-workflow.cjs');
const {inspectTransactions}=require('../transaction-store.cjs');
const HANDLE='b'.repeat(48);
function fixture(t,{confirmNative=async()=>true,chooseDestination}={}){
 const corpus=JSON.parse(fs.readFileSync(
  path.join(__dirname,'../../examples/synthetic-canonical-v3.json'),'utf8'));
 const mapping={mapping_schema_version:'1.0.0',id:'synthetic-native-workflow',
  version:'1.0.0',profile_id:corpus.profile.id,profile_version:corpus.profile.version,
  format:'json',fields:{id:'/id',title:{en:'/name'},start_date:'/date',event_type:'/type'}};
 const bytes=Buffer.from(JSON.stringify([{id:'NATIVE_01',name:'Fictional event',
  date:'1701',type:'fictional assembly'}]));
 const sourceName='synthetic-native.json';
 const bundle=sdk.ingestion.preview({corpus,bytes,mapping,sourceName,observedAt:null});
 const review={batch_id:bundle.report.batch_id,ids:['NATIVE_01'],
  reviewer:'Human researcher',reason:'Synthetic native confirmation',
  reviewed_at:'2026-11-09T00:00:00Z'};
 const accepted=sdk.ingestion.accept({corpus,bundle,review});
 const stage={scope:'in_memory_staging_only',canonical_validated:true,
  scientific_approval:false,saved_to_disk:false,published:false,
  import_performed:false,persistence_required:true,
  batch_id:bundle.report.batch_id,source_sha256:bundle.report.source.sha256,
  base_sha256:bundle.report.base_sha256,mapping_sha256:bundle.report.mapping.sha256,
  snapshot_sha256:accepted.journal.output_sha256,
  journal:accepted.journal};
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-native-save-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const choose=chooseDestination??(async()=>root);
 const workflow=createNativePersistenceWorkflow({sdk,confirmNative,chooseDestination:choose});
 const reread=async()=>({corpus,bytes,mapping,sourceName});
 return {stage,root,workflow,reread,bytes};
}
test('native host confirms, selects folder, recomputes and commits one canonical transaction',async t=>{
 const f=fixture(t),intent=f.workflow.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 assert.equal(intent.saved_to_disk,false);
 const receipt=await f.workflow.confirmAndCommit({handle:HANDLE,token:intent.token});
 assert.equal(receipt.saved_to_disk,true);
 assert.deepEqual(inspectTransactions(f.root,sdk.canonical),
  {complete:[receipt.transaction_id],invalid:[],pending:[]});
 await assert.rejects(()=>f.workflow.confirmAndCommit({handle:HANDLE,token:intent.token}),
  {code:'NATIVE_PERSIST_TOKEN_EXPIRED'});
});
test('native confirmation refusal never selects a folder or writes',async t=>{
 let picks=0;
 const f=fixture(t,{confirmNative:async()=>false,
  chooseDestination:async()=>{picks++;return '/should-not-be-used';}});
 const intent=f.workflow.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 const result=await f.workflow.confirmAndCommit({handle:HANDLE,token:intent.token});
 assert.deepEqual(result,{cancelled:true,saved_to_disk:false});
 assert.equal(picks,0);
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('native destination picker cancellation never recomputes or persists',async t=>{
 const f=fixture(t,{chooseDestination:async()=>null});
 const intent=f.workflow.offer({handle:HANDLE,stage:f.stage,reread:async()=>{
  throw Error('read must not happen');
 }});
 const result=await f.workflow.confirmAndCommit({handle:HANDLE,token:intent.token});
 assert.deepEqual(result,{cancelled:true,saved_to_disk:false});
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('native host rejects modified source after human confirmation',async t=>{
 const f=fixture(t),intent=f.workflow.offer({handle:HANDLE,stage:f.stage,reread:async()=>{
  const input=await f.reread();
  input.bytes=Buffer.from('changed');
  return input;
 }});
 await assert.rejects(()=>f.workflow.confirmAndCommit({handle:HANDLE,token:intent.token}),
  {code:'PERSIST_SOURCE_CHANGED'});
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('a renderer cannot supply an arbitrary destination path in the completion arguments',async t=>{
 const f=fixture(t),intent=f.workflow.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 const receipt=await f.workflow.confirmAndCommit({handle:HANDLE,token:intent.token,
  destination:'/tmp/forged',confirmed:true});
 assert.equal(receipt.saved_to_disk,true);
 assert.equal(inspectTransactions(f.root,sdk.canonical).complete.length,1);
});
test('session revocation during native confirmation prevents the later commit',async t=>{
 let release,entered;
 const blocked=new Promise(resolve=>release=resolve);
 const started=new Promise(resolve=>entered=resolve);
 const f=fixture(t,{confirmNative:async()=>{entered();await blocked;return true;}});
 const intent=f.workflow.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 const work=f.workflow.confirmAndCommit({handle:HANDLE,token:intent.token});
 await started;
 f.workflow.revoke(HANDLE);
 release();
 await assert.rejects(work,{code:'NATIVE_PERSIST_CANCELLED'});
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('native workflow rejects parallel operations even when different sessions exist',async t=>{
 let release,entered;
 const blocked=new Promise(resolve=>release=resolve);
 const started=new Promise(resolve=>entered=resolve);
 const f=fixture(t,{confirmNative:async()=>{entered();await blocked;return false;}});
 const first=f.workflow.offer({handle:HANDLE,stage:f.stage,reread:f.reread});
 const other='c'.repeat(48);
 const next=f.workflow.offer({handle:other,stage:f.stage,reread:f.reread});
 const work=f.workflow.confirmAndCommit({handle:HANDLE,token:first.token});
 await started;
 await assert.rejects(()=>f.workflow.confirmAndCommit({handle:other,token:next.token}),
  {code:'NATIVE_PERSIST_BUSY'});
 release();
 assert.deepEqual(await work,{cancelled:true,saved_to_disk:false});
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
