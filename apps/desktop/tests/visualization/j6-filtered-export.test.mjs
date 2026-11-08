import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {ProjectManager}=require('../../bridge/visualization/session.cjs');
const {canonical}=require('tempora-framework');

const fixture=()=>SYNTHETIC_CASES[0].make();
test('exported filtered records carry the normalized filter in a scientific manifest',()=>{
  const corpus=fixture(),sourceHash=canonical.digest(corpus);
  const project=new ProjectManager(()=>Date.parse('2026-11-08T00:00:00Z'));
  const handle=project.create(corpus);
  try{
    const facet={statuses:['proposed']};
    const filtered=project.export(handle.project_id,{module:'chronos',format:'json',
      offset:0,limit:1,facet});
    const plain=project.export(handle.project_id,{module:'chronos',format:'json',
      offset:0,limit:1});
    const json=JSON.parse(filtered.data);
    assert.deepEqual(json.manifest.filters.facet.statuses,['proposed']);
    assert.equal(json.manifest.corpus.canonical_sha256,sourceHash);
    assert.notEqual(json.manifest.scientific_sha256,JSON.parse(plain.data).manifest.scientific_sha256);
    assert.equal(json.records.length,1);
    assert.equal(canonical.digest(corpus),sourceHash);
  }finally{project.release(handle.project_id);}
});
test('impossible filtered export fails before serialization',()=>{
  const project=new ProjectManager(),handle=project.create(fixture());
  try{
    assert.throws(()=>project.export(handle.project_id,{module:'chronos',format:'json',
      facet:{time:{mode:'possible-overlap',earliest:'2026-02-30',latest:'2026-03-01'}}}),
      /INVALID_TIME_FILTER/);
    assert.throws(()=>project.export(handle.project_id,{module:'geo',format:'geojson',
      facet:{time:{mode:'possible-overlap',earliest:'1784-01-01',latest:'1784-12-31'}}}),
      /TEMPORAL_FILTER_UNSUPPORTED/);
  }finally{project.release(handle.project_id);}
});
