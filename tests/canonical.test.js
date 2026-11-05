const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {migrate,dateBounds,validateCorpus,restoreLegacy,readCorpus,root}=require('../src/canonical');
const {artifacts}=require('../scripts/build-canonical');
const original=require('../migrations/legacy-initial.json');
const {withProposal,approve}=require('./helpers/corpus');
const commit='97eef827834a7463e85eed8b5bd5c81e08069420';
test('T01/T03: exact round trip of 263 complete original records and metadata',()=>{
  const corpus=readCorpus();
  assert.ok(corpus.operations.length>=263);
  assert.deepEqual(restoreLegacy(corpus),original);
  assert.deepEqual(validateCorpus(corpus).errors,[]);
});
test('T02/T18: deterministic import and exports',()=>{
  assert.deepEqual(migrate(original,commit),migrate(original,commit));
  const files=artifacts(readCorpus());
  assert.deepEqual(files,artifacts(readCorpus()));
  for(const [name,content] of Object.entries(files))
    assert.equal(fs.readFileSync(path.join(root,'generated',name),'utf8'),content,name);
});
test('T07: partial dates retain precision, including leap years',()=>{
  assert.deepEqual(dateBounds('1956'),{earliest:'1956-01-01',latest:'1956-12-31',precision:'year',certainty:'unknown'});
  assert.equal(dateBounds('1956-02').latest,'1956-02-29');
  assert.throws(()=>dateBounds('1956-02-30'));
});
test('T08/T09: unknown location and multi-territorial label are not invented',()=>{
  const source=structuredClone(original.operations[0]);
  source.localisation={region_ou_ville:'غير معروف'};
  const op=migrate({dataset_metadata:{},operations:[source]},commit).operations[0];
  assert.equal(op.locations[0].geometry,null);
  assert.deepEqual(op.territorial_assignments,[]);
  assert.equal(op.legacy_territorial_label,source.wilaya_concernee);
  assert.equal(op.title.ar,null);
});
test('T05/T06/T21: invalid schema, IDs, dates, coordinates and orphan sources fail',()=>{
  const base=migrate(original,commit);
  for(const corrupt of [
    c=>c.operations.push(c.operations[0]), c=>c.operations[0].title.fr=7,
    c=>c.operations[0].locations[0].geometry.coordinates=[181,91],
    c=>c.operations[0].end_date.latest='1900-01-01',
    c=>c.sources=[]]) {
    const c=structuredClone(base); corrupt(c); assert.ok(validateCorpus(c).errors.length);
  }
  const duplicate=structuredClone(original);duplicate.operations.push(duplicate.operations[0]);
  assert.throws(()=>migrate(duplicate,commit),/duplicate/);
});
test('T17: GeoJSON uses lon,lat and labels uncertainty',()=>{
  const corpus=readCorpus();const geo=JSON.parse(artifacts(corpus)['operations.geojson']);
  const feature=geo.features.find(f=>f.id===original.operations[0].id);
  const point=original.operations[0].localisation.coordonnees_approximatives;
  assert.deepEqual(feature.geometry.coordinates,[point.longitude,point.latitude]);
  assert.equal(feature.properties.geometry_role,'representative_point');
});
test('T04/T19: synthetic fixture increments preview only when published',()=>{
  const {corpus,operation}=withProposal();
  assert.equal(JSON.parse(artifacts(corpus,{allowSynthetic:true})['operations.json']).operations.length,263);
  operation.editorial_status='published';assert.throws(()=>artifacts(corpus,{allowSynthetic:true}),/review/);
  approve(operation);
  assert.equal(JSON.parse(artifacts(corpus,{allowSynthetic:true})['operations.json']).operations.length,264);
  assert.throws(()=>artifacts(corpus),/Synthetic/);
  assert.equal(readCorpus().operations.length,263);
});
