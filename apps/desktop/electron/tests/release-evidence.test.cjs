'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,writeFileSync,readFileSync,rmSync,unlinkSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {createHash}=require('node:crypto');
const {verifyCandidate}=require('../scripts/verify-release-evidence.cjs');
const NSIS='TEMPORA-Desktop-1.0.0-x64-SETUP.exe';
const APPX='TEMPORA-Desktop-1.0.0-x64-STORE.appx';
const sha=b=>createHash('sha256').update(b).digest('hex');
const COMMIT='abc123d'.repeat(5)+'abc12';
async function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'tempora-release-'));
 try{
  const bytes=Buffer.from('SYNTHETIC_NOT_AN_EXECUTABLE');
  const nsis=sha(bytes),appx=sha(Buffer.from('SYNTHETIC_NOT_AN_APPX'));
  writeFileSync(join(dir,NSIS),bytes);
  writeFileSync(join(dir,APPX),'SYNTHETIC_NOT_AN_APPX');
  const obj={
   schema_version:'tempora-desktop-release-candidate-v1',
   desktop_version:'1.0.0',source_commit_sha:COMMIT,github_run_id:'42902639887',
   scientific_engine:'tempora-framework@3.0.0',desktop_runtime:'Electron/Chromium',
   architecture:'x64',store_package_identity:'GhemriM.TEMPORADesktop',
   store_publisher:'CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455',
   store_application_id:'TEMPORADesktop',nsis_name:NSIS,nsis_sha256:nsis,
   appx_name:APPX,appx_sha256:appx,signing_status:'unsigned_ci_candidate',
   windows_clean_vm_acceptance:'manual_not_verified',
   microsoft_store_submission:'not_submitted_by_ci',packaged_scientific_persistence:'disabled'
  };
  const save=()=>{writeFileSync(join(dir,'RELEASE-PROVENANCE.json'),JSON.stringify(obj));
   writeFileSync(join(dir,'SHA256SUMS.txt'),nsis+'  '+NSIS+'\n'+appx+'  '+APPX+'\n');};
  save();return fn({dir,obj,save});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('two full candidates verify against bytes and their original commit',async()=>{
 await fixture(async({dir})=>{
  const r=await verifyCandidate(dir,{requireBoth:true,expectedCommit:COMMIT});
  assert.equal(r.verified.length,2);
  assert.equal(r.source_commit_sha,COMMIT);
  assert.equal(r.signing_status,'unsigned_ci_candidate');
 });
});
test('separate NSIS and Store artifact archives verify independently',async()=>{
 await fixture(async({dir})=>{
  unlinkSync(join(dir,APPX));
  const r=await verifyCandidate(dir,{expectedCommit:COMMIT});
  assert.deepEqual(r.verified.map(x=>x.filename),[NSIS]);
  await assert.rejects(verifyCandidate(dir,{requireBoth:true}),
   {code:'RELEASE_BINARY_MISSING_'+APPX});
 });
});
test('modified binary is refused even though both metadata files agree',async()=>{
 await fixture(async({dir})=>{
  writeFileSync(join(dir,NSIS),'MODIFIED_SYNTHETIC_FILE');
  await assert.rejects(verifyCandidate(dir),{code:'RELEASE_BINARY_SHA256_MISMATCH_'+NSIS});
 });
});
test('provenance mismatch and wrong source commit fail closed',async()=>{
 await fixture(async({dir,obj,save})=>{
  obj.store_publisher='FAKE';save();
  await assert.rejects(verifyCandidate(dir),{code:'RELEASE_PROVENANCE_MISMATCH_store_publisher'});
  obj.store_publisher='CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455';save();
  await assert.rejects(verifyCandidate(dir,{expectedCommit:'f'.repeat(40)}),
   {code:'RELEASE_SOURCE_COMMIT_MISMATCH'});
 });
});
test('tampered hash list cannot override provenance digest',async()=>{
 await fixture(async({dir})=>{
  const sums=join(dir,'SHA256SUMS.txt');
  writeFileSync(sums,'f'.repeat(64)+'  '+NSIS+'\n'+'f'.repeat(64)+'  '+APPX+'\n');
  await assert.rejects(verifyCandidate(dir),{code:'RELEASE_HASH_MANIFEST_DISAGREEMENT'});
 });
});
test('duplicate, unsafe or missing names in sum list fail closed',async()=>{
 await fixture(async({dir,obj,save})=>{
  const sums=join(dir,'SHA256SUMS.txt'),good=readFileSync(sums,'utf8').split('\n');
  writeFileSync(sums,good[0]+'\n'+good[0]+'\n');
  await assert.rejects(verifyCandidate(dir),{code:'RELEASE_HASH_LIST_MALFORMED'});
  writeFileSync(sums,good[0].replace(NSIS,'../outside')+'\n'+good[1]+'\n');
  await assert.rejects(verifyCandidate(dir),{code:'RELEASE_HASH_LIST_MALFORMED'});
  writeFileSync(sums,good[0]+'\n');
  await assert.rejects(verifyCandidate(dir),{code:'RELEASE_HASH_LIST_INCOMPLETE'});
 });
});
test('empty or corrupted evidence and unexpected signing claim are rejected',async()=>{
 await fixture(async({dir,obj,save})=>{
  writeFileSync(join(dir,'RELEASE-PROVENANCE.json'),'{bad');
  await assert.rejects(verifyCandidate(dir),{code:'RELEASE_PROVENANCE_MALFORMED'});
  obj.signing_status='signed_and_certified';save();
  await assert.rejects(verifyCandidate(dir),{code:'RELEASE_PROVENANCE_MISMATCH_signing_status'});
 });
});
