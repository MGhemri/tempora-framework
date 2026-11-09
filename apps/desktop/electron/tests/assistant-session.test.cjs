'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolve}=require('node:path');
const {createHash}=require('node:crypto');
const {deflateRawSync}=require('node:zlib');
const {createAssistantSessions,SESSION_TTL_MS,MAX_SOURCE_BYTES}=require('../assistant-session.cjs');
const sourceRoot=resolve(__dirname,'../../../..','src');
function host(initial,ending='.csv'){
  let content=Buffer.from(initial),clock=1000,readCount=0;
  const path='/native-choice/records'+ending;
  const service=createAssistantSessions({sourceRoot,now:()=>clock,
    stat:p=>{assert.equal(p,path);return {isFile:()=>true,size:content.length};},
    read:p=>{assert.equal(p,path);readCount++;return Buffer.from(content);}
  });
  return {path,service,setData:x=>{content=Buffer.from(x);},tick:x=>{clock+=x;},getReads:()=>readCount};
}
const throws=code=>e=>e.code===code;
const csv='id,title\n1,Title\n2,Second\n';
test('Assistant: native-selected CSV gets only an opaque handle, no paths through IPC',()=>{
  const f=host(csv),opened=f.service.open(f.path);
  assert.match(opened.handle_id,/^[a-f0-9]{48}$/);
  assert.equal(opened.format,'csv');
  assert.equal(opened.file_name,'records.csv');
  assert.equal(opened.source_sha256,createHash('sha256').update(csv).digest('hex'));
  assert.equal(opened.inspection.selected_delimiter,null);
  assert.equal(opened.inspection.suggested_delimiter,',');
  assert.doesNotMatch(JSON.stringify(opened),/native-choice/);
  assert.ok(Object.isFrozen(opened));
  const inspected=f.service.inspect(opened.handle_id);
  assert.equal(inspected.source_sha256,opened.source_sha256);
  assert.equal(inspected.inspection.candidates[0].header_values[0],'id');
  assert.ok(f.getReads()>=2,'re-read and hash each operation');
  assert.equal(f.service.close(opened.handle_id),true);
  assert.throws(()=>f.service.inspect(opened.handle_id),throws('ASSIST_SESSION_MISSING_OR_EXPIRED'));
});
test('Assistant: re-reading file prevents stale source or replayed handle',()=>{
 const f=host(csv),session=f.service.open(f.path);
 f.setData('id,title\n1,Tampered\n');
 assert.throws(()=>f.service.inspect(session.handle_id),throws('ASSIST_SOURCE_CHANGED'));
 assert.throws(()=>f.service.inspect(session.handle_id),throws('ASSIST_SESSION_MISSING_OR_EXPIRED'));
 assert.throws(()=>f.service.close('__proto__'),throws('ASSIST_HANDLE_INVALID'));
 assert.throws(()=>f.service.selectSheet(session.handle_id,'sheet1'),throws('ASSIST_SESSION_MISSING_OR_EXPIRED'));
});
test('Assistant: TTL and new sessions are bounded, and reset clears all handles',()=>{
 const f=host(csv);
 const first=f.service.open(f.path);
 f.tick(SESSION_TTL_MS);
 assert.throws(()=>f.service.inspect(first.handle_id),throws('ASSIST_SESSION_MISSING_OR_EXPIRED'));
 const b=f.service.open(f.path);
 f.service.clear();
 assert.throws(()=>f.service.inspect(b.handle_id),throws('ASSIST_SESSION_MISSING_OR_EXPIRED'));
});
test('Assistant: only three file extensions, and source size is bounded',()=>{
 const f=host('id,title\n1,Hello\n','.exe');
 assert.throws(()=>f.service.open(f.path),throws('ASSIST_SOURCE_FORMAT'));
 const larger=host(Buffer.alloc(MAX_SOURCE_BYTES+1,65));
 assert.throws(()=>larger.service.open(larger.path),throws('ASSIST_SOURCE_LIMIT'));
 const invalid=host(Buffer.from([0xff,0xfe,0x0a]));
 assert.throws(()=>invalid.service.open(invalid.path),throws('ASSIST_UTF8_INVALID'));
});
function crc32(buf){
 let n=0xffffffff;
 for(const b of buf){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}
 return (n^0xffffffff)>>>0;
}
function zip(entries){
 const locals=[],centers=[];let offset=0;
 for(const [name,value] of entries){
   const nameBytes=Buffer.from(name),raw=Buffer.from(value);
   const packed=deflateRawSync(raw),crc=crc32(raw);
   const local=Buffer.alloc(30),central=Buffer.alloc(46);
   local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
   local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);
   local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);
   local.writeUInt32LE(raw.length,22);local.writeUInt16LE(nameBytes.length,26);
   central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);
   central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);
   central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);
   central.writeUInt32LE(packed.length,20);central.writeUInt32LE(raw.length,24);
   central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(offset,42);
   locals.push(local,nameBytes,packed);centers.push(central,nameBytes);
   offset+=local.length+nameBytes.length+packed.length;
 }
 const directory=Buffer.concat(centers),eocd=Buffer.alloc(22);
 eocd.writeUInt32LE(0x06054b50,0);
 eocd.writeUInt16LE(entries.length,8);eocd.writeUInt16LE(entries.length,10);
 eocd.writeUInt32LE(directory.length,12);eocd.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,directory,eocd]);
}
const workbook='<workbook><sheets><sheet name="Fictive" sheetId="1" r:id="rId1"/></sheets></workbook>';
const types='<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>';
const root='<Relationships><Relationship Id="rId0" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
const relationships='<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
const worksheet='<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>id</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>R1</t></is></c></row></sheetData></worksheet>';
const xlsx=zip([['[Content_Types].xml',types],['_rels/.rels',root],
 ['xl/workbook.xml',workbook],['xl/_rels/workbook.xml.rels',relationships],
 ['xl/worksheets/sheet1.xml',worksheet]]);
