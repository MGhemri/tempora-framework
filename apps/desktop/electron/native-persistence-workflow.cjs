'use strict';

// Native-host-only M1.5 workflow. Callbacks MUST be implemented in the
// trusted Electron main process; never accept them from renderer IPC.
// No IPC registration, no automatic publishing or recovery.
const path=require('node:path');
const {createReviewPersistenceCoordinator}=require('./review-persistence-coordinator.cjs');
const {createTransaction}=require('./transaction-store.cjs');
const HEX48=/^[0-9a-f]{48}$/;
const error=code=>Object.assign(new Error(code),{code});
function createNativePersistenceWorkflow({sdk,confirmNative,chooseDestination}={}){
 if(!sdk?.canonical?.validateCorpus||!sdk?.canonical?.digest||
    !sdk?.ingestion?.preview||!sdk?.ingestion?.accept||
    typeof confirmNative!=='function'||typeof chooseDestination!=='function')
   throw error('NATIVE_PERSIST_CONFIGURATION');
 const intents=new Map();
 let active=null;
 let target=null;
 const coordinator=createReviewPersistenceCoordinator({
  sdk,
  persist:verified=>{
   if(!target)throw error('NATIVE_PERSIST_TARGET_REQUIRED');
   return createTransaction(target,verified,sdk.canonical);
  }
 });
 function offer({handle,stage,reread}){
  if(active)throw error('NATIVE_PERSIST_BUSY');
  if(typeof reread!=='function')throw error('NATIVE_PERSIST_REREAD_REQUIRED');
  const intent=coordinator.offer({handle,stage,reread});
  intents.set(handle,{token:intent.token,
   batch_id:intent.batch_id,source_sha256:intent.source_sha256,
   base_sha256:intent.base_sha256,snapshot_sha256:intent.snapshot_sha256});
  return intent;
 }
 async function confirmAndCommit({handle,token}={}){
  if(active)throw error('NATIVE_PERSIST_BUSY');
  if(typeof handle!=='string'||!HEX48.test(handle)||
     typeof token!=='string'||!HEX48.test(token))
    throw error('NATIVE_PERSIST_TOKEN_INVALID');
  const intent=intents.get(handle);
  if(!intent||intent.token!==token)throw error('NATIVE_PERSIST_TOKEN_EXPIRED');
  // A token is removed before opening either native dialog.
  intents.delete(handle);
  const operation={handle,cancelled:false};
  active=operation;
  try{
   const approved=await confirmNative(Object.freeze({...intent}));
   if(operation.cancelled)throw error('NATIVE_PERSIST_CANCELLED');
   if(approved!==true){
    coordinator.revoke(handle);
    return Object.freeze({cancelled:true,saved_to_disk:false});
   }
   const selected=await chooseDestination(Object.freeze({...intent}));
   if(operation.cancelled)throw error('NATIVE_PERSIST_CANCELLED');
   if(selected===null){
    coordinator.revoke(handle);
    return Object.freeze({cancelled:true,saved_to_disk:false});
   }
   if(typeof selected!=='string'||!path.isAbsolute(selected))
    throw error('NATIVE_PERSIST_DESTINATION_INVALID');
   target=selected;
   return await coordinator.commit({handle,token,confirmed:true});
  }finally{
   // No stale path survives the operation; never silently retry a write.
   target=null;
   active=null;
   coordinator.revoke(handle);
  }
 }
 function revoke(handle){
  intents.delete(handle);
  if(active&&active.handle===handle)active.cancelled=true;
  coordinator.revoke(handle);
 }
 function clear(){
  intents.clear();
  if(active)active.cancelled=true;
  coordinator.clear();
 }
 return Object.freeze({offer,confirmAndCommit,revoke,clear});
}
module.exports=Object.freeze({createNativePersistenceWorkflow});
