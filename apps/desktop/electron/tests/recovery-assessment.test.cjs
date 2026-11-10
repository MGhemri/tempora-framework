'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {assessRecovery}=require('../recovery-assessment.cjs');
const {createTransaction,inspectTransactions,inspectWriterReservation,inspectCommittedIdentity}=
 require('../transaction-store.cjs');
const H='a'.repeat(64);
const canonical={validateCorpus:c=>({valid:c?.schema_version==='3.0.0'}),digest:()=>H};
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-recovery-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const corpus={schema_version:'3.0.0',events:[]};
 const identity={batch_id:H,source_sha256:H,base_sha256:H,mapping_sha256:H,output_sha256:H};
 const journal={decision:'accepted_for_local_staging',batch_id:H,
   base_sha256:H,output_sha256:H,scientific_approval:false};
 return {root,corpus,identity,journal};
}
test('empty inspection never creates an output directory',t=>{
 const f=fixture(t);
 const report=assessRecovery(f.root,canonical);
 assert.equal(report.safe_to_start_new_write,true);
 assert.equal(report.requires_manual_attention,false);
 assert.equal(report.committed_count,0);
 assert.equal(report.recovery_performed,false);
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('normal committed transaction has no recovery blockers',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 const report=assessRecovery(f.root,canonical);
 assert.equal(report.committed_count,1);
 assert.equal(report.safe_to_start_new_write,true);
 assert.deepEqual(inspectTransactions(f.root,canonical).complete,[receipt.transaction_id]);
});
test('unsafe journal and orphaned pending entry are reported without mutation',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 fs.writeFileSync(path.join(f.root,'transactions',receipt.transaction_id,'journal.json'),'{}');
 const pending=path.join(f.root,'.pending','b'.repeat(32));
 fs.mkdirSync(pending);
 fs.writeFileSync(path.join(pending,'corpus.json'),'partial');
 const report=assessRecovery(f.root,canonical);
 assert.equal(report.safe_to_start_new_write,false);
 assert.deepEqual(report.invalid_transactions,[receipt.transaction_id]);
 assert.deepEqual(report.pending_incomplete,['b'.repeat(32)]);
 assert.equal(report.files_modified,false);
 assert.ok(fs.existsSync(pending));
});
function killDuringCommit(root,phase){
 const script=[
  "'use strict';",
  "const fs=require('node:fs');",
  "const store=require(process.argv[1]);",
  "const root=process.argv[2],phase=process.argv[3],H='a'.repeat(64);",
  "const input={corpus:{schema_version:'3.0.0',events:[]},",
  " identity:{batch_id:H,source_sha256:H,base_sha256:H,mapping_sha256:H,output_sha256:H},",
  " journal:{decision:'accepted_for_local_staging',batch_id:H,base_sha256:H,output_sha256:H,scientific_approval:false}};",
  "const canonical={validateCorpus:c=>({valid:c.schema_version==='3.0.0'}),digest:()=>H};",
  "const rename=fs.renameSync;",
  "fs.renameSync=function(from,to){",
  " if(String(from).includes('.pending')&&String(to).includes('transactions')){",
  "  if(phase==='before')process.exit(77);",
  "  rename.call(fs,from,to);process.exit(78);",
  " }",
  " return rename.call(fs,from,to);",
  "};",
  "store.createTransaction(root,input,canonical);",
  "process.exit(79);"
 ].join('\n');
 return spawnSync(process.execPath,['-e',script,
  path.resolve(__dirname,'../transaction-store.cjs'),root,phase],
  {encoding:'utf8',timeout:15000});
}
for(const [phase,exitCode] of [['before',77],['after',78]]){
 test('abrupt child process exit '+phase+' directory rename preserves forensic truth',t=>{
  const f=fixture(t),child=killDuringCommit(f.root,phase);
  assert.equal(child.error,undefined);
  assert.equal(child.status,exitCode,child.stderr);
  const report=assessRecovery(f.root,canonical);
  assert.equal(report.lock_status,'reserved');
  assert.equal(report.safe_to_start_new_write,false);
  assert.equal(report.recovery_performed,false);
  if(phase==='before'){
   assert.equal(report.committed_count,0);
   assert.equal(report.pending_verified_for_review.length,1);
   assert.deepEqual(fs.readdirSync(path.join(f.root,'transactions')),[]);
  }else{
   assert.equal(report.committed_count,1);
   assert.deepEqual(report.pending_verified_for_review,[]);
  }
  assert.deepEqual(inspectWriterReservation(f.root),{status:'reserved'});
  assert.throws(()=>createTransaction(f.root,f,canonical),{code:'TRANSACTION_WRITER_BUSY'});
 });
}

