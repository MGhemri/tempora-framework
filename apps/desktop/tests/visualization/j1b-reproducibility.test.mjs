import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';

const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {projection,refKey,ProjectionError}=require('../../bridge/visualization/contracts.cjs');

const ALGORITHM={id:'tvrw.j1b-determinism',version:'1.0.0',
  parameters:{sort:'canonical',limit:1}};
function project(corpus,overrides={}){
  return projection({
    corpus,algorithm:ALGORITHM,mode:'validated',
    filters:{language:'en',type:'synthetic'},totalMatched:1,
    result:[{id:'EVENT_001'}],diagnostics:[],
    generatedAt:'2026-11-08T00:00:00Z',...overrides
  });
}
test('J1B fixture registry has exactly twelve unique synthetic cases',()=>{
  assert.equal(SYNTHETIC_CASES.length,12);
  assert.deepEqual(SYNTHETIC_CASES.map(x=>x.id),
    Array.from({length:12},(_,i)=>'SYN-'+String(i+1).padStart(2,'0')));
  for(const scenario of SYNTHETIC_CASES){
    assert.match(scenario.purpose,/./);
    assert.equal(typeof scenario.expectedValid,'boolean');
    assert.equal(scenario.make().profile.id,'synthetic-history');
  }
});
for(const scenario of SYNTHETIC_CASES){
  test('J1B '+scenario.id+' — '+scenario.purpose,()=>{
    const corpus=scenario.make();
    const before=structuredClone(corpus);
    const digest=canonical.digest(corpus);
    const validation=canonical.validateCorpus(corpus);
    assert.equal(validation.valid,scenario.expectedValid,JSON.stringify(validation.errors));
    assert.deepEqual(corpus,before,'validator must not mutate source');
    assert.equal(canonical.digest(corpus),digest);
    if(scenario.expectedValid){
      const first=project(corpus),second=project(structuredClone(corpus),{
        generatedAt:'2027-01-01T12:00:00Z',
        algorithm:{...ALGORITHM,parameters:{limit:1,sort:'canonical'}},
        filters:{type:'synthetic',language:'en'}
      });
      assert.equal(first.scientific_sha256,second.scientific_sha256);
      assert.equal(first.corpus.canonical_sha256,digest);
      assert.notEqual(first.source.generated_at,second.source.generated_at);
    } else {
      assert.throws(()=>project(corpus),
        err=>err instanceof ProjectionError && err.code==='CORPUS_NOT_VALIDATED');
    }
    assert.deepEqual(corpus,before,'scientific projection must never mutate source');
  });
}
test('J1B identity collisions preserve kind and namespace, never join on raw ID',()=>{
  const id='SAME';
  const keys=[
    refKey({kind:'event',namespace:'SYNTHETIC_HISTORY',id}),
    refKey({kind:'entity',namespace:'SYNTHETIC_HISTORY',id}),
    refKey({kind:'event',namespace:'ANOTHER',id})
  ];
  assert.equal(new Set(keys).size,3);
});
test('J1B time precision and unknowns are not silently converted into exact days',()=>{
  const year=SYNTHETIC_CASES[1].make().events[0].start_date;
  assert.equal(year.precision,'year');
  assert.equal(year.earliest,'1784-01-01');
  assert.equal(year.latest,'1784-12-31');
  const unknown=SYNTHETIC_CASES[11].make().events[0].start_date;
  assert.equal(unknown.kind,'unknown');
  assert.equal(unknown.earliest,null);
  assert.equal(unknown.latest,null);
});
test('J1B parameter, selection and corpus changes invalidate scientific digests',()=>{
  const c=SYNTHETIC_CASES[0].make();
  const baseline=project(c).scientific_sha256;
  assert.notEqual(project(c,{filters:{language:'es',type:'synthetic'}}).scientific_sha256,baseline);
  assert.notEqual(project(c,{algorithm:{...ALGORITHM,parameters:{limit:2,sort:'canonical'}}}).scientific_sha256,baseline);
  const changed=structuredClone(c);changed.events[0].title.en='An alternative entirely fictional event';
  assert.equal(canonical.validateCorpus(changed).valid,true);
  assert.notEqual(project(changed).scientific_sha256,baseline);
});
