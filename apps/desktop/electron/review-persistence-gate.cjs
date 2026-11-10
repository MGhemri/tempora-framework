'use strict';

// Host-only second authorization gate for ASSIST-M1.5. Not wired to renderer,
// IPC, worker or filesystem. A token is NOT proof of scientific authenticity;
// caller must independently re-run the canonical SDK before persisting.
const {randomBytes,timingSafeEqual}=require('node:crypto');
const HEX=/^[a-f0-9]{64}$/;
const TOKEN=/^[a-f0-9]{48}$/;
const TTL_MS=5*60*1000;
const FAIL=code=>{throw Object.assign(new Error(code),{code});};
function stringEq(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 return timingSafeEqual(Buffer.from(a,'utf8'),Buffer.from(b,'utf8'));
}
const FIELDS=['batch_id','source_sha256','base_sha256','snapshot_sha256'];
function validStage(receipt){
 return receipt && typeof receipt==='object' && !Array.isArray(receipt) &&
  receipt.scope==='in_memory_staging_only' &&
  receipt.canonical_validated===true &&
  receipt.scientific_approval===false &&
  receipt.saved_to_disk===false && receipt.published===false &&
  receipt.import_performed===false && receipt.persistence_required===true &&
  FIELDS.every(k=>typeof receipt[k]==='string'&&HEX.test(receipt[k])) &&
  receipt.journal && typeof receipt.journal==='object' &&
  receipt.journal.batch_id===receipt.batch_id &&
  receipt.journal.base_sha256===receipt.base_sha256 &&
  receipt.journal.output_sha256===receipt.snapshot_sha256 &&
  receipt.journal.scientific_approval===false &&
  receipt.journal.decision==='accepted_for_local_staging';
}
function createPersistenceGate({now=()=>Date.now(),maxPending=4}={}){
 if(typeof now!=='function'||!Number.isSafeInteger(maxPending)||maxPending<1||maxPending>32)
  FAIL('PERSIST_GATE_CONFIGURATION');
 const pending=new Map();
 function issue(handle,stage){
  if(typeof handle!=='string'||!TOKEN.test(handle))FAIL('PERSIST_GATE_HANDLE_INVALID');
  if(!validStage(stage))FAIL('PERSIST_GATE_STAGE_INVALID');
  const time=now();
  if(!Number.isFinite(time))FAIL('PERSIST_GATE_CLOCK_INVALID');
  for(const [key,p] of pending)if(p.expires<=time)pending.delete(key);
  // New simulation supersedes every previous intent for this session.
  for(const [key,p] of pending)if(stringEq(p.handle,handle))pending.delete(key);
  if(pending.size>=maxPending)FAIL('PERSIST_GATE_LIMIT');
  const token=randomBytes(24).toString('hex');
  const binding=Object.freeze(Object.fromEntries(FIELDS.map(k=>[k,stage[k]])));
  pending.set(token,{handle,binding,expires:time+TTL_MS});
  // The UI may show the bounded identity and an explicit *save* button.
  // This does not grant write access or authorize the preview itself.
  return Object.freeze({token,expires_in_ms:TTL_MS,...binding,
   confirmation_required:true,saved_to_disk:false,scientific_approval:false});
 }
 function claim(handle,token,confirmed,expected){
  if(typeof handle!=='string'||!TOKEN.test(handle)||typeof token!=='string'||!TOKEN.test(token))
   FAIL('PERSIST_GATE_TOKEN_INVALID');
  const p=pending.get(token);
  // Burn the token before validation so it can never be retried, including
  // after a failed or interrupted save attempt.
  pending.delete(token);
  if(!p||!stringEq(p.handle,handle)||now()>=p.expires)
   FAIL('PERSIST_GATE_EXPIRED');
  if(confirmed!==true)FAIL('PERSIST_GATE_CONFIRMATION_REQUIRED');
  if(!expected||typeof expected!=='object'||!FIELDS.every(k=>
     typeof expected[k]==='string'&&stringEq(expected[k],p.binding[k])))
   FAIL('PERSIST_GATE_STALE');
  return Object.freeze({...p.binding,authorization_scope:'one_shot_host_save',
    persistence_confirmed:true});
 }
 function revokeHandle(handle){
  if(typeof handle!=='string'||!TOKEN.test(handle))FAIL('PERSIST_GATE_HANDLE_INVALID');
  for(const [key,p] of pending)if(stringEq(p.handle,handle))pending.delete(key);
 }
 function clear(){pending.clear();}
 return Object.freeze({issue,claim,revokeHandle,clear});
}
module.exports=Object.freeze({createPersistenceGate,TTL_MS});