test('Assistant: XLSX requires explicit sheet, only selected cells are returned',()=>{
 const f=host(xlsx,'.xlsx');
 const opened=f.service.open(f.path);
 assert.equal(opened.inspection.selected_sheet,null);
 assert.equal(opened.inspection.sheets[0].name,'Fictive');
 assert.throws(()=>f.service.selectSheet(opened.handle_id,'No such sheet'),throws('ASSIST_XLSX_SHEET_SELECTION_INVALID'));
 const result=f.service.selectSheet(opened.handle_id,'Fictive');
 assert.deepEqual(result.table.headers,['id']);
 assert.deepEqual(result.table.sample_rows[0].values,['R1']);
 assert.equal(result.source_sha256,opened.source_sha256);
 assert.equal(result.table.formula_evaluation,'disabled');
});
test('Assistant: corrupt or external-link XLSX cannot create a session',()=>{
 const malicious=zip([['[Content_Types].xml',types],['_rels/.rels',root],
 ['xl/workbook.xml',workbook],['xl/_rels/workbook.xml.rels',relationships],
 ['xl/worksheets/sheet1.xml',worksheet],['xl/vbaProject.bin','malicious']]);
 const f=host(malicious,'.xlsx');
 assert.throws(()=>f.service.open(f.path),throws('ASSIST_XLSX_ACTIVE_CONTENT'));
});

