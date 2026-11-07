import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {build,COLLECTIONS,PAGE_LIMIT}=require('../../bridge/visualization/projections.cjs');
const baseline=()=>SYNTHETIC_CASES[0].make();
test('All six scientific labs have explicit deterministic read-only projections',()=>{
  for(const module of Object.keys(COLLECTIONS)){
    const c=baseline(),before=canonical.digest(c);
    const a=build(c,{module,limit:5,generatedAt:'2026-01-01T00:00:00Z'});
    const b=build(c,{module,limit:5,generatedAt:'2027-01-01T00:00:00Z'});
    assert.equal(a.scientific_sha256,b.scientific_sha256,module);
    assert.equal(a.source.mode,'validated');
    assert.equal(canonical.digest(c),before);
    assert.equal(a.algorithm.id,'tvrw.'+module+'.declared-records');
    assert.ok(Array.isArray(a.result));
  }
});
test('GeoLab preserves coordinates and approximate location status',()=>{
  const c=SYNTHETIC_CASES[2].make();
  const p=build(c,{module:'geo'});
  assert.equal(p.scope.total_matched,1);
  assert.deepEqual(p.result[0].geometry.coordinates,[-1.5,35.1]);
  assert.equal(p.result[0].precision_meters,null);
  assert.equal(p.result[0].geometry_role,'approximate_site');
});
test('Chronos preserves calendar precision and unknown bounds',()=>{
  const c=SYNTHETIC_CASES[11].make();
  const p=build(c,{module:'chronos'});
  assert.equal(p.result[0].start_date.earliest,null);
  assert.equal(p.result[0].start_date.kind,'unknown');
});
test('PatternLab does not claim unexecuted clustering is a real discovery',()=>{
  const p=build(baseline(),{module:'pattern'});
  assert.equal(p.result[0].analysis_status,'not_computed');
  assert.deepEqual(p.result[0].candidate_links,[]);
});
test('Pagination is bounded and stable, never silently complete',()=>{
  const c=baseline();
  const first=build(c,{module:'chronos',offset:0,limit:1});
  const last=build(c,{module:'chronos',offset:1,limit:1});
  assert.equal(first.result.length,1);
  assert.equal(first.scope.total_matched,1);
  assert.equal(last.result.length,0);
  assert.equal(last.scope.total_matched,1);
  assert.equal(last.scope.truncated,true);
  assert.notEqual(first.scientific_sha256,last.scientific_sha256);
  assert.throws(()=>build(c,{module:'chronos',limit:PAGE_LIMIT+1}),/INVALID_PAGE/);
  assert.throws(()=>build(c,{module:'graph',offset:-1}),/INVALID_PAGE/);
  assert.throws(()=>build(c,{module:'arbitrary'}),/UNSUPPORTED_MODULE/);
});
test('Invalid corpus is rejected for every scientific laboratory',()=>{
  const invalid=SYNTHETIC_CASES[9].make();
  for(const module of Object.keys(COLLECTIONS)){
    assert.throws(()=>build(invalid,{module}),/CORPUS_NOT_VALIDATED/);
  }
});
