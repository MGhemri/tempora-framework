'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const sdk=require('tempora-framework');
const {buildScientificTransport}=require('../scientific-native-transport.cjs');
const H='a'.repeat(64);
function sample(){
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,
  '../../examples/synthetic-canonical-v3.json'),'utf8'));
 const hash=sdk.canonical.digest(corpus);
 const identity={batch_id:H,source_sha256:'b'.repeat(64),
  base_sha256:'c'.repeat(64),mapping_sha256:'d'.repeat(64),output_sha256:hash};
 const journal={decision:'accepted_for_local_staging',batch_id:identity.batch_id,
  base_sha256:identity.base_sha256,output_sha256:hash,scientific_approval:false};
 return {sdk,corpus,journal,identity};
}
test('host constructs SDK-validated scientific transport without touching disk',()=>{
 const input=sample(),transport=buildScientificTransport(input);
 assert.deepEqual(Object.keys(transport).sort(),
  ['corpus.json','envelope.json','journal.json']);
 const meta=JSON.parse(transport['envelope.json']);
 assert.equal(meta.sdk_validated,true);
 assert.equal(meta.published,false);
 assert.equal(meta.scientific_approval,false);
 assert.equal(meta.identity.output_sha256,input.identity.output_sha256);
});
test('canonical mutation, false approval, foreign batch and extra identity are refused',()=>{
 const base=sample();
 for(const modification of [
   f=>{f.corpus.events.push({id:'tampered'});},
   f=>{f.journal.scientific_approval=true;},
   f=>{f.journal.batch_id='e'.repeat(64);},
   f=>{f.identity.injected='e'.repeat(64);}
 ]){
  const f=sample();modification(f);
  assert.throws(()=>buildScientificTransport(f));
 }
 assert.throws(()=>buildScientificTransport({...base,sdk:null}),{
  code:'NATIVE_TRANSPORT_SDK_REQUIRED'});
});
test('real Windows Rust verifies SDK envelope and rejects byte or journal tampering',t=>{
 if(process.platform!=='win32')return;
 const binary=path.resolve(__dirname,
  '../../native-windows-guard/target/release/tempora-windows-guard.exe');
 assert.ok(fs.existsSync(binary),'native executable must be built first');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-sdk-envelope-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const transport=buildScientificTransport(sample());
 for(const [file,bytes] of Object.entries(transport))
  fs.writeFileSync(path.join(dir,file),bytes,{flag:'wx'});
 const verify=()=>spawnSync(binary,['--verify-envelope',dir],
  {encoding:'utf8',windowsHide:true,timeout:5000});
 const valid=verify();
 assert.equal(valid.status,0,valid.stderr);
 assert.equal(valid.stdout.trim(),'NATIVE_ENVELOPE_VERIFIED');
 fs.appendFileSync(path.join(dir,'journal.json'),' ');
 assert.equal(verify().status,3);
 fs.writeFileSync(path.join(dir,'journal.json'),transport['journal.json']);
 const envelope=JSON.parse(transport['envelope.json']);
 envelope.published=true;
 fs.writeFileSync(path.join(dir,'envelope.json'),JSON.stringify(envelope));
 assert.equal(verify().status,3);
 assert.equal(fs.existsSync(path.join(dir,'transactions')),false);
 assert.equal(fs.existsSync(path.join(dir,'.pending')),false);
});