test('Assistant: suggestions require explicit trusted profile and delimiter, never confirm',()=>{
 const f=host(csv),session=f.service.open(f.path);
 assert.throws(()=>f.service.suggest(session.handle_id,'synthetic-history',{}),throws('ASSIST_DELIMITER_CONFIRMATION_REQUIRED'));
 assert.throws(()=>f.service.suggest(session.handle_id,'other-profile',{delimiter:','}),throws('ASSIST_PROFILE_NOT_REGISTERED'));
 const result=f.service.suggest(session.handle_id,'synthetic-history',{delimiter:','});
 assert.equal(result.source_sha256,session.source_sha256);
 assert.equal(result.profile_id,'synthetic-history');
 assert.equal(result.mapping.mapping_confirmed,false);
 assert.deepEqual(result.mapping.confirmed_bindings,[]);
 assert.deepEqual(result.mapping.suggestions.map(x=>[x.source_column,x.target_field]),[
  ['id','id'],['title','title.en']]);
 assert.ok(result.mapping.suggestions.every(x=>x.state==='suggested'&&x.confidence_kind==='heuristic'));
 assert.equal(JSON.stringify(result).includes(f.path),false);
 assert.throws(()=>f.service.suggest(session.handle_id,'synthetic-history',{delimiter:'|'}),throws('ASSIST_DELIMITER_CONFIRMATION_REQUIRED'));
 assert.throws(()=>f.service.suggest(session.handle_id,'synthetic-history',{delimiter:',',__proto__:'invisible',bad:2}),throws('ASSIST_MAPPING_CHOICE_INVALID'));
});
test('Assistant: untrusted header and changed file invalidate suggestion request',()=>{
 const unsafe=host('id,__proto__\n1,unsafe\n');
 const open=unsafe.service.open(unsafe.path);
 assert.throws(()=>unsafe.service.suggest(open.handle_id,'synthetic-history',{delimiter:','}),throws('ASSIST_MAPPING_HEADERS_UNSAFE'));
 const f=host(csv),s=f.service.open(f.path);
 f.setData('id,title\n9,Modified\n');
 assert.throws(()=>f.service.suggest(s.handle_id,'synthetic-history',{delimiter:','}),throws('ASSIST_SOURCE_CHANGED'));
});
test('Assistant: worksheet suggestions require explicit sheet and return no confirmation',()=>{
 const f=host(xlsx,'.xlsx'),open=f.service.open(f.path);
 assert.throws(()=>f.service.suggest(open.handle_id,'synthetic-history',{}),throws('ASSIST_SHEET_SELECTION_REQUIRED'));
 const result=f.service.suggest(open.handle_id,'synthetic-history',{sheet_name:'Fictive'});
 assert.equal(result.mapping.mapping_confirmed,false);
 assert.equal(result.mapping.suggestions[0].target_field,'id');
 assert.deepEqual(result.mapping.confirmed_bindings,[]);
});

