import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {filter}=require('../../bridge/visualization/chronos-filter.cjs');
const window={earliest:'1784-06-01',latest:'1784-06-30'};
test('Temporal filter preserves exact dates and canonical source immutability',()=>{
  const c=SYNTHETIC_CASES[0].make(),original=structuredClone(c),digest=canonical.digest(c);
  const a=filter(c,{...window,mode:'possible-overlap'});
  const b=filter(structuredClone(c),{...window,mode:'possible-overlap',
    generatedAt:'2027-01-01T00:00:00Z'});
  assert.equal(a.scientific_sha256,b.scientific_sha256);
  assert.equal(a.scope.total_matched,1);
  assert.equal(a.result[0].start_date.kind,'exact');
  assert.deepEqual(c,original);assert.equal(canonical.digest(c),digest);
});
test('A year-only claim can overlap June but is not certainly enclosed by June',()=>{
  const c=SYNTHETIC_CASES[1].make();
  const possible=filter(c,{...window,mode:'possible-overlap'});
  const certain=filter(c,{...window,mode:'certain-only'});
  const starts=filter(c,{...window,mode:'declared-start'});
  assert.equal(possible.scope.total_matched,1);
  assert.equal(starts.scope.total_matched,1);
  assert.equal(certain.scope.total_matched,0);
  assert.equal(possible.result[0].start_date.kind,'year');
  assert.equal(possible.result[0].start_date.precision,'year');
});
test('Unknown dates remain excluded and are quantified as uncertainty',()=>{
  const c=SYNTHETIC_CASES[11].make();
  const result=filter(c,{...window});
  assert.equal(result.result.length,0);
  assert.equal(result.scope.filters.unknown_count,1);
  assert.deepEqual(result.diagnostics,[{code:'UNKNOWN_TEMPORAL_BOUNDS',severity:'warning',count:1}]);
});
test('Explicitly unknown end cannot be replaced by a known start',()=>{
  const c=SYNTHETIC_CASES[0].make();
  c.events[0].end_date={kind:'unknown',calendar:'gregorian',original:null,
    earliest:null,latest:null,precision:'unknown',certainty:'unknown'};
  assert.equal(canonical.validateCorpus(c).valid,true);
  const possible=filter(c,{...window,mode:'possible-overlap'});
  assert.equal(possible.scope.total_matched,0);
  assert.equal(possible.scope.filters.unknown_count,1);
  const startOnly=filter(c,{...window,mode:'declared-start'});
  assert.equal(startOnly.scope.total_matched,1);
});
test('Impossible, reversed and missing filter dates fail closed',()=>{
  const c=SYNTHETIC_CASES[0].make();
  for(const params of [{earliest:'1784-02-30',latest:'1784-06-30'},
    {earliest:'1784-07-01',latest:'1784-06-30'},
    {earliest:'1784',latest:'1784-06-30'},
    {earliest:null,latest:'1784-06-30'}]){
    assert.throws(()=>filter(c,params),/INVALID_DATE|INVERTED_TIME_WINDOW/);
  }
  assert.throws(()=>filter(c,{...window,mode:'predictive'}),/INVALID_TIME_MODE/);
  assert.throws(()=>filter(c,{...window,limit:101}),/INVALID_PAGE/);
  assert.throws(()=>filter(SYNTHETIC_CASES[9].make(),window),/CORPUS_NOT_VALIDATED/);
});
