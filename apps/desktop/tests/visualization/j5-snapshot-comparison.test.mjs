import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {compare}=require('../../bridge/visualization/snapshots.cjs');
test('identical snapshots yield zero change and a stable scientific digest',()=>{
  const before=SYNTHETIC_CASES[0].make();
  const after=structuredClone(before),copy=structuredClone(before);
  const a=compare(before,after),b=compare(structuredClone(before),structuredClone(after));
  assert.equal(a.scientific_sha256,b.scientific_sha256);
  assert.ok(a.rows.every(x=>x.delta===0&&x.added_ids===0&&x.removed_ids===0));
  assert.equal(a.measurement,'declared_documentation_only');
  assert.ok(a.rows.every(x=>x.historical_completeness==='unknown'));
  assert.deepEqual(before,copy);
});
test('added and removed typed canonical identities are counted, not evaluated as history',()=>{
  const old=SYNTHETIC_CASES[0].make(),next=structuredClone(old);
  const renamed=structuredClone(next.events[0]);
  renamed.id='EVENT_002';next.events.push(renamed);
  assert.equal(canonical.validateCorpus(next).valid,true);
  const diff=compare(old,next),record=diff.rows.find(x=>x.collection==='events');
  assert.deepEqual([record.previous,record.current,record.delta,record.added_ids,record.removed_ids],
    [1,2,1,1,0]);
  assert.notEqual(diff.previous.canonical_sha256,diff.current.canonical_sha256);
  assert.equal(compare(next,old).rows.find(x=>x.collection==='events').removed_ids,1);
});
test('content edits change digest even when row counts and IDs do not change',()=>{
  const a=SYNTHETIC_CASES[0].make(),b=structuredClone(a);
  b.events[0].title.en='Entirely different fictional meeting';
  const diff=compare(a,b);
  assert.equal(diff.rows.find(x=>x.collection==='events').delta,0);
  assert.notEqual(diff.previous.canonical_sha256,diff.current.canonical_sha256);
});
test('invalid corpus is rejected and no claim of historical completeness is fabricated',()=>{
  assert.throws(()=>compare(SYNTHETIC_CASES[9].make(),SYNTHETIC_CASES[0].make()),
    /CORPUS_NOT_VALIDATED/);
});
