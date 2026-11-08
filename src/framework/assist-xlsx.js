'use strict';
// TEMPORA Assistant M1.1b — bounded XLSX structure inventory, NOT cell import.
// This module never executes Excel formulas, macros, embedded links or remote data.
// Untrusted archives are rejected unless they meet a deliberately strict ZIP subset.
const {inflateRawSync}=require('node:zlib');
const {createHash}=require('node:crypto');

const MAX_ARCHIVE_BYTES=16*1024*1024;
const MAX_ENTRIES=512, MAX_EXPANDED_BYTES=16*1024*1024;
const MAX_XML_BYTES=512*1024, MAX_SHEETS=128;
const UTF8=new TextDecoder('utf-8',{fatal:true});
function fail(code){const e=new Error(code);e.code=code;throw e;}
function u16(b,p){return b.readUInt16LE(p);}
function u32(b,p){return b.readUInt32LE(p);}
function crc32(bytes){
  let n=0xffffffff;
  for(const value of bytes){
    n^=value;
    for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0);
  }
  return (n^0xffffffff)>>>0;
}
function text(bytes){
  try{return UTF8.decode(bytes);}
  catch{fail('ASSIST_XLSX_UTF8');}
}
function safeName(name){
  if(!name||name.length>512||name.includes('\\')||name.startsWith('/')||
     name.includes('\0')||name.split('/').some(p=>!p||p==='.'||p==='..')||
     /[\x00-\x1f]/.test(name))fail('ASSIST_XLSX_ENTRY_PATH');
  return name;
}
function forbiddenPart(name){
  return /(^|\/)(vbaProject|activeX|embeddings|externalLinks|connections|pivotCache|queryTables)(\/|\.|$)/i.test(name)||
    /(?:\.bin|\.vbs|\.js|\.exe|\.dll|\.bat|\.cmd|\.ps1)$/i.test(name);
}
function zipEntries(bytes){
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_ARCHIVE_BYTES)
    fail('ASSIST_XLSX_SIZE');
  const b=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(b.length<22||u32(b,0)!==0x04034b50)fail('ASSIST_XLSX_NOT_ZIP');
  let eocd=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){
    if(u32(b,i)===0x06054b50&&i+22+u16(b,i+20)===b.length){eocd=i;break;}
  }
  if(eocd<0)fail('ASSIST_XLSX_ZIP_STRUCTURE');
  if(u16(b,eocd+4)!==0||u16(b,eocd+6)!==0||
     u16(b,eocd+8)!==u16(b,eocd+10))fail('ASSIST_XLSX_MULTIDISK');
  const count=u16(b,eocd+10),size=u32(b,eocd+12),start=u32(b,eocd+16);
  if(!count||count>MAX_ENTRIES||start===0xffffffff||size===0xffffffff||
     start+size!==eocd)fail('ASSIST_XLSX_ZIP_STRUCTURE');
  const entries=new Map(),ranges=[];let offset=start,expanded=0;
  for(let i=0;i<count;i++){
    if(offset+46>eocd||u32(b,offset)!==0x02014b50)
      fail('ASSIST_XLSX_ZIP_STRUCTURE');
    const flags=u16(b,offset+8),method=u16(b,offset+10),crc=u32(b,offset+16),
      compressed=u32(b,offset+20),length=u32(b,offset+24),
      nameLen=u16(b,offset+28),extraLen=u16(b,offset+30),commentLen=u16(b,offset+32),
      local=u32(b,offset+42),external=u32(b,offset+38);
    if(flags&~0x0800||![0,8].includes(method)||compressed===0xffffffff||
       length===0xffffffff||local===0xffffffff)fail('ASSIST_XLSX_ZIP_FEATURE');
    const end=offset+46+nameLen+extraLen+commentLen;
    if(end>eocd)fail('ASSIST_XLSX_ZIP_STRUCTURE');
    const name=safeName(text(b.subarray(offset+46,offset+46+nameLen)));
    const unixMode=(external>>>16)&0xffff;
    if((unixMode&0xf000)===0xa000)fail('ASSIST_XLSX_SYMLINK');
    if(forbiddenPart(name))fail('ASSIST_XLSX_ACTIVE_CONTENT');
    if(entries.has(name))fail('ASSIST_XLSX_DUPLICATE_PART');
    if(local+30>start||u32(b,local)!==0x04034b50)
      fail('ASSIST_XLSX_ZIP_STRUCTURE');
    if(u16(b,local+6)!==flags||u16(b,local+8)!==method||
       u32(b,local+14)!==crc||u32(b,local+18)!==compressed||
       u32(b,local+22)!==length)fail('ASSIST_XLSX_ZIP_HEADER_MISMATCH');
    const localNameLen=u16(b,local+26),localExtraLen=u16(b,local+28);
    if(localNameLen!==nameLen||!b.subarray(local+30,local+30+nameLen)
      .equals(b.subarray(offset+46,offset+46+nameLen)))
      fail('ASSIST_XLSX_ZIP_HEADER_MISMATCH');
    const dataOffset=local+30+localNameLen+localExtraLen,stop=dataOffset+compressed;
    if(stop>start||stop<dataOffset||dataOffset<local+30)
      fail('ASSIST_XLSX_ZIP_STRUCTURE');
    if(method===0&&compressed!==length)fail('ASSIST_XLSX_ZIP_STRUCTURE');
    if(length>MAX_EXPANDED_BYTES||compressed===0&&length>0||
       compressed>0&&length>compressed*100)fail('ASSIST_XLSX_EXPANSION_LIMIT');
    expanded+=length;
    if(expanded>MAX_EXPANDED_BYTES)fail('ASSIST_XLSX_EXPANSION_LIMIT');
    ranges.push([local,stop]);entries.set(name,{offset:dataOffset,compressed,length,method,crc});
    offset=end;
  }
  if(offset!==eocd)fail('ASSIST_XLSX_ZIP_STRUCTURE');
  ranges.sort((a,b)=>a[0]-b[0]);
  if(ranges[0][0]!==0)fail('ASSIST_XLSX_ZIP_STRUCTURE');
  for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])
    fail('ASSIST_XLSX_ZIP_OVERLAP');
  function readPart(name){
    const part=entries.get(name);
    if(!part)fail('ASSIST_XLSX_MISSING_PART');
    if(part.length>MAX_XML_BYTES)fail('ASSIST_XLSX_XML_LIMIT');
    const raw=b.subarray(part.offset,part.offset+part.compressed);
    let result;
    try{result=part.method===0?Buffer.from(raw):
      inflateRawSync(raw,{maxOutputLength:MAX_XML_BYTES+1});}
    catch{fail('ASSIST_XLSX_DECOMPRESSION');}
    if(result.length!==part.length||crc32(result)!==part.crc)
      fail('ASSIST_XLSX_ZIP_INTEGRITY');
    return text(result);
  }
  return {entries,readPart};
}
function xmlSafe(value){
  if(/<!DOCTYPE|<!ENTITY|<!\[CDATA|<\?xml-stylesheet/i.test(value)||
     value.includes('\0')||value.length>MAX_XML_BYTES)fail('ASSIST_XLSX_XML_UNSAFE');
}
function unescapeXML(v){
  const out=v.replace(/&(#(?:x[0-9a-fA-F]+|[0-9]+)|amp|lt|gt|quot|apos);/g,(_,entity)=>{
    if(entity==='amp')return '&';if(entity==='lt')return '<';if(entity==='gt')return '>';
    if(entity==='quot')return '"';if(entity==='apos')return "'";
    const n=entity.startsWith('#x')?parseInt(entity.slice(2),16):Number(entity.slice(1));
    if(n===0||n>0x10ffff||n>=0xd800&&n<=0xdfff)fail('ASSIST_XLSX_XML_UNSAFE');
    return String.fromCodePoint(n);
  });
  if(out.includes('&')&&/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(v))
    fail('ASSIST_XLSX_XML_UNSAFE');
  return out;
}
function attrs(source){
  const pairs=Object.create(null);
  let remaining=source.trim().replace(/\/\s*$/,'').trim();
  const pattern=/^([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*/;
  while(remaining){
    const m=pattern.exec(remaining);
    if(!m||Object.hasOwn(pairs,m[1]))fail('ASSIST_XLSX_XML_UNSAFE');
    pairs[m[1]]=unescapeXML(m[2]??m[3]);
    remaining=remaining.slice(m[0].length);
  }
  return pairs;
}
function tags(xml,tag){
  const output=[];
  const rx=new RegExp('<(?:[A-Za-z_][A-Za-z0-9_.-]*:)?'+tag+'\\b([^<>]*?)\\/?>','g');
  for(const m of xml.matchAll(rx))output.push(attrs(m[1]));
  return output;
}
function inspectXlsx(bytes){
  const zip=zipEntries(bytes);
  const required=['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels'];
  for(const p of required)if(!zip.entries.has(p))fail('ASSIST_XLSX_MISSING_PART');
  const types=zip.readPart('[Content_Types].xml');
  const workbook=zip.readPart('xl/workbook.xml');
  const rels=zip.readPart('xl/_rels/workbook.xml.rels');
  const rootRels=zip.readPart('_rels/.rels');
  for(const xml of [types,workbook,rels,rootRels])xmlSafe(xml);
  if(/macroEnabled|vbaProject|externalLink|externalConnection|ActiveX/i.test(types+workbook+rels+rootRels))
    fail('ASSIST_XLSX_ACTIVE_CONTENT');
  const found=tags(workbook,'sheet');
  if(!found.length||found.length>MAX_SHEETS)fail('ASSIST_XLSX_SHEET_LIMIT');
  const links=new Map();
  for(const rel of tags(rels,'Relationship')){
    if(rel.TargetMode==='External'||rel.Target?.includes('..')||
       rel.Target?.startsWith('http:')||rel.Target?.startsWith('https:'))
      fail('ASSIST_XLSX_EXTERNAL_LINK');
    if(!rel.Id||links.has(rel.Id))fail('ASSIST_XLSX_XML_UNSAFE');
    links.set(rel.Id,rel);
  }
  const seen=new Set(),ids=new Set();
  const sheets=found.map(sheet=>{
    const name=sheet.name,id=sheet.sheetId,rid=sheet['r:id'];
    if(!name||name.length>31||/[\[\]:*?\\/]/.test(name)||seen.has(name.toLowerCase())||
       !/^[1-9]\d*$/.test(id??'')||ids.has(id)||!rid)
      fail('ASSIST_XLSX_SHEET_INVALID');
    seen.add(name.toLowerCase());ids.add(id);
    const ref=links.get(rid);
    if(!ref||!ref.Type?.endsWith('/worksheet')||!ref.Target)
      fail('ASSIST_XLSX_SHEET_RELATION');
    const target=ref.Target.startsWith('/xl/')?ref.Target.slice(1):
      'xl/'+ref.Target;
    safeName(target);
    if(!target.startsWith('xl/worksheets/')||!target.endsWith('.xml')||
       !zip.entries.has(target))fail('ASSIST_XLSX_SHEET_RELATION');
    const state=sheet.state??'visible';
    if(!['visible','hidden','veryHidden'].includes(state))
      fail('ASSIST_XLSX_SHEET_INVALID');
    return Object.freeze({name,sheet_id:id,state,worksheet_part:target,
      selected:false,formula_evaluation:'disabled',cell_inspection:'not_implemented'});
  });
  return Object.freeze({
    inspection_schema_version:'0.1.0',
    scope:'bounded_xlsx_container_and_sheet_inventory_only',
    input_bytes:bytes.length,
    raw_sha256:createHash('sha256').update(bytes).digest('hex'),
    format:'xlsx',sheet_count:sheets.length,sheets:Object.freeze(sheets),
    selected_sheet:null,canonical_validated:false,
    formulas_executed:false,external_data_loaded:false,input_modified:false
  });
}
module.exports=Object.freeze({inspectXlsx,MAX_ARCHIVE_BYTES,MAX_ENTRIES,MAX_XML_BYTES});
