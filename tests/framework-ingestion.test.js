const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {prepareImport,acceptImport,createWorkingCorpus,renderMarkdown}=require('../src/framework/ingestion');
const {digest,validateCorpus}=require('../src/framework/canonical');
const {nativeCorpus}=require('./helpers/tempora');
const time='2026-11-05T00:00:00Z',reviewed='2026-11-05T01:00:00Z';
const review=(...ids)=>({ids,reviewer:'TEST only',reason:'Fictional local staging test',reviewed_at:reviewed});
const code=expected=>e=>e.code===expected;
const row=(id,extra={})=>({id,name:'Asamblea ficticia',date:'1701',type:'reunión ficticia',...extra});
const bytes=value=>Buffer.from(JSON.stringify(value));
const mapping=(c,format='json',extra={})=>({mapping_schema_version:'1.0.0',id:'fictional-event-import',version:'1.0.0',profile_id:c.profile.id,profile_version:c.profile.version,format,fields:{id:'/id',title:{es:'/name'},start_date:'/date',event_type:'/type'},...extra});
const prepare=(corpus,body,manifest=mapping(corpus),extra={})=>prepareImport({corpus,bytes:body,mapping:manifest,sourceName:'synthetic.input',observedAt:time,...extra});
const counts=(b,expected)=>assert.deepEqual(b.report.summary,{total:0,create:0,unchanged:0,conflict:0,quarantined:0,...expected});
test('JSON isolates invalid records, keeps source locators, explicit unknowns and exact original multilingual text',()=>{
 const c=nativeCorpus(),before=structuredClone(c),m=mapping(c),original=row(' NEW_1 ',{name:'Été — العربية\u200f',date:'1701-02',extra:'Non traduit'});
 m.records_pointer='/events';m.fields.evidence='/evidence';original.evidence=[{source_id:'DOCUMENT_1',locator:'folio 2',quotation:'Texte original'}];
 const body=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),bytes({events:[original,row('BAD_DATE',{date:'1701-02-29'}),null,row('BAD_REF',{evidence:[{source_id:'missing'}]}),row('AFTER_1')]})]);
 const b=prepare(c,body,m);counts(b,{total:5,create:2,quarantined:3});assert.deepEqual(c,before);assert.equal(b.report.source.encoding,'UTF-8 BOM');
 assert.deepEqual(Buffer.from(b.original_input_base64,'base64'),body);assert.deepEqual(b.report.rows.map(r=>r.source_path),['/events/0','/events/1','/events/2','/events/3','/events/4']);
 const e=b.candidates[0].event;assert.equal(e.id,'NEW_1');assert.equal(e.title.es,original.name);assert.equal(e.start_date.precision,'month');assert.equal(e.end_date.earliest,null);assert.deepEqual(e.event_type,['fictional assembly']);assert.deepEqual(e.extensions.ingestion.original,original);
 assert.equal(e.provenance.evidence[0].locator,'folio 2');assert.equal(e.provenance.transformations[0].input_sha256,b.report.source.sha256);assert.equal(e.extensions.ingestion.field_paths.title.es,'/name');
 assert.ok(b.report.rows[3].diagnostics.some(d=>d.code==='ROW_SOURCE_UNKNOWN'));assert.match(renderMarkdown(b.report),/quarantaine : 3/);
});
test('CSV handles escaped quotes, multiline fields, UTF-8, delimiter, CRLF and retains valid rows after width errors',()=>{
 const c=nativeCorpus(),m=mapping(c,'csv',{delimiter:';'});m.fields.longitude='/lon';m.fields.latitude='/lat';m.fields.geometry_role='/role';
 const body=Buffer.from('id;name;date;type;lon;lat;role\r\nCSV_A;"Été; ""nom""\r\nالعربية";1702;reunión ficticia;0;0;representative_point\r\nBAD_WIDTH;foo\r\nCSV_B;Deuxième;1703;fictional assembly;;;\r\n');
 const b=prepare(c,body,m);counts(b,{total:3,create:2,quarantined:1});assert.deepEqual(b.report.rows.map(r=>r.line),[2,4,5]);assert.equal(b.candidates[0].event.title.es,'Été; "nom"\r\nالعربية');assert.deepEqual(b.candidates[0].spatial[0].geometry.coordinates,[0,0]);assert.deepEqual(b.candidates[1].spatial,[]);
 assert.equal(b.report.rows[1].diagnostics[0].code,'ROW_CSV_WIDTH');
});
test('GeoJSON validates each feature before mapping and retains null or multiple points without guessing precision',()=>{
 const c=nativeCorpus(),m=mapping(c,'geojson',{fields:{id:'/properties/id',title:{es:'/properties/name'},start_date:'/properties/date',event_type:'/properties/type',geometry:'/geometry',geometry_role:'/properties/role'}});
 const feature=(id,geometry,role)=>({type:'Feature',properties:row(id,role?{role}:{}),geometry});
 const body={type:'FeatureCollection',features:[feature('GEO_A',{type:'MultiPoint',coordinates:[[2,3],[5,6]]},'representative_point'),feature('GEO_B',null),feature('GEO_BAD',{type:'Point',coordinates:[2,91]},'exact_site'),feature('GEO_NO_ROLE',{type:'Point',coordinates:[2,4]}),{type:'Wrong'}]};
 const b=prepare(c,bytes(body),m);counts(b,{total:5,create:2,quarantined:3});assert.equal(b.candidates[0].spatial[0].geometry.type,'MultiPoint');assert.equal(b.candidates[0].spatial[0].precision_meters,null);assert.equal(b.candidates[1].spatial[0].geometry_role,'unknown');assert.equal(b.candidates[1].spatial[0].geometry,null);
 assert.throws(()=>prepare(c,bytes({...body,crs:{type:'name'}}),m),code('INPUT_GEOJSON_CRS'));
});
test('Conflicting IDs are never replaced or resolved by file order; invalid peer blocks its matching ID',()=>{
 const c=nativeCorpus(),b=prepare(c,bytes([row('DUP'),row('DUP'),row('CONFLICT'),row('CONFLICT',{name:'Divergence'}),row('EXAMPLE_1'),row('DOCUMENT_1'),row('PEER'),row('PEER',{name:''}),row('OK')]));
 counts(b,{total:9,create:2,unchanged:1,conflict:5,quarantined:1});assert.deepEqual(b.candidates.map(r=>r.event.id),['DUP','OK']);assert.ok(b.report.rows[4].changed_fields.includes('title'));assert.equal(b.report.rows[5].diagnostics.at(-1).code,'BASE_ID_KIND_CONFLICT');assert.equal(b.report.rows[6].diagnostics.at(-1).code,'BATCH_ID_QUARANTINED_PEER');
 assert.throws(()=>acceptImport({corpus:c,bundle:b,review:review('CONFLICT')}),code('REVIEW_SELECTION'));
});
test('Acceptance is explicit, local and idempotent; repeated input bytes keep the batch and produce no additions',()=>{
 const c=nativeCorpus(),body=bytes([row('REPEAT_1'),row('REPEAT_2')]),m=mapping(c),b=prepare(c,body,m),before=structuredClone(c);
 assert.deepEqual(prepare(c,body,m),b);assert.throws(()=>acceptImport({corpus:c,bundle:b,review:review()}),code('REVIEW_SELECTION'));
 const snapshot=acceptImport({corpus:c,bundle:b,review:review('REPEAT_1','REPEAT_2')});assert.deepEqual(c,before);assert.equal(validateCorpus(snapshot.corpus).valid,true);assert.equal(snapshot.journal.scientific_approval,false);assert.ok(snapshot.corpus.events.slice(-2).every(e=>e.editorial_status==='proposed'&&!e.review_refs.length));
 const second=prepare(snapshot.corpus,body,m,{sourceName:'renamed.json',observedAt:reviewed});counts(second,{total:2,unchanged:2});assert.equal(second.report.batch_id,b.report.batch_id);assert.equal(second.report.base_sha256,snapshot.journal.output_sha256);assert.equal(digest(snapshot.corpus),snapshot.journal.output_sha256);
 assert.throws(()=>acceptImport({corpus:snapshot.corpus,bundle:b,review:review('REPEAT_1')}),code('BUNDLE_STALE'));
 const changed=structuredClone(b);changed.candidates[0].event.editorial_status='published';assert.throws(()=>acceptImport({corpus:c,bundle:changed,review:review('REPEAT_1')}),code('BUNDLE_CHANGED'));
 assert.throws(()=>acceptImport({corpus:c,bundle:b,review:{...review('REPEAT_1'),reviewed_at:'2026-11-04T01:00:00Z'}}),code('REVIEW_TIMESTAMP'));
});
test('Selected rows can be accepted without accepting all valid rows or changing the base',()=>{
 const c=nativeCorpus(),b=prepare(c,bytes([row('SELECTED'),row('LEFT_OVER'),row('BAD',{date:'1900'})]));
 counts(b,{total:3,create:2,quarantined:1});const s=acceptImport({corpus:c,bundle:b,review:review('SELECTED')});assert.equal(s.corpus.events.at(-1).id,'SELECTED');assert.equal(s.corpus.events.some(e=>e.id==='LEFT_OVER'),false);assert.equal(c.events.length,1);
 assert.ok(b.report.rows[2].diagnostics.some(d=>d.code==='DATE_OUTSIDE_PROFILE'));
});
test('Syntax and encoding failures are explicit and never produce a partially interpreted input file',()=>{
 const c=nativeCorpus();for(const [body,expected]of [[Buffer.from([0xff,0xfe,0x7b,0]),'INPUT_ENCODING'],[Buffer.from('{'),'INPUT_JSON_SYNTAX'],[Buffer.from('[{"id":"A","\\u0069d":"B"}]'),'INPUT_JSON_DUPLICATE_KEY'],[Buffer.from('[{"n":9007199254740993}]'),'INPUT_JSON_NUMBER'],[Buffer.from('[{"n":1e-999}]'),'INPUT_JSON_NUMBER'],[bytes({foo:[]}), 'INPUT_JSON_ROWS']])assert.throws(()=>prepare(c,body),code(expected));
 for(const [body,expected]of [['id,name\nA,"x','INPUT_CSV_SYNTAX'],['id,id\nA,B','INPUT_CSV_HEADER'],['id,name\nA,"x"other','INPUT_CSV_SYNTAX']])assert.throws(()=>prepare(c,Buffer.from(body),mapping(c,'csv')),code(expected));
});
test('Mapping contract rejects unsafe selectors, ambiguous options and wrong profiles; pointers escape names correctly',()=>{
 const c=nativeCorpus(),m=mapping(c);m.fields.title.es='/nested/a~1b~0c';const b=prepare(c,bytes([row('POINTER',{nested:{'a/b~c':'Quoted field'}})]),m);assert.equal(b.candidates[0].event.title.es,'Quoted field');
 for(const [change,expected]of [[x=>x.profile_version='9.0.0','MAPPING_PROFILE_MISMATCH'],[x=>x.fields.id='/__proto__/id','MAPPING_POINTER'],[x=>x.fields.title={fr:'/name'},'MAPPING_LANGUAGE'],[x=>x.fields.longitude='/lon','MAPPING_INVALID'],[x=>x.delimiter=';','MAPPING_INVALID'],[x=>x.fields.id='/bad~2','MAPPING_INVALID']]){const broken=mapping(c);change(broken);assert.throws(()=>prepare(c,bytes([row('A')]),broken),code(expected));}
 const dangerous=prepare(c,Buffer.from('[{"id":"BAD","name":"A","__proto__":{}},{"id":"GOOD","name":"A"}]'));counts(dangerous,{total:2,create:1,quarantined:1});
});
test('An empty synthetic corpus accepts its first independent event proposal',()=>{
 const independent=nativeCorpus(),empty=createWorkingCorpus(independent.profile,independent.taxonomies);assert.equal(empty.events.length,0);assert.equal(prepare(empty,bytes([row('UNRELATED')])).report.summary.create,1);
});
test('CLI defaults to no writes, saves one immutable package, requires explicit selection and validates the resulting working snapshot',t=>{
 const {run}=require('../scripts/ingest-tempora'),os=require('node:os');const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-ingestion-test-'));
 t.after(()=>{const real=fs.realpathSync(folder),parent=fs.realpathSync(os.tmpdir());if(path.dirname(real)===parent&&path.basename(real).startsWith('tempora-ingestion-test-'))fs.rmSync(real,{recursive:true,force:true});});
 const c=nativeCorpus(),base=path.join(folder,'base.json'),m=path.join(folder,'mapping.json'),input=path.join(folder,'input.json');
 fs.writeFileSync(base,bytes(c));fs.writeFileSync(m,bytes(mapping(c)));fs.writeFileSync(input,bytes([row('CLI_NEW')]));
 const args=['import','--input',input,'--mapping',m,'--base',base],opts={rootDirectory:folder,clock:()=>time,writeLine:()=>{}};
 assert.equal(run(args,opts).local_output,null);assert.equal(fs.existsSync(path.join(folder,'work')),false);
 const stage=run([...args,'--write'],opts);assert.ok(stage.local_output.startsWith('work/tempora-v3/ingestion/batch-'));assert.throws(()=>run([...args,'--write'],opts),code('CLI_OUTPUT_EXISTS'));
 const accept=['accept','--batch',path.join(folder,stage.local_output),'--base',base,'--id','CLI_NEW','--reviewer','TEST','--reason','Fictional test','--write'];
 const accepted=run(accept,{...opts,clock:()=>reviewed});assert.equal(accepted.snapshot.corpus.events.at(-1).editorial_status,'proposed');
 assert.equal(run(['validate','--base',path.join(folder,accepted.local_output)],opts).exitCode,0);assert.deepEqual(JSON.parse(fs.readFileSync(base,'utf8')),c);
 assert.throws(()=>run(['publish','--base',base],opts),code('CLI_ARGUMENT'));
});

