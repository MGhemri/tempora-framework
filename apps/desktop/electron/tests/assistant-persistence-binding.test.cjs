'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto');
const {nativeReadCorpus,makeTrustedSessionReread}=require('../assistant-persistence-binding.cjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const HANDLE='a'.repeat(48);
function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-binding-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const corpus={schema_version:'3.0.0',profile:{id:'test-profile'},events:[]};
 const corpusPath=path.join(root,'corpus.json');
 fs.writeFileSync(corpusPath,JSON.stringify(corpus));
 const rawHash=sha(fs.readFileSync(corpusPath));
 const sourceBytes=Buffer.from('synthetic source text');
 const sourceHash=sha(sourceBytes);
 const input={bytes:sourceBytes,sourceSha256:sourceHash,
  profile_id:'test-profile',sourceName:'test.csv',
  mapping:{mapping_schema_version:'1.0.0'}};
 let expired=false;
 const sessions={canonicalInput(id){
  if(id!==HANDLE||expired)throw Object.assign(Error('expired'),{code:'ASSIST_SESSION_MISSING_OR_EXPIRED'});
  return input;
 }};
 const reread=makeTrustedSessionReread({
  sessions,handle:HANDLE,corpusPath,corpusRawSha256:rawHash,
  sourceSha256:sourceHash,profileId:'test-profile',expectedMapping:input.mapping
 });
 return {root,corpusPath,corpus,rawHash,sourceHash,sourceBytes,input,
  sessions,reread,expire:()=>{expired=true;}};
}
test('native binding reopens exactly the selected corpus and original session source',async t=>{
 const f=setup(t);
 const result=await f.reread();
 assert.equal(result.bytes.toString(),'synthetic source text');
 assert.deepEqual(result.corpus,f.corpus);
 assert.equal(result.sourceName,'test.csv');
 assert.notEqual(result.mapping,f.input.mapping);
});
test('a modified original canonical file cannot be committed after a preview',async t=>{
 const f=setup(t);
 fs.writeFileSync(f.corpusPath,JSON.stringify({...f.corpus,events:[{id:'forged'}]}));
 await assert.rejects(f.reread(),{code:'ASSIST_BINDING_CORPUS_CHANGED'});
});
test('expired native session invalidates any former persistence decision',async t=>{
 const f=setup(t);f.expire();
 await assert.rejects(f.reread(),{code:'ASSIST_SESSION_MISSING_OR_EXPIRED'});
});
test('changed confirmed mapping is rejected before corpus reread',async t=>{
 const f=setup(t);
 f.input.mapping={mapping_schema_version:'1.0.0',changed:true};
 await assert.rejects(f.reread(),{code:'ASSIST_BINDING_MAPPING_CHANGED'});
});
test('changed native source or profile invalidates prior consent',async t=>{
 const f=setup(t);
 f.input.bytes=Buffer.from('changed');
 await assert.rejects(f.reread(),{code:'ASSIST_BINDING_SOURCE_CHANGED'});
 f.input.bytes=f.sourceBytes;
 f.input.profile_id='different';
 await assert.rejects(f.reread(),{code:'ASSIST_BINDING_PROFILE_CHANGED'});
});
test('corpus symlink is refused without traversing it',t=>{
 const f=setup(t),other=path.join(f.root,'other.json');
 fs.writeFileSync(other,JSON.stringify(f.corpus));
 fs.unlinkSync(f.corpusPath);
 try{fs.symlinkSync(other,f.corpusPath,'file');}
 catch(e){if(process.platform==='win32'&&['EPERM','EACCES'].includes(e.code))return;throw e;}
 assert.throws(()=>nativeReadCorpus(f.corpusPath),{code:'ASSIST_BINDING_CORPUS_FILE_UNSAFE'});
});
test('a native-selected corpus is required; a renderer-provided nonabsolute path is rejected',t=>{
 const f=setup(t);
 assert.throws(()=>makeTrustedSessionReread({
  sessions:f.sessions,handle:HANDLE,corpusPath:'../corpus.json',
  corpusRawSha256:f.rawHash,sourceSha256:f.sourceHash,profileId:'test-profile'
 }),{code:'ASSIST_BINDING_CONFIGURATION'});
});

test('native session-bound reread completes a genuine reviewed SDK transaction',async t=>{
 const sdk=require('tempora-framework');
 const {createNativePersistenceWorkflow}=require('../native-persistence-workflow.cjs');
 const {inspectTransactions}=require('../transaction-store.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-binding-integration-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const corpus=JSON.parse(fs.readFileSync(
  path.join(__dirname,'../../examples/synthetic-canonical-v3.json'),'utf8'));
 const file=path.join(root,'canonical.json');
 fs.writeFileSync(file,JSON.stringify(corpus));
 const mapping={mapping_schema_version:'1.0.0',id:'binding-native-integration',
  version:'1.0.0',profile_id:corpus.profile.id,profile_version:corpus.profile.version,
  format:'json',fields:{id:'/id',title:{en:'/name'},start_date:'/date',event_type:'/type'}};
 const bytes=Buffer.from(JSON.stringify([{id:'BIND_01',name:'Fictional event',
  date:'1701',type:'fictional assembly'}]));
 const input={bytes,sourceSha256:sha(bytes),sourceName:'fictional.json',
  profile_id:corpus.profile.id,mapping};
 const sessions={canonicalInput(id){
  if(id!==HANDLE)throw Error('unknown session');
  return input;
 }};
 const reread=makeTrustedSessionReread({sessions,handle:HANDLE,
  corpusPath:file,corpusRawSha256:sha(fs.readFileSync(file)),
  profileId:corpus.profile.id,sourceSha256:sha(bytes)});
 const bundle=sdk.ingestion.preview({corpus,mapping,bytes,
  sourceName:'fictional.json',observedAt:null});
 const review={batch_id:bundle.report.batch_id,ids:['BIND_01'],
  reviewer:'Synthetic researcher',reason:'Session-bound second decision',
  reviewed_at:'2026-11-09T00:00:00Z'};
 const accepted=sdk.ingestion.accept({corpus,bundle,review});
 const stage={scope:'in_memory_staging_only',canonical_validated:true,
  scientific_approval:false,saved_to_disk:false,published:false,
  import_performed:false,persistence_required:true,batch_id:bundle.report.batch_id,
  source_sha256:bundle.report.source.sha256,
  base_sha256:bundle.report.base_sha256,
  snapshot_sha256:accepted.journal.output_sha256,journal:accepted.journal};
 const workflow=createNativePersistenceWorkflow({sdk,
  confirmNative:async()=>true,chooseDestination:async()=>root});
 const intent=workflow.offer({handle:HANDLE,stage,reread});
 const receipt=await workflow.confirmAndCommit({handle:HANDLE,token:intent.token});
 assert.equal(receipt.saved_to_disk,true);
 assert.equal(receipt.scientific_approval,false);
 assert.deepEqual(inspectTransactions(root,sdk.canonical),
  {complete:[receipt.transaction_id],invalid:[],pending:[]});
 // The user's original canonical document remains unchanged.
 assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),corpus);
});
