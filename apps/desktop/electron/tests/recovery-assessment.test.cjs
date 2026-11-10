'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {assessRecovery}=require('../recovery-assessment.cjs');
const {createTransaction,inspectTransactions,inspectWriterReservation,inspectPendingEvidence,inspectCommittedIdentity}=
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

test('offline operator can match a real SDK transaction using exactly five digests',t=>{
 const sdk=require('tempora-framework');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-real-match-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,
  '../../examples/synthetic-canonical-v3.json'),'utf8'));
 const hash=sdk.canonical.digest(corpus);
 const identity={batch_id:H,source_sha256:H,base_sha256:H,
  mapping_sha256:H,output_sha256:hash};
 const journal={decision:'accepted_for_local_staging',batch_id:H,
  base_sha256:H,output_sha256:hash,scientific_approval:false};
 const receipt=createTransaction(root,{corpus,journal,identity},sdk.canonical);
 const script=path.resolve(__dirname,'../scripts/assess-recovery.cjs');
 const args=[script,root,'--match',identity.batch_id,identity.source_sha256,
  identity.base_sha256,identity.mapping_sha256,identity.output_sha256];
 const result=spawnSync(process.execPath,args,{encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);
 assert.deepEqual(report.identity_matching.matching_transaction_ids,[receipt.transaction_id]);
 assert.equal(report.identity_matching.files_modified,false);
 assert.equal(report.durability_certified,false);
 assert.equal(report.receipt_reissued,false);
 assert.equal(report.operator_review_required,false);
 const wrong=[...args];wrong[3]='b'.repeat(64);
 const mismatch=spawnSync(process.execPath,wrong,{encoding:'utf8',timeout:10000});
 assert.equal(mismatch.status,2,mismatch.stderr);
 assert.deepEqual(JSON.parse(mismatch.stdout).identity_matching.matching_transaction_ids,[]);
});
test('offline matching refuses invalid digests without changing the root',t=>{
 const f=fixture(t),script=path.resolve(__dirname,'../scripts/assess-recovery.cjs');
 const args=[script,f.root,'--match','not-a-hash',H,H,H,H];
 const outcome=spawnSync(process.execPath,args,{encoding:'utf8',timeout:10000});
 assert.equal(outcome.status,3);
 assert.match(outcome.stderr,/TRANSACTION_IDENTITY_INVALID/);
 assert.deepEqual(fs.readdirSync(f.root),[]);
});

test('recovery assessment refuses a lock acquired during inventory',t=>{
 const f=fixture(t),pending=path.join(f.root,'.pending');
 fs.mkdirSync(pending);
 const original=fs.readdirSync;let injected=false;
 fs.readdirSync=function(location,...args){
  if(!injected&&String(location)===pending){
   injected=true;
   const lock=path.join(f.root,'.writer-lock');
   fs.mkdirSync(lock);
   fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({
    schema_version:'1.0.0',nonce:'a'.repeat(32)
   })+'\n');
  }
  return original.call(fs,location,...args);
 };
 try{
  assert.throws(()=>assessRecovery(f.root,canonical),{code:'RECOVERY_SNAPSHOT_CHANGED'});
 }finally{fs.readdirSync=original;}
 assert.equal(injected,true);
 assert.deepEqual(inspectWriterReservation(f.root),{status:'reserved'});
});
test('recovery report refuses 101 pending candidates instead of returning unbounded metadata',t=>{
 const f=fixture(t),pending=path.join(f.root,'.pending');
 fs.mkdirSync(pending);
 for(let n=0;n<101;n++)
   fs.mkdirSync(path.join(pending,n.toString(16).padStart(32,'0')));
 assert.throws(()=>assessRecovery(f.root,canonical),{code:'RECOVERY_REPORT_LIMIT'});
 assert.equal(fs.readdirSync(pending).length,101);
});