test('A collision between an explicit identifier and another record’s derived spatial ID blocks both candidates',()=>{
 const c=nativeCorpus(),m=mapping(c,'json',{default_geometry_role:'representative_point'});m.fields.geometry='/geometry';
 const first=row('PARENT',{geometry:{type:'Point',coordinates:[1,2]}}),id=prepare(c,bytes([first]),m).candidates[0].spatial[0].id;
 const b=prepare(c,bytes([first,row(id),row('FREE')]),m);counts(b,{total:3,create:1,conflict:2});assert.equal(b.candidates[0].event.id,'FREE');assert.ok(b.report.rows[0].diagnostics.some(d=>d.code==='BATCH_DERIVED_ID_CONFLICT'));
});

test('Two profiles import the same event identifier independently',()=>{
 const {loadProfile}=require('../src/framework/profile-loader');
 const first=nativeCorpus();
 const secondProfile=loadProfile(path.join(__dirname,'fixtures/profiles/synthetic-maritime/profile.json'));
 const second=createWorkingCorpus(secondProfile,{event_types:['fictional port call'],territorial_units:[]});
 const firstBatch=prepare(first,bytes([row('SHARED_1')]));
 const secondMapping=mapping(second);
 secondMapping.fields.title={fr:'/name'};
 const secondBatch=prepare(second,bytes([row('SHARED_1',{date:'1935',type:'escale fictive',name:'Escale fictive'})]),secondMapping);
 counts(firstBatch,{total:1,create:1});
 counts(secondBatch,{total:1,create:1});
 assert.equal(firstBatch.candidates[0].event.id,secondBatch.candidates[0].event.id);
 assert.notEqual(firstBatch.candidates[0].event.namespace,secondBatch.candidates[0].event.namespace);
 assert.deepEqual(secondBatch.candidates[0].event.event_type,['fictional port call']);
 assert.throws(()=>prepare(first,bytes([]),secondMapping),code('MAPPING_PROFILE_MISMATCH'));
});

