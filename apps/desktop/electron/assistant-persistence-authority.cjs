'use strict';

// Host-owned staging bridge. Never export it to preload / renderer.
// Only the native Electron main process supplies the preview and worker
// receipt; incoming renderer values cannot create a persistence consent.
const {makeTrustedSessionReread}=require('./assistant-persistence-binding.cjs');
const {isDeepStrictEqual}=require('node:util');
const HEX48=/^[a-f0-9]{48}$/;
const HEX64=/^[a-f0-9]{64}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
function createAssistantPersistenceAuthority({sessions,workflow}={}){
 if(typeof sessions?.canonicalInput!=='function'||
    typeof workflow?.offer!=='function'||
    typeof workflow?.confirmAndCommit!=='function'||
    typeof workflow?.revoke!=='function'||
    typeof workflow?.clear!=='function')
  fail('ASSIST_PERSIST_AUTHORITY_CONFIGURATION');
 const pending=new Map();
 function revoke(handle){
  if(typeof handle!=='string'||!HEX48.test(handle))
   fail('ASSIST_PERSIST_AUTHORITY_HANDLE');
  pending.delete(handle);
  workflow.revoke(handle);
 }
 function recordStaging({handle,preview,input,stage}={}){
  if(typeof handle!=='string'||!HEX48.test(handle))
   fail('ASSIST_PERSIST_AUTHORITY_HANDLE');
  // Any fresh review supersedes the previous consent for this session.
  revoke(handle);
  if(!preview||!input||!stage||
     typeof preview.corpus_path!=='string'||
     !HEX64.test(preview.corpus_raw_sha256)||
     !HEX64.test(preview.base_sha256)||!HEX64.test(preview.batch_id)||
     !HEX64.test(preview.source_sha256)||!HEX64.test(preview.mapping_sha256)||
     !HEX64.test(input.sourceSha256)||
     typeof input.profile_id!=='string'||
     stage.scope!=='in_memory_staging_only'||
     stage.canonical_validated!==true||
     stage.saved_to_disk!==false||
     stage.published!==false||
     stage.scientific_approval!==false||
     stage.import_performed!==false||
     stage.persistence_required!==true||
     stage.source_sha256!==preview.source_sha256||
     stage.source_sha256!==input.sourceSha256||
     stage.batch_id!==preview.batch_id||
     stage.base_sha256!==preview.base_sha256||
     !HEX64.test(stage.snapshot_sha256)||
     !HEX64.test(stage.mapping_sha256)||
     stage.mapping_sha256!==preview.mapping_sha256||
     stage.journal?.batch_id!==preview.batch_id||
     stage.journal?.base_sha256!==preview.base_sha256||
     stage.journal?.output_sha256!==stage.snapshot_sha256||
     stage.journal?.decision!=='accepted_for_local_staging'||
     !Array.isArray(stage.journal?.selected_ids)||
     stage.journal.selected_ids.length===0)
   fail('ASSIST_PERSIST_AUTHORITY_STAGE_INVALID');
  // Verify the session still exists *when* the worker's async staging
  // result returns, not only if a later commit is attempted.
  const current=sessions.canonicalInput(handle);
  if(current.sourceSha256!==input.sourceSha256||
     current.profile_id!==input.profile_id||
     !isDeepStrictEqual(current.mapping,input.mapping))
    fail('ASSIST_PERSIST_AUTHORITY_SESSION_CHANGED');
  const reread=makeTrustedSessionReread({
   sessions,handle,corpusPath:preview.corpus_path,
   corpusRawSha256:preview.corpus_raw_sha256,
   profileId:input.profile_id,sourceSha256:input.sourceSha256,
   expectedMapping:input.mapping
  });
  const intent=workflow.offer({handle,stage,reread});
  if(typeof intent?.token!=='string'||!HEX48.test(intent.token))
   fail('ASSIST_PERSIST_AUTHORITY_INTENT_INVALID');
  pending.set(handle,intent.token);
  // No token, filesystem path, journal or corpus crosses renderer IPC.
  return Object.freeze({prepared_in_host:true,saved_to_disk:false});
 }
 async function commitTrusted(handle){
  if(typeof handle!=='string'||!HEX48.test(handle))
   fail('ASSIST_PERSIST_AUTHORITY_HANDLE');
  const token=pending.get(handle);
  pending.delete(handle);
  if(!token)fail('ASSIST_PERSIST_AUTHORITY_NOT_PREPARED');
  // This method is intentionally ONLY available in the main process.
  // No IPC is registered for it while Windows handle safety is unqualified.
  return workflow.confirmAndCommit({handle,token});
 }
 function clear(){pending.clear();workflow.clear();}
 return Object.freeze({recordStaging,commitTrusted,revoke,clear});
}
module.exports=Object.freeze({createAssistantPersistenceAuthority});
