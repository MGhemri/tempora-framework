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
function createAssistantSessions({sourceRoot,profileRoot,now=()=>Date.now(),read=readFileSync,stat=statSync}={}){
  if(typeof sourceRoot!=='string'||!sourceRoot)reject('ASSIST_HOST_CONFIGURATION');
  const root=resolve(sourceRoot);
  const profilesRoot=resolve(profileRoot||join(root,'..','profiles'));
  const {inspectDelimitedSample}=loadInspector(root,'framework/assist-inspection.js');
  const {inspectXlsx}=loadInspector(root,'assist-io/xlsx-inventory.js');
  const {suggestColumnMappings,compileConfirmedCsvMapping}=loadInspector(root,'framework/assist-mapping.js');
  const {extractXlsxCells}=loadInspector(root,'assist-io/xlsx-cells.js');
  const {previewNormalization}=loadInspector(root,'framework/assist-preview.js');
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
  // The renderer never supplies a profile definition, alias bundle, or filesystem path.
  // Stage 1 registers only one explicitly labelled fictional demonstration profile.
  function trustedProfile(profile_id){
    if(profile_id!=='synthetic-history')reject('ASSIST_PROFILE_NOT_REGISTERED');
    let profile;
    try{
      profile=JSON.parse(readFileSync(join(profilesRoot,'synthetic-history','profile.json'),'utf8'));
    }catch{reject('ASSIST_PROFILE_UNAVAILABLE');}
    if(profile?.id!==profile_id||profile.version!=='1.0.0'||
       !Array.isArray(profile.locales)||!profile.locales.includes(profile.default_locale))
      reject('ASSIST_PROFILE_INVALID');
    return profile;
  }
  function suggest(handle_id,profile_id,choice){
    const s=requireSession(handle_id);
    if(!validShape(choice,['delimiter','sheet_name']))reject('ASSIST_MAPPING_CHOICE_INVALID');
    const bytes=verified(s),profile=trustedProfile(profile_id);
    let headers;
    if(s.format==='xlsx'){
      if(typeof choice.sheet_name!=='string'||choice.delimiter!==undefined)
        reject('ASSIST_SHEET_SELECTION_REQUIRED');
      const table=extractXlsxCells(bytes,{sheet_name:choice.sheet_name});
      headers=table.headers;
    }else{
      if(choice.sheet_name!==undefined||![',',';','\t'].includes(choice.delimiter))
        reject('ASSIST_DELIMITER_CONFIRMATION_REQUIRED');
      const report=inspectDelimitedSample(bytes.subarray(0,Math.min(bytes.length,MAX_SAMPLE_BYTES)));
      const selected=report.candidates.find(x=>x.delimiter===choice.delimiter);
      if(!selected||selected.header_issues.length||selected.csv_syntax_errors||
         selected.header_columns<2)reject('ASSIST_MAPPING_HEADERS_UNSAFE');
      headers=selected.header_values;
    }
    const mapping=suggestColumnMappings(headers,profile);
    // Every new proposal invalidates earlier user decisions, including across profiles/choices.
    s.confirmation=null; // New proposal revokes prior confirmation and normalization authority.
    s.proposal={token:randomBytes(24).toString('hex'),headers:[...headers],
      profile_id:profile.id,profile_version:profile.version,choice:{...choice},
      suggestions:mapping.suggestions.map(x=>({source_column:x.source_column,target_field:x.target_field}))};
    // Suggestions are never confirmed, even if the UI displays an exact header match.
    return bounded({handle_id,source_sha256:s.sha256,profile_id:profile.id,
      profile_version:profile.version,choice:{...choice},proposal_token:s.proposal.token,mapping});
  }
  function confirm(handle_id,proposal_token,bindings){
    const s=requireSession(handle_id);
    // Confirming is a host-side operation, never an authorization flag from the renderer.
    // This stage compiles ONLY CSV/TSV, never an Excel preview reinterpreted as CSV.
    if(s.format==='xlsx')reject('ASSIST_XLSX_MAPPING_COMPILATION_UNSUPPORTED');
    if(typeof proposal_token!=='string'||!HANDLE.test(proposal_token)||
       !s.proposal||proposal_token!==s.proposal.token)
      reject('ASSIST_PROPOSAL_EXPIRED');
    const bytes=verified(s),proposal=s.proposal;
    if(!Array.isArray(bindings)||bindings.length<2||bindings.length>proposal.headers.length||
       bindings.some(b=>!validShape(b,['source_column','target_field','state'])||
         Object.keys(b).length!==3||b.state!=='confirmed_by_user'||
         typeof b.source_column!=='string'||typeof b.target_field!=='string'))
      reject('ASSIST_MAPPING_CONFIRMATION_REQUIRED');
    const allowed=new Set(proposal.suggestions.map(x=>JSON.stringify([x.source_column,x.target_field])));
    for(const binding of bindings){
      if(!allowed.has(JSON.stringify([binding.source_column,binding.target_field])))
        reject('ASSIST_MAPPING_UNSUGGESTED_BINDING');
    }
    const profile=trustedProfile(proposal.profile_id);
    if(profile.version!==proposal.profile_version)reject('ASSIST_PROFILE_CHANGED');
    const selected=inspectDelimitedSample(bytes.subarray(0,Math.min(bytes.length,MAX_SAMPLE_BYTES)))
      .candidates.find(x=>x.delimiter===proposal.choice.delimiter);
    if(!selected||selected.header_issues.length||selected.csv_syntax_errors||
       JSON.stringify(selected.header_values)!==JSON.stringify(proposal.headers))
      reject('ASSIST_SOURCE_HEADERS_CHANGED');
    // A user must explicitly select at least ID and localized TITLE.
    const mapping=compileConfirmedCsvMapping({headers:proposal.headers,profile,
      bindings,id:'assistant-csv-review',version:'1.0.0',delimiter:proposal.choice.delimiter});
    // A successful compilation consumes the proposal. Source remains untouched.
    s.proposal=null;
    s.confirmation={mapping,bindings:bindings.map(x=>({...x})),profile_id:profile.id};
    const digestInput=JSON.stringify({source_sha256:s.sha256,profile_id:profile.id,
      profile_version:profile.version,bindings,mapping});
    return bounded({handle_id,source_sha256:s.sha256,profile_id:profile.id,
      profile_version:profile.version,confirmation_scope:'read_only_mapping_compilation',
      mapping_confirmed:true,confirmed_bindings:bindings.map(x=>({...x})),
      mapping,confirmation_sha256:digest(Buffer.from(digestInput)),source_modified:false,
      canonical_validated:false,import_performed:false});
  }
  function normalizePreview(handle_id,rules){
    const s=requireSession(handle_id);
    if(s.format==='xlsx')reject('ASSIST_PREVIEW_XLSX_UNSUPPORTED');
    if(!s.confirmation)reject('ASSIST_PREVIEW_CONFIRMATION_REQUIRED');
    if(!Array.isArray(rules)||rules.length>32||
       rules.some(x=>!validShape(x,['source_column','rule'])))
      reject('ASSIST_PREVIEW_RULE');
    const bytes=verified(s);
    const result=previewNormalization({bytes,mapping:s.confirmation.mapping,
      bindings:s.confirmation.bindings,rules,source_sha256:s.sha256});
    return bounded({handle_id,preview:result});
  }
  // Privileged host-to-worker input. This is NEVER returned across renderer IPC.
  // The selected source is re-hashed, and the mapping was independently confirmed.
  function canonicalInput(handle_id){
    const s=requireSession(handle_id);
    if(s.format==='xlsx')reject('ASSIST_CANONICAL_XLSX_NOT_SUPPORTED');
    if(!s.confirmation||!s.confirmation.mapping)
      reject('ASSIST_PREVIEW_CONFIRMATION_REQUIRED');
    const bytes=verified(s);
    // Worker protocol 1.0.0 is 4 MiB; use a strict budget to keep bounded
    // base64 input and canonical corpus inside the same audited frame.
    if(bytes.length>128*1024)reject('ASSIST_CANONICAL_SOURCE_LIMIT');
    const mapping=structuredClone(s.confirmation.mapping);
    return Object.freeze({bytes:Buffer.from(bytes),mapping,
      sourceName:basename(s.path),sourceSha256:s.sha256,
      profile_id:s.confirmation.profile_id});
  }
  function close(handle_id){
    if(!safeHandle(handle_id))reject('ASSIST_HANDLE_INVALID');
    return sessions.delete(handle_id);
  }
  function clear(){sessions.clear();}
  return Object.freeze({open,inspect,selectSheet,suggest,confirm,normalizePreview,canonicalInput,close,clear,
    // Shape enforcement is deliberately public to unit tests but not exposed by preload.
    validShape});
}
module.exports=Object.freeze({createAssistantSessions,MAX_SOURCE_BYTES,
  MAX_SAMPLE_BYTES,SESSION_TTL_MS,MAX_SESSIONS,MAX_IPC_RESPONSE_BYTES});
