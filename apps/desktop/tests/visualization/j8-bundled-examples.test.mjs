import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const load=(name)=>JSON.parse(readFileSync(fileURLToPath(new URL('../../examples/'+name,import.meta.url)),'utf8'));

test('bundled synthetic sample passes actual TEMPORA v3 canonical validation',()=>{
  const corpus=load('synthetic-canonical-v3.json');
  assert.equal(corpus.schema_version,'3.0.0');
  const result=canonical.validateCorpus(corpus);
  assert.equal(result.valid,true,JSON.stringify(result.errors??result.diagnostics??result));
  assert.match(canonical.digest(corpus),/^[a-f0-9]{64}$/);
});

test('ALNOP teaching GeoJSON is a bounded, pinned and attributed five-wilaya subset',()=>{
  const data=load('alnop-geographic-sample.geojson');
  assert.equal(data.type,'FeatureCollection');
  assert.equal(data.features.length,5);
  assert.equal(data.properties.source_commit,'2428a693393a4a635d5eeac3e3c8542498b8b9d6');
  assert.equal(data.properties.license,'https://creativecommons.org/licenses/by/4.0/');
  assert.deepEqual([...new Set(data.features.map(f=>f.properties.wilaya_code))].sort(),['W1','W2','W3','W4','W5']);
  for(const f of data.features){
    assert.equal(f.type,'Feature');
    assert.equal(f.geometry.type,'Point');
    assert.equal(f.properties.geometry_role,'representative_point');
    assert.match(f.id,/^OP_\d{4}_\d{3}$/);
    assert.equal(f.properties.id,f.id);
    const [lon,lat]=f.geometry.coordinates;
    assert.ok(Number.isFinite(lon)&&lon>=-180&&lon<=180);
    assert.ok(Number.isFinite(lat)&&lat>=-90&&lat<=90);
  }
});
