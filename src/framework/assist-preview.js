'use strict';
// Pure, deterministic, strictly read-only normalization dry-run.
// It is NOT a canonical import preview and never issues an acceptance token.
// This dry-run uses a small bounded CSV decoder; the authoritative ingestion
// parser remains in ingestion-formats. No output from here is importable.
function csvPreview(bytes,delimiter){
 if(![',',';','\t'].includes(delimiter))fail('ASSIST_PREVIEW_DELIMITER');
 let source;
 try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
 catch{fail('ASSIST_PREVIEW_ENCODING');}
 if(source.includes('\0'))fail('ASSIST_PREVIEW_ENCODING');
 const table=[];let row=[],cell='',state='start',line=1,startLine=1,rows=0;
 function field(){row.push(cell);cell='';state='start';}
 function finish(){
   field();rows++;
   if(table.length<MAX_PREVIEW_ROWS+1)table.push({fields:row,line:startLine});
   row=[];
 }
 for(let i=0;i<source.length;i++){
   const ch=source[i],nl=ch==='\n'||ch==='\r';
   if(state==='quoted'){
     if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else state='closed';}
     else {cell+=ch;if(nl){if(ch==='\r'&&source[i+1]==='\n'){cell+='\n';i++;}line++;}}
     continue;
   }
   if(ch===delimiter){field();continue;}
   if(nl){if(ch==='\r'&&source[i+1]==='\n')i++;finish();line++;startLine=line;continue;}
   if(state==='closed')fail('ASSIST_PREVIEW_CSV_SYNTAX');
   if(ch==='"'){if(state!=='start')fail('ASSIST_PREVIEW_CSV_SYNTAX');state='quoted';}
   else{cell+=ch;state='plain';}
 }
 if(state==='quoted')fail('ASSIST_PREVIEW_CSV_SYNTAX');
 if(row.length||cell||state==='closed')finish();
 if(!table.length)fail('ASSIST_PREVIEW_HEADER');
 const headers=table.shift().fields;
 if(headers.some(h=>!h||/[\r\n]/.test(h)||['__proto__','prototype','constructor'].includes(h))||
   new Set(headers).size!==headers.length||headers.length>256)
   fail('ASSIST_PREVIEW_HEADER');
 const rowsOut=table.map((entry,i)=>{
   const errors=entry.fields.length===headers.length?[]:[{code:'ROW_CSV_WIDTH'}];
   const raw=errors.length?null:Object.fromEntries(headers.map((h,n)=>[h,entry.fields[n]]));
   return {index:i+1,source_path:'csv:line:'+entry.line,line:entry.line,raw,errors};
 });
 return {rows:rowsOut,totalRows:rows-1};
}
function selectField(raw,column){return Object.hasOwn(raw,column)?raw[column]:undefined;}
const {normalizeCell,RULE_VERSION}=require('./assist-normalization');
const {createHash}=require('node:crypto');
const MAX_PREVIEW_ROWS=64,MAX_CELLS=512,MAX_RESPONSE_CHARS=100000;
function fail(code){const error=new Error(code);error.code=code;throw error;}
function plain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);}
function digest(v){return createHash('sha256').update(JSON.stringify(v)).digest('hex');}
function previewNormalization({bytes,mapping,bindings,rules,source_sha256}){
 if(!(bytes instanceof Uint8Array)||!plain(mapping)||mapping.format!=='csv'||
   !Array.isArray(bindings)||!Array.isArray(rules)||rules.length>32||
   typeof source_sha256!=='string'||!/^[a-f0-9]{64}$/.test(source_sha256))
   fail('ASSIST_PREVIEW_INPUT');
 const sourceDigest=createHash('sha256').update(bytes).digest('hex');
 if(sourceDigest!==source_sha256)fail('ASSIST_PREVIEW_SOURCE_CHANGED');
 const allowed=new Map();
 for(const binding of bindings){
   if(!plain(binding)||binding.state!=='confirmed_by_user'||
      typeof binding.source_column!=='string'||typeof binding.target_field!=='string'||
      allowed.has(binding.source_column))fail('ASSIST_PREVIEW_BINDINGS');
   allowed.set(binding.source_column,binding.target_field);
 }
 const configured=new Map(),ids=new Set();
 for(const entry of rules){
   if(!plain(entry)||Object.keys(entry).some(k=>!['source_column','rule'].includes(k))||
     typeof entry.source_column!=='string'||!allowed.has(entry.source_column)||
     configured.has(entry.source_column)||!plain(entry.rule)||
     typeof entry.rule.id!=='string'||ids.has(entry.rule.id))
     fail('ASSIST_PREVIEW_RULE');
   ids.add(entry.rule.id);configured.set(entry.source_column,entry.rule);
 }
 const {rows,totalRows}=csvPreview(bytes,mapping.delimiter);
 let processed=0,normalized=0,quarantined=0,unconfigured=0,output=0;
 const results=[];
 for(const row of rows.slice(0,MAX_PREVIEW_ROWS)){
   const entries=[];
   if(row.errors.length){
     quarantined++;entries.push({status:'quarantined',code:'ROW_CSV_WIDTH',source_path:row.source_path});
   }else{
     for(const [source_column,target_field] of allowed){
       if(++processed>MAX_CELLS)fail('ASSIST_PREVIEW_CELL_LIMIT');
       const raw=selectField(row.raw,source_column);
       if(typeof raw!=='string')fail('ASSIST_PREVIEW_CELL_TYPE');
       const rule=configured.get(source_column);
       let status='unconfigured',value=null,code=null;
       if(rule){
         const result=normalizeCell(raw,rule);
         status=result.status;
         value=result.status==='normalized'?result.normalized:null;
         code=result.status==='quarantined'?result.diagnostic.code:null;
         if(status==='normalized')normalized++;else quarantined++;
       }else unconfigured++;
       entries.push({source_column,target_field,source_text:raw,status,normalized:value,
         rule_id:rule?.id??null,rule_version:rule?RULE_VERSION:null,diagnostic_code:code});
     }
   }
   const record={source_path:row.source_path,line:row.line,entries};
   output+=JSON.stringify(record).length;
   if(output>MAX_RESPONSE_CHARS)fail('ASSIST_PREVIEW_OUTPUT_LIMIT');
   results.push(record);
 }
 const ruleset_sha256=digest(rules);
 const truncated=totalRows>MAX_PREVIEW_ROWS;
 return Object.freeze({preview_schema_version:'1.0.0',scope:'normalization_dry_run_only',
   source_sha256,source_modified:false,canonical_validated:false,import_performed:false,
   batch_accepted:false,preview_complete:!truncated,
   total_rows:totalRows,displayed_rows:results.length,
   summary:{normalized,quarantined,unconfigured,rows_with_structure_errors:results.filter(r=>r.entries.some(e=>e.code==='ROW_CSV_WIDTH')).length},
   ruleset_sha256,rows:results,
   note:truncated?'PREVIEW_TRUNCATED_NO_ACCEPTANCE':'ALL_ROWS_EXAMINED_NO_ACCEPTANCE'});
}
module.exports=Object.freeze({previewNormalization,MAX_PREVIEW_ROWS,MAX_CELLS});
