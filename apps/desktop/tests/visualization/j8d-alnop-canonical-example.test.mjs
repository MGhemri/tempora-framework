import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
function example(name){return JSON.parse(readFileSync(fileURLToPath(new URL('../../examples/'+name,import.meta.url)),'utf8'));}

test('ALNOP geographic subset has a separately validated, read-only canonical v3 demonstration',()=>{
  const geo=example('alnop-geographic-sample.geojson');
  const c=example('alnop-canonical-v3-demo.json');
  const valid=canonical.validateCorpus(c);
  assert.equal(valid.valid,true,JSON.stringify(valid.errors??valid));
  assert.equal(c.profile.id,'alnop');
  assert.equal(c.profile.namespace,'ALNOP');
  assert.equal(c.events.length,geo.features.length);
  assert.equal(c.spatial_assertions.length,geo.features.length);
  assert.equal(c.extensions.alnop_geo_demo.source_commit,geo.properties.source_commit);
  assert.equal(c.extensions.alnop_geo_demo.license,geo.properties.license);
  assert.equal(c.extensions.alnop_geo_demo.no_canonical_evidence_imported,true);
  for(const feature of geo.features){
    const e=c.events.find(x=>x.id===feature.id);
    assert.ok(e);
    assert.equal(e.title.fr,feature.properties.nom_operation);
    assert.equal(e.start_date.original,feature.properties.date_debut);
    if(feature.properties.date_fin===null)assert.equal(e.end_date.kind,'unknown');
    else assert.equal(e.end_date.original,feature.properties.date_fin);
    assert.deepEqual(e.event_type,[feature.properties.type_action]);
    const spatial=c.spatial_assertions.find(x=>x.subject?.id===e.id);
    assert.ok(spatial);
    assert.deepEqual(spatial.geometry,feature.geometry);
    assert.equal(spatial.geometry_role,'representative_point');
    assert.equal(spatial.precision_meters,null);
    assert.equal(spatial.provenance.evidence.length,0);
    assert.deepEqual(e.spatial_refs,[{kind:'spatial',namespace:'ALNOP',id:spatial.id}]);
    assert.equal(e.provenance.evidence.length,0);
  }
  assert.deepEqual(c.sources,[]);
  assert.deepEqual(c.claims,[]);
  assert.match(canonical.digest(c),/^[a-f0-9]{64}$/);
});
