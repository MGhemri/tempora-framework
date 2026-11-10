'use strict';
// Offline operator diagnostic. Read-only, no automatic recovery or deletion.
// Usage: node electron/scripts/assess-recovery.cjs <existing-absolute-directory>
const path=require('node:path');
const {assessRecovery}=require('../recovery-assessment.cjs');
const sdk=require('tempora-framework');
function main(args){
 if(args.length!==1||!path.isAbsolute(args[0])){
  process.stderr.write('RECOVERY_USAGE: expected one existing absolute folder path\n');
  return 3;
 }
 try {
  const assessment=assessRecovery(args[0],sdk.canonical);
  process.stdout.write(JSON.stringify(assessment,null,2)+'\n');
  return assessment.requires_manual_attention?2:0;
 }catch(error){
  const code=typeof error?.code==='string'&&/^[A-Z0-9_]{1,100}$/.test(error.code)?
    error.code:'RECOVERY_ASSESSMENT_FAILED';
  process.stderr.write(code+'\n');
  return 3;
 }
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={main};
