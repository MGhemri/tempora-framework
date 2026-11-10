'use strict';
// Explicit test-only feature gate. Packaged applications cannot enable
// scientific writes using environment variables or renderer input.
function localSaveEnabled({isPackaged,env}={}){
 return isPackaged===false&&
   env!==null&&typeof env==='object'&&
   env.TEMPORA_EXPERIMENTAL_M15_SAVE==='1';
}
module.exports=Object.freeze({localSaveEnabled});
