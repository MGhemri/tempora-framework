'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createTransaction,inspectTransactions}=require('../transaction-store.cjs');
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
