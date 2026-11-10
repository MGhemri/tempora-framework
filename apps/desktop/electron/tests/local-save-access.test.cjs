'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {localSaveEnabled}=require('../local-save-access.cjs');
test('packaged Desktop never enables local-save IPC even with opt-in variable',()=>{
 for(const flag of ['1','true','0','']){
  assert.equal(localSaveEnabled({isPackaged:true,
    env:{TEMPORA_EXPERIMENTAL_M15_SAVE:flag}}),false);
 }
});
test('unpackaged local-save requires exact explicit opt-in',()=>{
 for(const flag of [undefined,'0','true','yes',' 1 ','2']){
  assert.equal(localSaveEnabled({isPackaged:false,
    env:{TEMPORA_EXPERIMENTAL_M15_SAVE:flag}}),false);
 }
 assert.equal(localSaveEnabled({isPackaged:false,
   env:{TEMPORA_EXPERIMENTAL_M15_SAVE:'1'}}),true);
});
test('incomplete gate context cannot enable a production write',()=>{
 assert.equal(localSaveEnabled(),false);
 assert.equal(localSaveEnabled({isPackaged:false}),false);
 assert.equal(localSaveEnabled({isPackaged:null,
  env:{TEMPORA_EXPERIMENTAL_M15_SAVE:'1'}}),false);
 assert.equal(localSaveEnabled({isPackaged:false,env:null}),false);
});
