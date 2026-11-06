const path=require('node:path');
const {root:externalRoot}=require('../../../compatibility/alnop/verify').verifyExternal(process.env.ALNOP_REFERENCE);
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateCorpus,validateObject,digest,canonicalStringify}=require('../../../src/framework/canonical');
const {temporal,temporalRelation}=require('../../../src/framework/temporal');
const {toTempora,fromTempora}=require('../../../compatibility/alnop/adapters/alnop-migration');
const old=require(path.join(externalRoot,'src/canonical')),adapter=require('../../../compatibility/alnop/adapters/alnop');
const {nativeCorpus}=require('../../helpers/tempora');
const release=require(path.join(externalRoot,'data/releases/data-2026.11.1.json'));
const profile=()=>require('../../../compatibility/alnop/profile/profile.json');
function ok(corpus){const r=validateCorpus(corpus);assert.equal(r.valid,true,JSON.stringify(r.errors));}
function invalid(corpus,code){const r=validateCorpus(corpus);assert.equal(r.valid,false);if(code)assert.ok(r.errors.some(e=>e.code===code),JSON.stringify(r.errors));}
function spatial(corpus,geometry,role='approximate_area'){
 const e=corpus.events[0],ref={kind:'spatial',namespace:e.namespace,id:'GEOMETRY_1'};
 corpus.spatial_assertions=[{...e,kind:'spatial',id:ref.id,subject:{kind:'event',namespace:e.namespace,id:e.id}}];
 const s=corpus.spatial_assertions[0];for(const key of ['title','description','start_date','end_date','event_type','spatial_refs','territory_refs','participant_refs','review_refs'])delete s[key];
 Object.assign(s,{label:null,geometry,crs:'EPSG:4326',geometry_role:geometry?role:'unknown',precision_meters:null,geocoding_method:null,reference_version:null,place:null});e.spatial_refs=[ref];return s;
}
test('TEMPORA v3 round trip preserves every ALNOP record, ordering, metadata, release and public artifact',()=>{
 const input=old.readCorpus(),before=structuredClone(input),v3=toTempora(input,profile(),{releases:[release]});ok(v3);
 assert.equal(v3.events.length,263);assert.equal(v3.releases[0].corpus_schema_version,'2.0.0');assert.equal(v3.releases[0].archive_sha256,release.archive_sha256);
 const restored=fromTempora(v3);assert.deepEqual(restored,{corpus:input,releases:[release]});assert.deepEqual(input,before);
 const {artifacts}=require(path.join(externalRoot,'scripts/build-canonical'));assert.deepEqual(artifacts(restored.corpus),artifacts(input));
 assert.equal(digest(v3),digest(toTempora(input,profile(),{releases:[release]})));
 assert.equal(v3.events[0].start_date.precision,input.operations[0].start_date.precision);assert.ok(v3.events.every(e=>e.review_refs.length===0));
});

test('Reverse migration refuses silent loss of generic edits, deleted originals, and unknown migration versions',()=>{
 const baseline=toTempora(old.readCorpus(),profile());
 let c=structuredClone(baseline);c.events[0].title.fr+=' updated';assert.throws(()=>fromTempora(c),e=>e.code==='MIGRATION_REVERSE_LOSS');
 c=structuredClone(baseline);delete c.events[0].extensions.alnop;assert.throws(()=>fromTempora(c),e=>e.code==='MIGRATION_RECORD_MISSING');
 c=structuredClone(baseline);c.extensions.alnop.migration_version='9.0.0';assert.throws(()=>fromTempora(c),e=>e.code==='MIGRATION_VERSION_UNSUPPORTED');
 c=structuredClone(baseline);c.events[0].extensions.alnop.original.legacy.description+=' changed';assert.throws(()=>fromTempora(c),e=>e.code==='MIGRATION_INTEGRITY_MISMATCH');
 c=structuredClone(baseline);c.schema_version='4.0.0';invalid(c,'CANONICAL_SCHEMA_INVALID');
});

test('Claims retain disagreement, evidence locators, quotations, units, context, timestamps and original reviews',()=>{
 const input=require(path.join(externalRoot,'tests/helpers/claims')).withClaims({reviewed:true}),v3=toTempora(input,profile());ok(v3);
 assert.deepEqual(v3.claims.map(c=>c.value),input.claims.map(c=>c.value));assert.equal(v3.claims[0].contradicts[0].id,input.claims[0].contradicts[0]);
 assert.equal(v3.claims[0].provenance.evidence[0].locator,input.claims[0].evidence[0].locator);
 assert.equal(v3.reviews.length,2);assert.equal(v3.reviews[0].agent_type,'unspecified');assert.deepEqual(fromTempora(v3).corpus,input);
 const broken=structuredClone(v3);broken.claims[1].predicate='other';invalid(broken,'CANONICAL_CONTRADICTION_INVALID');
});

