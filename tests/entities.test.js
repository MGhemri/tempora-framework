const {test}=require('node:test'),assert=require('node:assert/strict');
const {readCorpus,validateCorpus}=require('../src/canonical');
const {artifacts}=require('../scripts/build-canonical');
const {publicArtifacts,corpusFingerprint}=require('../src/publication');
const {entity,approve,withEntities}=require('./helpers/entities');
const build=c=>artifacts(c,{allowSynthetic:true});
test('Draft entities, identity candidates and their sources stay outside public exports',()=>{
  const c=withEntities();c.places.push(entity());
  assert.deepEqual(validateCorpus(c).errors,[]);assert.deepEqual(build(c),artifacts(readCorpus()));
  assert.equal(corpusFingerprint(c),corpusFingerprint(readCorpus()));
});
test('Reviewed entities retain old spellings, Arabic and evidence without inventing geometry',()=>{
  const c=withEntities(),e=approve(entity());c.places.push(e);
  e.names.push({value:'Ancienne graphie de test',language:'fr',role:'historical_name',valid_from:'1954-01-01',valid_to:'1962-12-31',source_ids:e.source_ids});
  const before=structuredClone(e.names),out=build(c),result=JSON.parse(out['places.json']).entities[0];
  assert.deepEqual(result.names,before);assert.equal(result.geometry,undefined);
  assert.ok(JSON.parse(out['sources.json']).some(s=>s.source_id===e.source_ids[0]));
  assert.deepEqual(publicArtifacts(c),publicArtifacts(readCorpus()));
  assert.throws(()=>artifacts(c),/Synthetic entities/);
});
test('Identity candidates never turn into public equivalence without explicit evidence and review',()=>{
  const c=withEntities(),a=approve(entity()),b=approve(entity('place','B'));c.places.push(a,b);
  a.relations.push({type:'same_as_candidate',target_id:b.id,source_ids:[],review_history:[]});
  assert.deepEqual(JSON.parse(build(c)['places.json']).entities[0].relations,[]);
  a.relations[0].type='same_as';assert.throws(()=>build(c),/same_as/);
  a.relations[0].source_ids=a.source_ids;a.relations[0].review_history=a.review_history;
  assert.equal(JSON.parse(build(c)['places.json']).entities[0].relations[0].target_id,b.id);
  assert.equal(c.places.length,2);
});
test('Entity references, names, kinds, geometry and identity evidence are validated',()=>{
  for(const mutate of [c=>c.places[0].source_ids=[],c=>c.places[0].names[0].source_ids=[],
    c=>c.places[0].names[0].valid_to='1950-01-01',c=>c.places[0].kind='person',
    c=>c.places[0].label.fr='unrecorded name',c=>c.places[0].review_history=[],
    c=>c.places[0].geometry={type:'Point',coordinates:[181,35]},
    c=>c.places[0].relations=[{type:'same_as',target_id:'PLC_MISSING',source_ids:[],review_history:[]}],
    c=>c.places.push(structuredClone(c.places[0])),c=>c.sources.at(-1).title=null]){
    const c=withEntities();const e=approve(entity());e.names[0].valid_from='1954-01-01';c.places.push(e);mutate(c);assert.throws(()=>build(c));
  }
});
test('Reviewed operation links need published people/places and independent role evidence',()=>{
  const {withProposal,approve:approveOperation}=require('./helpers/corpus');const {corpus:c,operation:op}=withProposal();approveOperation(op);
  const person=approve(entity('person'));person.source_ids=op.source_ids;person.names[0].source_ids=op.source_ids;c.persons.push(person);
  op.participants=[{entity_id:person.id,role:'rôle synthétique',source_ids:op.source_ids}];
  assert.deepEqual(validateCorpus(c).errors,[]);
  person.editorial_status='proposed';assert.match(validateCorpus(c).errors.join('\n'),/draft entity/);
  op.participants[0].entity_id='PER_MISSING';assert.match(validateCorpus(c).errors.join('\n'),/missing entity/);
});

test('Build validation detects an edit after a content-bound entity review',()=>{
  const {contentDigest}=require('../src/review');const c=withEntities(),e=approve(entity());c.places.push(e);
  e.review_history.at(-1).content_sha256=contentDigest(e);assert.deepEqual(validateCorpus(c).errors,[]);
  e.names.push({...e.names[0],value:'Autre graphie documentée',role:'alias'});
  assert.throws(()=>build(c),/content changed after/);
});
