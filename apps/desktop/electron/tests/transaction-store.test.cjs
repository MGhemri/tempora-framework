'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createTransaction,inspectTransactions,inspectWriterReservation,inspectPendingEvidence}=require('../transaction-store.cjs');
const sdk = require('tempora-framework');
const H='a'.repeat(64);
const canonical={validateCorpus:corpus=>({valid:corpus && corpus.schema_version==='3.0.0'}),digest:()=>H};
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-import-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const identity={batch_id:H,source_sha256:H,base_sha256:H,mapping_sha256:H,output_sha256:H};
  return {root,identity,corpus:{schema_version:'3.0.0',events:[]},journal:{decision:'accepted_for_local_staging',batch_id:H,base_sha256:H,output_sha256:H,scientific_approval:false}};
}
test('one logical commit retains corpus, journal and manifest together',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 assert.equal(receipt.saved_to_disk,true);
 assert.equal(receipt.published,false);
 const location=path.join(f.root,'transactions',receipt.transaction_id);
 assert.deepEqual(fs.readdirSync(location).sort(),['corpus.json','journal.json','manifest.json']);
 assert.deepEqual(inspectTransactions(f.root,canonical),{complete:[receipt.transaction_id],invalid:[],pending:[]});
});
test('journal digest mismatch refuses mutation',t=>{
 const f=fixture(t);f.journal.output_sha256='b'.repeat(64);
 assert.throws(()=>createTransaction(f.root,f,canonical),{code:'TRANSACTION_JOURNAL_MISMATCH'});
 assert.equal(fs.existsSync(path.join(f.root,'transactions')),false);
});
test('tampering with a committed journal is detected',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 fs.writeFileSync(path.join(f.root,'transactions',receipt.transaction_id,'journal.json'),'{}');
 assert.deepEqual(inspectTransactions(f.root,canonical),{complete:[],invalid:[receipt.transaction_id],pending:[]});
});
test('an abandoned pending directory is reported, never removed',t=>{
 const f=fixture(t);const dir=path.join(f.root,'.pending','b'.repeat(32));
 fs.mkdirSync(path.dirname(dir));fs.mkdirSync(path.join(f.root,'transactions'));fs.mkdirSync(dir);
 assert.deepEqual(inspectTransactions(f.root,canonical),{complete:[],invalid:[],pending:['b'.repeat(32)]});
 assert.equal(fs.existsSync(dir),true);
});
test('root symlink is refused',t=>{
 const f=fixture(t),link=path.join(os.tmpdir(),'tempora-link-'+process.pid+'-'+Date.now());
 try {fs.symlinkSync(f.root,link,'dir');}
 catch(e){if(process.platform==='win32'&&e.code==='EPERM')return;throw e;}
 t.after(()=>fs.rmSync(link,{force:true}));
 assert.throws(()=>createTransaction(link,f,canonical),{code:'TRANSACTION_ROOT_UNSAFE'});
});

