'use strict';
// Pure, deterministic, strictly read-only normalization dry-run.
// It is NOT a canonical import preview and never issues an acceptance token.
const {parseInput,select}=require('./ingestion-formats');
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
 const {input,rows}=parseInput(bytes,mapping);
 if(input.sha256!==source_sha256)fail('ASSIST_PREVIEW_SOURCE_CHANGED');
 let processed=0,normalized=0,quarantined=0,unconfigured=0,output=0;
 const results=[];
 for(const row of rows.slice(0,MAX_PREVIEW_ROWS)){
   const entries=[];
   if(row.errors.length){
     quarantined++;entries.push({status:'quarantined',code:'ROW_CSV_WIDTH',source_path:row.source_path});
   }else{
     for(const [source_column,target_field] of allowed){
       if(++processed>MAX_CELLS)fail('ASSIST_PREVIEW_CELL_LIMIT');
       const raw=select(row.raw,'/'+source_column.replace(/~/g,'~0').replace(/\//g,'~1'));
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
 const truncated=rows.length>MAX_PREVIEW_ROWS;
 return Object.freeze({preview_schema_version:'1.0.0',scope:'normalization_dry_run_only',
   source_sha256,source_modified:false,canonical_validated:false,import_performed:false,
   batch_accepted:false,preview_complete:!truncated,
   total_rows:rows.length,displayed_rows:results.length,
   summary:{normalized,quarantined,unconfigured,rows_with_structure_errors:results.filter(r=>r.entries.some(e=>e.code==='ROW_CSV_WIDTH')).length},
   ruleset_sha256,rows:results,
   note:truncated?'PREVIEW_TRUNCATED_NO_ACCEPTANCE':'ALL_ROWS_EXAMINED_NO_ACCEPTANCE'});
}
module.exports=Object.freeze({previewNormalization,MAX_PREVIEW_ROWS,MAX_CELLS});
