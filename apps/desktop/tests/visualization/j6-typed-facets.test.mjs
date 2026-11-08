import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {build}=require('../../bridge/visualization/projections.cjs');
const {realDate,normalizeFacets}=require('../../bridge/visualization/facets.cjs');

const fixture=id=>SYNTHETIC_CASES.find(x=>x.id===id).make();
const period=(mode,earliest,latest)=>({time:{mode,earliest,latest}});
test('calendar parser rejects impossible civil dates and accepts Gregorian leap years',()=>{
  for(const date of ['1900-02-29','2026-02-30','2001-13-01','2020-00-01','1784-06-31']){
    assert.equal(realDate(date),false,date);
  }
  for(const date of ['2000-02-29','1784-02-29','1784-06-12']){
    assert.equal(realDate(date),true,date);
  }
});
test('possible overlap does not manufacture a certain day from a year',()=>{
  const c=fixture('SYN-02'),before=canonical.digest(c);
  const p=build(c,{module:'chronos',facet:period('possible-overlap','1784-06-01','1784-06-30')});
  assert.equal(p.scope.total_matched,1);
  assert.equal(p.result[0].start_date.precision,'year');
  const certain=build(c,{module:'chronos',facet:period('certain-only','1784-06-01','1784-06-30')});
  assert.equal(certain.scope.total_matched,0);
  const start=build(c,{module:'chronos',facet:period('declared-start','1784-01-01','1784-01-01')});
  assert.equal(start.scope.total_matched,0);
  assert.equal(start.diagnostics[0]?.code,'TEMPORAL_UNKNOWN_EXCLUDED');
  assert.equal(canonical.digest(c),before);
});
test('unknown temporal bounds are explicitly counted and never assigned dates',()=>{
  const c=fixture('SYN-12');
  const p=build(c,{module:'chronos',facet:period('possible-overlap','1700-01-01','1800-01-01')});
  assert.equal(p.scope.total_matched,0);
  assert.equal(p.diagnostics[0].code,'TEMPORAL_UNKNOWN_EXCLUDED');
  assert.equal(p.diagnostics[0].count,1);
});
test('facets are canonicalized independent of order and never change raw default',()=>{
  const c=fixture('SYN-01');
  const baseline=build(c,{module:'chronos'});
  const first=build(c,{module:'chronos',facet:{statuses:['proposed','published','proposed']}});
  const second=build(c,{module:'chronos',facet:{statuses:['published','proposed']}});
  assert.equal(first.scientific_sha256,second.scientific_sha256);
  assert.notEqual(first.scientific_sha256,baseline.scientific_sha256);
  assert.equal(first.scope.total_matched,1);
  assert.equal(build(c,{module:'chronos',facet:{statuses:['withdrawn']}}).scope.total_matched,0);
});
test('typed direct reference rejects homonyms and does not infer linked relationships',()=>{
  const c=fixture('SYN-01');
  const exact={kind:'event',namespace:'SYNTHETIC_HISTORY',id:'EVENT_001'};
  assert.equal(build(c,{module:'chronos',facet:{selectedRef:exact}}).scope.total_matched,1);
  assert.equal(build(c,{module:'chronos',facet:{selectedRef:{...exact,kind:'entity'}}}).scope.total_matched,0);
  assert.equal(build(c,{module:'chronos',facet:{selectedRef:{...exact,namespace:'OTHER'}}}).scope.total_matched,0);
});
test('invalid facets fail closed, including unsupported cross-laboratory temporal inference',()=>{
  const c=fixture('SYN-01');
  assert.throws(()=>build(c,{module:'geo',facet:period('possible-overlap','1784-01-01','1784-12-31')}),/TEMPORAL_FILTER_UNSUPPORTED/);
  assert.throws(()=>build(c,{module:'chronos',facet:period('possible-overlap','1900-02-29','1900-03-10')}),/INVALID_TIME_FILTER/);
  assert.throws(()=>build(c,{module:'chronos',facet:{statuses:['impossible']}}),/INVALID_STATUS_FILTER/);
  assert.throws(()=>build(c,{module:'chronos',facet:{unsafeExpression:'eval(...)'}}),/INVALID_FACET/);
  assert.throws(()=>normalizeFacets({selectedRef:{kind:'event',namespace:'SYNTHETIC_HISTORY',id:'EVENT_001',extra:'x'}},'chronos'),/INVALID_ENVELOPE/);
});
