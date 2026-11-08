'use strict';
// TEMPORA Assistant M1.1d. Strict, bounded, read-only XLSX cell preview.
// This is intentionally not a general OOXML parser and never evaluates formulas.
const {openValidatedXlsx}=require('./xlsx-inventory');

const LIMITS=Object.freeze({rows:10000,columns:256,cells:20000,
  shared_strings:10000,cell_chars:16384,output_chars:2*1024*1024,
  xml_nodes:40000});
function fail(code){const err=new Error(code);err.code=code;throw err;}
function local(name){return name.slice(name.lastIndexOf(':')+1);}
function decode(text){
  const result=text.replace(/&(?:#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g,m=>{
    if(m==='&amp;')return '&';if(m==='&lt;')return '<';
    if(m==='&gt;')return '>';if(m==='&quot;')return '"';
    if(m==='&apos;')return "'";
    const n=m[2]==='x'?parseInt(m.slice(3,-1),16):Number(m.slice(2,-1));
    if(!Number.isInteger(n)||n===0||n>0x10ffff||(n>=0xd800&&n<=0xdfff))
      fail('ASSIST_XLSX_XML_UNSAFE');
    return String.fromCodePoint(n);
  });
  if(/&/.test(text.replace(/&(?:#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g,'')))
    fail('ASSIST_XLSX_XML_UNSAFE');
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result))
    fail('ASSIST_XLSX_XML_UNSAFE');
  return result;
}
function attributes(src){
  const result=Object.create(null);
  let s=src.trim();
  while(s){
    const m=/^([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*/.exec(s);
    if(!m||Object.hasOwn(result,m[1]))fail('ASSIST_XLSX_XML_UNSAFE');
    result[m[1]]=decode(m[2]??m[3]);s=s.slice(m[0].length);
  }
  return result;
}
function parseXml(xml){
  const roots=[],stack=[];let cursor=0,nodes=0;
  function addText(raw){
    if(!raw)return;
    const value=decode(raw);
    if(!stack.length){if(value.trim())fail('ASSIST_XLSX_XML_UNSAFE');return;}
    stack[stack.length-1].text+=value;
  }
  while(cursor<xml.length){
    const at=xml.indexOf('<',cursor);
    if(at<0){addText(xml.slice(cursor));break;}
    addText(xml.slice(cursor,at));
    let end=-1,quote=null;
    for(let i=at+1;i<xml.length;i++){
      const ch=xml[i];
      if(quote){if(ch===quote)quote=null;}
      else if(ch==='"'||ch==="'")quote=ch;
      else if(ch==='>'){end=i;break;}
    }
    if(end<0)fail('ASSIST_XLSX_XML_UNSAFE');
    const token=xml.slice(at+1,end).trim();
    cursor=end+1;
    if(/^\\?xml\s/i.test(token)&&!roots.length&&!stack.length&&at===0)
      continue;
    if(!token||token.startsWith('!')||token.startsWith('?'))
      fail('ASSIST_XLSX_XML_UNSAFE');
    if(token[0]==='/'){
      const name=token.slice(1).trim();
      if(!/^[A-Za-z_][\w.:-]*$/.test(name)||!stack.length||
         stack[stack.length-1].qualified!==name)fail('ASSIST_XLSX_XML_UNSAFE');
      stack.pop();continue;
    }
    const m=/^([A-Za-z_][\w.:-]*)([\s\S]*)$/.exec(token);
    if(!m)fail('ASSIST_XLSX_XML_UNSAFE');
    const self=/\/\s*$/.test(m[2]);
    const a=attributes(self?m[2].replace(/\/\s*$/,''):m[2]);
    const node={name:local(m[1]),qualified:m[1],a,children:[],text:''};
    if(++nodes>LIMITS.xml_nodes)fail('ASSIST_XLSX_XML_LIMIT');
    if(stack.length)stack[stack.length-1].children.push(node);
    else roots.push(node);
    if(!self)stack.push(node);
  }
  if(stack.length||roots.length!==1)fail('ASSIST_XLSX_XML_UNSAFE');
  return roots[0];
}
function child(n,name){return n.children.find(x=>x.name===name);}
function children(n,name){return n.children.filter(x=>x.name===name);}
function textNode(n){return n?n.text:'';}
function richText(n){
  if(!n)return '';
  let value='';
  for(const part of n.children){
    if(part.name==='t')value+=textNode(part);
    else if(part.name==='r'){const t=child(part,'t');if(t)value+=textNode(t);}
  }
  return value;
}
function checkCell(value){
  if(value.length>LIMITS.cell_chars)fail('ASSIST_XLSX_CELL_LIMIT');
  if(value.includes('\0'))fail('ASSIST_CELL_NUL');
  return value;
}
function colIndex(ref){
  const m=/^([A-Z]{1,3})([1-9][0-9]*)$/.exec(ref);
  if(!m)fail('ASSIST_XLSX_CELL_REFERENCE');
  let col=0;for(const c of m[1])col=col*26+c.charCodeAt(0)-64;
  const row=Number(m[2]);
  if(!Number.isSafeInteger(row)||row>1048576||col>LIMITS.columns)
    fail('ASSIST_XLSX_PREVIEW_LIMIT');
  return {row,col:col-1};
}
function sharedPool(open){
  if(!open.hasPart('xl/sharedStrings.xml'))return [];
  const root=parseXml(open.readXmlPart('xl/sharedStrings.xml'));
  if(root.name!=='sst')fail('ASSIST_XLSX_XML_UNSAFE');
  const strings=children(root,'si');
  if(strings.length>LIMITS.shared_strings)fail('ASSIST_XLSX_STRING_LIMIT');
  let total=0;
  return strings.map(si=>{
    const value=checkCell(richText(si));total+=value.length;
    if(total>LIMITS.output_chars)fail('ASSIST_XLSX_OUTPUT_LIMIT');
    return value;
  });
}
function dateInfo(open){
  const workbook=parseXml(open.readXmlPart('xl/workbook.xml'));
  if(workbook.name!=='workbook')fail('ASSIST_XLSX_XML_UNSAFE');
  const p=child(workbook,'workbookPr');
  if(p&&p.a.date1904!==undefined&&!['0','1','false','true'].includes(p.a.date1904))
    fail('ASSIST_XLSX_DATE_SYSTEM');
  const system=p&&['1','true'].includes(p.a.date1904)?'1904':'1900';
  const dateStyles=new Set();
  if(open.hasPart('xl/styles.xml')){
    const root=parseXml(open.readXmlPart('xl/styles.xml'));
    if(root.name!=='styleSheet')fail('ASSIST_XLSX_XML_UNSAFE');
    const builtin=new Set([14,15,16,17,18,19,20,21,22,45,46,47]);
    const fmt=child(root,'numFmts');
    const custom=new Set(children(fmt??{children:[]},'numFmt')
      .filter(x=>/[ymdhHsS]/.test((x.a.formatCode??'').replace(/"[^"]*"/g,'')))
      .map(x=>Number(x.a.numFmtId)));
    const xfs=child(root,'cellXfs');
    children(xfs??{children:[]},'xf').forEach((xf,i)=>{
      const id=Number(xf.a.numFmtId);
      if(builtin.has(id)||custom.has(id))dateStyles.add(i);
    });
  }
  return {system,dateStyles};
}
function dateCandidate(raw,system){
  if(!/^[0-9]+(?:\.[0-9]+)?$/.test(raw))return null;
  const serial=Number(raw);
  if(!Number.isSafeInteger(serial))return null;
  if(system==='1900'&&serial===60)return {serial,iso:null,warning:'EXCEL_1900_LEAP_DAY'};
  if(serial>2958465)return null;
  const shifted=system==='1900'?serial-(serial>=60?1:0):serial;
  const stamp=Date.UTC(system==='1900'?1899:1904,system==='1900'?11:0,system==='1900'?31:1)+shifted*86400000;
  const iso=new Date(stamp).toISOString().slice(0,10);
  return {serial,iso,warning:null};
}
function extractXlsxCells(bytes,{sheet_name}={}){
  if(typeof sheet_name!=='string'||!sheet_name)fail('ASSIST_XLSX_SHEET_SELECTION_REQUIRED');
  const open=openValidatedXlsx(bytes),inspection=open.inspection;
  const sheet=inspection.sheets.find(s=>s.name===sheet_name);
  if(!sheet)fail('ASSIST_XLSX_SHEET_SELECTION_INVALID');
  const strings=sharedPool(open),dates=dateInfo(open);
  const root=parseXml(open.readXmlPart(sheet.worksheet_part));
  if(root.name!=='worksheet')fail('ASSIST_XLSX_XML_UNSAFE');
  const data=child(root,'sheetData');
  if(!data)fail('ASSIST_XLSX_SHEET_DATA');
  const rawRows=children(data,'row');
  if(rawRows.length>LIMITS.rows)fail('ASSIST_XLSX_PREVIEW_LIMIT');
  let lastRow=0,cellCount=0,maxColumns=0,output=0,hasFormulas=false;
  const diagnostics=[],cell_provenance=Object.create(null);
  const rows=[];
  for(const row of rawRows){
    const rowNumber=Number(row.a.r);
    if(!/^[1-9]\d*$/.test(row.a.r??'')||
       !Number.isSafeInteger(rowNumber)||rowNumber>1048576||rowNumber<=lastRow)
      fail('ASSIST_XLSX_ROW_REFERENCE');
    lastRow=rowNumber;
    const values=[],coordinates=[],seen=new Set();
    for(const c of children(row,'c')){
      if(++cellCount>LIMITS.cells)fail('ASSIST_XLSX_PREVIEW_LIMIT');
      const ref=c.a.r,position=colIndex(ref??'');
      if(position.row!==rowNumber||seen.has(position.col))
        fail('ASSIST_XLSX_CELL_REFERENCE');
      seen.add(position.col);
      const type=c.a.t??'n',v=child(c,'v'),formula=child(c,'f');
      const raw=textNode(v);
      let value='';
      if(type==='s'){
        if(!/^(0|[1-9]\d*)$/.test(raw)||!Number.isSafeInteger(Number(raw))||
           Number(raw)>=strings.length)fail('ASSIST_XLSX_STRING_INDEX_OUT_OF_BOUNDS');
        value=strings[Number(raw)];
      }else if(type==='inlineStr')value=richText(child(c,'is'));
      else if(type==='b'){
        if(raw!=='0'&&raw!=='1')fail('ASSIST_XLSX_CELL_TYPE');
        value=raw==='1'?'false':'true';
      }else if(type==='n'||type==='str'||type==='d'||type==='e'){
        value=raw;
      }else fail('ASSIST_XLSX_CELL_TYPE');
      checkCell(value);output+=value.length;
      if(output>LIMITS.output_chars)fail('ASSIST_XLSX_OUTPUT_LIMIT');
      values[position.col]=value;
      coordinates[position.col]=ref;
      maxColumns=Math.max(maxColumns,position.col+1);
      const style=c.a.s===undefined?0:Number(c.a.s);
      if(!Number.isSafeInteger(style)||style<0)fail('ASSIST_XLSX_CELL_STYLE');
      const dateHint=(type==='n'&&dates.dateStyles.has(style))?
        dateCandidate(raw,dates.system):null;
      if(formula)hasFormulas=true;
      const provenance={coordinate:ref,raw_value:raw,cell_type:type,
        style_index:style,cached_formula:!!formula,cached_value_unverified:!!formula,
        formula_text:formula?textNode(formula):null,date_candidate:dateHint};
      cell_provenance[ref]=provenance;
      if(formula&&!v)diagnostics.push({coordinate:ref,code:'FORMULA_VALUE_ABSENT',
        severity:'warning'});
      if(dateHint?.warning)diagnostics.push({coordinate:ref,code:dateHint.warning,
        severity:'warning'});
    }
    rows.push({line_number:rowNumber,values,coordinates});
  }
  if(maxColumns>LIMITS.columns)fail('ASSIST_XLSX_PREVIEW_LIMIT');
  for(const row of rows){
    row.values=Array.from({length:maxColumns},(_,i)=>row.values[i]??'');
    row.row_coordinates=Array.from({length:maxColumns},(_,i)=>row.coordinates[i]??null);
    delete row.coordinates;
  }
  const first=rows.findIndex(r=>r.values.some(v=>v!==''));
  const headers=first>=0?rows[first].values:[];
  return Object.freeze({
    extraction_schema_version:'1.0.0',scope:'read_only_cell_preview',
    sheet_name:sheet.name,sheet_id:sheet.sheet_id,sheet_state:sheet.state,
    raw_sha256:inspection.raw_sha256,
    total_rows_observed:rows.length,total_columns_observed:maxColumns,
    headers,header_line_number:first<0?null:rows[first].line_number,
    sample_rows:rows.slice(first<0?0:first+1),
    cell_provenance,has_formulas:hasFormulas,formula_evaluation:'disabled',
    date_system:dates.system,diagnostics,
    canonical_validated:false,source_modified:false,preview_complete:true
  });
}
module.exports=Object.freeze({extractXlsxCells,LIMITS});