test('Assistant: explicit user-selected CSV mappings compile once without reading or writing source',()=>{
 const input='id,title,description\n1,A,B\n';
 const f=host(input),session=f.service.open(f.path);
 const proposal=f.service.suggest(session.handle_id,'synthetic-history',{delimiter:','});
 const bindings=[{source_column:'id',target_field:'id',state:'confirmed_by_user'},
  {source_column:'title',target_field:'title.en',state:'confirmed_by_user'}];
 assert.equal(proposal.mapping.mapping_confirmed,false);
 assert.deepEqual(proposal.mapping.confirmed_bindings,[]);
 const receipt=f.service.confirm(session.handle_id,proposal.proposal_token,bindings);
 assert.equal(receipt.mapping_confirmed,true);
 assert.equal(receipt.import_performed,false);
 assert.equal(receipt.canonical_validated,false);
 assert.equal(receipt.source_modified,false);
 assert.equal(receipt.mapping.format,'csv');
 assert.deepEqual(receipt.mapping.fields,{id:'/id',title:{en:'/title'}});
 assert.match(receipt.confirmation_sha256,/^[a-f0-9]{64}$/);
 assert.throws(()=>f.service.confirm(session.handle_id,proposal.proposal_token,bindings),throws('ASSIST_PROPOSAL_EXPIRED'));
 const next=f.service.suggest(session.handle_id,'synthetic-history',{delimiter:','});
 assert.notEqual(next.proposal_token,proposal.proposal_token);
});
test('Assistant: rejects fake confirmation, unissued fields, expired and stale proposal tokens',()=>{
 const f=host(csv),s=f.service.open(f.path);
 const p=f.service.suggest(s.handle_id,'synthetic-history',{delimiter:','});
 const yes=(a,b)=>({source_column:a,target_field:b,state:'confirmed_by_user'});
 const valid=[yes('id','id'),yes('title','title.en')];
 assert.throws(()=>f.service.confirm(s.handle_id,'b'.repeat(48),valid),throws('ASSIST_PROPOSAL_EXPIRED'));
 assert.throws(()=>f.service.confirm(s.handle_id,p.proposal_token,[yes('id','id'),yes('title','title.es')]),throws('ASSIST_MAPPING_UNSUGGESTED_BINDING'));
 assert.throws(()=>f.service.confirm(s.handle_id,p.proposal_token,[yes('id','id'),
  {source_column:'title',target_field:'title.en',state:'suggested'}]),throws('ASSIST_MAPPING_CONFIRMATION_REQUIRED'));
 assert.throws(()=>f.service.confirm(s.handle_id,p.proposal_token,[yes('id','id'),yes('id','id')]),throws('ASSIST_MAPPING_CONFIRMATION_REQUIRED'));
 const newer=f.service.suggest(s.handle_id,'synthetic-history',{delimiter:','});
 assert.throws(()=>f.service.confirm(s.handle_id,p.proposal_token,valid),throws('ASSIST_PROPOSAL_EXPIRED'));
 assert.throws(()=>f.service.confirm(s.handle_id,newer.proposal_token,[yes('id','id'),yes('title','title.es')]),throws('ASSIST_MAPPING_UNSUGGESTED_BINDING'));
 const p2=f.service.suggest(s.handle_id,'synthetic-history',{delimiter:','});
 f.setData('id,title\n1,changed\n');
 assert.throws(()=>f.service.confirm(s.handle_id,p2.proposal_token,valid),throws('ASSIST_SOURCE_CHANGED'));
});
test('Assistant: Excel inspection cannot be compiled through CSV mapping contract',()=>{
 const f=host(xlsx,'.xlsx'),s=f.service.open(f.path);
 const p=f.service.suggest(s.handle_id,'synthetic-history',{sheet_name:'Fictive'});
 assert.throws(()=>f.service.confirm(s.handle_id,p.proposal_token,[]),throws('ASSIST_XLSX_MAPPING_COMPILATION_UNSUPPORTED'));
});

test('Assistant: normalization dry-run requires confirmed CSV mapping and never accepts a batch',()=>{
 const source='id,title,date\n1,Example,12/03/1956\n2,Invalid,31/02/1956\n';
 const f=host(source),s=f.service.open(f.path);
 const rule=[{source_column:'date',rule:{id:'human-date',kind:'date',format:'DD/MM/YYYY'}}];
 assert.throws(()=>f.service.normalizePreview(s.handle_id,rule),throws('ASSIST_PREVIEW_CONFIRMATION_REQUIRED'));
 const p=f.service.suggest(s.handle_id,'synthetic-history',{delimiter:','});
 f.service.confirm(s.handle_id,p.proposal_token,[
  {source_column:'id',target_field:'id',state:'confirmed_by_user'},
  {source_column:'title',target_field:'title.en',state:'confirmed_by_user'},
  {source_column:'date',target_field:'start_date',state:'confirmed_by_user'}]);
 const dry=f.service.normalizePreview(s.handle_id,rule);
 assert.equal(dry.preview.summary.normalized,1);
 assert.equal(dry.preview.summary.quarantined,1);
 assert.equal(dry.preview.canonical_validated,false);
 assert.equal(dry.preview.batch_accepted,false);
 assert.equal(dry.preview.import_performed,false);
 assert.equal(dry.preview.source_sha256,s.source_sha256);
 assert.throws(()=>f.service.normalizePreview(s.handle_id,[{source_column:'absent',rule:rule[0].rule}]),throws('ASSIST_PREVIEW_RULE'));
 f.service.suggest(s.handle_id,'synthetic-history',{delimiter:','});
 assert.throws(()=>f.service.normalizePreview(s.handle_id,rule),throws('ASSIST_PREVIEW_CONFIRMATION_REQUIRED'));
});
test('Assistant: file changes invalidate dry-run and XLSX remains out of scope',()=>{
 const f=host('id,title\n1,A\n'),s=f.service.open(f.path);
 const p=f.service.suggest(s.handle_id,'synthetic-history',{delimiter:','});
 f.service.confirm(s.handle_id,p.proposal_token,[
  {source_column:'id',target_field:'id',state:'confirmed_by_user'},
  {source_column:'title',target_field:'title.en',state:'confirmed_by_user'}]);
 f.setData('id,title\n2,B\n');
 assert.throws(()=>f.service.normalizePreview(s.handle_id,[]),throws('ASSIST_SOURCE_CHANGED'));
 const excel=host(xlsx,'.xlsx'),opened=excel.service.open(excel.path);
 assert.throws(()=>excel.service.normalizePreview(opened.handle_id,[]),throws('ASSIST_PREVIEW_XLSX_UNSUPPORTED'));
});

