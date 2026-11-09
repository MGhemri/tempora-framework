'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createTransaction,inspectTransactions}=require('../transaction-store.cjs');
const H='a'.repeat(64);
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-import-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const identity={batch_id:H,source_sha256:H,base_sha256:H,mapping_sha256:H,output_sha256:H};
  return {root,identity,corpus:{schema_version:'3.0.0',events:[]},journal:{batch_id:H,output_sha256:H}};
}
test('one logical commit retains corpus, journal and manifest together',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f);
 assert.equal(receipt.saved_to_disk,true);
 assert.equal(receipt.published,false);
 const location=path.join(f.root,'transactions',receipt.transaction_id);
 assert.deepEqual(fs.readdirSync(location).sort(),['corpus.json','journal.json','manifest.json']);
 assert.deepEqual(inspectTransactions(f.root),{complete:[receipt.transaction_id],invalid:[],pending:[]});
});
test('journal digest mismatch refuses mutation',t=>{
 const f=fixture(t);f.journal.output_sha256='b'.repeat(64);
 assert.throws(()=>createTransaction(f.root,f),{code:'TRANSACTION_JOURNAL_MISMATCH'});
 assert.equal(fs.existsSync(path.join(f.root,'transactions')),false);
});
test('tampering with a committed journal is detected',t=>{
 const f=fixture(t),receipt=createTransaction(f.root,f);
 fs.writeFileSync(path.join(f.root,'transactions',receipt.transaction_id,'journal.json'),'{}');
 assert.deepEqual(inspectTransactions(f.root),{complete:[],invalid:[receipt.transaction_id],pending:[]});
});
test('an abandoned pending directory is reported, never removed',t=>{
 const f=fixture(t);const dir=path.join(f.root,'.pending','b'.repeat(32));
 fs.mkdirSync(path.dirname(dir));fs.mkdirSync(dir);
 assert.deepEqual(inspectTransactions(f.root),{complete:[],invalid:[],pending:['b'.repeat(32)]});
 assert.equal(fs.existsSync(dir),true);
});
test('root symlink is refused',t=>{
 const f=fixture(t),link=path.join(os.tmpdir(),'tempora-link-'+process.pid+'-'+Date.now());
 try {fs.symlinkSync(f.root,link,'dir');}
 catch(e){if(process.platform==='win32'&&e.code==='EPERM')return;throw e;}
 t.after(()=>fs.rmSync(link,{force:true}));
 assert.throws(()=>createTransaction(link,f),{code:'TRANSACTION_ROOT_UNSAFE'});
});
