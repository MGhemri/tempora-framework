'use strict';
// TEMPORA Assistant IPC host authority. Never loaded in the renderer.
// Source paths are accepted only from the trusted native file picker.
const {readFileSync,statSync}=require('node:fs');
const {basename,extname,join,resolve}=require('node:path');
const {createHash,randomBytes,timingSafeEqual}=require('node:crypto');

const MAX_SOURCE_BYTES=16*1024*1024;
const MAX_SAMPLE_BYTES=64*1024;
const SESSION_TTL_MS=10*60*1000;
const MAX_SESSIONS=4;
const MAX_IPC_RESPONSE_BYTES=256*1024;
const HANDLE=/^[a-f0-9]{48}$/;
const FORMATS=Object.freeze({'.csv':'csv','.tsv':'tsv','.xlsx':'xlsx'});
function reject(code){const error=new Error(code);error.code=code;throw error;}
function digest(bytes){return createHash('sha256').update(bytes).digest('hex');}
function bounded(response){
  if(Buffer.byteLength(JSON.stringify(response),'utf8')>MAX_IPC_RESPONSE_BYTES)
    reject('ASSIST_IPC_RESPONSE_LIMIT');
  return Object.freeze(response);
}
function safeHandle(id){return typeof id==='string'&&HANDLE.test(id);}
function validShape(obj,keys){
  return obj&&typeof obj==='object'&&!Array.isArray(obj)&&
    Object.keys(obj).every(key=>keys.includes(key)&&!['__proto__','prototype','constructor'].includes(key));
}
function loadInspector(root,filename){
  return require(join(root,filename));
}
function createAssistantSessions({sourceRoot,now=()=>Date.now(),read=readFileSync,stat=statSync}={}){
  if(typeof sourceRoot!=='string'||!sourceRoot)reject('ASSIST_HOST_CONFIGURATION');
  const root=resolve(sourceRoot);
  const {inspectDelimitedSample}=loadInspector(root,'framework/assist-inspection.js');
  const {inspectXlsx}=loadInspector(root,'assist-io/xlsx-inventory.js');
  const {extractXlsxCells}=loadInspector(root,'assist-io/xlsx-cells.js');
  const sessions=new Map();
  function clearExpired(){
    const time=now();
    for(const [id,s] of sessions)if(time>=s.expires_at)sessions.delete(id);
  }
  function snapshot(path,format){
    if(typeof path!=='string'||!path)reject('ASSIST_SOURCE_INVALID');
    let metadata;
    try{metadata=stat(path);}catch{reject('ASSIST_SOURCE_UNAVAILABLE');}
    if(!metadata.isFile()||metadata.size===0||metadata.size>MAX_SOURCE_BYTES)
      reject('ASSIST_SOURCE_LIMIT');
    let bytes;
    try{bytes=read(path);}catch{reject('ASSIST_SOURCE_UNAVAILABLE');}
    if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_SOURCE_BYTES)
      reject('ASSIST_SOURCE_LIMIT');
    if(format==='xlsx'&&bytes.length<22)reject('ASSIST_XLSX_NOT_ZIP');
    return bytes;
  }
  function requireSession(id){
    if(!safeHandle(id))reject('ASSIST_HANDLE_INVALID');
    const s=sessions.get(id);
    if(!s)reject('ASSIST_SESSION_MISSING_OR_EXPIRED');
    if(now()>=s.expires_at){sessions.delete(id);reject('ASSIST_SESSION_MISSING_OR_EXPIRED');}
    return s;
  }
  function verified(s){
    const bytes=snapshot(s.path,s.format),actual=digest(bytes);
    // Fixed-size digest comparison avoids accidental early-out and revalidates the actual file,
    // not the path, file size, or timestamp alone.
    if(!timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(s.sha256,'hex'))){
      sessions.delete(s.handle_id);reject('ASSIST_SOURCE_CHANGED');
    }
    return bytes;
  }
  function open(path){
    clearExpired();
    if(typeof path!=='string'||!path)reject('ASSIST_SOURCE_INVALID');
    const format=FORMATS[extname(path).toLowerCase()];
    if(!format)reject('ASSIST_SOURCE_FORMAT');
    const bytes=snapshot(path,format);
    const sample=bytes.subarray(0,Math.min(bytes.length,MAX_SAMPLE_BYTES));
    const inspection=format==='xlsx'?inspectXlsx(bytes):inspectDelimitedSample(sample);
    const handle_id=randomBytes(24).toString('hex');
    const source_sha256=digest(bytes);
    const session={handle_id,path,format,source_sha256,sha256:source_sha256,
      expires_at:now()+SESSION_TTL_MS};
    if(sessions.size>=MAX_SESSIONS)sessions.delete(sessions.keys().next().value);
    sessions.set(handle_id,session);
    return bounded({handle_id,format,file_name:basename(path),source_sha256,
      size_bytes:bytes.length,expires_in_ms:SESSION_TTL_MS,
      selected_sheet:null,selected_delimiter:null,inspection});
  }
  function inspect(handle_id){
    const s=requireSession(handle_id),bytes=verified(s);
    return bounded({handle_id,format:s.format,source_sha256:s.sha256,
      inspection:s.format==='xlsx'?inspectXlsx(bytes):
        inspectDelimitedSample(bytes.subarray(0,Math.min(bytes.length,MAX_SAMPLE_BYTES)))});
  }
  function selectSheet(handle_id,sheet_name){
    const s=requireSession(handle_id);
    if(s.format!=='xlsx')reject('ASSIST_SHEET_NOT_APPLICABLE');
    if(typeof sheet_name!=='string'||sheet_name.length===0||sheet_name.length>31)
      reject('ASSIST_SHEET_INVALID');
    const bytes=verified(s);
    const table=extractXlsxCells(bytes,{sheet_name});
    return bounded({handle_id,source_sha256:s.sha256,table});
  }
  function close(handle_id){
    if(!safeHandle(handle_id))reject('ASSIST_HANDLE_INVALID');
    return sessions.delete(handle_id);
  }
  function clear(){sessions.clear();}
  return Object.freeze({open,inspect,selectSheet,close,clear,
    // Shape enforcement is deliberately public to unit tests but not exposed by preload.
    validShape});
}
module.exports=Object.freeze({createAssistantSessions,MAX_SOURCE_BYTES,
  MAX_SAMPLE_BYTES,SESSION_TTL_MS,MAX_SESSIONS,MAX_IPC_RESPONSE_BYTES});
