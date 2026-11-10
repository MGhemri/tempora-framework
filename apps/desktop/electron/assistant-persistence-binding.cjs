'use strict';

// Trusted native-only bridge between the temporary Assistant session and
// M1.5's second-decision workflow. No IPC and no renderer-selected path.
const {createHash,timingSafeEqual}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const HASH=/^[a-f0-9]{64}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&
 HASH.test(a)&&HASH.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const MAX_CORPUS_BYTES=2*1024*1024;
function nativeReadCorpus(selectedPath){
 if(typeof selectedPath!=='string'||!path.isAbsolute(selectedPath)||
    path.extname(selectedPath).toLowerCase()!=='.json')
   fail('ASSIST_BINDING_CORPUS_PATH_INVALID');
 let stat,bytes;
 try{
  stat=fs.lstatSync(selectedPath);
  if(!stat.isFile()||stat.isSymbolicLink()||
     stat.size===0||stat.size>MAX_CORPUS_BYTES)
    fail('ASSIST_BINDING_CORPUS_FILE_UNSAFE');
  const fd=fs.openSync(selectedPath,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try{
   const opened=fs.fstatSync(fd);
   if(!opened.isFile()||opened.size===0||opened.size>MAX_CORPUS_BYTES||
      (typeof stat.ino==='number'&&typeof opened.ino==='number'&&
       stat.ino!==opened.ino))
     fail('ASSIST_BINDING_CORPUS_FILE_UNSAFE');
   bytes=fs.readFileSync(fd);
  }finally{fs.closeSync(fd);}
 }catch(error){
  if(typeof error?.code==='string'&&error.code.startsWith('ASSIST_BINDING_'))throw error;
  fail('ASSIST_BINDING_CORPUS_UNAVAILABLE');
 }
 if(bytes.length===0||bytes.length>MAX_CORPUS_BYTES)
  fail('ASSIST_BINDING_CORPUS_FILE_UNSAFE');
 let corpus;
 try{corpus=JSON.parse(bytes.toString('utf8'));}
 catch{fail('ASSIST_BINDING_CORPUS_JSON_INVALID');}
 if(!corpus||typeof corpus!=='object'||Array.isArray(corpus))
  fail('ASSIST_BINDING_CORPUS_JSON_INVALID');
 return Object.freeze({corpus,rawSha256:sha(bytes)});
}
function makeTrustedSessionReread({sessions,handle,corpusPath,corpusRawSha256,
 profileId,sourceSha256,readCorpus=nativeReadCorpus}={}){
 if(typeof sessions?.canonicalInput!=='function'||
    typeof handle!=='string'||!/^[0-9a-f]{48}$/.test(handle)||
    typeof corpusPath!=='string'||!path.isAbsolute(corpusPath)||
    !HASH.test(corpusRawSha256)||!HASH.test(sourceSha256)||
    typeof profileId!=='string'||!profileId||
    typeof readCorpus!=='function')
   fail('ASSIST_BINDING_CONFIGURATION');
 // Native path and expected digests are snapshotted; no caller-supplied input
 // can substitute the source or canonical document at commit time.
 const selected=corpusPath;
 const baseHash=corpusRawSha256;
 return async function reread(){
  const source=sessions.canonicalInput(handle); // validates TTL and source hash
  if(!same(source.sourceSha256,sourceSha256)||
     !same(sha(source.bytes),sourceSha256))
    fail('ASSIST_BINDING_SOURCE_CHANGED');
  if(source.profile_id!==profileId)
    fail('ASSIST_BINDING_PROFILE_CHANGED');
  const raw=await readCorpus(selected);
  if(!raw||!same(raw.rawSha256,baseHash))
    fail('ASSIST_BINDING_CORPUS_CHANGED');
  if(raw.corpus?.schema_version!=='3.0.0'||
     raw.corpus.profile?.id!==profileId)
    fail('ASSIST_BINDING_CORPUS_PROFILE_CHANGED');
  return {bytes:Buffer.from(source.bytes),corpus:raw.corpus,
   mapping:structuredClone(source.mapping),sourceName:source.sourceName};
 };
}
module.exports=Object.freeze({nativeReadCorpus,makeTrustedSessionReread});
