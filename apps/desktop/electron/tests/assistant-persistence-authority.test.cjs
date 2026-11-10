'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto');
const sdk=require('tempora-framework');
const {createNativePersistenceWorkflow}=require('../native-persistence-workflow.cjs');
const {createAssistantPersistenceAuthority}=require('../assistant-persistence-authority.cjs');
const {inspectTransactions}=require('../transaction-store.cjs');
const sha=x=>createHash('sha256').update(x).digest('hex');
const HANDLE='e'.repeat(48);
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-authority-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,
  '../../examples/synthetic-canonical-v3.json'),'utf8'));
 const corpus_path=path.join(root,'original-corpus.json');
 fs.writeFileSync(corpus_path,JSON.stringify(corpus));
 const mapping={mapping_schema_version:'1.0.0',id:'synthetic-authority',
  version:'1.0.0',profile_id:corpus.profile.id,profile_version:corpus.profile.version,
  format:'json',fields:{id:'/id',title:{en:'/name'},start_date:'/date',event_type:'/type'}};
 const bytes=Buffer.from(JSON.stringify([{id:'AUTH_001',
  name:'Fictional event',date:'1701',type:'fictional assembly'}]));
 const sourceName='fictional.json';
 const bundle=sdk.ingestion.preview({corpus,mapping,bytes,sourceName,observedAt:null});
 const review={batch_id:bundle.report.batch_id,ids:['AUTH_001'],
  reviewer:'Synthetic human',reason:'Second decision host-only test',
  reviewed_at:'2026-11-09T00:00:00Z'};
 const accepted=sdk.ingestion.accept({corpus,bundle,review});
 const input={bytes,mapping,sourceName,sourceSha256:sha(bytes),profile_id:corpus.profile.id};
 let valid=true;
 const sessions={canonicalInput(handle){
  if(handle!==HANDLE||!valid)
    throw Object.assign(Error('ASSIST_SESSION_MISSING_OR_EXPIRED'),{code:'ASSIST_SESSION_MISSING_OR_EXPIRED'});
  return input;
 }};
 const preview={corpus_path,corpus_raw_sha256:sha(fs.readFileSync(corpus_path)),
  base_sha256:bundle.report.base_sha256,batch_id:bundle.report.batch_id,
  source_sha256:bundle.report.source.sha256,mapping_sha256:bundle.report.mapping.sha256};
 const stage={scope:'in_memory_staging_only',canonical_validated:true,
  scientific_approval:false,saved_to_disk:false,published:false,
  import_performed:false,persistence_required:true,
  batch_id:bundle.report.batch_id,source_sha256:bundle.report.source.sha256,
  base_sha256:bundle.report.base_sha256,
  snapshot_sha256:accepted.journal.output_sha256,journal:accepted.journal};
 const workflow=createNativePersistenceWorkflow({sdk,
  confirmNative:async()=>true,chooseDestination:async()=>root});
 const authority=createAssistantPersistenceAuthority({sessions,workflow});
 return {root,corpus_path,preview,input,stage,authority,
  expire:()=>{valid=false;}};
}
test('verified worker staging offers an internal one-shot save without exposing a token',async t=>{
 const f=fixture(t);
 const response=f.authority.recordStaging({
  handle:HANDLE,preview:f.preview,input:f.input,stage:f.stage
 });
 assert.deepEqual(response,{prepared_in_host:true,saved_to_disk:false});
 assert.equal('token' in response,false);
 assert.deepEqual(fs.readdirSync(f.root),['original-corpus.json']);
 const result=await f.authority.commitTrusted(HANDLE);
 assert.equal(result.saved_to_disk,true);
 assert.equal(result.published,false);
 assert.equal(inspectTransactions(f.root,sdk.canonical).complete.length,1);
 await assert.rejects(()=>f.authority.commitTrusted(HANDLE),
  {code:'ASSIST_PERSIST_AUTHORITY_NOT_PREPARED'});
});
test('worker receipt with mismatched source identity is never armed',t=>{
 const f=fixture(t);
 assert.throws(()=>f.authority.recordStaging({
  handle:HANDLE,preview:f.preview,input:f.input,
  stage:{...f.stage,source_sha256:'b'.repeat(64)}
 }),{code:'ASSIST_PERSIST_AUTHORITY_STAGE_INVALID'});
 assert.deepEqual(fs.readdirSync(f.root),['original-corpus.json']);
});
test('a fresh staging attempt revokes the previous intent even if the new receipt fails',async t=>{
 const f=fixture(t);
 f.authority.recordStaging({handle:HANDLE,preview:f.preview,input:f.input,stage:f.stage});
 assert.throws(()=>f.authority.recordStaging({
  handle:HANDLE,preview:f.preview,input:f.input,
  stage:{...f.stage,batch_id:'b'.repeat(64)}
 }),{code:'ASSIST_PERSIST_AUTHORITY_STAGE_INVALID'});
 await assert.rejects(()=>f.authority.commitTrusted(HANDLE),
  {code:'ASSIST_PERSIST_AUTHORITY_NOT_PREPARED'});
});
test('session close and shutdown invalidate any unreleased internal consent',async t=>{
 const f=fixture(t);
 f.authority.recordStaging({handle:HANDLE,preview:f.preview,input:f.input,stage:f.stage});
 f.authority.revoke(HANDLE);
 await assert.rejects(()=>f.authority.commitTrusted(HANDLE),
  {code:'ASSIST_PERSIST_AUTHORITY_NOT_PREPARED'});
 f.authority.recordStaging({handle:HANDLE,preview:f.preview,input:f.input,stage:f.stage});
 f.authority.clear();
 await assert.rejects(()=>f.authority.commitTrusted(HANDLE),
  {code:'ASSIST_PERSIST_AUTHORITY_NOT_PREPARED'});
});
test('expired source session blocks actual native commit and no files are written',async t=>{
 const f=fixture(t);
 f.authority.recordStaging({handle:HANDLE,preview:f.preview,input:f.input,stage:f.stage});
 f.expire();
 await assert.rejects(()=>f.authority.commitTrusted(HANDLE),
  {code:'ASSIST_SESSION_MISSING_OR_EXPIRED'});
 assert.deepEqual(fs.readdirSync(f.root),['original-corpus.json']);
});
test('changed source corpus blocks native save after consent',async t=>{
 const f=fixture(t);
 f.authority.recordStaging({handle:HANDLE,preview:f.preview,input:f.input,stage:f.stage});
 fs.appendFileSync(f.corpus_path,' ');
 await assert.rejects(()=>f.authority.commitTrusted(HANDLE),
  {code:'ASSIST_BINDING_CORPUS_CHANGED'});
 assert.deepEqual(fs.readdirSync(f.root),['original-corpus.json']);
});
