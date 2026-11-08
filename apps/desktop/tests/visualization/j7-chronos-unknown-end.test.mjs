import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {analyze}=require('../../bridge/visualization/algorithms.cjs');
const {build}=require('../../bridge/visualization/projections.cjs');

test('Chronos analysis does not impute unknown end from known beginning',()=>{
  const corpus=SYNTHETIC_CASES[0].make();
  corpus.events[0].end_date={
    kind:'unknown',calendar:'gregorian',original:null,
    earliest:null,latest:null,precision:'unknown',certainty:'unknown'
  };
  assert.equal(canonical.validateCorpus(corpus).valid,true);
  const before=canonical.digest(corpus);
  const a=analyze(corpus,{module:'chronos'});
  const b=analyze(structuredClone(corpus),{module:'chronos',
    generatedAt:'2027-01-01T00:00:00Z'});
  assert.equal(a.result.length,1);
  assert.equal(a.result[0].start_earliest,'1784-06-12');
  assert.equal(a.result[0].end_latest,null);
  assert.equal(a.result[0].end_kind,'unknown');
  assert.equal(a.algorithm.version,'1.0.1');
  assert.equal(a.diagnostics.find(x=>x.code==='UNKNOWN_END_DATES')?.count,1);
  assert.equal(a.scientific_sha256,b.scientific_sha256);
  assert.equal(canonical.digest(corpus),before);
  const scoped=build(corpus,{module:'chronos',facet:{time:{
    mode:'possible-overlap',earliest:'1784-06-01',latest:'1784-06-30'
  }}});
  assert.equal(scoped.scope.total_matched,0);
  assert.equal(scoped.diagnostics.find(x=>x.code==='TEMPORAL_UNKNOWN_EXCLUDED')?.count,1);
});
test('Chronos unknown start and end remain unknown in deterministic analysis',()=>{
  const corpus=SYNTHETIC_CASES.find(x=>x.id==='SYN-12').make();
  assert.equal(canonical.validateCorpus(corpus).valid,true);
  const result=analyze(corpus,{module:'chronos'});
  assert.equal(result.result[0].start_earliest,null);
  assert.equal(result.result[0].end_latest,null);
});
