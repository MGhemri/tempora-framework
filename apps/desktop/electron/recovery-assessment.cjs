'use strict';
// ASSIST M1.5: read-only recovery assessment, not a recovery operation.
// This module cannot promote, delete, rename or approve any transaction.
const {inspectTransactions,inspectWriterReservation,inspectPendingEvidence}=
  require('./transaction-store.cjs');
const fs=require('node:fs'),path=require('node:path');
const {fingerprint}=require('./forensic-snapshot.cjs');
const ERROR=code=>Object.assign(new Error(code),{code});
// Read-only identity snapshot for a lock, not an ownership claim.
// Comparing only status ("reserved"/"reserved") misses a replaced directory.
function lockFingerprint(root){
 const lock=path.join(root,'.writer-lock');
 const info=filename=>{
  try{
   const stat=fs.lstatSync(filename,{bigint:true});
   return [stat.dev,stat.ino,stat.size,stat.ctimeNs,stat.mtimeNs,
     stat.isSymbolicLink()?1n:0n].map(String).join(':');
  }catch(error){
   if(error?.code==='ENOENT')return 'absent';
   throw error;
  }
 };
 return info(lock)+'|'+info(path.join(lock,'owner.json'));
}
function assessRecovery(root,canonical){
 const filesystemBefore=fingerprint(root);
 const lock=inspectWriterReservation(root);
 const fingerprintBefore=lockFingerprint(root);
 const inventory=inspectTransactions(root,canonical);
 const evidence=inspectPendingEvidence(root,canonical);
 // Independently revalidate both inventories: the same list of directory IDs
 // can conceal a file that changed from verified to unsafe during the scan.
 // This is best-effort consistency checking, not an atomic filesystem snapshot.
 const inventoryAfter=inspectTransactions(root,canonical);
 const evidenceAfter=inspectPendingEvidence(root,canonical);
 const lockAfter=inspectWriterReservation(root);
 const fingerprintAfter=lockFingerprint(root);
 const filesystemAfter=fingerprint(root);
 const unchanged=(first,second)=>JSON.stringify(first)===JSON.stringify(second);
 if(filesystemBefore!==filesystemAfter||
    lockAfter.status!==lock.status||fingerprintAfter!==fingerprintBefore||
    !unchanged(inventory,inventoryAfter)||!unchanged(evidence,evidenceAfter))
   throw ERROR('RECOVERY_SNAPSHOT_CHANGED');
 const classified=[...evidence.verified_for_review,...evidence.incomplete,...evidence.unsafe];
 // Compare sorted IDs: a race or inconsistent snapshot is not a safe report.
 const ids=new Set(classified);
 // Fail early before creating potentially huge IPC and CLI responses.
 const MAX_REPORT_ITEMS=100;
 if(classified.length>MAX_REPORT_ITEMS||inventory.complete.length>MAX_REPORT_ITEMS||
    inventory.invalid.length>MAX_REPORT_ITEMS)
   throw ERROR('RECOVERY_REPORT_LIMIT');
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
