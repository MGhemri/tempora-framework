'use strict';
// Invoked only by unpackaged experimental Electron on Windows.
// Handle-based prefix inspection is necessary but cannot authorize a
// production write: the helper releases handles before Node writes.
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const fail=code=>{throw Object.assign(new Error(code),{code});};
function assertNativeDestination(destination,{
 platform=process.platform,
 executable=path.resolve(__dirname,'../native-windows-guard/target/release/tempora-windows-guard.exe'),
 run=spawnSync
}={}){
 if(platform!=='win32')fail('NATIVE_GUARD_WINDOWS_REQUIRED');
 if(typeof destination!=='string'||!path.isAbsolute(destination))
   fail('NATIVE_GUARD_DESTINATION_INVALID');
 let result;
 try{
   result=run(executable,['--inspect',destination],{
     windowsHide:true,shell:false,timeout:5000,encoding:'utf8',
     maxBuffer:1024
   });
 }catch{fail('NATIVE_GUARD_UNAVAILABLE');}
 if(result?.error)fail('NATIVE_GUARD_UNAVAILABLE');
 if(result?.status!==0||result?.stdout?.trim()!=='NATIVE_DESTINATION_OK')
   fail('NATIVE_GUARD_DESTINATION_REJECTED');
 return destination;
}
module.exports=Object.freeze({assertNativeDestination});
