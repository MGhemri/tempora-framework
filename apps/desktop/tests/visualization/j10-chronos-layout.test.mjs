import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutDeclaredChronology as layout} from '../../src/visualization/core/chronos-layout.mjs';
const exact=s=>({kind:'exact',calendar:'gregorian',earliest:s,latest:s});
const range=(a,b)=>({kind:'range',calendar:'gregorian',earliest:a,latest:b});
const unknown=()=>({kind:'unknown',calendar:'gregorian',earliest:null,latest:null});
const row=(id,start,end)=>({ref:{kind:'event',namespace:'SYNTHETIC_HISTORY',id},
 label:id,start_date:start,end_date:end});
test('unknown end is not replaced with the start or chart maximum',()=>{
 const out=layout([row('A',exact('1784-06-12'),unknown()),
  row('B',exact('1790-01-01'),exact('1795-01-01'))]);
 assert.equal(out.entries[0].end_latest,null);
 assert.equal(out.entries[0].end_x0,null);
 assert.equal(out.entries[0].end_x1,null);
 assert.equal(out.entries[0].unknown_end,true);
 assert.equal(out.entries[0].certain_duration,false);
 assert.equal(out.unknown_end_count,1);
 assert.equal(out.axis.latest,'1795-01-01');
});
test('start and end uncertainty are separate and kept on a civil day axis',()=>{
 const e=layout([row('A',range('1784-01-01','1784-12-31'),
  range('1785-03-01','1785-07-01'))]).entries[0];
 assert.ok(e.start_x0<e.start_x1);
 assert.ok(e.start_x1<e.end_x0);
 assert.ok(e.end_x0<e.end_x1);
 assert.equal(e.uncertain,true);
 assert.equal(e.certain_duration,true);
});
test('overlapping uncertainty cannot assert a guaranteed duration',()=>{
 const e=layout([row('A',range('1784-01-01','1786-01-01'),
  range('1785-01-01','1787-01-01'))]).entries[0];
 assert.equal(e.certain_duration,false);
});
test('same-day event is a single point, not a guessed span',()=>{
 const e=layout([row('A',exact('1784-06-12'),exact('1784-06-12'))]).entries[0];
 assert.equal(e.start_x0,e.end_x1);
 assert.equal(e.uncertain,false);
});
test('Gregorian leap year and century rules, including year 0001',()=>{
 const valid=layout([row('A',exact('0001-01-01'),unknown()),
  row('B',exact('1600-02-29'),exact('1600-03-01'))]);
 assert.equal(valid.entries.length,2);
 assert.equal(valid.axis.earliest,'0001-01-01');
 assert.equal(layout([row('X',exact('1700-02-29'),unknown())]).omitted,1);
 assert.equal(layout([row('X',exact('0000-01-01'),unknown())]).omitted,1);
});
test('invalid and missing date bounds are reported and never repaired',()=>{
 const out=layout([row('X',range('1784-12-31','1784-01-01'),unknown()),
  row('Y',exact('1800-01-01'),exact('1799-01-01')),
  row('Z',unknown(),unknown()),
  row('W',exact('1800-01-01'),range('1800-02-30','1800-03-01'))]);
 assert.equal(out.entries.length,0);
 assert.equal(out.omitted,4);
 assert.equal(out.axis,null);
});
test('order, immutability and hard 50-row bound',()=>{
 const original=[row('Z',exact('1790-01-01'),unknown()),
  row('A',exact('1784-01-01'),unknown()),row('B',exact('1784-01-01'),unknown())];
 const before=structuredClone(original);
 assert.deepEqual(layout(original),layout([...original].reverse()));
 assert.deepEqual(original,before);
 assert.deepEqual(layout(original).entries.map(x=>x.reference.split(':').pop()),['A','B','Z']);
 assert.equal(layout(Array.from({length:50},(_,i)=>
  row(String(i),exact('1800-01-01'),unknown()))).entries.length,50);
 assert.throws(()=>layout(Array.from({length:51},(_,i)=>
  row(String(i),exact('1800-01-01'),unknown()))),/VISUAL_CHRONOS_LAYOUT_LIMIT/);
});
