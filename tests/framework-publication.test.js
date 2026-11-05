const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {buildPublicationArtifacts,verifyPublicationArtifacts} = require('../src/framework/publication');
const {createPublicationStore} = require('../src/framework/publication-store');
const {run} = require('../scripts/publish-tempora');

const {fixture,later,operator,ref} = require('./helpers/publication-request');

function temporary(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(),'tempora-publication-test-'));
  t.after(() => {
    const actual = fs.realpathSync(folder);
    assert.equal(path.dirname(actual),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(actual).startsWith('tempora-publication-test-'));
    fs.rmSync(actual,{recursive:true,force:true});
  });
  return folder;
}

test('Publication builds identical bytes and exports only the reviewed public projection', () => {
  const {request} = fixture(), before = structuredClone(request);
  const bundle = buildPublicationArtifacts(request);
  assert.deepEqual(buildPublicationArtifacts(request),bundle);
  assert.deepEqual(request,before);
  const snapshot = verifyPublicationArtifacts(bundle);
  assert.equal(require('../src/framework/canonical').validateCorpus(JSON.parse(bundle.files['corpus.json'])).valid,true);
  assert.match(bundle.files['SHA256SUMS.txt'],/  corpus\.json/);
  assert.equal(JSON.parse(bundle.files['validation-report.json']).counts.events,1);
  assert.throws(() => buildPublicationArtifacts({...request,expectedHead:undefined}),/independently supplied/);
  assert.equal(snapshot.records.events.length,1);
  assert.equal(snapshot.records.sources.length,1);
  assert.equal(snapshot.records.claims.length,0);
  assert.equal(snapshot.records.events[0].start_date.precision,'year');
  assert.equal(JSON.parse(bundle.files['events.geojson']).features[0].geometry,null);
  assert.match(bundle.files['events.csv'],/"'=1\+2"/);
  assert.doesNotMatch(JSON.stringify(bundle),/PRIVATE_|private-review/);
  const altered = structuredClone(bundle);
  altered.files['events.csv'] += 'corrupt';
  assert.throws(() => verifyPublicationArtifacts(altered),/checksum/);
  assert.throws(() => buildPublicationArtifacts({...request,journal:[]}),/independently supplied/);
});

test('A withdrawal needs a recorded decision and preserves a permanent tombstone', () => {
  const {request,event,source,append} = fixture();
  const previous = buildPublicationArtifacts(request);
  request.previous = previous;
  request.release.id = 'fictional-2';
  request.subjects = [ref(source)];
  request.asOf = later;
  assert.throws(() => buildPublicationArtifacts(request),error=>error.code==='PUBLICATION_WITHDRAWAL_REQUIRED');
  append(event,'withdrawn','published','withdrawn',later);
  const next = buildPublicationArtifacts(request);
  const snapshot = verifyPublicationArtifacts(next);
  assert.deepEqual(next.manifest.changes.withdrawn,[event.id]);
  assert.equal(snapshot.tombstones[0].previous_release_id,'fictional-1');
  assert.equal(snapshot.records.events.length,0);
  assert.equal(verifyPublicationArtifacts(previous).records.events.length,1);
});

test('An independent promotion is atomic, preserves archives and can roll back', t => {
  const dir = temporary(t), {request,source,append,event} = fixture();
  const store = createPublicationStore(dir);
  const first = buildPublicationArtifacts(request);
  const {profile} = request.corpus;
  const firstSha = store.stage(first);
  assert.equal(store.readCurrent(profile.id),null);
  assert.throws(() => store.promote(request,{snapshot_sha256:firstSha,operator:{...operator,reviewer:'reviewer'}}),/independent/);
  store.promote(request,{snapshot_sha256:firstSha,operator});
  assert.equal(store.readCurrent(profile.id).manifest.snapshot_sha256,firstSha);
  assert.deepEqual(store.promote(request,{snapshot_sha256:firstSha,operator}).history.length,1);
  assert.throws(() => store.stage(buildPublicationArtifacts({...request,release:{...request.release,rights_notice:'different'}})),/Immutable/);
  request.previous = first;
  request.release.id = 'fictional-2';
  request.subjects = [ref(source)];
  request.asOf = later;
  append(event,'withdrawn','published','withdrawn',later);
  const second = buildPublicationArtifacts(request);
  const secondSha = store.stage(second);
  const interrupted = createPublicationStore(dir,{replacePointer(){throw Error('Simulated rename failure');}});
  assert.throws(() => interrupted.promote(request,{snapshot_sha256:secondSha,operator}),/rename failure/);
  assert.equal(store.readCurrent(profile.id).manifest.snapshot_sha256,firstSha);
  store.promote(request,{snapshot_sha256:secondSha,operator});
  assert.equal(store.readCurrent(profile.id).manifest.snapshot_sha256,secondSha);
  store.rollback({profile,policy:request.policy,expected_sha256:secondSha,target_release_id:'fictional-1',operator});
  assert.deepEqual(store.readCurrent(profile.id),first);
  assert.ok(fs.existsSync(path.join(dir,profile.id,'fictional-2.bundle.json')));
  assert.throws(() => store.promote({...request,previous:null},{snapshot_sha256:secondSha,operator}),/withdrawal|digest/i);
});

