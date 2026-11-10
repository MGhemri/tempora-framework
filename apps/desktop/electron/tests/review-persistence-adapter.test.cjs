'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const sdk=require('tempora-framework');
const {preparePersistence}=require('../review-persistence-adapter.cjs');
const {createPersistenceGate}=require('../review-persistence-gate.cjs');
const {createTransaction,inspectTransactions}=require('../transaction-store.cjs');
const H='b'.repeat(48);
function fixture(){
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,'../../examples/synthetic-canonical-v3.json'),'utf8'));
 const mapping={mapping_schema_version:'1.0.0',id:'synthetic-persistence-check',
  version:'1.0.0',profile_id:corpus.profile.id,profile_version:corpus.profile.version,
  format:'json',fields:{id:'/id',title:{en:'/name'},start_date:'/date',event_type:'/type'}};
 const bytes=Buffer.from(JSON.stringify([{id:'PERSIST_VERIFY_01',
  name:'Fictional event',date:'1701',type:'fictional assembly'}]));
 const sourceName='fictional.json';
 const report=sdk.ingestion.preview({corpus,mapping,bytes,sourceName}).report;
 const review={ids:['PERSIST_VERIFY_01'],reviewer:'Synthetic researcher',
  reason:'Verifying the host second authorization',reviewed_at:'2026-11-09T00:00:00Z'};
 const accepted=sdk.ingestion.accept({corpus,
  bundle:sdk.ingestion.preview({corpus,mapping,bytes,sourceName}),review:{...review,batch_id:report.batch_id}});
 const stage={scope:'in_memory_staging_only',canonical_validated:true,
  scientific_approval:false,saved_to_disk:false,published:false,
  import_performed:false,persistence_required:true,batch_id:report.batch_id,
  source_sha256:report.source.sha256,base_sha256:report.base_sha256,
  snapshot_sha256:accepted.journal.output_sha256,journal:accepted.journal};
 const gate=createPersistenceGate(),intent=gate.issue(H,stage);
 const authorization=gate.claim(H,intent.token,true,{
  batch_id:stage.batch_id,source_sha256:stage.source_sha256,
  base_sha256:stage.base_sha256,snapshot_sha256:stage.snapshot_sha256});
 return {corpus,mapping,bytes,sourceName,review,authorization};
}
test('trusted SDK recomputation matches a separately authorized stage',()=>{
 const f=fixture(),before=structuredClone(f.corpus);
 const out=preparePersistence(f);
 assert.equal(out.identity.output_sha256,sdk.canonical.digest(out.corpus));
 assert.equal(out.journal.decision,'accepted_for_local_staging');
 assert.deepEqual(f.corpus,before);
 assert.equal(out.corpus.events.some(e=>e.id==='PERSIST_VERIFY_01'),true);
});
test('changed bytes cannot use old human authorization',()=>{
 const f=fixture();
 f.bytes=Buffer.from(JSON.stringify([{id:'PERSIST_VERIFY_02',
  name:'Another fictional event',date:'1701',type:'fictional assembly'}]));
 assert.throws(()=>preparePersistence(f),{code:'PERSIST_SOURCE_CHANGED'});
});
test('different working corpus cannot use old authorization',()=>{
 const f=fixture();f.corpus.extensions={...f.corpus.extensions,new_note:'changed'};
 assert.throws(()=>preparePersistence(f),{code:'PERSIST_BASE_CHANGED'});
});
test('different review selection is refused independently of the host token',()=>{
 const f=fixture();f.review.ids=['NONEXISTENT'];
 assert.throws(()=>preparePersistence(f),{code:'PERSIST_REVIEW_STALE'});
});
test('forged stage output hash causes refusal',()=>{
 const f=fixture();f.authorization={...f.authorization,snapshot_sha256:'a'.repeat(64)};
 assert.throws(()=>preparePersistence(f),{code:'PERSIST_OUTPUT_CHANGED'});
});
test('a fabricated flag cannot replace a confirmed host authorization',()=>{
 const f=fixture();f.authorization={...f.authorization,persistence_confirmed:false};
 assert.throws(()=>preparePersistence(f),{code:'PERSIST_RECOMPUTE_INPUT_INVALID'});
});
test('verified adapter output is accepted by isolated transaction store',t=>{
 const f=fixture(),out=preparePersistence(f);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-adapter-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const receipt=createTransaction(root,out,sdk.canonical);
 assert.equal(receipt.saved_to_disk,true);
 assert.deepEqual(inspectTransactions(root,sdk.canonical),
  {complete:[receipt.transaction_id],invalid:[],pending:[]});
});

test('the canonical replay uses the injected packaged SDK instead of a global import',()=>{
 const f=fixture(),calls={preview:0,accept:0};
 const packaged={
  canonical:sdk.canonical,
  ingestion:{
   preview(...args){calls.preview++;return sdk.ingestion.preview(...args);},
   accept(...args){calls.accept++;return sdk.ingestion.accept(...args);}
  }
 };
 const out=preparePersistence(f,packaged);
 assert.equal(out.journal.decision,'accepted_for_local_staging');
 assert.deepEqual(calls,{preview:1,accept:1});
});
test('an incomplete packaged SDK is rejected before any transaction',()=>{
 const f=fixture();
 assert.throws(()=>preparePersistence(f,{ingestion:{},canonical:{}}),
  {code:'PERSIST_ENGINE_UNAVAILABLE'});
});
