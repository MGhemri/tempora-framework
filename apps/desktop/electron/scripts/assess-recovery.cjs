'use strict';
// Offline operator diagnostic. Read-only, no automatic recovery or deletion.
// Usage: node electron/scripts/assess-recovery.cjs <existing-absolute-directory>
// Optional: ... <directory> --match <batch> <source> <base> <mapping> <output>
const path=require('node:path');
const {assessRecovery}=require('../recovery-assessment.cjs');
const {inspectCommittedIdentity}=require('../transaction-store.cjs');
const sdk=require('tempora-framework');
function main(args){
 if((args.length!==1&&args.length!==7)||
    !path.isAbsolute(args[0])||
    (args.length===7&&args[1]!=='--match')){
  process.stderr.write('RECOVERY_USAGE: expected folder, optionally --match and five SHA-256 digests\n');
  return 3;
 }
 try {
  const assessment=assessRecovery(args[0],sdk.canonical);
  if(args.length===1){
   process.stdout.write(JSON.stringify(assessment,null,2)+'\n');
   return assessment.requires_manual_attention?2:0;
  }
  const [batch_id,source_sha256,base_sha256,mapping_sha256,output_sha256]=args.slice(2);
  const matched=inspectCommittedIdentity(args[0],sdk.canonical,{
   batch_id,source_sha256,base_sha256,mapping_sha256,output_sha256
  });
  const report={
   ...assessment,identity_matching:matched,
   operator_review_required:assessment.requires_manual_attention||
     matched.matching_transaction_ids.length!==1,
   durability_certified:false,
   receipt_reissued:false
  };
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  return report.operator_review_required?2:0;
 }catch(error){
  const code=typeof error?.code==='string'&&/^[A-Z0-9_]{1,100}$/.test(error.code)?
    error.code:'RECOVERY_ASSESSMENT_FAILED';
  process.stderr.write(code+'\n');
  return 3;
 }
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={main};
