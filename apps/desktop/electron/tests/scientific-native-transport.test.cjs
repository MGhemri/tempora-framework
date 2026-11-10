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

test('Windows native writer copies only independently verified SDK bytes to an isolated test transaction',t=>{
 if(process.platform!=='win32')return;
 const binary=path.resolve(__dirname,
  '../../native-windows-guard/target/release/tempora-windows-guard.exe');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-verified-input-'));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-verified-target-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const transport=buildScientificTransport(sample());
 for(const [name,bytes] of Object.entries(transport))
  fs.writeFileSync(path.join(dir,name),bytes,{flag:'wx'});
 const baseEnv={...process.env};
 delete baseEnv.TEMPORA_NATIVE_SYNTHETIC_TEST;
 const invoke=(enabled=true)=>spawnSync(binary,
  ['--synthetic-transport-commit',root,dir],
  {encoding:'utf8',windowsHide:true,timeout:15000,env:enabled
    ?{...baseEnv,TEMPORA_NATIVE_SYNTHETIC_TEST:'1'}:baseEnv});
 const disabled=invoke(false);
 assert.equal(disabled.status,3,disabled.stderr);
 assert.deepEqual(fs.readdirSync(root),[]);
 // Reject an unverified journal; it must not create even a synthetic lock.
 fs.appendFileSync(path.join(dir,'journal.json'),' ');
 const invalid=invoke();
 assert.equal(invalid.status,3,invalid.stderr);
 assert.deepEqual(fs.readdirSync(root),[]);
 fs.writeFileSync(path.join(dir,'journal.json'),transport['journal.json']);
 const committed=invoke();
 assert.equal(committed.status,0,committed.stderr);
 const result=/^NATIVE_SYNTHETIC_TRANSPORT_COMMITTED:([0-9a-f]{32})$/
  .exec(committed.stdout.trim());
 assert.ok(result,committed.stdout);
 const target=path.join(root,'native-probe-complete',result[1]);
 assert.deepEqual(fs.readdirSync(target).sort(),
  ['corpus.json','envelope.json','journal.json','manifest.json']);
 for(const [name,bytes] of Object.entries(transport))
  assert.deepEqual(fs.readFileSync(path.join(target,name)),bytes);
 const meta=JSON.parse(fs.readFileSync(path.join(target,'manifest.json'),'utf8'));
 assert.equal(meta.kind,'NTFS_SCIENTIFIC_TRANSPORT_PROBE');
 assert.equal(meta.published,false);
 assert.equal(fs.existsSync(path.join(root,'.native-probe-lock')),false);
 assert.equal(fs.existsSync(path.join(root,'transactions')),false);
 assert.equal(fs.existsSync(path.join(root,'.pending')),false);
 // Repeat the same input only into a separately numbered test result.
 // This is NOT scientific idempotency; production writer remains blocked.
 assert.equal(fs.readdirSync(path.join(root,'native-probe-complete')).length,1);
});