test('canonical SDK adapter is mandatory and its digest must match',t=>{
 const f=fixture(t);
 assert.throws(()=>createTransaction(f.root,f),{code:'TRANSACTION_CANONICAL_ADAPTER_REQUIRED'});
 assert.throws(()=>createTransaction(f.root,f,{validateCorpus:()=>({valid:true}),digest:()=>('b'.repeat(64))}),
  {code:'TRANSACTION_CANONICAL_DIGEST_MISMATCH'});
 assert.equal(fs.existsSync(path.join(f.root,'.pending')),false);
});
test('inspection of an empty root does not create any directory',t=>{
 const f=fixture(t);
 assert.deepEqual(inspectTransactions(f.root,canonical),{complete:[],invalid:[],pending:[]});
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('mismatched base hash in journal is rejected before any mutation',t=>{
 const f=fixture(t);f.journal.base_sha256='b'.repeat(64);
 assert.throws(()=>createTransaction(f.root,f,canonical),{code:'TRANSACTION_JOURNAL_MISMATCH'});
 assert.deepEqual(fs.readdirSync(f.root),[]);
});

test('real TEMPORA SDK canonical validates and digests a persisted corpus',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-sdk-persist-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,'../../examples/synthetic-canonical-v3.json'),'utf8'));
 assert.equal(sdk.canonical.validateCorpus(corpus).valid,true);
 const resultHash=sdk.canonical.digest(corpus),base='b'.repeat(64),batch='c'.repeat(64);
 const input={corpus,identity:{batch_id:batch,source_sha256:'d'.repeat(64),
   base_sha256:base,mapping_sha256:'e'.repeat(64),output_sha256:resultHash},
   journal:{decision:'accepted_for_local_staging',batch_id:batch,base_sha256:base,
     output_sha256:resultHash,scientific_approval:false}};
 const receipt=createTransaction(root,input,sdk.canonical);
 assert.equal(receipt.output_sha256,resultHash);
 assert.deepEqual(inspectTransactions(root,sdk.canonical),
   {complete:[receipt.transaction_id],invalid:[],pending:[]});
});
test('real canonical hash rejects content changed after the claimed digest',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-sdk-mismatch-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,'../../examples/synthetic-canonical-v3.json'),'utf8'));
 const hash=sdk.canonical.digest(corpus);
 const identity={batch_id:H,source_sha256:H,base_sha256:H,mapping_sha256:H,output_sha256:hash};
 const journal={decision:'accepted_for_local_staging',batch_id:H,base_sha256:H,
   output_sha256:hash,scientific_approval:false};
 corpus.extensions={...corpus.extensions,unapproved_change:true};
 assert.throws(()=>createTransaction(root,{corpus,journal,identity},sdk.canonical),
   {code:'TRANSACTION_CANONICAL_DIGEST_MISMATCH'});
 assert.deepEqual(fs.readdirSync(root),[]);
});

test('real SDK preview/accept roundtrip is persisted without changing the working base',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-accept-persist-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const base=JSON.parse(fs.readFileSync(path.join(__dirname,'../../examples/synthetic-canonical-v3.json'),'utf8'));
 assert.equal(sdk.canonical.validateCorpus(base).valid,true);
 const mapping={mapping_schema_version:'1.0.0',id:'synthetic-transaction',
   version:'1.0.0',profile_id:base.profile.id,profile_version:base.profile.version,
   format:'json',fields:{id:'/id',title:{en:'/name'},start_date:'/date',event_type:'/type'}};
 const bytes=Buffer.from(JSON.stringify([{id:'PERSIST_TEST_1',
   name:'Fictional event',date:'1701',type:'fictional assembly'}]));
 const preview=sdk.ingestion.preview({corpus:base,mapping,bytes,
   sourceName:'fictional.json',observedAt:null});
 assert.equal(preview.report.summary.create,1);
 const review={batch_id:preview.report.batch_id,ids:['PERSIST_TEST_1'],
   reviewer:'Test researcher',reason:'Synthetic transaction integration test',
   reviewed_at:'2026-11-09T00:00:00Z'};
 const accepted=sdk.ingestion.accept({corpus:base,bundle:preview,review});
 assert.equal(accepted.journal.decision,'accepted_for_local_staging');
 assert.equal(sdk.canonical.validateCorpus(accepted.corpus).valid,true);
 const identity={batch_id:preview.report.batch_id,source_sha256:preview.report.source.sha256,
   base_sha256:preview.report.base_sha256,mapping_sha256:preview.report.mapping.sha256,
   output_sha256:accepted.journal.output_sha256};
 const receipt=createTransaction(root,{corpus:accepted.corpus,journal:accepted.journal,identity},sdk.canonical);
 assert.equal(receipt.saved_to_disk,true);
 assert.equal(receipt.output_sha256,sdk.canonical.digest(accepted.corpus));
 assert.equal(base.events.some(e=>e.id==='PERSIST_TEST_1'),false);
 assert.deepEqual(inspectTransactions(root,sdk.canonical),
   {complete:[receipt.transaction_id],invalid:[],pending:[]});
});

