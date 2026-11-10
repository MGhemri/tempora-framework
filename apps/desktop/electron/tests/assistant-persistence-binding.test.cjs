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
  sourceSha256:sourceHash,profileId:'test-profile'
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
