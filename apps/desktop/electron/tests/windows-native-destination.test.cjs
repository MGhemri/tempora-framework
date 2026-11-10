'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {assertNativeDestination}=require('../windows-native-destination.cjs');
function fake(status,stdout,error){return ()=>({status,stdout,error});}
test('native destination guard rejects unsupported platform and relative paths',()=>{
 assert.throws(()=>assertNativeDestination('/tmp/synthetic',{platform:'linux'}),{
  code:'NATIVE_GUARD_WINDOWS_REQUIRED'});
 assert.throws(()=>assertNativeDestination('relative',{platform:'win32'}),{
  code:'NATIVE_GUARD_DESTINATION_INVALID'});
});
test('native destination guard requires exact success and never trusts partial output',()=>{
 for(const [status,stdout] of [[0,'NATIVE_DESTINATION_REJECTED'],
   [3,'NATIVE_DESTINATION_OK'],[0,'NATIVE_DESTINATION_OK garbage']]){
  assert.throws(()=>assertNativeDestination('C:\\temp',{
   platform:'win32',run:fake(status,stdout)
  }),{code:'NATIVE_GUARD_DESTINATION_REJECTED'});
 }
 assert.throws(()=>assertNativeDestination('C:\\temp',{
  platform:'win32',run:fake(null,'',{code:'ENOENT'})
 }),{code:'NATIVE_GUARD_UNAVAILABLE'});
});
test('native destination guard invokes an executable without shell or arbitrary caller flags',()=>{
 let args;
 const destination='C:\\fictitious folder';
 assert.equal(assertNativeDestination(destination,{platform:'win32',
  executable:'C:\\trusted\\guard.exe',
  run:(...params)=>{args=params;return {status:0,stdout:'NATIVE_DESTINATION_OK\n'};}
 }),destination);
 assert.deepEqual(args[1],['--inspect',destination]);
 assert.equal(args[2].shell,false);
 assert.equal(args[2].windowsHide,true);
 assert.ok(args[2].timeout<=5000);
});
test('real Windows guard accepts local NTFS temp and refuses junction, missing and UNC',t=>{
 if(process.platform!=='win32')return;
 const binary=path.resolve(__dirname,'../../native-windows-guard/target/release/tempora-windows-guard.exe');
 assert.equal(fs.existsSync(binary),true,'CI must build the native executable first');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-native-guard-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 assert.equal(assertNativeDestination(dir),dir);
 for(const rejected of [path.join(dir,'missing'), '\\\\server\\share\\folder']){
  assert.throws(()=>assertNativeDestination(rejected),{
   code:'NATIVE_GUARD_DESTINATION_REJECTED'});
 }
 const outside=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-native-target-'));
 t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
 const junction=path.join(dir,'junction');
 try{
  fs.symlinkSync(outside,junction,'junction');
  assert.throws(()=>assertNativeDestination(junction),{
   code:'NATIVE_GUARD_DESTINATION_REJECTED'});
 }catch(e){
  if(!['EPERM','EACCES','ENOTSUP'].includes(e.code))throw e;
 }
 const script=spawnSync(binary,['--inspect',dir],{encoding:'utf8',windowsHide:true});
 assert.equal(script.status,0);
 assert.equal(script.stdout.trim(),'NATIVE_DESTINATION_OK');
});

test('native synthetic writer performs one handle-relative directory commit and leaves no active lock',t=>{
 if(process.platform!=='win32')return;
 const binary=path.resolve(__dirname,'../../native-windows-guard/target/release/tempora-windows-guard.exe');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-handle-commit-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 // A production environment cannot turn on the synthetic writer accidentally.
 const disabledEnv={...process.env};
 delete disabledEnv.TEMPORA_NATIVE_SYNTHETIC_TEST;
 const denied=spawnSync(binary,['--synthetic-commit',dir],
  {encoding:'utf8',windowsHide:true,env:disabledEnv,timeout:10000});
 assert.equal(denied.status,3,denied.stderr);
 assert.deepEqual(fs.readdirSync(dir),[]);
 const enabled=spawnSync(binary,['--synthetic-commit',dir],{
  encoding:'utf8',windowsHide:true,timeout:15000,
  env:{...disabledEnv,TEMPORA_NATIVE_SYNTHETIC_TEST:'1'}
 });
 assert.equal(enabled.status,0,enabled.stderr);
 const match=/^NATIVE_SYNTHETIC_COMMITTED:([a-f0-9]{32})$/.exec(enabled.stdout.trim());
 assert.ok(match,enabled.stdout);
 const id=match[1];
 const committed=path.join(dir,'native-probe-complete',id);
 assert.deepEqual(fs.readdirSync(committed).sort(),
  ['corpus.json','journal.json','manifest.json']);
 assert.deepEqual(fs.readdirSync(path.join(dir,'.native-probe-pending')),[]);
 assert.equal(fs.existsSync(path.join(dir,'.native-probe-lock')),false);
 const manifest=JSON.parse(fs.readFileSync(path.join(committed,'manifest.json'),'utf8'));
 assert.equal(manifest.kind,'NTFS_HANDLE_RENAME_PROBE');
 assert.equal(manifest.published,false);
 // A synthetic marker must never enter the scientific transactions tree.
 assert.equal(fs.existsSync(path.join(dir,'transactions')),false);
 assert.equal(fs.existsSync(path.join(dir,'.pending')),false);
});
