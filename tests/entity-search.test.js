const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildIndex,search}=require('../src/shared/entity-search');
const {artifacts}=require('../scripts/build-entity-search');
test('Published corpus mentions find Oran and akid Lotfi without creating an identity',()=>{
 const fs=require('node:fs'),index=require('../docs/data/entity-search/index.json');
 assert.ok(search(index,'Oran','place').some(r=>r.matches.some(m=>m.field==='locations')));
 assert.ok(search(index,'akid lotfi','person').some(r=>r.matches.some(m=>m.field==='commanders')));
 assert.deepEqual(search(index,'akid lotfi','person'),search(index,'colonel lotfi','person'));
 assert.equal(fs.readdirSync('data/persons').filter(f=>f.endsWith('.json')).length,0);
});
test('Mention search preserves exact field excerpts, word boundaries and drafts remain absent',()=>{
 const operations=[{id:'A',editorial_status:'published',title:{fr:'TEST',ar:null},locations:[{label:'Oranie'}],commanders:['Lotfi'],description:{fr:'TEST Oran'}}],before=structuredClone(operations);
 const index=buildIndex([...operations,{...operations[0],id:'DRAFT',editorial_status:'proposed'}]);
 const results=search(index,'Oran','place');assert.equal(results.length,1);assert.deepEqual(results[0].matches,[{field:'narratives',text:'TEST Oran'}]);
 assert.deepEqual(search(index,'Oran','person')[0].matches,[{field:'narratives',text:'TEST Oran'}]);
 assert.equal(index.operations.length,1);assert.deepEqual(operations,before);assert.deepEqual(search(index,'  '),[]);
});
test('Search artifacts are reproducible and bound to the canonical snapshot bytes',()=>{
 const fs=require('node:fs'),canonical=Object.fromEntries(['dataset-manifest.json','operations.json'].map(f=>[f,fs.readFileSync('docs/data/canonical/'+f)]));
 assert.deepEqual(artifacts(canonical),artifacts(canonical));const out=artifacts(canonical),meta=JSON.parse(out['docs/data/entity-search/manifest.json']);
 assert.equal(meta.snapshot_sha256,JSON.parse(canonical['dataset-manifest.json']).canonical_sha256);
 assert.throws(()=>artifacts({...canonical,'operations.json':canonical['operations.json']+' '}),/Unverified/);
});
