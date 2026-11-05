const {createHash}=require('node:crypto');
const {TextDecoder}=require('node:util');
const {validateObject}=require('./canonical');
const {fail}=require('./ingestion-error');
const MAX_BYTES=16*1024*1024,MAX_ROWS=100000;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const escapePointer=key=>String(key).replace(/~/g,'~0').replace(/\//g,'~1');
const reserved=new Set(['__proto__','constructor','prototype']);
const segments=pointer=>pointer===''?[]:pointer.slice(1).split('/').map(k=>k.replace(/~1/g,'/').replace(/~0/g,'~'));
function select(value,pointer){for(const k of segments(pointer)){if(value===null||typeof value!=='object'||(Array.isArray(value)&&!/^(0|[1-9]\d*)$/.test(k))||!Object.hasOwn(value,k))return undefined;value=value[k];}return value;}
function decode(bytes){
 if(!(bytes instanceof Uint8Array))fail('INPUT_BYTES_REQUIRED','Input must be explicit bytes');
 if(!bytes.length||bytes.length>MAX_BYTES)fail('INPUT_SIZE','Input must contain 1 byte to 16 MiB');
 const source=Buffer.from(bytes);let text;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(source);}catch{fail('INPUT_ENCODING','Only valid UTF-8, optionally with a UTF-8 BOM, is accepted');}
 if(text.includes('\u0000'))fail('INPUT_ENCODING','Input contains a NUL byte; convert the file to UTF-8');
 return {text,sha256:createHash('sha256').update(source).digest('hex'),encoding:source.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf]))?'UTF-8 BOM':'UTF-8',content_base64:source.toString('base64')};
}
// JSON.parse checks syntax; the second pass catches ambiguous duplicate keys and unsafe numeric literals.
function strictJson(text){
 let parsed;try{parsed=JSON.parse(text);}catch{fail('INPUT_JSON_SYNTAX','Malformed JSON; no partial document was staged');}
 let offset=0;
 const whitespace=c=>c===' '||c==='\r'||c==='\n'||c==='\t';
 function next(){
  while(whitespace(text[offset]))offset++;
  const start=offset,c=text[offset++];if(c===undefined)fail('INPUT_JSON_SYNTAX','Unexpected end of JSON');
  if('{}[],:'.includes(c))return c;
  if(c==='"'){while(offset<text.length){const next=text[offset++];if(next==='\\')offset++;else if(next==='"')return text.slice(start,offset);}fail('INPUT_JSON_SYNTAX','Unterminated JSON string');}
  while(offset<text.length&&!whitespace(text[offset])&&!'{}[],:'.includes(text[offset]))offset++;
  return text.slice(start,offset);
 }
 function walk(t,depth=0){
  if(depth>128)fail('INPUT_JSON_DEPTH','JSON nesting exceeds 128 levels');
  if(t==='{'){
   const keys=new Set();let key=next();
   while(key!=='}'){key=JSON.parse(key);if(keys.has(key))fail('INPUT_JSON_DUPLICATE_KEY','Duplicate JSON object key');keys.add(key);next();walk(next(),depth+1);key=next();if(key===',')key=next();}
  }else if(t==='['){let v=next();while(v!==']'){walk(v,depth+1);v=next();if(v===',')v=next();}}
  else if(/^-?\d/.test(t)){const n=Number(t);if(!Number.isFinite(n)||(Number.isInteger(n)&&!Number.isSafeInteger(n))||(n===0&&/[1-9]/.test(t.split(/[eE]/)[0])))fail('INPUT_JSON_NUMBER','JSON number is outside the supported finite precision');}
 }
 walk(next());return parsed;
}
function csvRows(text,delimiter){
 const table=[];let fields=[],value='',state='start',line=1,startLine=1;
 const pushField=()=>{fields.push(value);value='';state='start';};
 const pushRow=()=>{pushField();table.push({fields,line:startLine});fields=[];if(table.length>MAX_ROWS+1)fail('INPUT_ROW_LIMIT','Input exceeds 100,000 records');};
 for(let i=0;i<text.length;i++){
  const c=text[i],newline=c==='\r'||c==='\n';
  if(state==='quoted'){
   if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else state='closed';}
   else if(newline){if(c==='\r'&&text[i+1]==='\n'){value+='\r\n';i++;}else value+=c;line++;}
   else value+=c;
   continue;
  }
  if(c===delimiter){pushField();continue;}
  if(newline){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();line++;startLine=line;continue;}
  if(state==='closed')fail('INPUT_CSV_SYNTAX',`Unexpected character after closing quote at line ${line}`);
  if(c==='"'){if(state!=='start')fail('INPUT_CSV_SYNTAX',`Unexpected quote at line ${line}`);state='quoted';}
  else{value+=c;state='plain';}
 }
 if(state==='quoted')fail('INPUT_CSV_SYNTAX',`Unterminated quoted value at line ${startLine}`);
 if(fields.length||value.length||state==='closed')pushRow();
 if(!table.length)fail('INPUT_CSV_HEADER','CSV header is missing');
 const header=table.shift().fields;
 if(header.some(h=>!h.trim()||reserved.has(h)||/[\r\n]/.test(h))||new Set(header).size!==header.length)fail('INPUT_CSV_HEADER','CSV column names must be nonempty, safe and unique');
 return table.map((r,index)=>({index:index+1,source_path:`csv:line:${r.line}`,line:r.line,raw:r.fields.length===header.length?Object.fromEntries(header.map((h,i)=>[h,r.fields[i]])):r.fields,
  errors:r.fields.length===header.length?[]:[{code:'ROW_CSV_WIDTH',message:`Expected ${header.length} columns; received ${r.fields.length}`}]}));
}
const readers={
 json(text,mapping){const path=mapping.records_pointer??'',rows=select(strictJson(text),path);if(!Array.isArray(rows))fail('INPUT_JSON_ROWS','JSON mapping must select an array of records');return records(rows,path);},
 csv(text,mapping){return csvRows(text,mapping.delimiter??',');},
 geojson(text){const document=strictJson(text);if(!object(document)||document.type!=='FeatureCollection'||!Array.isArray(document.features))fail('INPUT_GEOJSON_COLLECTION','Expected a GeoJSON FeatureCollection');if(Object.hasOwn(document,'crs'))fail('INPUT_GEOJSON_CRS','Explicit GeoJSON CRS is unsupported; supply standard WGS84 GeoJSON');
  return records(document.features,'/features').map(row=>{
   const f=row.raw;if(!object(f)||f.type!=='Feature'||!(f.properties===null||object(f.properties))||!Object.hasOwn(f,'geometry'))row.errors.push({code:'ROW_GEOJSON_FEATURE',message:'Expected a Feature with properties and geometry'});
   else if(Object.hasOwn(f,'crs'))row.errors.push({code:'ROW_GEOJSON_CRS',message:'Feature declares an unsupported CRS'});
   else row.errors.push(...validateObject('geometry',f.geometry).errors);
   return row;
  });}
};
function records(rows,path){if(rows.length>MAX_ROWS)fail('INPUT_ROW_LIMIT','Input exceeds 100,000 records');return rows.map((raw,index)=>({index:index+1,source_path:`${path}/${index}`,line:null,raw,errors:object(raw)?[]:[{code:'ROW_OBJECT_REQUIRED',message:'Record must be a JSON object'}]}));}
function parseInput(bytes,mapping){const decoded=decode(bytes),read=readers[mapping.format];if(!read)fail('INPUT_FORMAT_UNSUPPORTED','Unsupported input format');const {text,...input}=decoded;return {input,rows:read(text,mapping)};}
module.exports={MAX_BYTES,MAX_ROWS,parseInput,strictJson,select,segments,escapePointer,reserved,object};
