'use strict';
// Verify a Windows release candidate against file bytes, not the GitHub
// Actions ZIP hash. No installation, network request or code execution.
const {createHash}=require('node:crypto');
const {createReadStream,existsSync,readFileSync,statSync}=require('node:fs');
const {resolve,join}=require('node:path');
const pkg=require('../package.json');
const VERSION='1.0.0';
const NSIS='TEMPORA-Desktop-1.0.0-x64-SETUP.exe';
const APPX='TEMPORA-Desktop-1.0.0-x64-STORE.appx';
const TARGETS=Object.freeze({[NSIS]:'nsis_sha256',[APPX]:'appx_sha256'});
const SHA64=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
function fail(code){const e=new Error(code);e.code=code;throw e;}
function smallText(directory,name,max){
 const p=join(directory,name);
 if(!existsSync(p))fail('RELEASE_EVIDENCE_MISSING_'+name);
 const stat=statSync(p);
 if(!stat.isFile()||stat.size<1||stat.size>max)fail('RELEASE_EVIDENCE_INVALID_'+name);
 return readFileSync(p,'utf8').replace(/^\uFEFF/,'');
}
function metadata(directory){
 let data;
 try{data=JSON.parse(smallText(directory,'RELEASE-PROVENANCE.json',8192));}
 catch(e){if(e.code)throw e;fail('RELEASE_PROVENANCE_MALFORMED');}
 if(!data||typeof data!=='object'||Array.isArray(data))fail('RELEASE_PROVENANCE_MALFORMED');
 const expected={
  schema_version:'tempora-desktop-release-candidate-v1',
  desktop_version:VERSION,
  scientific_engine:'tempora-framework@3.0.0',
  desktop_runtime:'Electron/Chromium',
  architecture:'x64',
  store_package_identity:'GhemriM.TEMPORADesktop',
  store_publisher:'CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455',
  store_application_id:'TEMPORADesktop',
  signing_status:'unsigned_ci_candidate',
  microsoft_store_submission:'not_submitted_by_ci',
  windows_clean_vm_acceptance:'manual_not_verified',
  packaged_scientific_persistence:'disabled',
  nsis_name:NSIS,appx_name:APPX
 };
 for(const [key,value]of Object.entries(expected))
  if(data[key]!==value)fail('RELEASE_PROVENANCE_MISMATCH_'+key);
 if(!SHA40.test(data.source_commit_sha))fail('RELEASE_PROVENANCE_COMMIT_INVALID');
 if(!/^[1-9][0-9]*$/.test(String(data.github_run_id)))
  fail('RELEASE_PROVENANCE_RUN_INVALID');
 for(const [name,field]of Object.entries(TARGETS))
  if(!SHA64.test(data[field]))fail('RELEASE_PROVENANCE_HASH_INVALID_'+name);
 if(pkg.version!==VERSION)fail('RELEASE_PACKAGE_VERSION_MISMATCH');
 return Object.freeze(data);
}
function readHashes(directory){
 const lines=smallText(directory,'SHA256SUMS.txt',1024).trimEnd().split(/\r?\n/);
 if(lines.length!==2)fail('RELEASE_HASH_LIST_INCOMPLETE');
 const hashes=new Map();
 for(const line of lines){
  const match=/^([a-f0-9]{64})  ([A-Za-z0-9_.-]+)$/.exec(line);
  if(!match||!Object.hasOwn(TARGETS,match[2])||hashes.has(match[2]))
   fail('RELEASE_HASH_LIST_MALFORMED');
  hashes.set(match[2],match[1]);
 }
 if(hashes.size!==2)fail('RELEASE_HASH_LIST_INCOMPLETE');
 return hashes;
}
async function digestFile(file){
 const hash=createHash('sha256');
 const stream=createReadStream(file);
 for await (const chunk of stream)hash.update(chunk);
 return hash.digest('hex');
}
async function verifyCandidate(directory,{expectedCommit,requireBoth=false}={}){
 if(typeof directory!=='string'||!directory.trim())
  fail('RELEASE_DIRECTORY_INVALID');
 if(expectedCommit!==undefined&&!SHA40.test(expectedCommit))
  fail('RELEASE_EXPECTED_COMMIT_INVALID');
 const location=resolve(directory),info=metadata(location),hashes=readHashes(location);
 if(expectedCommit&&info.source_commit_sha!==expectedCommit)
  fail('RELEASE_SOURCE_COMMIT_MISMATCH');
 const verified=[];
 for(const [filename,field]of Object.entries(TARGETS)){
  if(hashes.get(filename)!==info[field])
   fail('RELEASE_HASH_MANIFEST_DISAGREEMENT');
  const filenameOnDisk=join(location,filename);
  if(!existsSync(filenameOnDisk)){
   if(requireBoth)fail('RELEASE_BINARY_MISSING_'+filename);
   continue;
  }
  const stat=statSync(filenameOnDisk);
  if(!stat.isFile()||stat.size===0)fail('RELEASE_BINARY_INVALID_'+filename);
  const value=await digestFile(filenameOnDisk);
  if(value!==info[field])fail('RELEASE_BINARY_SHA256_MISMATCH_'+filename);
  verified.push(Object.freeze({filename,sha256:value,size_bytes:stat.size}));
 }
 if(verified.length===0)fail('RELEASE_NO_BINARIES_FOUND');
 return Object.freeze({source_commit_sha:info.source_commit_sha,
  github_run_id:String(info.github_run_id),desktop_version:VERSION,
  signing_status:info.signing_status,microsoft_store_submission:info.microsoft_store_submission,
  verified:Object.freeze(verified)});
}
module.exports=Object.freeze({verifyCandidate});
if(require.main===module){
 const args=process.argv.slice(2),directory=args[0];
 const both=args.includes('--both'),pos=args.indexOf('--source-sha');
 const expectedCommit=pos>=0?args[pos+1]:undefined;
 if(args.length<1||args.some((arg,index)=>index!==0&&
    arg!=='--both'&&arg!=='--source-sha'&&
    !(pos>=0&&index===pos+1))){
  process.stderr.write('Usage: node verify-release-evidence.cjs DIRECTORY [--both] [--source-sha 40HEX]\n');
  process.exitCode=2;
 }else{
  verifyCandidate(directory,{requireBoth:both,expectedCommit})
   .then(result=>{process.stdout.write(JSON.stringify(result,null,2)+'\n');})
   .catch(error=>{process.stderr.write('RELEASE_VERIFICATION_FAILED: '+error.message+'\n');
    process.exitCode=1;});
 }
}