test('Reviewed entities, historical names, relations and multiple event locations survive round trip',()=>{
 const {corpus,operation}=require(path.join(externalRoot,'tests/helpers/corpus')).withProposal();const {entity,approve}=require(path.join(externalRoot,'tests/helpers/entities'));
 const place=approve(entity('place','A')),other=approve(entity('place','B')),person=approve(entity('person','C'));corpus.places.push(place,other);corpus.persons.push(person);
 corpus.sources.push({source_id:place.source_ids[0],title:'Fictional source',review_status:'needs_review'});operation.source_ids.push(place.source_ids[0]);
 place.relations.push({type:'same_as_candidate',target_id:other.id,source_ids:[place.source_ids[0]],review_history:[]});
 operation.participants=[{entity_id:person.id,role:'participant',source_ids:[person.source_ids[0]]}];
 operation.locations.push({label:'Site fictif',geometry:{type:'Point',coordinates:[1,2]},geometry_role:'representative_point',review_status:'needs_review',place_id:place.id,source_ids:place.source_ids});
 const v3=toTempora(corpus,profile());ok(v3);assert.equal(v3.events.at(-1).spatial_refs.length,2);assert.ok(v3.relations.some(r=>r.predicate==='same_as_candidate'));assert.deepEqual(fromTempora(v3).corpus,corpus);
});

test('Migration rejects incompatible profiles, corrupt input and malformed release manifests',()=>{
 const input=old.readCorpus();assert.throws(()=>toTempora(input,nativeCorpus().profile),e=>e.code==='MIGRATION_PROFILE_INVALID');
 const bad=structuredClone(input);bad.operations[0].source_ids=['MISSING'];assert.throws(()=>toTempora(bad,profile()),e=>e.code==='MIGRATION_INPUT_INVALID');
 assert.throws(()=>toTempora(input,profile(),{releases:[{id:'fake'}]}),e=>e.code==='MIGRATION_RELEASE_INVALID');
});

test('Assessments preserve content-bound decisions and source fingerprints without creating historical truth',()=>{
 const c=old.readCorpus(),[left,right]=c.operations,source=c.sources[0],{contentDigest}=require(path.join(externalRoot,'src/review'));
 const a={id:'QA_TEST_MIGRATION',left_id:left.id,right_id:right.id,label:'uncertain',rationale:'Fictional test assessment',evidence:[{source_id:source.source_id,locator:'TEST p. 1'}],operation_fingerprints:{left:contentDigest(left),right:contentDigest(right)},source_fingerprints:{[source.source_id]:contentDigest(source)},editorial_status:'reviewed',review_history:[],created_at:'2026-11-05T00:00:00Z',updated_at:'2026-11-05T01:00:00Z'};
 a.review_history.push({reviewer:'TEST',decision:'approved',reason:'Fictional fixture',reference:'https://example.org/test',reviewed_at:'2026-11-05T00:30:00Z',content_sha256:contentDigest(a)});c.duplicate_assessments=[a];
 const v3=toTempora(c,profile());ok(v3);assert.equal(v3.assessments[0].result.label,'uncertain');assert.equal(v3.reviews.at(-1).content_sha256,a.review_history[0].content_sha256);assert.deepEqual(fromTempora(v3).corpus,c);
});

test('Generated migration identifiers do not depend on event titles or the order of event import',()=>{
 const c=old.readCorpus(),first=toTempora(c,profile());c.operations.reverse();const reversed=toTempora(c,profile());
 assert.deepEqual(first.events.map(e=>e.id).sort(),reversed.events.map(e=>e.id).sort());assert.deepEqual(first.spatial_assertions.map(e=>e.id).sort(),reversed.spatial_assertions.map(e=>e.id).sort());assert.deepEqual(fromTempora(reversed).corpus,c);
});
test('Migration CLI defaults to dry run, checks round trip and never writes a migration artifact implicitly',()=>{
 const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');const target=path.join(old.root,'work/tempora-v3/corpus-v3.json'),before=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null;
 const r=spawnSync(process.execPath,['scripts/migrate-tempora.js'],{cwd:old.root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);assert.equal(report.mode,'dry_run');assert.equal(report.roundtrip_verified,true);assert.equal(report.events,263);assert.equal(fs.existsSync(target)?fs.readFileSync(target,'utf8'):null,before);
 const invalid=spawnSync(process.execPath,['scripts/migrate-tempora.js','--reverse'],{cwd:old.root,encoding:'utf8'});assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/MIGRATION_ARGUMENT_INVALID/);
});
