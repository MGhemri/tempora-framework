'use strict';

// ASSIST-M1.5 internal, trusted-host coordinator. No renderer, IPC or path
// argument is exposed here. The host supplies a privileged reread callback
// bound to its native file selections and a privileged commit callback.
// Not wired to production Electron until filesystem and crash qualification.
const {createPersistenceGate}=require('./review-persistence-gate.cjs');
const {preparePersistence}=require('./review-persistence-adapter.cjs');

function fail(code){throw Object.assign(new Error(code),{code});}
const HANDLE=/^[a-f0-9]{48}$/;
const TOKEN=/^[a-f0-9]{48}$/;
const FIELDS=['batch_id','source_sha256','base_sha256','mapping_sha256','snapshot_sha256'];
function createReviewPersistenceCoordinator({persist,now,sdk}={}){
 if(typeof persist!=='function')fail('PERSIST_COORDINATOR_CONFIGURATION');
 const gate=createPersistenceGate({now});
 const pending=new Map();
 // Serialize saves within this trusted host instance. This is NOT an
 // interprocess filesystem lock; cross-process coordination remains a gate.
 let committing=false;
 let active=null;

 function offer({handle,stage,reread}){
  if(typeof handle!=='string'||!HANDLE.test(handle)||typeof reread!=='function')
   fail('PERSIST_COORDINATOR_INPUT_INVALID');
  if(committing)fail('PERSIST_COORDINATOR_BUSY');
  // The staging receipt must come from the trusted worker, not renderer IPC.
  // Snapshot it now; later mutation by the caller cannot modify consent.
  let copy;
  try {copy=structuredClone(stage);}catch{fail('PERSIST_COORDINATOR_STAGE_INVALID');}
  const intent=gate.issue(handle,copy);
  for(const [token,entry] of pending)if(entry.handle===handle)pending.delete(token);
  const review=copy.journal;
  if(!Array.isArray(review.selected_ids)||review.selected_ids.length===0||
     review.selected_ids.length>50||
     typeof review.reviewer!=='string'||typeof review.reason!=='string'||
     typeof review.reviewed_at!=='string')
   {gate.revokeHandle(handle);fail('PERSIST_COORDINATOR_REVIEW_INVALID');}
  const expected=Object.freeze(Object.fromEntries(FIELDS.map(k=>[k,copy[k]])));
  pending.set(intent.token,{handle,expected,reread,review:{
   ids:[...review.selected_ids],reviewer:review.reviewer,
   reason:review.reason,reviewed_at:review.reviewed_at
  }});
  return intent;
 }
 async function commit({handle,token,confirmed}){
  if(typeof handle!=='string'||!HANDLE.test(handle)||
     typeof token!=='string'||!TOKEN.test(token))
   fail('PERSIST_COORDINATOR_TOKEN_INVALID');
  if(committing)fail('PERSIST_COORDINATOR_BUSY');
  const saved=pending.get(token);
  // Burn intent before any operation, even on error, await or cancellation.
  pending.delete(token);
  const authorization=gate.claim(handle,token,confirmed,saved?.expected);
  if(!saved||saved.handle!==handle)fail('PERSIST_COORDINATOR_STALE');
  // A second async save must not overlap this read/verify/commit cycle.
  // Acquire synchronously before the first await; release even on rejection.
  committing=true;
  const operation={handle,cancelled:false};
  active=operation;
  try {
    // Native host callback must reopen/re-hash original selected source and
    // corpus. No data, free path, or journal arrives from renderer.
    const input=await saved.reread();
    if(!input||typeof input!=='object')fail('PERSIST_COORDINATOR_REREAD_INVALID');
    if(operation.cancelled)fail('PERSIST_COORDINATOR_CANCELLED');
    const verified=sdk===undefined
      ?preparePersistence({...input,review:saved.review,authorization})
      :preparePersistence({...input,review:saved.review,authorization},sdk);
    // Cancellation is honored until handoff to the atomic commit callback.
    // Once persist() starts, the host must report its actual outcome.
    if(operation.cancelled)fail('PERSIST_COORDINATOR_CANCELLED');
    return await persist(verified);
  } finally {
    active=null;
    committing=false;
  }
 }
 function revoke(handle){
  if(typeof handle!=='string'||!HANDLE.test(handle))fail('PERSIST_COORDINATOR_HANDLE_INVALID');
  if(active&&active.handle===handle)active.cancelled=true;
  for(const [token,entry] of pending)if(entry.handle===handle)pending.delete(token);
  gate.revokeHandle(handle);
 }
 function clear(){if(active)active.cancelled=true;pending.clear();gate.clear();}
 return Object.freeze({offer,commit,revoke,clear});
}
module.exports=Object.freeze({createReviewPersistenceCoordinator});