// One reproducible subprocess fault-injection matrix instead of a separate
// CI workflow for every crash point. process.exit() simulates Node process
// loss only, NOT Windows shutdown, NTFS durability or power failure.
function crashAtDurabilityBoundary(root,phase){
 const script=[
  "'use strict';",
  "const fs=require('node:fs');",
  "const store=require(process.argv[1]);",
  "const root=process.argv[2],phase=process.argv[3],H='a'.repeat(64);",
  "const input={corpus:{schema_version:'3.0.0',events:[]},",
  "identity:{batch_id:H,source_sha256:H,base_sha256:H,mapping_sha256:H,output_sha256:H},",
  "journal:{decision:'accepted_for_local_staging',batch_id:H,base_sha256:H,output_sha256:H,scientific_approval:false}};",
  "const canonical={validateCorpus:c=>({valid:c.schema_version==='3.0.0'}),digest:()=>H};",
  "const originalSync=fs.fsyncSync;let syncCount=0;",
  "fs.fsyncSync=function(...args){const result=originalSync.apply(fs,args);",
  " syncCount++;",
  " const names={owner:1,corpus:2,journal:3,manifest:4};",
  " if(names[phase]===syncCount)process.exit(70+syncCount);",
  " return result;};",
  "const originalRename=fs.renameSync;",
  "fs.renameSync=function(from,to){",
  " if(String(from).includes('.pending')&&String(to).includes('transactions')){",
  "  if(phase==='before_commit')process.exit(75);",
  "  const result=originalRename.call(fs,from,to);",
  "  if(phase==='after_commit')process.exit(76);",
  "  return result;",
  " }",
  " return originalRename.call(fs,from,to);",
  "};",
  "store.createTransaction(root,input,canonical);",
  "process.exit(99);"
 ].join('\n');
 return spawnSync(process.execPath,['-e',script,
  path.resolve(__dirname,'../transaction-store.cjs'),root,phase],
  {encoding:'utf8',timeout:15000});
}
const interruptionMatrix=[
 {phase:'owner',exit:71,verified:0,incomplete:0,committed:0},
 {phase:'corpus',exit:72,verified:0,incomplete:1,committed:0},
 {phase:'journal',exit:73,verified:0,incomplete:1,committed:0},
 {phase:'manifest',exit:74,verified:1,incomplete:0,committed:0},
 {phase:'before_commit',exit:75,verified:1,incomplete:0,committed:0},
 {phase:'after_commit',exit:76,verified:0,incomplete:0,committed:1}
];
for(const boundary of interruptionMatrix){
 test('crash matrix '+boundary.phase+' leaves only inspectable evidence and blocks replay',t=>{
  const f=fixture(t);
  const child=crashAtDurabilityBoundary(f.root,boundary.phase);
  assert.equal(child.error,undefined);
  assert.equal(child.status,boundary.exit,child.stderr);
  const rootEntriesBefore=fs.readdirSync(f.root).sort();
  const report=assessRecovery(f.root,canonical);
  assert.equal(report.lock_status,'reserved');
  assert.equal(report.safe_to_start_new_write,false);
  assert.equal(report.requires_manual_attention,true);
  assert.equal(report.committed_count,boundary.committed);
  assert.equal(report.pending_verified_for_review.length,boundary.verified);
  assert.equal(report.pending_incomplete.length,boundary.incomplete);
  assert.deepEqual(report.pending_unsafe,[]);
  assert.equal(report.files_modified,false);
  assert.equal(report.recovery_performed,false);
  assert.equal(report.published,false);
  assert.deepEqual(fs.readdirSync(f.root).sort(),rootEntriesBefore);
  assert.throws(()=>createTransaction(f.root,f,canonical),
   {code:'TRANSACTION_WRITER_BUSY'});
  assert.deepEqual(fs.readdirSync(f.root).sort(),rootEntriesBefore);
  if(boundary.phase==='after_commit'){
   const reconciled=inspectCommittedIdentity(f.root,canonical,f.identity);
   assert.equal(reconciled.matching_transaction_ids.length,1);
   assert.equal(reconciled.files_modified,false);
  }
 });
}