test('modified committed corpus is rejected even when journal remains intact',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 const corpusPath=path.join(f.root,'transactions',receipt.transaction_id,'corpus.json');
 fs.writeFileSync(corpusPath,JSON.stringify({schema_version:'3.0.0',events:[{id:'FORGED'}]})+'\n');
 assert.deepEqual(inspectTransactions(f.root,canonical),
   {complete:[],invalid:[receipt.transaction_id],pending:[]});
});
test('modified transaction manifest is detected on inspection',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 const dir=path.join(f.root,'transactions',receipt.transaction_id);
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 manifest.output_sha256='f'.repeat(64);
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest)+'\n');
 assert.deepEqual(inspectTransactions(f.root,canonical),
   {complete:[],invalid:[receipt.transaction_id],pending:[]});
});
test('the scientific journal cannot claim published status or omit local staging decision',t=>{
 const f=fixture(t);f.journal.decision='published';
 assert.throws(()=>createTransaction(f.root,f,canonical),{code:'TRANSACTION_JOURNAL_MISMATCH'});
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('committed transaction inspection never mutates source files',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 const dir=path.join(f.root,'transactions',receipt.transaction_id);
 const before=['corpus.json','journal.json','manifest.json'].map(name=>
   fs.readFileSync(path.join(dir,name)));
 assert.equal(inspectTransactions(f.root,canonical).complete.length,1);
 const after=['corpus.json','journal.json','manifest.json'].map(name=>
   fs.readFileSync(path.join(dir,name)));
 assert.deepEqual(after,before);
});

test('unexpected files inside an immutable transaction invalidate inspection',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 const dir=path.join(f.root,'transactions',receipt.transaction_id);
 fs.writeFileSync(path.join(dir,'untracked.txt'),'untracked payload');
 assert.deepEqual(inspectTransactions(f.root,canonical),
   {complete:[],invalid:[receipt.transaction_id],pending:[]});
});
test('transaction directory symbolic links are never traversed by the verifier',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 const actual=path.join(f.root,'transactions',receipt.transaction_id);
 const target=path.join(f.root,'retained-original');
 fs.renameSync(actual,target);
 try { fs.symlinkSync(target,actual,'dir'); }
 catch(e) {
   if(process.platform==='win32' && (e.code==='EPERM'||e.code==='EACCES')) return;
   throw e;
 }
 assert.deepEqual(inspectTransactions(f.root,canonical),
   {complete:[],invalid:[receipt.transaction_id],pending:[]});
});

test('symlinked journal is rejected without following its external target',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 const dir=path.join(f.root,'transactions',receipt.transaction_id);
 const journalPath=path.join(dir,'journal.json');
 const outside=path.join(f.root,'outside-journal.json');
 fs.renameSync(journalPath,outside);
 try {fs.symlinkSync(outside,journalPath,'file');}
 catch(e) {
   if(process.platform==='win32' && (e.code==='EPERM'||e.code==='EACCES'))return;
   throw e;
 }
 assert.deepEqual(inspectTransactions(f.root,canonical),
   {complete:[],invalid:[receipt.transaction_id],pending:[]});
 assert.ok(fs.existsSync(outside));
});

test('a pre-existing cross-process reservation refuses all writes and is never reclaimed',t=>{
 const f=fixture(t),lock=path.join(f.root,'.writer-lock');
 fs.mkdirSync(lock);
 fs.writeFileSync(path.join(lock,'owner.json'),'{"nonce":"external"}\n');
 assert.throws(()=>createTransaction(f.root,f,canonical),
   {code:'TRANSACTION_WRITER_BUSY'});
 assert.deepEqual(fs.readdirSync(f.root),['.writer-lock']);
 assert.ok(fs.existsSync(path.join(lock,'owner.json')));
});
test('a completed commit releases only its owned writer reservation',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f,canonical);
 assert.equal(receipt.saved_to_disk,true);
 assert.equal(fs.existsSync(path.join(f.root,'.writer-lock')),false);
 assert.deepEqual(inspectTransactions(f.root,canonical),
  {complete:[receipt.transaction_id],invalid:[],pending:[]});
});
test('failing validation does not create or touch the cross-process reservation',t=>{
 const f=fixture(t);f.journal.output_sha256='b'.repeat(64);
 assert.throws(()=>createTransaction(f.root,f,canonical),
  {code:'TRANSACTION_JOURNAL_MISMATCH'});
 assert.deepEqual(fs.readdirSync(f.root),[]);
});

test('read-only reservation inspection distinguishes absent, reserved and unsafe',t=>{
 const f=fixture(t),lock=path.join(f.root,'.writer-lock');
 assert.deepEqual(inspectWriterReservation(f.root),{status:'absent'});
 assert.deepEqual(fs.readdirSync(f.root),[]);
 fs.mkdirSync(lock);
 fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({
  schema_version:'1.0.0',nonce:'e'.repeat(32)})+'\n');
 assert.deepEqual(inspectWriterReservation(f.root),{status:'reserved'});
 assert.equal(fs.existsSync(lock),true);
 fs.writeFileSync(path.join(lock,'extra.txt'),'unexpected');
 assert.deepEqual(inspectWriterReservation(f.root),{status:'unsafe'});
 assert.equal(fs.existsSync(path.join(lock,'extra.txt')),true);
});

