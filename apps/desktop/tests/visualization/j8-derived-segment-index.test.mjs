import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {
  buildSegmentIndex,readSegment,MAX_RECORDS,MAX_PAGE_SIZE
}=require('../../bridge/visualization/segment-index.cjs');

function corpusOf(size){
  const c=SYNTHETIC_CASES[0].make();
  const sample=c.events[0];
  c.events=Array.from({length:size},(_,n)=>{
    const row=structuredClone(sample);
    // Reverse declaration order to test deterministic sorted indexed identities.
    row.id='EVENT_'+String(size-n).padStart(6,'0');
    return row;
  });
  return c;
}
test('J8 segment catalog is reproducible and never modifies canonical events',()=>{
  const corpus=corpusOf(620),before=canonical.digest(corpus);
  const a=buildSegmentIndex(corpus,{segmentSize:256});
  const b=buildSegmentIndex(structuredClone(corpus),{segmentSize:256});
  assert.equal(a.manifest.scientific_sha256,b.manifest.scientific_sha256);
  assert.equal(a.manifest.corpus_sha256,before);
  assert.equal(a.manifest.segment_count,3);
  assert.deepEqual(a.manifest.segments.map(s=>s.count),[256,256,108]);
  assert.equal(a.manifest.segments[0].first_ref.id,'EVENT_000001');
  const p=readSegment(a,corpus,{segment:0,offset:0,limit:100});
  assert.equal(p.rows.length,100);
  assert.equal(p.rows[0].ref.id,'EVENT_000001');
  assert.equal(p.rows[0].record_index,619);
  assert.equal(p.partial,true);
  assert.equal(canonical.digest(corpus),before);
  assert.ok(Object.isFrozen(a.manifest));
  assert.ok(Object.isFrozen(a.entries));
});
test('J8 catalog hash detects canonical array reordering while sorted refs stay stable',()=>{
  const a=corpusOf(64),b=structuredClone(a);
  b.events.reverse();
  const first=buildSegmentIndex(a,{segmentSize:32});
  const second=buildSegmentIndex(b,{segmentSize:32});
  assert.notEqual(first.manifest.corpus_sha256,second.manifest.corpus_sha256);
  assert.notEqual(first.manifest.scientific_sha256,second.manifest.scientific_sha256);
  assert.deepEqual(first.entries.map(x=>x.key),second.entries.map(x=>x.key));
  assert.notEqual(first.entries[0].position,second.entries[0].position);
});
test('J8 pages never cross a segment or synthesize missing records',()=>{
  const corpus=corpusOf(289),idx=buildSegmentIndex(corpus,{segmentSize:256});
  const last=readSegment(idx,corpus,{segment:1,offset:20,limit:50});
  assert.equal(last.returned,13);
  assert.equal(last.partial,false);
  assert.equal(last.segment_total,33);
  assert.deepEqual(last.rows.map(x=>x.ref.id).slice(-1),['EVENT_000289']);
  const empty=readSegment(idx,corpus,{segment:1,offset:33,limit:20});
  assert.equal(empty.returned,0);
  assert.throws(()=>readSegment(idx,corpus,{segment:2}),/SEGMENT_NOT_FOUND/);
  assert.throws(()=>readSegment(idx,corpus,{segment:1,offset:34}),/INVALID_PAGE/);
});
test('J8 rejects changed corpus without leaking outdated indexed results',()=>{
  const corpus=corpusOf(48),idx=buildSegmentIndex(corpus,{segmentSize:32});
  corpus.events[0].title.en='A changed, fictional statement';
  assert.throws(()=>readSegment(idx,corpus,{segment:0}),/INDEX_STALE_CORPUS/);
});
test('J8 refuses invalid canonical data, oversized payload and unbounded paging',()=>{
  const corpus=corpusOf(32),idx=buildSegmentIndex(corpus,{segmentSize:32});
  const invalid=SYNTHETIC_CASES.find(x=>x.id==='SYN-10').make();
  assert.throws(()=>buildSegmentIndex(invalid),/CORPUS_NOT_VALIDATED/);
  assert.throws(()=>buildSegmentIndex(corpus,{collection:'__proto__'}),/INVALID_COLLECTION/);
  assert.throws(()=>buildSegmentIndex(corpus,{segmentSize:1}),/INVALID_SEGMENT_SIZE/);
  assert.throws(()=>buildSegmentIndex(corpus,{arbitrary:true}),/INVALID_OPTIONS/);
  assert.throws(()=>readSegment(idx,corpus,{segment:0,limit:MAX_PAGE_SIZE+1}),/INVALID_PAGE/);
  assert.throws(()=>readSegment(idx,corpus,{segment:-1}),/INVALID_PAGE/);
  assert.ok(MAX_RECORDS<=100000);
});
test('J8 1000 fictional events span deterministic, bounded catalog segments',()=>{
  const corpus=corpusOf(1000),idx=buildSegmentIndex(corpus);
  assert.equal(idx.manifest.segment_count,4);
  assert.ok(idx.manifest.segments.every(s=>s.count<=256));
  assert.equal(idx.manifest.segments[3].count,232);
  assert.equal(readSegment(idx,corpus,{segment:3,offset:0,limit:1}).rows[0].ref.id,'EVENT_000769');
});

test('J8 experimental catalog indexes 10000 fictional events without opening a Desktop session',()=>{
  const corpus=corpusOf(10000);
  assert.ok(Buffer.byteLength(canonical.stringify(corpus),'utf8')>3*1024*1024);
  const idx=buildSegmentIndex(corpus);
  assert.equal(idx.manifest.total_records,10000);
  assert.equal(idx.manifest.segment_count,40);
  const final=readSegment(idx,corpus,{segment:39,offset:0,limit:100});
  assert.equal(final.segment_total,16);
  assert.equal(final.returned,16);
  assert.equal(final.rows[0].ref.id,'EVENT_009985');
  assert.equal(final.rows.at(-1).ref.id,'EVENT_010000');
  // The production Desktop session limit is intentionally not lifted.
});
