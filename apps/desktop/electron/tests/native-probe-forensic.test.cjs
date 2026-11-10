'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const sdk=require('tempora-framework');
const {buildScientificTransport}=require('../scientific-native-transport.cjs');
const binary=path.resolve(__dirname,
 '../../native-windows-guard/target/release/tempora-windows-guard.exe');
const H='a'.repeat(64);
function createCase(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-native-forensic-root-'));
 const source=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-native-forensic-source-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 t.after(()=>fs.rmSync(source,{recursive:true,force:true}));
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,
  '../../examples/synthetic-canonical-v3.json'),'utf8'));
 const hash=sdk.canonical.digest(corpus);
 const identity={batch_id:H,source_sha256:'b'.repeat(64),
  base_sha256:'c'.repeat(64),mapping_sha256:'d'.repeat(64),output_sha256:hash};
 const journal={batch_id:H,base_sha256:identity.base_sha256,
  output_sha256:hash,decision:'accepted_for_local_staging',scientific_approval:false};
 const transport=buildScientificTransport({sdk,corpus,journal,identity});
 for(const [name,bytes] of Object.entries(transport))
  fs.writeFileSync(path.join(source,name),bytes,{flag:'wx'});
 const command=(args,env={})=>spawnSync(binary,args,{
  env:{...process.env,TEMPORA_NATIVE_SYNTHETIC_TEST:'1',...env},
  windowsHide:true,encoding:'utf8',timeout:15000});
 return {root,source,transport,command,
  inspect:()=>command(['--inspect-probe',root])};
}
test('native forensic inventory is strictly read-only and reports empty probe',t=>{
 if(process.platform!=='win32')return;
 const f=createCase(t);
 const inventory=f.inspect();
 assert.equal(inventory.status,0,inventory.stderr);
 const result=JSON.parse(inventory.stdout);
 assert.equal(result.writer_lock_status,'absent');
 assert.equal(result.inspected_only,true);
 assert.equal(result.files_modified,false);
 assert.equal(result.recovery_performed,false);
 assert.equal(result.durability_certified,false);
 assert.equal(result.scientific_approval,false);
 assert.deepEqual(result.committed_verified,[]);
 assert.deepEqual(fs.readdirSync(f.root),[]);
});
test('native forensic identifies verified committed transport and corrupted manifest',t=>{
 if(process.platform!=='win32')return;
 const f=createCase(t);
 const commit=f.command(['--synthetic-transport-commit',f.root,f.source]);
 assert.equal(commit.status,0,commit.stderr);
 const id=/([0-9a-f]{32})/.exec(commit.stdout)?.[1];
 assert.ok(id,commit.stdout);
 const first=f.inspect();
 assert.equal(first.status,0,first.stderr);
 const verified=JSON.parse(first.stdout);
 assert.deepEqual(verified.committed_verified,[id]);
 assert.deepEqual(verified.committed_invalid,[]);
 assert.equal(verified.writer_lock_status,'absent');
 assert.equal(verified.requires_manual_attention,false);
 const manifest=path.join(f.root,'native-probe-complete',id,'manifest.json');
 fs.writeFileSync(manifest,'{}');
 const second=f.inspect();
 assert.equal(second.status,0,second.stderr);
 assert.deepEqual(JSON.parse(second.stdout).committed_invalid,[id]);
 assert.equal(JSON.parse(second.stdout).requires_manual_attention,true);
 assert.equal(fs.readFileSync(manifest,'utf8'),'{}');
});
test('native forensic crash matrix preserves lock and classifies pending vs visible',t=>{
 if(process.platform!=='win32')return;
 const phases=[
  {phase:'after_lock',status:81,pending:0,committed:0},
  {phase:'after_corpus',status:82,pending:1,committed:0},
  {phase:'after_rename',status:83,pending:0,committed:1}
 ];
 for(const phase of phases){
  const f=createCase(t);
  const crash=f.command(['--synthetic-transport-commit',f.root,f.source],
   {TEMPORA_NATIVE_TEST_CRASH_POINT:phase.phase});
  assert.equal(crash.status,phase.status,crash.stderr);
  const result=f.inspect();
  assert.equal(result.status,0,result.stderr);
  const info=JSON.parse(result.stdout);
  assert.equal(info.writer_lock_status,'reserved');
  assert.equal(info.pending_incomplete.length,phase.pending);
  assert.equal(info.committed_verified.length,phase.committed);
  assert.equal(info.requires_manual_attention,true);
  assert.equal(info.recovery_performed,false);
  assert.equal(fs.existsSync(path.join(f.root,'.native-probe-lock','owner.txt')),true);
 }
});
test('native forensic rejects unsafe directory entry and never follows junction',t=>{
 if(process.platform!=='win32')return;
 const f=createCase(t);
 const pending=path.join(f.root,'.native-probe-pending');
 fs.mkdirSync(pending);
 const outside=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-forensic-outside-'));
 t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
 const junction=path.join(pending,'f'.repeat(32));
 try{fs.symlinkSync(outside,junction,'junction');}
 catch(error){
  if(['EPERM','EACCES','ENOTSUP'].includes(error.code))return;
  throw error;
 }
 const report=f.inspect();
 assert.equal(report.status,3,report.stdout);
 assert.match(report.stderr,/NATIVE_PROBE_INSPECTION_REJECTED/);
 assert.deepEqual(fs.readdirSync(outside),[]);
 assert.equal(fs.lstatSync(junction).isSymbolicLink(),true);
});
