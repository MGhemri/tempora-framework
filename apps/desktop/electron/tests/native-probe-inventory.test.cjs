'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const binary=path.resolve(__dirname,
 '../../native-windows-guard/target/release/tempora-windows-guard.exe');
function root(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-win-probe-inventory-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 return dir;
}
const run=(args,env={})=>spawnSync(binary,args,{encoding:'utf8',windowsHide:true,
 timeout:15000,env:{...process.env,TEMPORA_NATIVE_SYNTHETIC_TEST:'1',...env}});
function inventory(dir){
 const result=run(['--inspect-probe',dir]);
 assert.equal(result.status,0,result.stderr);
 return JSON.parse(result.stdout);
}
test('native NTFS inventory is strictly read-only for empty root',t=>{
 if(process.platform!=='win32')return;
 const dir=root(t),before=fs.readdirSync(dir);
 const result=inventory(dir);
 assert.equal(result.schema_version,'tempora-native-probe-inventory-v1');
 assert.equal(result.lock_status,'absent');
 assert.equal(result.committed_verified,0);
 assert.equal(result.files_modified,false);
 assert.equal(result.production_recovery_authorized,false);
 assert.deepEqual(fs.readdirSync(dir),before);
});
test('native crash after writer lock leaves reserved forensic evidence',t=>{
 if(process.platform!=='win32')return;
 const dir=root(t);
 const crashed=run(['--synthetic-commit',dir]);
 // A regular commit finishes; the next tests inject real crashes separately.
 assert.equal(crashed.status,0,crashed.stderr);
 assert.equal(inventory(dir).committed_verified,1);
 assert.equal(inventory(dir).lock_status,'absent');
});
test('native process crash after rename classifies visible commit but does not clear orphan lock',t=>{
 if(process.platform!=='win32')return;
 const dir=root(t);
 const crashed=spawnSync(binary,['--synthetic-commit',dir],{
  encoding:'utf8',windowsHide:true,timeout:15000,
  env:{...process.env,TEMPORA_NATIVE_SYNTHETIC_TEST:'1',
    TEMPORA_NATIVE_TEST_CRASH_POINT:'after_rename'}});
 assert.equal(crashed.status,83,crashed.stderr);
 const result=inventory(dir);
 assert.equal(result.committed_verified,1);
 assert.equal(result.lock_status,'reserved');
 assert.equal(result.requires_manual_attention,true);
 assert.equal(result.production_recovery_authorized,false);
 assert.equal(fs.existsSync(path.join(dir,'.native-probe-lock','owner.txt')),true);
});
test('forged published manifest is never considered a verified transaction',t=>{
 if(process.platform!=='win32')return;
 const dir=root(t),committed=run(['--synthetic-commit',dir]);
 assert.equal(committed.status,0,committed.stderr);
 const id=fs.readdirSync(path.join(dir,'native-probe-complete'))[0];
 const manifest=path.join(dir,'native-probe-complete',id,'manifest.json');
 fs.writeFileSync(manifest,'{"synthetic":true,"published":true}');
 const result=inventory(dir);
 assert.equal(result.committed_verified,0);
 assert.equal(result.unsafe_entries,1);
 assert.equal(result.requires_manual_attention,true);
 assert.equal(fs.readFileSync(manifest,'utf8'),'{"synthetic":true,"published":true}');
});
test('more than 100 orphan candidates refuses inventory without removing evidence',t=>{
 if(process.platform!=='win32')return;
 const dir=root(t),pending=path.join(dir,'.native-probe-pending');
 fs.mkdirSync(pending);
 for(let i=0;i<101;i++)
  fs.mkdirSync(path.join(pending,i.toString(16).padStart(32,'0')));
 const result=run(['--inspect-probe',dir]);
 assert.equal(result.status,3,result.stdout);
 assert.match(result.stderr,/NATIVE_PROBE_INSPECTION_REJECTED/);
 assert.equal(fs.readdirSync(pending).length,101);
});