test('a live reservation owner is valid JSON and observable without mutation',t=>{
 const f=fixture(t);
 const originalRename=fs.renameSync;
 let checked=false;
 fs.renameSync=function(from,to){
   assert.deepEqual(inspectWriterReservation(f.root),{status:'reserved'});
   const owner=fs.readFileSync(path.join(f.root,'.writer-lock','owner.json'),'utf8');
   assert.equal(JSON.parse(owner).schema_version,'1.0.0');
   checked=true;
   return originalRename.call(fs,from,to);
 };
 try {
   const receipt=createTransaction(f.root,f,canonical);
   assert.equal(receipt.saved_to_disk,true);
 } finally {
   fs.renameSync=originalRename;
 }
 assert.equal(checked,true);
 assert.deepEqual(inspectWriterReservation(f.root),{status:'absent'});
});
test('repeated identical staging is rejected without a second committed directory',t=>{
 const f=fixture(t),first=createTransaction(f.root,f,canonical);
 assert.throws(()=>createTransaction(f.root,f,canonical),
  {code:'TRANSACTION_ALREADY_COMMITTED'});
 assert.deepEqual(inspectTransactions(f.root,canonical),
  {complete:[first.transaction_id],invalid:[],pending:[]});
 assert.deepEqual(inspectWriterReservation(f.root),{status:'absent'});
});
test('a preexisting damaged transaction blocks new writes without hiding corruption',t=>{
 const f=fixture(t),first=createTransaction(f.root,f,canonical);
 fs.writeFileSync(path.join(f.root,'transactions',first.transaction_id,'journal.json'),'{}');
 assert.throws(()=>createTransaction(f.root,f,canonical),
  {code:'TRANSACTION_PREEXISTING_INVALID'});
 assert.deepEqual(inspectTransactions(f.root,canonical),
  {complete:[],invalid:[first.transaction_id],pending:[]});
 assert.deepEqual(inspectWriterReservation(f.root),{status:'absent'});
});
test('a distinct reviewed output for the same batch is not mistaken for a replay',t=>{
 const f=fixture(t);
 const adapter={validateCorpus:canonical.validateCorpus,
   digest:corpus=>corpus.events.length?'b'.repeat(64):H};
 const first=createTransaction(f.root,f,adapter);
 const alternative={...f,
   corpus:{schema_version:'3.0.0',events:[{id:'NEW_PROPOSAL'}]},
   identity:{...f.identity,output_sha256:'b'.repeat(64)},
   journal:{...f.journal,output_sha256:'b'.repeat(64)}};
 const second=createTransaction(f.root,alternative,adapter);
 assert.notEqual(first.transaction_id,second.transaction_id);
 assert.deepEqual(inspectTransactions(f.root,adapter),
   {complete:[first.transaction_id,second.transaction_id].sort(),invalid:[],pending:[]});
});

test('failed directory commit preserves complete pending evidence without publishing',t=>{
 const f=fixture(t),originalRename=fs.renameSync;
 fs.renameSync=function(from,to){
   if(from.includes(path.sep+'.pending'+path.sep)&&to.includes(path.sep+'transactions'+path.sep)){
     const e=Object.assign(new Error('simulated commit failure'),{code:'EIO'});
     throw e;
   }
   return originalRename.call(fs,from,to);
 };
 try {
   assert.throws(()=>createTransaction(f.root,f,canonical),{code:'EIO'});
 } finally {fs.renameSync=originalRename;}
 const state=inspectTransactions(f.root,canonical);
 assert.deepEqual(state.complete,[]);
 assert.deepEqual(state.invalid,[]);
 assert.equal(state.pending.length,1);
 const pending=path.join(f.root,'.pending',state.pending[0]);
 assert.deepEqual(fs.readdirSync(pending).sort(),
  ['corpus.json','journal.json','manifest.json']);
 assert.deepEqual(inspectWriterReservation(f.root),{status:'absent'});
 assert.equal(fs.existsSync(path.join(f.root,'transactions',state.pending[0])),false);
});
test('a failed later commit does not modify a previously completed corpus',t=>{
 const f=fixture(t),first=createTransaction(f.root,f,canonical);
 const saved=path.join(f.root,'transactions',first.transaction_id,'corpus.json');
 const before=fs.readFileSync(saved);
 const alternative={...f,identity:{...f.identity,batch_id:'b'.repeat(64)},
   journal:{...f.journal,batch_id:'b'.repeat(64)}};
 const originalRename=fs.renameSync;
 fs.renameSync=function(from,to){
   if(from.includes(path.sep+'.pending'+path.sep)){
     throw Object.assign(new Error('simulated interrupted commit'),{code:'EIO'});
   }
   return originalRename.call(fs,from,to);
 };
 try {assert.throws(()=>createTransaction(f.root,alternative,canonical),{code:'EIO'});}
 finally {fs.renameSync=originalRename;}
 assert.deepEqual(fs.readFileSync(saved),before);
 const state=inspectTransactions(f.root,canonical);
 assert.deepEqual(state.complete,[first.transaction_id]);
 assert.equal(state.pending.length,1);
});