test('Assistant canonical preview snapshots verified original bytes only after explicit CSV mapping confirmation',()=>{
 const source='id,title,date,type\nFICTIVE_101,Demo,1701,fictional assembly\n';
 const f=host(source),opened=f.service.open(f.path);
 assert.throws(()=>f.service.canonicalInput(opened.handle_id),throws('ASSIST_PREVIEW_CONFIRMATION_REQUIRED'));
 const p=f.service.suggest(opened.handle_id,'synthetic-history',{delimiter:','});
 f.service.confirm(opened.handle_id,p.proposal_token,[
  {source_column:'id',target_field:'id',state:'confirmed_by_user'},
  {source_column:'title',target_field:'title.en',state:'confirmed_by_user'}]);
 const input=f.service.canonicalInput(opened.handle_id);
 assert.equal(input.sourceSha256,opened.source_sha256);
 assert.equal(input.bytes.toString('utf8'),source);
 assert.equal(input.sourceName,'records.csv');
 assert.equal(input.mapping.format,'csv');
 assert.equal(input.profile_id,'synthetic-history');
 assert.ok(!Object.hasOwn(input,'path'));
 input.bytes[0]=0;
 assert.equal(f.service.canonicalInput(opened.handle_id).bytes.toString('utf8'),source,
  'snapshot mutation must not mutate the source or authorized session');
 f.service.suggest(opened.handle_id,'synthetic-history',{delimiter:','});
 assert.throws(()=>f.service.canonicalInput(opened.handle_id),throws('ASSIST_PREVIEW_CONFIRMATION_REQUIRED'));
});
test('Assistant canonical preview rejects stale, oversized and XLSX sources without fallback',()=>{
 const csvInput=host('id,title\n1,First\n'),open=csvInput.service.open(csvInput.path);
 const p=csvInput.service.suggest(open.handle_id,'synthetic-history',{delimiter:','});
 csvInput.service.confirm(open.handle_id,p.proposal_token,[
  {source_column:'id',target_field:'id',state:'confirmed_by_user'},
  {source_column:'title',target_field:'title.en',state:'confirmed_by_user'}]);
 csvInput.setData('id,title\n1,Changed\n');
 assert.throws(()=>csvInput.service.canonicalInput(open.handle_id),throws('ASSIST_SOURCE_CHANGED'));
 const big=host('id,title\n1,'+'A'.repeat(128*1024)+'\n');
 const bigOpen=big.service.open(big.path);
 const bigP=big.service.suggest(bigOpen.handle_id,'synthetic-history',{delimiter:','});
 big.service.confirm(bigOpen.handle_id,bigP.proposal_token,[
  {source_column:'id',target_field:'id',state:'confirmed_by_user'},
  {source_column:'title',target_field:'title.en',state:'confirmed_by_user'}]);
 assert.throws(()=>big.service.canonicalInput(bigOpen.handle_id),throws('ASSIST_CANONICAL_SOURCE_LIMIT'));
 const x=host(xlsx,'.xlsx'),xo=x.service.open(x.path);
 assert.throws(()=>x.service.canonicalInput(xo.handle_id),throws('ASSIST_CANONICAL_XLSX_NOT_SUPPORTED'));
});
