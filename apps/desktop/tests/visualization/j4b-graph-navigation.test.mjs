import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {walk}=require('../../bridge/visualization/graph-navigation.cjs');

const R=id=>({kind:'event',namespace:'SYNTHETIC_HISTORY',id});
function graphFixture(){
  const c=SYNTHETIC_CASES[0].make();
  for(const id of ['EVENT_002','EVENT_003']){
    const event=structuredClone(c.events[0]);event.id=id;
    event.title.en='Fictional linked event '+id;c.events.push(event);
  }
  const link=(id,a,b)=>{
    const sample=c.events[0];
    c.relations.push({schema_version:'3.0.0',id,namespace:'SYNTHETIC_HISTORY',
      editorial_status:'proposed',provenance:structuredClone(sample.provenance),
      extensions:{},kind:'relation',subject:R(a),predicate:'fictional_declared_link',
      object:R(b),valid_from:structuredClone(sample.start_date),
      valid_to:structuredClone(sample.end_date),review_refs:[]});
  };
  link('REL_001','EVENT_001','EVENT_002');
  link('REL_002','EVENT_001','EVENT_002');
  link('REL_003','EVENT_002','EVENT_003');
  return c;
}
test('Graph fixture preserves canonical validity and typed multiedges',()=>{
  const c=graphFixture();
  assert.equal(canonical.validateCorpus(c).valid,true,
    JSON.stringify(canonical.validateCorpus(c).errors));
  const original=canonical.digest(c);
  const a=walk(c,{root:R('EVENT_001'),depth:1,direction:'out'});
  const b=walk(structuredClone(c),{root:R('EVENT_001'),depth:1,direction:'out',
    generatedAt:'2027-10-20T00:00:00Z'});
  assert.equal(a.scientific_sha256,b.scientific_sha256);
  assert.equal(a.scope.total_matched,2);
  assert.deepEqual(a.result.map(x=>x.relation.id),['REL_001','REL_002']);
  assert.equal(canonical.digest(c),original);
  assert.ok(a.result.every(x=>x.edge_origin==='declared_relation'));
});
test('Graph traversal is directional and stops at max depth',()=>{
  const c=graphFixture();
  assert.equal(walk(c,{root:R('EVENT_001'),direction:'out',depth:2}).scope.total_matched,3);
  assert.equal(walk(c,{root:R('EVENT_001'),direction:'in',depth:2}).scope.total_matched,0);
  assert.equal(walk(c,{root:R('EVENT_003'),direction:'in',depth:2}).scope.total_matched,3);
  assert.equal(walk(c,{root:R('EVENT_001'),direction:'both',depth:0}).result.length,0);
});
test('Graph pagination is explicit, method changes alter hash, identities cannot conflate',()=>{
  const c=graphFixture();
  const p=walk(c,{root:R('EVENT_001'),depth:2,direction:'out',limit:1});
  assert.equal(p.scope.returned,1);assert.equal(p.scope.truncated,true);
  assert.equal(p.scope.total_matched,3);
  assert.notEqual(p.scientific_sha256,walk(c,{root:R('EVENT_001'),depth:1,direction:'out'}).scientific_sha256);
  assert.notEqual(p.scientific_sha256,walk(c,{root:R('EVENT_001'),depth:2,direction:'both',limit:1}).scientific_sha256);
  assert.equal(walk(c,{root:{kind:'entity',namespace:'SYNTHETIC_HISTORY',id:'EVENT_001'}}).scope.total_matched,0);
});
test('Graph navigation rejects unbounded or malformed jobs and invalid canonical inputs',()=>{
  const c=graphFixture();
  assert.throws(()=>walk(c,{root:R('EVENT_001'),depth:6}),/INVALID_DEPTH/);
  assert.throws(()=>walk(c,{root:R('EVENT_001'),limit:101}),/INVALID_LIMIT/);
  assert.throws(()=>walk(c,{root:R('EVENT_001'),direction:'diagonal'}),/INVALID_DIRECTION/);
  assert.throws(()=>walk(c,{root:{kind:'unknown',namespace:'SYNTHETIC_HISTORY',id:'EVENT_001'}}),/INVALID_REFERENCE/);
  assert.throws(()=>walk(SYNTHETIC_CASES[9].make(),{root:R('EVENT_001')}),/CORPUS_NOT_VALIDATED/);
});