test('A mixed canonical batch stages six dependent record kinds as one explicit transaction',()=>{
 const fixture=nativeCorpus(),base=createWorkingCorpus(fixture.profile,fixture.taxonomies);
 const [event]=fixture.events,[source]=fixture.sources,[claim]=fixture.claims;
 const shared={schema_version:event.schema_version,namespace:event.namespace,editorial_status:'proposed',
  provenance:{evidence:[],transformations:[]},extensions:{}};
 const ref=({kind,namespace,id})=>({kind,namespace,id});
 const unknown=event.end_date;
 const place={...shared,kind:'entity',id:'PORT_1',entity_type:'place',label:{en:'Fictional port'},names:[],
  valid_from:unknown,valid_to:unknown,spatial_refs:[],review_refs:[]};
 const spatial={...shared,kind:'spatial',id:'SITE_1',subject:ref(event),place:ref(place),label:null,
  geometry:{type:'Point',coordinates:[1,2]},crs:'EPSG:4326',geometry_role:'representative_point',
  precision_meters:null,geocoding_method:null,reference_version:null};
 const relation={...shared,kind:'relation',id:'RELATION_1',subject:ref(event),object:ref(place),predicate:'visited',
  valid_from:unknown,valid_to:unknown,review_refs:[]};
 event.spatial_refs.push(ref(spatial));
 const records=[relation,claim,spatial,event,place,source];
 const invalidSource={...source,id:'INVALID_SOURCE',url:'javascript:alert(1)'};
 const brokenEvent={...event,id:'BROKEN_1',spatial_refs:[],provenance:{...event.provenance,
  evidence:[{source:ref(invalidSource),locator:null,quotation:null}]}};
 const m={...mapping(base),record_kind:'mixed',fields:{record:'/record'}};
 const wrap=record=>({record,unmapped:'Texte original — العربية'});
 const input=bytes([...records,invalidSource,brokenEvent].map(wrap));
 const batch=prepare(base,input,m);
 counts(batch,{total:8,create:6,quarantined:2});
 assert.ok(batch.report.rows[7].diagnostics.some(d=>d.code==='CANONICAL_REFERENCE_MISSING'));
 assert.deepEqual(Buffer.from(batch.original_input_base64,'base64'),input);
 assert.throws(()=>acceptImport({corpus:base,bundle:batch,review:review(event.id)}),code('REVIEW_DEPENDENCY'));
 assert.equal(base.events.length,0);
 const output=acceptImport({corpus:base,bundle:batch,review:review(...records.map(record=>record.id))});
 assert.equal(validateCorpus(output.corpus).valid,true);
 assert.equal(output.corpus.events[0].editorial_status,'proposed');
 assert.equal(output.corpus.events[0].extensions.ingestion.original.unmapped,'Texte original — العربية');
 assert.equal(output.corpus.events[0].provenance.transformations.at(-1).input_sha256,batch.report.source.sha256);
 assert.equal(output.journal.scientific_approval,false);
 counts(prepare(output.corpus,input,m),{total:8,unchanged:6,quarantined:2});
});

