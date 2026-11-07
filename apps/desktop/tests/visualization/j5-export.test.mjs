import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {build}=require('../../bridge/visualization/projections.cjs');
const {projection}=require('../../bridge/visualization/contracts.cjs');
const {buildExport}=require('../../bridge/visualization/exporter.cjs');
const c=SYNTHETIC_CASES[0].make();
test('exported JSON has an explicit reproducibility manifest',()=>{
  const p=build(c,{module:'chronos',limit:2});
  const saved=buildExport(p,{module:'chronos',format:'json'});
  const obj=JSON.parse(saved.data);
  assert.equal(obj.manifest.scientific_sha256,p.scientific_sha256);
  assert.equal(obj.manifest.partial,p.scope.truncated);
  assert.equal(obj.manifest.corpus.canonical_sha256,p.corpus.canonical_sha256);
  assert.equal(saved.sha256,createHash('sha256').update(saved.data).digest('hex'));
  assert.equal(obj.records.length,1);
});
test('GeoJSON export retains declared approximate precision without invented geometry',()=>{
  const p=build(SYNTHETIC_CASES[2].make(),{module:'geo'});
  const doc=JSON.parse(buildExport(p,{module:'geo',format:'geojson'}).data);
  assert.equal(doc.type,'FeatureCollection');
  assert.equal(doc.features[0].properties.geometry_role,'approximate_site');
  assert.equal(doc.features[0].properties.precision_meters,null);
  assert.deepEqual(doc.features[0].geometry.coordinates,[-1.5,35.1]);
});
test('CSV has a standalone manifest and neutralizes spreadsheet formulas',()=>{
  const p=projection({corpus:c,algorithm:{id:'tvrw.synthetic',version:'1.0.0',parameters:{}},
    mode:'validated',filters:{module:'chronos'},totalMatched:1,
    result:[{ref:{kind:'event',namespace:'SYNTHETIC_HISTORY',id:'EVENT_001'},
      title:'=HYPERLINK("https://example.test","click")'}],
    diagnostics:[],generatedAt:'2026-11-08T00:00:00Z'});
  const output=buildExport(p,{module:'chronos',format:'csv'});
  assert.ok(output.manifestText);
  assert.equal(JSON.parse(output.manifestText).scientific_sha256,p.scientific_sha256);
  assert.ok(output.data.includes("'=HYPERLINK"));
});
test('GraphML is directed, preserves multiedges, escapes XML and embeds manifest',()=>{
  const p=projection({corpus:c,algorithm:{id:'tvrw.graph',version:'1.0.0',parameters:{}},
    mode:'validated',filters:{module:'graph'},totalMatched:2,
    result:[0,1].map(i=>({ref:{kind:'relation',namespace:'SYNTHETIC_HISTORY',id:'R'+i},
      source:{kind:'event',namespace:'SYNTHETIC_HISTORY',id:'EVENT_001'},
      target:{kind:'event',namespace:'SYNTHETIC_HISTORY',id:'EVENT_001'},
      predicate:'<declared & "quoted">'})),
    diagnostics:[],generatedAt:'2026-11-08T00:00:00Z'});
  const xml=buildExport(p,{module:'graph',format:'graphml'}).data;
  assert.ok(xml.includes('edgedefault="directed"'));
  assert.equal(xml.match(/<edge /g)?.length,2);
  assert.ok(xml.includes('&lt;declared &amp; &quot;quoted&quot;&gt;'));
  assert.ok(xml.includes('tempora_manifest'));
});
test('tampered projection hashes, wrong module and invalid formats fail closed',()=>{
  const p=build(c,{module:'chronos'});
  const broken=structuredClone(p);broken.result[0].label='SILENT_MUTATION';
  assert.throws(()=>buildExport(broken,{module:'chronos'}),/PROJECTION_DIGEST_MISMATCH/);
  assert.throws(()=>buildExport(p,{module:'geo'}),/MISMATCHED_MODULE/);
  assert.throws(()=>buildExport(p,{module:'chronos',format:'exe'}),/UNSUPPORTED_FORMAT/);
  assert.throws(()=>buildExport(p,{module:'chronos',format:'geojson'}),/UNSUPPORTED_MODULE_FORMAT/);
});
