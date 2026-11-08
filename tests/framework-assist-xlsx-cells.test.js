const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deflateRawSync}=require('node:zlib');
const {createHash}=require('node:crypto');
const {inspectXlsx,MAX_ARCHIVE_BYTES}=require('../src/assist-io/xlsx-inventory');
function crc32(bytes){
  let n=0xffffffff;
  for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}
  return (n^0xffffffff)>>>0;
}
function syntheticZip(entries,{compression=true}={}){
  const locals=[],centers=[];let offset=0;
  for(const [name,value] of entries){
    const nameBytes=Buffer.from(name,'utf8'),raw=Buffer.from(value,'utf8');
    const compressed=compression?deflateRawSync(raw):raw,method=compression?8:0;
    const sum=crc32(raw);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
    local.writeUInt16LE(0x800,6);local.writeUInt16LE(method,8);
    local.writeUInt32LE(sum,14);local.writeUInt32LE(compressed.length,18);
    local.writeUInt32LE(raw.length,22);local.writeUInt16LE(nameBytes.length,26);
    locals.push(local,nameBytes,compressed);
    const center=Buffer.alloc(46);
    center.writeUInt32LE(0x02014b50,0);center.writeUInt16LE(20,4);
    center.writeUInt16LE(20,6);center.writeUInt16LE(0x800,8);
    center.writeUInt16LE(method,10);center.writeUInt32LE(sum,16);
    center.writeUInt32LE(compressed.length,20);center.writeUInt32LE(raw.length,24);
    center.writeUInt16LE(nameBytes.length,28);center.writeUInt32LE(offset,42);
    centers.push(center,nameBytes);
    offset+=local.length+nameBytes.length+compressed.length;
  }
  const directory=Buffer.concat(centers),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
const workbook='<?xml version="1.0" encoding="UTF-8"?>'+
'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '+
'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
'<sheets><sheet name="Événements fictifs" sheetId="1" r:id="rId1"/>'+
'<sheet name="Archives &amp; notes" sheetId="2" state="hidden" r:id="rId2"/></sheets></workbook>';
const relationships='<?xml version="1.0" encoding="UTF-8"?>'+
'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'+
'</Relationships>';
const rootRels='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
'</Relationships>';
const types='<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
'<Default Extension="xml" ContentType="application/xml"/>'+
'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
'</Types>';
const base=()=>[
 ['[Content_Types].xml',types],
 ['_rels/.rels',rootRels],
 ['xl/workbook.xml',workbook],
 ['xl/_rels/workbook.xml.rels',relationships],
 ['xl/worksheets/sheet1.xml','<worksheet><sheetData><row r="1"><c r="A1"><f>1+1</f></c></row></sheetData></worksheet>'],
 ['xl/worksheets/sheet2.xml','<worksheet/>']
];
const err=code=>e=>e.code===code;
const {extractXlsxCells}=require('../src/assist-io/xlsx-cells');


function book(sheet,{extra=[],wb=workbook}={}){
 const entries=base();
 entries[2]=[entries[2][0],wb];
 entries[4]=[entries[4][0],sheet];
 return syntheticZip([...entries,...extra]);
}
const cells='<worksheet><sheetData>'+
 '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>date</t></is></c></row>'+
 '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="b"><v>1</v></c>'+
 '<c r="C2" s="1"><v>61</v></c></row>'+
 '<row r="3"><c r="A3"><f>1+1</f><v>2</v></c>'+
 '<c r="B3"><f>EXTERNAL.FOO()</f></c></row>'+
 '</sheetData></worksheet>';
const sst='<sst><si><t>id</t></si><si><r><t>OP_</t></r><r><t xml:space="preserve"> 01</t></r></si></sst>';
const styles='<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>';
const extras=[['xl/sharedStrings.xml',sst],['xl/styles.xml',styles]];
test('XLSX cells: read-only typed extraction, sparse rows, formula caches, provenance and dates',()=>{
 const bytes=book(cells,{extra:extras}),before=Buffer.from(bytes);
 const a=extractXlsxCells(bytes,{sheet_name:'Événements fictifs'});
 assert.deepEqual(bytes,before);
 assert.deepEqual(extractXlsxCells(bytes,{sheet_name:'Événements fictifs'}),a);
 assert.equal(a.raw_sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.deepEqual(a.headers,['id','','date']);
 assert.deepEqual(a.sample_rows[0].values,['OP_ 01','true','61']);
 assert.deepEqual(a.sample_rows[0].row_coordinates,['A2','B2','C2']);
 assert.equal(a.cell_provenance.C2.date_candidate.iso,'1900-03-01');
 assert.equal(a.cell_provenance.A3.cached_formula,true);
 assert.equal(a.cell_provenance.A3.cached_value_unverified,true);
 assert.equal(a.cell_provenance.A3.formula_text,'1+1');
 assert.equal(a.cell_provenance.B3.cached_formula,true);
 assert.ok(a.diagnostics.some(x=>x.code==='FORMULA_VALUE_ABSENT'&&x.coordinate==='B3'));
 assert.equal(a.has_formulas,true);
 assert.equal(a.formula_evaluation,'disabled');
 assert.equal(a.canonical_validated,false);
 assert.equal(a.source_modified,false);
});
test('XLSX cells: sheet must be explicitly selected; hidden sheet can be selected',()=>{
 const bytes=book(cells,{extra:extras});
 assert.throws(()=>extractXlsxCells(bytes),err('ASSIST_XLSX_SHEET_SELECTION_REQUIRED'));
 assert.throws(()=>extractXlsxCells(bytes,{sheet_name:'absent'}),err('ASSIST_XLSX_SHEET_SELECTION_INVALID'));
 const hidden=extractXlsxCells(bytes,{sheet_name:'Archives & notes'});
 assert.equal(hidden.sheet_state,'hidden');
 assert.deepEqual(hidden.headers,[]);
});
test('XLSX cells: 1904 workbook system and 1900 phantom leap day remain explicit',()=>{
 const wk=workbook.replace('<sheets>','<workbookPr date1904="1"/><sheets>');
 const sheet='<worksheet><sheetData><row r="1"><c r="A1" s="1"><v>0</v></c></row></sheetData></worksheet>';
 const converted=extractXlsxCells(book(sheet,{wb:wk,extra:[['xl/styles.xml',styles]]}),{sheet_name:'Événements fictifs'});
 assert.equal(converted.date_system,'1904');
 assert.equal(converted.cell_provenance.A1.date_candidate.iso,'1904-01-01');
 const phantom=extractXlsxCells(book(sheet.replace('>0<','>60<'),{extra:[['xl/styles.xml',styles]]}),{sheet_name:'Événements fictifs'});
 assert.equal(phantom.cell_provenance.A1.date_candidate.iso,null);
 assert.ok(phantom.diagnostics.some(x=>x.code==='EXCEL_1900_LEAP_DAY'));
});
test('XLSX cells: adversarial shared index, malformed row and unsafe XML fail closed',()=>{
 const badSst=cells.replace('<v>1</v></c><c r="B2"','<v>99999</v></c><c r="B2"');
 assert.throws(()=>extractXlsxCells(book(badSst,{extra:extras}),{sheet_name:'Événements fictifs'}),err('ASSIST_XLSX_STRING_INDEX_OUT_OF_BOUNDS'));
 const duplicate='<worksheet><sheetData><row r="1"><c r="A1"/><c r="A1"/></row></sheetData></worksheet>';
 assert.throws(()=>extractXlsxCells(book(duplicate),{sheet_name:'Événements fictifs'}),err('ASSIST_XLSX_CELL_REFERENCE'));
 const invalid='<worksheet><sheetData><row r="2"/><row r="1"/></sheetData></worksheet>';
 assert.throws(()=>extractXlsxCells(book(invalid),{sheet_name:'Événements fictifs'}),err('ASSIST_XLSX_ROW_REFERENCE'));
 const xml='<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&xxe;</t></is></c></row></sheetData></worksheet>';
 assert.throws(()=>extractXlsxCells(book(xml),{sheet_name:'Événements fictifs'}),err('ASSIST_XLSX_XML_UNSAFE'));
 const wide='<worksheet><sheetData><row r="1"><c r="AAA1"><v>4</v></c></row></sheetData></worksheet>';
 assert.throws(()=>extractXlsxCells(book(wide),{sheet_name:'Événements fictifs'}),err('ASSIST_XLSX_PREVIEW_LIMIT'));
});
test('XLSX cells: macros, external relationships and NUL are rejected',()=>{
 const malicious=[...base(),['xl/vbaProject.bin','macro']];
 assert.throws(()=>extractXlsxCells(syntheticZip(malicious),{sheet_name:'Événements fictifs'}),err('ASSIST_XLSX_ACTIVE_CONTENT'));
 const link=[...base(),['xl/worksheets/_rels/sheet1.xml.rels',
 '<Relationships><Relationship Id="rId3" Type="hyperlink" Target="https://invalid.example" TargetMode="External"/></Relationships>']];
 assert.throws(()=>extractXlsxCells(syntheticZip(link),{sheet_name:'Événements fictifs'}),err('ASSIST_XLSX_EXTERNAL_LINK'));
 const nul='<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>bad\u0000cell</t></is></c></row></sheetData></worksheet>';
 assert.throws(()=>extractXlsxCells(book(nul),{sheet_name:'Événements fictifs'}),e=>['ASSIST_XLSX_XML_UNSAFE','ASSIST_CELL_NUL'].includes(e.code));
});