test('Canonical CSV and GeoJSON mappings preserve the payload and reject forged editorial state',()=>{
 const fixture=nativeCorpus(),base=createWorkingCorpus(fixture.profile,fixture.taxonomies);
 const source=fixture.sources[0];
 const csv={...mapping(base,'csv'),record_kind:'source',fields:{record:'/payload'},delimiter:';'};
 const cell=JSON.stringify(source).replace(/"/g,'""');
 counts(prepare(base,Buffer.from('payload;unused\r\n"'+cell+'";original\r\n'),csv),{total:1,create:1});
 const geo={...mapping(base,'geojson'),record_kind:'source',fields:{record:'/properties/payload'}};
 const input=record=>bytes({type:'FeatureCollection',features:[{type:'Feature',properties:{payload:record},geometry:null}]});
 counts(prepare(base,input(source),geo),{total:1,create:1});
 const forged=prepare(base,input({...source,editorial_status:'published'}),geo);
 assert.equal(forged.report.rows[0].diagnostics[0].code,'ROW_EDITORIAL_STATUS');
 assert.throws(()=>prepare(base,bytes([]),{...mapping(base),fields:{record:'/payload'}}),code('MAPPING_INVALID'));
 const narrow={...mapping(base),record_kind:'entity',fields:{record:'/payload'}};
 assert.equal(prepare(base,bytes([{payload:source}]),narrow).report.rows[0].diagnostics[0].code,'ROW_CANONICAL_KIND');
});

test('Input limits and malformed CSV headers fail before a preview can be staged',()=>{
 const corpus=nativeCorpus();
 const {MAX_BYTES}=require('../src/framework/ingestion-formats');
 assert.throws(()=>prepare(corpus,Buffer.alloc(MAX_BYTES+1)),code('INPUT_SIZE'));
 const nested='['.repeat(140)+'0'+']'.repeat(140);
 assert.throws(()=>prepare(corpus,Buffer.from(nested)),code('INPUT_JSON_DEPTH'));
 const csv=mapping(corpus,'csv',{delimiter:';'});
 assert.throws(()=>prepare(corpus,Buffer.from('id;name;name\nA;B;C'),csv),code('INPUT_CSV_HEADER'));
 assert.throws(()=>prepare(corpus,Buffer.from('id;name\nA;"B"x'),csv),code('INPUT_CSV_SYNTAX'));
});


test('Renamed event_type vocabulary is used by ingestion aliases and observed coverage',()=>{
 const c=nativeCorpus();
 const alias=c.profile.aliases.find(a=>a.taxonomy==='event_types' && a.value==='reunión ficticia');
 assert.ok(alias,'synthetic fixture has a declared event-type alias');
 c.profile.taxonomies=c.profile.taxonomies.map(name=>name==='event_types'?'types_evenement':name);
 c.profile.rules=c.profile.rules.map(rule=>rule.type==='vocabulary'&&rule.field==='event_type'
   ? {...rule,taxonomy:'types_evenement'}:rule);
 c.profile.aliases=c.profile.aliases.map(a=>a.taxonomy==='event_types'?{...a,taxonomy:'types_evenement'}:a);
 c.taxonomies.types_evenement=c.taxonomies.event_types;
 delete c.taxonomies.event_types;
 assert.equal(validateCorpus(c).valid,true);
 const b=prepare(c,bytes([row('RENAMED_VOCAB')]));
 assert.deepEqual(b.report.summary,{total:1,create:1,unchanged:0,conflict:0,quarantined:0});
 assert.deepEqual(b.candidates[0].event.event_type,['fictional assembly']);
 const {analyze}=require('../src/framework/analysis');
 const result=analyze(c,{scope:'working'});
 assert.ok(result.coverage.groups.type.some(group=>group.key==='fictional assembly'));
 assert.ok(!result.coverage.groups.type.some(group=>group.key==='reunión ficticia'));
});
