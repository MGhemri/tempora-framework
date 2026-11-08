const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {nativeCorpus}=require('./helpers/tempora');
const {inspectDelimitedSample}=require('../src/framework/assist-inspection');
const {suggestColumnMappings,compileConfirmedCsvMapping}=require('../src/framework/assist-mapping');
const {prepareImport}=require('../src/framework/ingestion');
const {checkMapping}=require('../src/framework/ingestion-mapping');
const rowInput=[
 'identifiant;nom_operation;date_debut;type_action',
 'ASSIST_SYN_A;Événement fictif A;1701;fictional assembly',
 'ASSIST_SYN_B;Événement fictif B;1702;fictional assembly',
 'ASSIST_SYN_INVALID;Événement fictif C;29/02/1701;fictional assembly'
].join('\r\n')+'\r\n';
const confirmed=(source_column,target_field)=>({source_column,target_field,state:'confirmed_by_user'});
const exampleAliases=profile=>({
 alias_schema_version:'1.0.0',id:'fictional-operation-headers',
 profile_id:profile.id,profile_version:profile.version,
 aliases:[{header:'nom_operation',target:'title'},{header:'type_action',target:'event_type'}]
});

test('Assistant M1 CSV inspection -> explicit mapping -> canonical preview preserves source and quarantines invalid rows',()=>{
 const corpus=nativeCorpus(),before=structuredClone(corpus);
 const bytes=Buffer.from(rowInput,'utf8'),original=Buffer.from(bytes);
 const inspected=inspectDelimitedSample(bytes);
 assert.equal(inspected.suggested_delimiter,';');
 assert.equal(inspected.selected_delimiter,null);
 const candidate=inspected.candidates.find(x=>x.delimiter===';');
 assert.ok(candidate);
 assert.deepEqual(candidate.header_issues,[]);
 const headers=candidate.header_values;
 const suggestions=suggestColumnMappings(headers,corpus.profile,exampleAliases(corpus.profile));
 assert.equal(suggestions.mapping_confirmed,false);
 assert.equal(suggestions.confirmed_bindings.length,0);
 assert.deepEqual(suggestions.suggestions.map(x=>x.target_field),['id','title.en','start_date','event_type']);
 const mapping=compileConfirmedCsvMapping({
  headers,profile:corpus.profile,id:'assist-fictitious-csv',version:'1.0.0',delimiter:';',
  bindings:[
   confirmed('identifiant','id'),confirmed('nom_operation','title.en'),
   confirmed('date_debut','start_date'),confirmed('type_action','event_type')
  ]
 });
 assert.deepEqual(checkMapping(mapping,corpus.profile),mapping);
 const preview=prepareImport({bytes,mapping,corpus,sourceName:'fictitious.csv',observedAt:null});
 assert.deepEqual(preview.report.summary,{total:3,create:2,unchanged:0,conflict:0,quarantined:1});
 assert.deepEqual(preview.report.rows.map(x=>x.source_path),[
  'csv:line:2','csv:line:3','csv:line:4'
 ]);
 assert.ok(preview.report.rows[2].diagnostics.some(x=>x.code==='ROW_DATE'));
 assert.deepEqual(preview.candidates.map(x=>x.event.id),['ASSIST_SYN_A','ASSIST_SYN_B']);
 assert.equal(preview.candidates[0].event.title.en,'Événement fictif A');
 assert.equal(preview.candidates[0].event.editorial_status,'proposed');
 assert.equal(preview.report.source.sha256,createHash('sha256').update(original).digest('hex'));
 assert.deepEqual(bytes,original);
 assert.deepEqual(corpus,before);
 assert.equal(corpus.events.some(x=>x.id==='ASSIST_SYN_A'),false);
 assert.deepEqual(prepareImport({bytes,mapping,corpus,sourceName:'fictitious.csv',observedAt:null}).report,
  preview.report);
});
test('Assistant does not compile unreviewed suggestions into a staging mapping',()=>{
 const c=nativeCorpus(),bytes=Buffer.from(rowInput);
 const report=inspectDelimitedSample(bytes);
 const suggestions=suggestColumnMappings(report.candidates[0].header_values,c.profile,exampleAliases(c.profile));
 const bindings=suggestions.suggestions.map(x=>({
  source_column:x.source_column,target_field:x.target_field,state:x.state
 }));
 assert.throws(()=>compileConfirmedCsvMapping({
  headers:report.candidates[0].header_values,profile:c.profile,bindings,
  id:'unreviewed',version:'1.0.0',delimiter:';'
 }),error=>error.code==='ASSIST_MAPPING_CONFIRMATION_REQUIRED');
});
