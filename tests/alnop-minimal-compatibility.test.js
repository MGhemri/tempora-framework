const {test}=require('node:test');
const assert=require('node:assert/strict');
const {digest,validateCorpus}=require('../src/framework/canonical');
const {toTempora,fromTempora}=require('../compatibility/alnop/adapters/alnop-migration');
const profile=require('../compatibility/alnop/profile/profile.json');
const fixture=require('../compatibility/alnop/fixtures/corpus.json');

test('The reduced, offline ALNOP compatibility fixture migrates and round-trips exactly',()=>{
  assert.equal(digest(fixture),'cf6c7513a80a515b6ece9a17381ef2224a20be136fd140c3b3df14e0406c804b');
  const migrated=toTempora(fixture,profile);
  assert.equal(validateCorpus(migrated).valid,true);
  assert.deepEqual(migrated.events.map(event=>event.id),['OP_1954_001']);
  assert.deepEqual(fromTempora(migrated),{corpus:fixture,releases:[]});
});
