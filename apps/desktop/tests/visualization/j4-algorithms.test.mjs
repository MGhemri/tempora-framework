import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {analyze,trigrams}=require('../../bridge/visualization/algorithms.cjs');
test('Each lab has deterministic non-authoritative scientific measurements',()=>{
  for(const module of ['geo','graph','chronos','evidence','pattern','observatory']){
    const corpus=SYNTHETIC_CASES[0].make(),before=canonical.digest(corpus);
    const a=analyze(corpus,{module,generatedAt:'2026-11-08T00:00:00Z'});
    const b=analyze(corpus,{module,generatedAt:'2027-11-08T00:00:00Z'});
    assert.equal(a.scientific_sha256,b.scientific_sha256);
    assert.equal(canonical.digest(corpus),before);
    assert.equal(a.source.mode,'validated');
  }
});
test('GeoLab does not turn approximate geometry into exact location',()=>{
  const c=SYNTHETIC_CASES[2].make();
  const p=analyze(c,{module:'geo'});
  assert.equal(p.result[0].role,'approximate_site');
  assert.equal(p.result[0].precision_meters,null);
  assert.equal(p.result[0].calculation,'geometry_inventory');
});
test('Chronos retains unknown temporal bounds',()=>{
  const c=SYNTHETIC_CASES[11].make();
  const p=analyze(c,{module:'chronos'});
  assert.equal(p.result[0].start_earliest,null);
  assert.equal(p.result[0].start_kind,'unknown');
});
test('Observatory counts actual corpus collections, not historical completeness',()=>{
  const p=analyze(SYNTHETIC_CASES[0].make(),{module:'observatory'});
  assert.equal(p.result.length,9);
  assert.deepEqual(p.result.find(x=>x.collection==='events'),{collection:'events',count:1});
});
test('Pattern candidates cannot become historical relations; scores and parameters are recorded',()=>{
  const c=SYNTHETIC_CASES[0].make();
  const second=structuredClone(c.events[0]);
  second.id='EVENT_002';second.title.en='Fictional scientific assembly';
  c.events.push(second);
  assert.equal(canonical.validateCorpus(c).valid,true);
  const p=analyze(c,{module:'pattern',threshold:0.5});
  assert.equal(p.result.length,1);
  assert.equal(p.result[0].status,'candidate');
  assert.equal(p.result[0].not_a_canonical_relation,true);
  assert.equal(c.relations.length,0);
  assert.notEqual(p.scientific_sha256,analyze(c,{module:'pattern',threshold:0.9}).scientific_sha256);
  assert.throws(()=>analyze(c,{module:'pattern',threshold:1.01}),/INVALID_THRESHOLD/);
  assert.ok(trigrams('fictional assembly').size>0);
});
test('Algorithms reject invalid corpora and unknown operations',()=>{
  const c=SYNTHETIC_CASES[9].make();
  assert.throws(()=>analyze(c,{module:'geo'}),/CORPUS_NOT_VALIDATED/);
  assert.throws(()=>analyze(SYNTHETIC_CASES[0].make(),{module:'unknown'}),/UNSUPPORTED_MODULE/);
});