test('Windows source transport symlinks are refused before any probe transaction',t=>{
 if(process.platform!=='win32')return;
 const binary=path.resolve(__dirname,
  '../../native-windows-guard/target/release/tempora-windows-guard.exe');
 const src=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-input-link-'));
 const dest=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-output-link-'));
 t.after(()=>fs.rmSync(src,{recursive:true,force:true}));
 t.after(()=>fs.rmSync(dest,{recursive:true,force:true}));
 const transport=buildScientificTransport(sample());
 for(const [name,bytes] of Object.entries(transport))
  fs.writeFileSync(path.join(src,name),bytes,{flag:'wx'});
 const corpus=path.join(src,'corpus.json');
 fs.renameSync(corpus,path.join(src,'corpus-original.json'));
 try{fs.symlinkSync(path.join(src,'corpus-original.json'),corpus,'file');}
 catch(error){
  if(['EPERM','EACCES','ENOTSUP'].includes(error.code))return;
  throw error;
 }
 const env={...process.env,TEMPORA_NATIVE_SYNTHETIC_TEST:'1'};
 const verified=spawnSync(binary,['--verify-envelope',src],
  {encoding:'utf8',env,timeout:8000,windowsHide:true});
 assert.equal(verified.status,3);
 const committed=spawnSync(binary,['--synthetic-transport-commit',dest,src],
  {encoding:'utf8',env,timeout:8000,windowsHide:true});
 assert.equal(committed.status,3,committed.stdout);
 assert.deepEqual(fs.readdirSync(dest),[]);
});
test('Win32 source file handles resist a concurrent writer during the native probe',async t=>{
 if(process.platform!=='win32')return;
 const {spawn}=require('node:child_process');
 const binary=path.resolve(__dirname,
  '../../native-windows-guard/target/release/tempora-windows-guard.exe');
 const src=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-input-pinned-'));
 const dest=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-output-pinned-'));
 t.after(()=>fs.rmSync(src,{recursive:true,force:true}));
 t.after(()=>fs.rmSync(dest,{recursive:true,force:true}));
 const transport=buildScientificTransport(sample());
 for(const [name,bytes] of Object.entries(transport))
  fs.writeFileSync(path.join(src,name),bytes,{flag:'wx'});
 const env={...process.env,TEMPORA_NATIVE_SYNTHETIC_TEST:'1',
  TEMPORA_NATIVE_TEST_HOLD_MS:'3000'};
 const child=spawn(binary,['--synthetic-transport-commit',dest,src],
  {env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let out='',err='';
 child.stdout.on('data',d=>{out+=d;});
 child.stderr.on('data',d=>{err+=d;});
 const lock=path.join(dest,'.native-probe-lock');
 let acquired=false;
 for(let attempt=0;attempt<100;attempt++){
  if(fs.existsSync(path.join(lock,'owner.txt'))){acquired=true;break;}
  if(child.exitCode!==null)break;
  await new Promise(resolve=>setTimeout(resolve,25));
 }
 assert.equal(acquired,true,'native probe must expose test lock during pin');
 assert.throws(()=>fs.appendFileSync(path.join(src,'journal.json'),'UNAUTHORIZED'),
  {code:/^(EPERM|EACCES|EBUSY)$/});
 assert.deepEqual(fs.readFileSync(path.join(src,'journal.json')),
  transport['journal.json']);
 const outcome=await new Promise(resolve=>child.once('close',resolve));
 assert.equal(outcome,0,err);
 assert.match(out,/^NATIVE_SYNTHETIC_TRANSPORT_COMMITTED:[a-f0-9]{32}/);
});

test('real Rust crash matrix preserves forensic evidence without replaying a native write',t=>{
 if(process.platform!=='win32')return;
 const binary=path.resolve(__dirname,
  '../../native-windows-guard/target/release/tempora-windows-guard.exe');
 const src=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-native-crash-input-'));
 t.after(()=>fs.rmSync(src,{recursive:true,force:true}));
 const transport=buildScientificTransport(sample());
 for(const [name,bytes] of Object.entries(transport))
  fs.writeFileSync(path.join(src,name),bytes,{flag:'wx'});
 const matrix=[
  {point:'after_lock',code:81,pending:0,complete:0},
  {point:'after_corpus',code:82,pending:1,complete:0},
  {point:'after_rename',code:83,pending:0,complete:1}
 ];
 for(const stage of matrix){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-native-crash-target-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const env={...process.env,TEMPORA_NATIVE_SYNTHETIC_TEST:'1',
   TEMPORA_NATIVE_TEST_CRASH_POINT:stage.point};
  const result=spawnSync(binary,['--synthetic-transport-commit',root,src],
   {encoding:'utf8',timeout:15000,windowsHide:true,env});
  assert.equal(result.status,stage.code,result.stderr);
  const lock=path.join(root,'.native-probe-lock');
  assert.equal(fs.existsSync(path.join(lock,'owner.txt')),true);
  const pending=fs.readdirSync(path.join(root,'.native-probe-pending'));
  const completed=fs.readdirSync(path.join(root,'native-probe-complete'));
  assert.equal(pending.length,stage.pending,stage.point);
  assert.equal(completed.length,stage.complete,stage.point);
  if(stage.point==='after_corpus'){
   assert.deepEqual(fs.readdirSync(path.join(root,'.native-probe-pending',
    pending[0])),['corpus.json']);
  }
  if(stage.point==='after_rename'){
   const final=path.join(root,'native-probe-complete',completed[0]);
   assert.deepEqual(fs.readFileSync(path.join(final,'journal.json')),
    transport['journal.json']);
  }
  const replay=spawnSync(binary,['--synthetic-transport-commit',root,src],
   {encoding:'utf8',timeout:15000,windowsHide:true,
    env:{...env,TEMPORA_NATIVE_TEST_CRASH_POINT:''}});
  assert.equal(replay.status,3,'orphan lock must block blind replay');
  assert.equal(fs.existsSync(lock),true);
  assert.equal(fs.existsSync(path.join(root,'transactions')),false);
 }
});
