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
test('XLSX: bounded, read-only worksheet inventory without reading cells or executing formulas',()=>{
  const input=syntheticZip(base()),original=Buffer.from(input);
  const a=inspectXlsx(input);
  assert.deepEqual(input,original);
  assert.deepEqual(inspectXlsx(input),a);
  assert.equal(a.raw_sha256,createHash('sha256').update(input).digest('hex'));
  assert.equal(a.sheet_count,2);
  assert.equal(a.selected_sheet,null);
  assert.equal(a.sheets[0].name,'Événements fictifs');
  assert.equal(a.sheets[1].name,'Archives & notes');
  assert.equal(a.sheets[1].state,'hidden');
  assert.equal(a.sheets[0].cell_inspection,'not_implemented');
  assert.equal(a.formulas_executed,false);
  assert.equal(a.canonical_validated,false);
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.sheets)&&Object.isFrozen(a.sheets[0]));
});
test('XLSX: uncompressed store entries also work',()=>{
 const a=inspectXlsx(syntheticZip(base(),{compression:false}));
 assert.equal(a.sheet_count,2);
});
test('XLSX: macro, embedded payload and external links fail closed',()=>{
 for(const name of ['xl/vbaProject.bin','xl/activeX/activeX1.xml',
    'xl/embeddings/oleObject1.bin','xl/externalLinks/externalLink1.xml']){
   assert.throws(()=>inspectXlsx(syntheticZip([...base(),[name,'evil']])),
     err('ASSIST_XLSX_ACTIVE_CONTENT'));
 }
 const entries=base();
 entries[3]=[entries[3][0],relationships.replace('Target="worksheets/sheet1.xml"',
   'Target="https://example.invalid/secret" TargetMode="External"')];
 assert.throws(()=>inspectXlsx(syntheticZip(entries)),err('ASSIST_XLSX_EXTERNAL_LINK'));
});
test('XLSX: duplicate and traversal archive paths are rejected',()=>{
 assert.throws(()=>inspectXlsx(syntheticZip([...base(),['xl/workbook.xml','duplicate']])),
   err('ASSIST_XLSX_DUPLICATE_PART'));
 assert.throws(()=>inspectXlsx(syntheticZip([...base(),['xl/../secret.xml','bad']])),
   err('ASSIST_XLSX_ENTRY_PATH'));
});
test('XLSX: missing worksheet, ambiguous sheet ID, malicious XML rejected',()=>{
 const missing=base().filter(([name])=>name!=='xl/worksheets/sheet2.xml');
 assert.throws(()=>inspectXlsx(syntheticZip(missing)),err('ASSIST_XLSX_SHEET_RELATION'));
 const duplicate=base();
 duplicate[2]=[duplicate[2][0],workbook.replace('sheetId="2"','sheetId="1"')];
 assert.throws(()=>inspectXlsx(syntheticZip(duplicate)),err('ASSIST_XLSX_SHEET_INVALID'));
 const malicious=base();
 malicious[2]=[malicious[2][0],workbook.replace('<sheets>',
   '<!DOCTYPE workbook [<!ENTITY leak SYSTEM "file:///etc/passwd">]><sheets>')];
 assert.throws(()=>inspectXlsx(syntheticZip(malicious)),err('ASSIST_XLSX_XML_UNSAFE'));
});
test('XLSX: truncation, corrupt CRC, and oversized input never yield inventory',()=>{
 const input=syntheticZip(base());
 assert.throws(()=>inspectXlsx(input.subarray(0,input.length-8)),
   err('ASSIST_XLSX_ZIP_STRUCTURE'));
 const corrupted=Buffer.from(input);
 const offset=30+Buffer.byteLength('[Content_Types].xml')+2;
 corrupted[offset]^=0x20;
 assert.throws(()=>inspectXlsx(corrupted),e=>e.code==='ASSIST_XLSX_DECOMPRESSION'||
   e.code==='ASSIST_XLSX_ZIP_INTEGRITY');
 assert.throws(()=>inspectXlsx(Buffer.alloc(MAX_ARCHIVE_BYTES+1)),
   err('ASSIST_XLSX_SIZE'));
 assert.throws(()=>inspectXlsx(Buffer.from('not an Excel file')),
   err('ASSIST_XLSX_NOT_ZIP'));
});


test('XLSX: external links in worksheet or root relationships cannot hide from inventory',()=>{
 const extra='<Relationships><Relationship Id="hyperlink1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>';
 assert.throws(()=>inspectXlsx(syntheticZip([...base(),['xl/worksheets/_rels/sheet1.xml.rels',extra]])),
   err('ASSIST_XLSX_EXTERNAL_LINK'));
 const changed=base();
 changed[1]=[changed[1][0],rootRels.replace('Target="xl/workbook.xml"',
   'Target="http://example.invalid/workbook.xml" TargetMode="External"')];
 assert.throws(()=>inspectXlsx(syntheticZip(changed)),err('ASSIST_XLSX_EXTERNAL_LINK'));
});
test('XLSX: root relation and workbook content type are checked explicitly',()=>{
 const wrongRoot=base();
 wrongRoot[1]=[wrongRoot[1][0],rootRels.replace('xl/workbook.xml','other/workbook.xml')];
 assert.throws(()=>inspectXlsx(syntheticZip(wrongRoot)),err('ASSIST_XLSX_ROOT_RELATION'));
 const wrongType=base();
 wrongType[0]=[wrongType[0][0],types.replace('spreadsheetml.sheet.main+xml','wordprocessingml.document.main+xml')];
 assert.throws(()=>inspectXlsx(syntheticZip(wrongType)),err('ASSIST_XLSX_CONTENT_TYPE'));
});
test('XLSX: XML comments cannot inject fake worksheet definitions',()=>{
 const malicious=base();
 malicious[2]=[malicious[2][0],workbook.replace('<sheets>',
   '<!-- <sheet name="fake" sheetId="3" r:id="rId1"/> --><sheets>')];
 assert.throws(()=>inspectXlsx(syntheticZip(malicious)),err('ASSIST_XLSX_XML_UNSAFE'));
});