test('a second real Node process cannot write while first process owns reservation',t=>{
 const f=fixture(t),originalRename=fs.renameSync;
 const {spawnSync}=require('node:child_process');
 let childChecked=false;
 fs.renameSync=function(from,to){
   const source=String(from),target=String(to);
   if(source.includes(path.sep+'.pending'+path.sep)&&
      target.includes(path.sep+'transactions'+path.sep)){
     const script=[
       "'use strict';",
       "const {createTransaction}=require(process.argv[1]);",
       "const H='a'.repeat(64);",
       "const canonical={validateCorpus:()=>({valid:true}),digest:()=>H};",
       "const identity={batch_id:H,source_sha256:H,base_sha256:H,mapping_sha256:H,output_sha256:H};",
       "try {createTransaction(process.argv[2],{identity,corpus:{schema_version:'3.0.0',events:[]},",
       "journal:{decision:'accepted_for_local_staging',batch_id:H,base_sha256:H,output_sha256:H,scientific_approval:false}},canonical);",
       "process.exit(2);}catch(e){process.stdout.write(String(e.code));process.exit(e.code==='TRANSACTION_WRITER_BUSY'?0:3);}"
     ].join('\n');
     const child=spawnSync(process.execPath,['-e',script,
       path.resolve(__dirname,'../transaction-store.cjs'),f.root],
       {encoding:'utf8',timeout:10000});
     assert.equal(child.error,undefined);
     assert.equal(child.status,0,child.stderr);
     assert.equal(child.stdout,'TRANSACTION_WRITER_BUSY');
     childChecked=true;
   }
   return originalRename.call(fs,from,to);
 };
 try {
   const receipt=createTransaction(f.root,f,canonical);
   assert.equal(receipt.saved_to_disk,true);
 } finally {fs.renameSync=originalRename;}
 assert.equal(childChecked,true);
 assert.deepEqual(inspectWriterReservation(f.root),{status:'absent'});
 assert.equal(inspectTransactions(f.root,canonical).complete.length,1);
});

test('orphaned pending transaction blocks new writers without deleting evidence',t=>{
 const f=fixture(t),pending=path.join(f.root,'.pending','b'.repeat(32));
 fs.mkdirSync(path.dirname(pending));fs.mkdirSync(pending);
 fs.writeFileSync(path.join(pending,'corpus.json'),'incomplete');
 assert.throws(()=>createTransaction(f.root,f,canonical),
  {code:'TRANSACTION_PENDING_RECOVERY_REQUIRED'});
 assert.equal(fs.readFileSync(path.join(pending,'corpus.json'),'utf8'),'incomplete');
 assert.deepEqual(inspectTransactions(f.root,canonical),
  {complete:[],invalid:[],pending:['b'.repeat(32)]});
 assert.deepEqual(inspectWriterReservation(f.root),{status:'absent'});
});
test('pending recovery gate also protects previously committed corpus',t=>{
 const f=fixture(t),first=createTransaction(f.root,f,canonical);
 const original=path.join(f.root,'transactions',first.transaction_id,'corpus.json');
 const before=fs.readFileSync(original);
 const pending=path.join(f.root,'.pending','e'.repeat(32));
 fs.mkdirSync(pending);
 const other={...f,identity:{...f.identity,batch_id:'f'.repeat(64)},
  journal:{...f.journal,batch_id:'f'.repeat(64)}};
 assert.throws(()=>createTransaction(f.root,other,canonical),
  {code:'TRANSACTION_PENDING_RECOVERY_REQUIRED'});
 assert.deepEqual(fs.readFileSync(original),before);
 assert.equal(fs.existsSync(pending),true);
});