test('lock replacement with identical reserved status invalidates recovery snapshot',t=>{
 const f=fixture(t),pending=path.join(f.root,'.pending'),
       lock=path.join(f.root,'.writer-lock'),retired=path.join(f.root,'.writer-lock-original');
 fs.mkdirSync(pending);fs.mkdirSync(lock);
 const owner=JSON.stringify({schema_version:'1.0.0',nonce:'a'.repeat(32)})+'\n';
 fs.writeFileSync(path.join(lock,'owner.json'),owner);
 assert.deepEqual(inspectWriterReservation(f.root),{status:'reserved'});
 const readdir=fs.readdirSync;let swapped=false;
 fs.readdirSync=function(location,...args){
  if(!swapped&&String(location)===pending){
   swapped=true;
   fs.renameSync(lock,retired);
   fs.mkdirSync(lock);
   fs.writeFileSync(path.join(lock,'owner.json'),owner);
  }
  return readdir.call(fs,location,...args);
 };
 try{
  assert.throws(()=>assessRecovery(f.root,canonical),
   {code:'RECOVERY_SNAPSHOT_CHANGED'});
 }finally{fs.readdirSync=readdir;}
 assert.equal(swapped,true);
 assert.deepEqual(inspectWriterReservation(f.root),{status:'reserved'});
 assert.equal(fs.readFileSync(path.join(retired,'owner.json'),'utf8'),owner);
 assert.equal(fs.readFileSync(path.join(lock,'owner.json'),'utf8'),owner);
});

test('concurrent modification of a finalized journal invalidates a previously clean inspection',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical),
  pendingRoot=path.join(f.root,'.pending'),
  journal=path.join(f.root,'transactions',receipt.transaction_id,'journal.json');
 const readdir=fs.readdirSync;let mutated=false;
 fs.readdirSync=function(location,...args){
  if(!mutated&&String(location)===pendingRoot){
   mutated=true;
   fs.writeFileSync(journal,'{}');
  }
  return readdir.call(fs,location,...args);
 };
 try{
  assert.throws(()=>assessRecovery(f.root,canonical),{code:'RECOVERY_SNAPSHOT_CHANGED'});
 }finally{fs.readdirSync=readdir;}
 assert.equal(mutated,true);
 assert.equal(fs.readFileSync(journal,'utf8'),'{}');
 assert.deepEqual(inspectTransactions(f.root,canonical).invalid,[receipt.transaction_id]);
});
test('pending evidence changed between two classifications invalidates forensic snapshot',t=>{
 const f=fixture(t),pendingRoot=path.join(f.root,'.pending');
 fs.mkdirSync(pendingRoot);
 const id='e'.repeat(32),dir=path.join(pendingRoot,id);
 fs.mkdirSync(dir);
 const manifest={schema_version:'1.0.0',transaction_id:id,...f.identity,
  engine_version:'3.0.0',published:false,scientific_approval:false,
  corpus_file_sha256:'',journal_sha256:''};
 const crypto=require('node:crypto');
 const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 const corpusBytes=Buffer.from(JSON.stringify(f.corpus)+'\n');
 const journalBytes=Buffer.from(JSON.stringify(f.journal)+'\n');
 manifest.corpus_file_sha256=hash(corpusBytes);
 manifest.journal_sha256=hash(journalBytes);
 fs.writeFileSync(path.join(dir,'corpus.json'),corpusBytes);
 fs.writeFileSync(path.join(dir,'journal.json'),journalBytes);
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest)+'\n');
 const transactions=path.join(f.root,'transactions');
 fs.mkdirSync(transactions);
 const readdir=fs.readdirSync;let observed=0;
 fs.readdirSync=function(location,...args){
  if(String(location)===transactions&&++observed===2){
    // First pending classification has already finished; the second one
    // must detect this tampering rather than returning the first answer.
    fs.writeFileSync(path.join(dir,'journal.json'),'{}');
  }
  return readdir.call(fs,location,...args);
 };
 try{
  assert.throws(()=>assessRecovery(f.root,canonical),{code:'RECOVERY_SNAPSHOT_CHANGED'});
 }finally{fs.readdirSync=readdir;}
 assert.ok(observed>=2);
 assert.deepEqual(inspectPendingEvidence(f.root,canonical).unsafe,[id]);
});
