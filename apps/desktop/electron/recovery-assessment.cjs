'use strict';
// ASSIST M1.5: read-only recovery assessment, not a recovery operation.
// This module cannot promote, delete, rename or approve any transaction.
const {inspectTransactions,inspectWriterReservation,inspectPendingEvidence}=
  require('./transaction-store.cjs');
const ERROR=code=>Object.assign(new Error(code),{code});
function assessRecovery(root,canonical){
 const lock=inspectWriterReservation(root);
 const inventory=inspectTransactions(root,canonical);
 const evidence=inspectPendingEvidence(root,canonical);
 const classified=[...evidence.verified_for_review,...evidence.incomplete,...evidence.unsafe];
 // Compare sorted IDs: a race or inconsistent snapshot is not a safe report.
 const ids=new Set(classified);
 if(ids.size!==classified.length||inventory.pending.length!==ids.size||
   inventory.pending.some(id=>!ids.has(id)))
   throw ERROR('RECOVERY_SNAPSHOT_CHANGED');
 const clean=lock.status==='absent'&&inventory.pending.length===0&&
   inventory.invalid.length===0;
 return Object.freeze({
  schema_version:'1.0.0',mode:'read_only_assessment',
  safe_to_start_new_write:clean,
  requires_manual_attention:!clean,
  lock_status:lock.status,
  committed_count:inventory.complete.length,
  invalid_transactions:[...inventory.invalid],
  pending_verified_for_review:[...evidence.verified_for_review],
  pending_incomplete:[...evidence.incomplete],
  pending_unsafe:[...evidence.unsafe],
  recovery_performed:false,files_modified:false,
  scientific_approval:false,published:false
 });
}
module.exports=Object.freeze({assessRecovery});
