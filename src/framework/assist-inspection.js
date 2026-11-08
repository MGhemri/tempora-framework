'use strict';
// TEMPORA Assistant M1.1a — deterministic, read-only inspection of supplied bytes.
// No path, I/O, HTTP, normalization, canonical import, or reviewer authority.
const {createHash}=require('node:crypto');

const MAX_SAMPLE_BYTES=64*1024;
const MAX_SAMPLE_ROWS=64;
const DELIMITERS=Object.freeze([',',';','\t']);
function fail(code){const e=new Error(code);e.code=code;throw e;}
function inspectRows(text,delimiter,maxRows){
  const rows=[];let cells=[],value='',quoted=false,closed=false,started=false;
  let line=1,startLine=1,incompleteTail=false,syntaxErrors=0;
  const field=()=>{cells.push(value);value='';closed=false;started=false;};
  const row=()=>{field();rows.push({line:startLine,cells});cells=[];startLine=line+1;};
  for(let i=0;i<text.length&&rows.length<maxRows;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'){
        if(text[i+1]==='"'){value+='"';i++;}
        else {quoted=false;closed=true;}
      }else if(c==='\r'||c==='\n'){
        if(c==='\r'&&text[i+1]==='\n'){value+='\r\n';i++;}
        else value+=c;
        line++;
      }else value+=c;
      continue;
    }
    if(c===delimiter){field();continue;}
    if(c==='\r'||c==='\n'){
      if(c==='\r'&&text[i+1]==='\n')i++;
      row();line++;continue;
    }
    if(c==='"'){
      if(started||closed){syntaxErrors++;value+=c;}
      else {quoted=true;started=true;}
    }else{
      if(closed)syntaxErrors++;
      value+=c;started=true;
    }
  }
  if(quoted)incompleteTail=true; // A prefix sample may end within a quoted cell.
  else if(cells.length||value.length||closed)row();
  const header=rows[0]?.cells??[];
  const widths=rows.slice(1).map(r=>r.cells.length);
  const consistent=widths.filter(n=>n===header.length).length;
  const multiColumn=header.length>=2;
  const quality=multiColumn&&widths.length&&syntaxErrors===0
    ?consistent*10-(widths.length-consistent)*15:0;
  const reservedHeaders=new Set(['__proto__','constructor','prototype']);
  const invalidHeader=header.some(x=>!x.trim()||/\r|\n/.test(x)||reservedHeaders.has(x))||new Set(header).size!==header.length;
  return Object.freeze({
    delimiter,header_columns:header.length,
    header_values:Object.freeze([...header]),
    header_status:'unconfirmed',
    header_issues:invalidHeader?['AMBIGUOUS_OR_UNSAFE_HEADER']:[],
    rows_observed:rows.length,
    data_rows_observed:widths.length,
    consistent_data_rows:consistent,
    row_start_lines:Object.freeze(rows.map(r=>r.line)),
    incomplete_tail:incompleteTail,
    csv_syntax_errors:syntaxErrors,
    score:quality
  });
}
function inspectDelimitedSample(bytes,options={}){
  if(!(bytes instanceof Uint8Array))fail('ASSIST_BYTES_REQUIRED');
  if(bytes.length===0||bytes.length>MAX_SAMPLE_BYTES)fail('ASSIST_SAMPLE_SIZE');
  if(options===null||typeof options!=='object'||Array.isArray(options)||
     Object.keys(options).some(x=>x!=='maxRows'))fail('ASSIST_OPTIONS');
  const maxRows=options.maxRows??MAX_SAMPLE_ROWS;
  if(!Number.isSafeInteger(maxRows)||maxRows<2||maxRows>MAX_SAMPLE_ROWS)
    fail('ASSIST_ROWS_LIMIT');
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{fail('ASSIST_UTF8_INVALID');}
  if(text.includes('\0'))fail('ASSIST_NUL');
  const bom=bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf;
  const candidates=DELIMITERS.map(x=>inspectRows(text,x,maxRows))
    .sort((a,b)=>b.score-a.score||DELIMITERS.indexOf(a.delimiter)-DELIMITERS.indexOf(b.delimiter));
  const best=candidates[0];
  const uniqueBest=best.score>0&&candidates.filter(x=>x.score===best.score).length===1;
  return Object.freeze({
    inspection_schema_version:'0.1.0',
    scope:'supplied_sample_bytes_only',
    sample_bytes:bytes.length,
    sample_sha256:createHash('sha256').update(bytes).digest('hex'),
    encoding:bom?'UTF-8 BOM':'UTF-8',
    format_family:'delimited_text_candidate',
    selected_delimiter:null, // User confirmation is required, even with one suggestion.
    suggested_delimiter:uniqueBest?best.delimiter:null,
    suggestion_status:uniqueBest?'requires_confirmation':'ambiguous',
    candidates:Object.freeze(candidates),
    canonical_validated:false,
    input_modified:false
  });
}
module.exports=Object.freeze({inspectDelimitedSample,MAX_SAMPLE_BYTES,MAX_SAMPLE_ROWS,DELIMITERS});