test('offline recovery CLI reports clean folder without writing any files',t=>{
 const f=fixture(t),script=path.resolve(__dirname,'../scripts/assess-recovery.cjs');
 const child=spawnSync(process.execPath,[script,f.root],{encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr);
 const report=JSON.parse(child.stdout);
 assert.equal(report.mode,'read_only_assessment');
 assert.equal(report.safe_to_start_new_write,true);
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('offline recovery CLI returns nonzero attention status and leaves orphan intact',t=>{
 const f=fixture(t),script=path.resolve(__dirname,'../scripts/assess-recovery.cjs');
 const dir=path.join(f.root,'.pending','c'.repeat(32));
 fs.mkdirSync(path.dirname(dir));fs.mkdirSync(dir);
 fs.writeFileSync(path.join(dir,'corpus.json'),'partial');
 const child=spawnSync(process.execPath,[script,f.root],{encoding:'utf8',timeout:10000});
 assert.equal(child.status,2,child.stderr);
 assert.deepEqual(JSON.parse(child.stdout).pending_incomplete,['c'.repeat(32)]);
 assert.equal(fs.readFileSync(path.join(dir,'corpus.json'),'utf8'),'partial');
});

for(const name of ['transactions','.pending']){
 test('dangling symlink as '+name+' is never reported as a clean absent folder',t=>{
  const f=fixture(t),link=path.join(f.root,name),missing=path.join(f.root,'non-existent-destination');
  try{fs.symlinkSync(missing,link,process.platform==='win32'?'junction':'dir');}
  catch(error){
   if(process.platform==='win32'&&['EPERM','EACCES','ENOTSUP'].includes(error.code))
    return;
   throw error;
  }
  assert.equal(fs.existsSync(link),false);
  assert.throws(()=>assessRecovery(f.root,canonical),
   {code:'TRANSACTION_DIRECTORY_UNSAFE'});
  assert.equal(fs.lstatSync(link).isSymbolicLink(),true);
 });
}

test('uncertain commit can be matched read-only to a verified visible transaction',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 const original=fs.readFileSync(path.join(f.root,'transactions',
  receipt.transaction_id,'corpus.json'));
 const report=inspectCommittedIdentity(f.root,canonical,f.identity);
 assert.deepEqual(report.matching_transaction_ids,[receipt.transaction_id]);
 assert.deepEqual(report.unverified_transactions,[]);
 assert.equal(report.pending_transaction_count,0);
 assert.equal(report.inspected_only,true);
 assert.equal(report.files_modified,false);
 assert.equal(report.scientific_approval,false);
 assert.equal(report.published,false);
 assert.deepEqual(fs.readFileSync(path.join(f.root,'transactions',
  receipt.transaction_id,'corpus.json')),original);
});
test('inspection never confuses another batch with the expected transaction',t=>{
 const f=fixture(t);
 createTransaction(f.root,f,canonical);
 const other={...f.identity,batch_id:'b'.repeat(64)};
 assert.deepEqual(inspectCommittedIdentity(f.root,canonical,other).matching_transaction_ids,[]);
});
test('tampered committed transaction is never presented as a verified match',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 fs.writeFileSync(path.join(f.root,'transactions',receipt.transaction_id,
  'journal.json'),'{}');
 const report=inspectCommittedIdentity(f.root,canonical,f.identity);
 assert.deepEqual(report.matching_transaction_ids,[]);
 assert.deepEqual(report.unverified_transactions,[receipt.transaction_id]);
});
test('read-only transaction matching cannot be called with incomplete digests',t=>{
 const f=fixture(t);
 assert.throws(()=>inspectCommittedIdentity(f.root,canonical,
  {batch_id:H}),{code:'TRANSACTION_IDENTITY_INVALID'});
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('after real child process exit after rename, matching detects a visible commit but lock stays reserved',t=>{
 const f=fixture(t),child=killDuringCommit(f.root,'after');
 assert.equal(child.status,78,child.stderr);
 const match=inspectCommittedIdentity(f.root,canonical,f.identity);
 assert.equal(match.matching_transaction_ids.length,1);
 assert.equal(match.inspected_only,true);
 assert.deepEqual(inspectWriterReservation(f.root),{status:'reserved'});
 assert.throws(()=>createTransaction(f.root,f,canonical),{code:'TRANSACTION_WRITER_BUSY'});
});
