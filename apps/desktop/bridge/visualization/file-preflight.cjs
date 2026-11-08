'use strict';
// J8E: private, read-only, bounded raw-byte preflight for a *native-picked* file.
// This module does NOT parse JSON, validate canonical v3 or open a Desktop project.
// No renderer/IPC entry point may pass an arbitrary path to this module.
const {open,lstat}=require('node:fs/promises');
const {constants}=require('node:fs');
const {isAbsolute,extname}=require('node:path');
const {createHash}=require('node:crypto');

const MAX_BYTES=64*1024*1024;
const DEFAULT_CHUNK_BYTES=64*1024;
const MAX_CHUNK_BYTES=1024*1024;
const FORMATS=Object.freeze(['.json','.geojson']);

function fail(code){const error=new Error(code);error.code=code;throw error;}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function verifyOptions(options){
  if(!object(options)||Object.keys(options).some(key=>!['maxBytes','chunkBytes','signal'].includes(key)))
    fail('PREFLIGHT_INVALID_OPTIONS');
  const maxBytes=options.maxBytes??MAX_BYTES;
  const chunkBytes=options.chunkBytes??DEFAULT_CHUNK_BYTES;
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_BYTES||
     !Number.isSafeInteger(chunkBytes)||chunkBytes<1||chunkBytes>MAX_CHUNK_BYTES)
    fail('PREFLIGHT_INVALID_LIMIT');
  if(options.signal!==undefined &&
     (!object(options.signal)||typeof options.signal.aborted!=='boolean'))
    fail('PREFLIGHT_INVALID_SIGNAL');
  return {maxBytes,chunkBytes,signal:options.signal};
}
function checkAborted(signal){if(signal?.aborted)fail('PREFLIGHT_CANCELLED');}
function sameIdentity(before,after){
  return before.dev===after.dev&&before.ino===after.ino&&
    before.size===after.size&&before.mtimeNs===after.mtimeNs&&
    before.ctimeNs===after.ctimeNs;
}
async function preflightSelectedFile(selectedPath,options={}){
  const {maxBytes,chunkBytes,signal}=verifyOptions(options);
  if(typeof selectedPath!=='string'||!isAbsolute(selectedPath)||selectedPath.includes('\0'))
    fail('PREFLIGHT_NATIVE_PICKER_PATH_REQUIRED');
  const format=extname(selectedPath).toLowerCase();
  if(!FORMATS.includes(format))fail('PREFLIGHT_UNSUPPORTED_FORMAT');
  checkAborted(signal);
  // Symlinks cannot silently redirect native-picked paths to other files.
  const pathStat=await lstat(selectedPath,{bigint:true});
  if(!pathStat.isFile()||pathStat.isSymbolicLink())fail('PREFLIGHT_NOT_REGULAR_FILE');
  if(pathStat.size===0n||pathStat.size>BigInt(maxBytes))fail('PREFLIGHT_INPUT_LIMIT');
  const noFollow=constants.O_NOFOLLOW??0;
  const fd=await open(selectedPath,constants.O_RDONLY|noFollow);
  try{
    const initial=await fd.stat({bigint:true});
    // On Windows Node/NTFS can report path and handle device/file IDs
    // differently. Compare like-with-like metadata while retaining independent
    // regular-file, byte-count and open-descriptor checks. On POSIX the two
    // identities must also agree across lstat and fstat.
    const openedPath=await lstat(selectedPath,{bigint:true});
    if(!initial.isFile()||!sameIdentity(pathStat,openedPath)||
       initial.size!==pathStat.size||
       (process.platform!=='win32'&&!sameIdentity(pathStat,initial)))
      fail('PREFLIGHT_FILE_CHANGED');
    const hash=createHash('sha256');
    const buffer=Buffer.allocUnsafe(chunkBytes);
    let readBytes=0;
    while(true){
      checkAborted(signal);
      const {bytesRead}=await fd.read(buffer,0,buffer.length,null);
      if(bytesRead===0)break;
      readBytes+=bytesRead;
      if(readBytes>maxBytes)fail('PREFLIGHT_INPUT_LIMIT');
      hash.update(buffer.subarray(0,bytesRead));
    }
    checkAborted(signal);
    const final=await fd.stat({bigint:true});
    const finalPath=await lstat(selectedPath,{bigint:true});
    if(!sameIdentity(initial,final)||!sameIdentity(pathStat,finalPath)||
       BigInt(readBytes)!==initial.size)
      fail('PREFLIGHT_FILE_CHANGED');
    return Object.freeze({
      preflight_schema_version:'1.0.0',format:format.slice(1),
      byte_count:readBytes,raw_sha256:hash.digest('hex'),
      interpretation:'raw-file-bytes-only',
      canonical_validated:false
    });
  }finally{await fd.close();}
}
module.exports=Object.freeze({
  preflightSelectedFile,MAX_BYTES,DEFAULT_CHUNK_BYTES,MAX_CHUNK_BYTES,FORMATS
});