test('CLI preparation is a dry run and staging requires explicit write', t => {
  const folder = temporary(t),{request} = fixture();
  const file = path.join(folder,'request.json'),store = path.join(folder,'publication');
  fs.writeFileSync(file,JSON.stringify(request));
  assert.equal(run(['prepare','--request',file,'--journal-head',request.expectedHead],store).mode,'dry_run');
  assert.equal(fs.existsSync(store),false);
  assert.throws(() => run(['promote','--request',file],store),/--write/);
  const {manifest} = run(['prepare','--request',file,'--journal-head',request.expectedHead,'--write'],store);
  const bundle = path.join(store,manifest.profile_id,manifest.release_id+'.bundle.json');
  assert.equal(run(['verify','--bundle',bundle],store).valid,true);
  assert.throws(() => run(['export','--bundle',bundle],store),/--write/);
  const {directory}=run(['export','--bundle',bundle,'--write'],store);
  assert.equal(run(['verify','--directory',directory],store).valid,true);
  fs.appendFileSync(path.join(directory,'corpus.json'),' ');
  assert.throws(() => run(['verify','--directory',directory],store),/checksum/);
});


test('Multiple places and contradictory reviewed claims survive the generic snapshot', () => {
  const {request,event,append} = fixture({contested:'allow'});
  const {corpus} = request;
  const site = (id,geometry,geometry_role) => ({
    id,kind:'spatial',namespace:event.namespace,schema_version:'3.0.0',editorial_status:'proposed',
    subject:ref(event),label:null,geometry,crs:'EPSG:4326',geometry_role,precision_meters:null,
    geocoding_method:null,reference_version:null,place:null,
    provenance:structuredClone(event.provenance),extensions:{}
  });
  const [claim] = corpus.claims;
  const other = {...structuredClone(claim),id:'ASSERTION_2',value:1,assertion_status:'contested'};
  claim.assertion_status = 'contested';
  claim.contradicts = [ref(other)];
  other.contradicts = [ref(claim)];
  corpus.claims.push(other);
  corpus.spatial_assertions = [
    site('SITE_A',{type:'Point',coordinates:[12,45]},'representative_point'),
    site('SITE_B',null,'unknown')
  ];
  event.spatial_refs = corpus.spatial_assertions.map(ref);
  append(event,'reopened','published','under_review');
  append(event,'approved','under_review','published');
  for (const record of [...corpus.claims,...corpus.spatial_assertions]) {
    append(record,'submitted','proposed','under_review');
    append(record,'approved','under_review','published');
  }
  request.subjects.push(ref(claim));
  const bundle = buildPublicationArtifacts(request);
  const snapshot = verifyPublicationArtifacts(bundle);
  assert.deepEqual(snapshot.records.claims.map(record=>record.value),[0,1]);
  assert.equal(snapshot.records.claims[0].contradicts[0].id,other.id);
  const features = JSON.parse(bundle.files['events.geojson']).features;
  assert.deepEqual(features.map(feature=>feature.properties.geometry_role),['representative_point','unknown']);
  assert.equal(features[1].geometry,null);
  assert.equal(features[0].properties.start_date.precision,'year');
});


test('A second synthetic profile independently promotes a byte-identical public release', t => {
  const {nativeCorpus}=require('./helpers/tempora');
  const {resolveProfile}=require('../src/framework/profile');
  const {temporal}=require('../src/framework/temporal');
  const corpus=nativeCorpus(), old=corpus.profile.namespace;
  const profile=resolveProfile(require('./fixtures/profiles/synthetic-maritime/profile.json'));
  const migrated=JSON.parse(JSON.stringify(corpus).replaceAll(old,profile.namespace));
  migrated.profile=profile;
  migrated.taxonomies.event_types=['fictional port call'];
  migrated.events[0].event_type=['fictional port call'];
  migrated.events[0].title={en:'Fictional port call',fr:'Escale fictive'};
  migrated.events[0].description={en:null};
  migrated.events[0].start_date=temporal('1935');
  const {request}=fixture({corpus:migrated});
  const first=buildPublicationArtifacts(request),second=buildPublicationArtifacts(request);
  assert.deepEqual(first,second);
  const store=createPublicationStore(temporary(t));
  store.promote(request,{snapshot_sha256:store.stage(first),operator});
  assert.deepEqual(store.readCurrent(profile.id),first);
  assert.equal(verifyPublicationArtifacts(first).profile.namespace,profile.namespace);
});
