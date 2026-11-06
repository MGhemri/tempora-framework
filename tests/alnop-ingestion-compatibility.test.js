const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {prepareImport}=require('../src/framework/ingestion');
const {digest}=require('../src/framework/canonical');
const {nativeCorpus}=require('./helpers/tempora');
const {toTempora}=require('../compatibility/alnop/adapters/alnop-migration');
const old=require('../src/canonical'),alnop=require('../compatibility/alnop/adapters/alnop');
const prepare=(corpus,bytes,mapping)=>prepareImport({corpus,bytes,mapping,sourceName:'compatibility.input',observedAt:'2026-11-05T00:00:00Z'});

test('Real ALNOP input is previewed against the migrated corpus without replacing any of its 263 notices',()=>{
 const c=toTempora(old.readCorpus(),alnop.load(old.root)),before=digest(c),m=require('../compatibility/alnop/profile/imports/json.json');
 const b=prepare(c,fs.readFileSync(path.join(old.root,'operations_fln_1954_1962.json')),m);assert.equal(b.report.summary.total,263);assert.equal(b.report.summary.create,0);assert.equal(b.report.summary.quarantined,0);assert.equal(digest(c),before);
 const independent=nativeCorpus();
 assert.throws(()=>prepare(independent,Buffer.from('[]'),m),{code:'MAPPING_PROFILE_MISMATCH'});
});
test('ALNOP prepared CSV and GeoJSON preserve an explicit French/Arabic proposal and check vocabulary and date window',()=>{
 const c=toTempora(old.readCorpus(),alnop.load(old.root)),type=c.taxonomies.event_types[0],csv=require('../compatibility/alnop/profile/imports/csv.json'),geo=require('../compatibility/alnop/profile/imports/geojson.json');
 const line=['INGESTION_TEST_A','Notice fictive','Ø§Ø®ØªØ¨Ø§Ø±','1956',type,'2','34','representative_point'].map(s=>'"'+s.replace(/"/g,'""')+'"').join(',');
 const b=prepare(c,Buffer.from('id,nom_operation,nom_operation_ar,date_debut,type_action,longitude,latitude,geometry_role\n'+line+'\n'),csv);assert.deepEqual(b.report.summary,{total:1,create:1,unchanged:0,conflict:0,quarantined:0});assert.equal(b.candidates[0].event.title.ar,'Ø§Ø®ØªØ¨Ø§Ø±');assert.equal(b.candidates[0].event.start_date.precision,'year');
 const collection={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'INGESTION_TEST_B',nom_operation:'Test only',type_action:'unknown type',date_debut:'1950'},geometry:null}]};
 const invalid=prepare(c,Buffer.from(JSON.stringify(collection)),geo);assert.deepEqual(invalid.report.summary,{total:1,create:0,unchanged:0,conflict:0,quarantined:1});assert.ok(invalid.report.rows[0].diagnostics.some(d=>d.code==='DATE_OUTSIDE_PROFILE'));assert.ok(invalid.report.rows[0].diagnostics.some(d=>d.code==='VOCABULARY_UNKNOWN'));
});