test('forensic pending inventory is read only and empty roots stay untouched',t=>{
 const f=fixture(t);
 assert.deepEqual(inspectPendingEvidence(f.root,canonical),
  {verified_for_review:[],incomplete:[],unsafe:[]});
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('an interrupted complete directory is verified only for manual review',t=>{
 const f=fixture(t),originalRename=fs.renameSync;
 fs.renameSync=function(from,to) {
  if(String(from).includes(path.sep+'.pending'+path.sep))
   throw Object.assign(new Error('simulated interruption'),{code:'EIO'});
  return originalRename.call(fs,from,to);
 };
 try {assert.throws(()=>createTransaction(f.root,f,canonical),{code:'EIO'});}
 finally {fs.renameSync=originalRename;}
 const before=inspectTransactions(f.root,canonical).pending;
 assert.equal(before.length,1);
 assert.deepEqual(inspectPendingEvidence(f.root,canonical),
  {verified_for_review:before,incomplete:[],unsafe:[]});
 assert.deepEqual(inspectTransactions(f.root,canonical).pending,before);
 assert.deepEqual(inspectWriterReservation(f.root),{status:'absent'});
});
test('forensic inspection separates incomplete from tampered pending folders',t=>{
 const f=fixture(t),base=path.join(f.root,'.pending'),partial='b'.repeat(32),
  malformed='c'.repeat(32);
 fs.mkdirSync(base);fs.mkdirSync(path.join(base,partial));
 fs.writeFileSync(path.join(base,partial,'corpus.json'),'partial');
 fs.mkdirSync(path.join(base,malformed));
 fs.writeFileSync(path.join(base,malformed,'unexpected.exe'),'invalid');
 assert.deepEqual(inspectPendingEvidence(f.root,canonical),
  {verified_for_review:[],incomplete:[partial],unsafe:[malformed]});
 assert.equal(fs.existsSync(path.join(base,partial,'corpus.json')),true);
 assert.equal(fs.existsSync(path.join(base,malformed,'unexpected.exe')),true);
});

test('a junction or symlink replacing the pending directory is refused without writing to its target',t=>{
 const f=fixture(t);
 const target=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-junction-target-'));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const entry=path.join(f.root,'.pending');
 try {fs.symlinkSync(target,entry,process.platform==='win32'?'junction':'dir');}
 catch(e) {
  if(process.platform==='win32'&&['EPERM','EACCES','ENOTSUP'].includes(e.code))return;
  throw e;
 }
 assert.throws(()=>createTransaction(f.root,f,canonical),
  {code:'TRANSACTION_DIRECTORY_UNSAFE'});
 assert.deepEqual(fs.readdirSync(target),[]);
 assert.equal(fs.lstatSync(entry).isSymbolicLink(),true);
});
test('a junction or symlink replacing the committed directory is refused without writing to its target',t=>{
 const f=fixture(t);
 const target=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-committed-target-'));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const entry=path.join(f.root,'transactions');
 try {fs.symlinkSync(target,entry,process.platform==='win32'?'junction':'dir');}
 catch(e) {
  if(process.platform==='win32'&&['EPERM','EACCES','ENOTSUP'].includes(e.code))return;
  throw e;
 }
 assert.throws(()=>createTransaction(f.root,f,canonical),
  {code:'TRANSACTION_DIRECTORY_UNSAFE'});
 assert.deepEqual(fs.readdirSync(target),[]);
 assert.equal(fs.lstatSync(entry).isSymbolicLink(),true);
});

test('filesystem and volume roots are never valid transaction write destinations',t=>{
 const f=fixture(t),root=path.parse(f.root).root;
 assert.throws(()=>createTransaction(root,f,canonical),
  {code:'TRANSACTION_ROOT_UNSAFE'});
});
test('Windows UNC and device destinations fail closed without probing remote paths',t=>{
 if(process.platform!=='win32')return;
 const f=fixture(t);
 for(const root of ['\\\\untrusted-server\\share\\TEMPORA',
                     '\\\\?\\C:\\TEMPORA']) {
   assert.throws(()=>createTransaction(root,f,canonical),
    {code:'TRANSACTION_ROOT_UNSAFE'});
 }
});

test('replacement of transaction directory during file writes is detected before commit',t=>{
 const f=fixture(t),outside=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-swap-target-'));
 t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
 const prior=fs.fsyncSync;let count=0,swapped=false;
 fs.fsyncSync=function(fd){
   const result=prior.call(fs,fd);
   count++;
   if(count===3&&!swapped){
     const dir=path.join(f.root,'transactions');
     fs.renameSync(dir,path.join(f.root,'transactions-retained'));
     try{fs.symlinkSync(outside,dir,process.platform==='win32'?'junction':'dir');}
     catch(e){
       // Refuse a test that cannot create a junction; the other security
       // tests still cover the static redirection.
       fs.renameSync(path.join(f.root,'transactions-retained'),dir);
       if(process.platform==='win32'&&['EPERM','EACCES','ENOTSUP'].includes(e.code))
         return result;
       throw e;
     }
     swapped=true;
   }
   return result;
 };
 try{
   if(process.platform==='win32'){
     // Windows runtime may lack junction permissions on some runners.
     try{createTransaction(f.root,f,canonical);}
     catch(e){if(swapped)assert.equal(e.code,'TRANSACTION_DIRECTORY_UNSAFE');else throw e;}
   }else{
     assert.throws(()=>createTransaction(f.root,f,canonical),
       {code:'TRANSACTION_DIRECTORY_UNSAFE'});
   }
 }finally{fs.fsyncSync=prior;}
 if(swapped){
   assert.deepEqual(fs.readdirSync(outside),[]);
   assert.deepEqual(fs.readdirSync(path.join(f.root,'transactions-retained')),[]);
   assert.equal(fs.readdirSync(path.join(f.root,'.pending')).length,1);
   assert.throws(()=>inspectTransactions(f.root,canonical),
     {code:'TRANSACTION_DIRECTORY_UNSAFE'});
 }
});

test('ordinary directory replacement during staging is blocked before commit',t=>{
 const f=fixture(t),originalFsync=fs.fsyncSync;
 let calls=0,replaced=false;
 fs.fsyncSync=function(fd){
  const value=originalFsync.call(fs,fd);
  if(++calls===3&&!replaced){
   const directory=path.join(f.root,'transactions');
   fs.renameSync(directory,path.join(f.root,'transactions-before-swap'));
   fs.mkdirSync(directory);
   replaced=true;
  }
  return value;
 };
 try{
  assert.throws(()=>createTransaction(f.root,f,canonical),
   {code:'TRANSACTION_DIRECTORY_IDENTITY_CHANGED'});
 }finally{fs.fsyncSync=originalFsync;}
 assert.equal(replaced,true);
 assert.deepEqual(fs.readdirSync(path.join(f.root,'transactions')),[]);
 assert.deepEqual(fs.readdirSync(path.join(f.root,'transactions-before-swap')),[]);
 assert.equal(fs.readdirSync(path.join(f.root,'.pending')).length,1);
 assert.deepEqual(inspectWriterReservation(f.root),{status:'absent'});
});
test('ordinary pending directory replacement during staging is blocked',t=>{
 const f=fixture(t),originalFsync=fs.fsyncSync;
 let calls=0,replaced=false;
 fs.fsyncSync=function(fd){
  const value=originalFsync.call(fs,fd);
  if(++calls===3&&!replaced){
   const pendingRoot=path.join(f.root,'.pending');
   fs.renameSync(pendingRoot,path.join(f.root,'pending-before-swap'));
   fs.mkdirSync(pendingRoot);
   replaced=true;
  }
  return value;
 };
 try{
  assert.throws(()=>createTransaction(f.root,f,canonical),
   {code:'TRANSACTION_DIRECTORY_IDENTITY_CHANGED'});
 }finally{fs.fsyncSync=originalFsync;}
 assert.equal(replaced,true);
 assert.deepEqual(fs.readdirSync(path.join(f.root,'transactions')),[]);
 assert.equal(fs.readdirSync(path.join(f.root,'.pending')).length,0);
 assert.equal(fs.readdirSync(path.join(f.root,'pending-before-swap')).length,1);
});
