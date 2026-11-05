const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {resolveProfile} = require('../src/framework/profile');
const {canonicalStringify, digest, validateCorpus, validateObject} = require('../src/framework/canonical');
const {temporal, temporalRelation} = require('../src/framework/temporal');
const {createWorkingCorpus} = require('../src/framework/ingestion');
const {nativeCorpus} = require('./helpers/tempora');
const first = require('./fixtures/profiles/synthetic-history/profile.json');
const second = require('./fixtures/profiles/synthetic-maritime/profile.json');

test('Profile contracts preserve inert metadata and keep overrides local', () => {
  const metadata = {mappings: [{id: 'fixture-map', version: '1.0.0'}], provenance: {reference: 'fictional registry'}};
  const a = resolveProfile({...first, ...metadata}, {parameters: {scope: ['fictional']}});
  const b = resolveProfile(second);
  assert.deepEqual(a.mappings, metadata.mappings);
  assert.deepEqual(a.provenance, metadata.provenance);
  assert.ok(Object.isFrozen(a.mappings[0]));
  assert.equal(b.parameters.scope, undefined);
  assert.throws(() => resolveProfile({...first, mappings: [...metadata.mappings, ...metadata.mappings]}),
    {code: 'PROFILE_MAPPING_DUPLICATE'});
  assert.throws(() => resolveProfile({...first, mappings: [{...metadata.mappings[0], path: '../outside.json'}]}),
    {code: 'PROFILE_SCHEMA_INVALID'});
  assert.equal(validateCorpus(createWorkingCorpus(b, {event_types: ['fictional port call'], territorial_units: []})).valid, true);
});

test('Profile validation rejects executable accessors and non-JSON descriptors without invoking getters', () => {
  const failIfRead = () => assert.fail('Getter executed');
  for (const field of [Object.defineProperty({}, 'x', {get: failIfRead, enumerable: true}),
    Object.defineProperty({}, 'hidden', {value: 1}), {[Symbol('private')]: 1}, Array(1)]) {
    assert.throws(() => resolveProfile({...first, parameters: {field}}), {code: 'PROFILE_VALUE_INVALID'});
  }
  const options = Object.defineProperty({}, 'parameters', {get: failIfRead, enumerable: true});
  assert.throws(() => resolveProfile(first, options), {code: 'PROFILE_VALUE_INVALID'});
});

test('The canonical vector preserves UTF-8, key and array order, and numeric encoding', () => {
  const value = {'é': 'Été — العربية', z: -0, arr: [2, 1], 10: 'dix', 2: 'deux'};
  const reference = fs.readFileSync(path.join(__dirname, 'fixtures/canonical-v3.utf8'));
  assert.deepEqual(Buffer.from(canonicalStringify(value), 'utf8'), reference);
  assert.equal(digest(value), '645902309d568112fbe93544042fa1d636628fa06284f0fd7ca6eb34a23cf30a');
  assert.notEqual(digest({...value, arr: [1, 2]}), digest(value));
});

test('Canonical validation rejects unknown schema keys and missing typed provenance', () => {
  for (const key of ['constructor', 'toString', '__proto__']) {
    assert.throws(() => validateObject(key, {}), {code: 'CANONICAL_SCHEMA_UNKNOWN'});
  }
  const corpus = nativeCorpus();
  corpus.events[0].provenance.evidence[0].source.namespace = second.namespace;
  assert.ok(validateCorpus(corpus).errors.some(error => error.code === 'CANONICAL_REFERENCE_MISSING'));
  const source = {...corpus.sources[0], url: 'javascript:alert(1)'};
  assert.ok(validateObject('source', source).errors.some(error => error.code === 'CANONICAL_SOURCE_URL_INVALID'));
});

test('Historical dates and WGS84 boundaries are explicit', () => {
  assert.equal(temporal('0004-02').latest, '0004-02-29');
  assert.equal(temporal('0099-02').latest, '0099-02-28');
  assert.throws(() => temporal('0099-02-29'));
  assert.throws(() => temporal('0004-02-29T00:00:00+01:00'));
  const before = {...temporal(null), kind: 'before', latest: '0004-02-29', precision: 'range'};
  assert.equal(temporalRelation(before, temporal('0004-02-29')), 'before');
  const polygon = {type: 'Polygon', coordinates: [[[179, 0], [-179, 0], [-179, 1], [179, 1], [179, 0]]]};
  assert.ok(validateObject('geometry', polygon).errors.some(error => /Dateline/.test(error.message)));
  assert.equal(validateObject('geometry', {type: 'Point', coordinates: [180, -90]}).valid, true);
  const corpus = nativeCorpus(), event = corpus.events[0];
  const record = {schema_version: event.schema_version, kind: 'spatial', namespace: event.namespace,
    id: 'SITE_1', editorial_status: 'proposed', provenance: event.provenance, extensions: {},
    subject: {kind: 'event', namespace: event.namespace, id: event.id}, label: null,
    geometry: null, crs: 'EPSG:4326', geometry_role: 'representative_point', precision_meters: null,
    geocoding_method: null, reference_version: null, place: null};
  assert.ok(validateObject('spatial-assertion', record).errors.some(error => error.code === 'CANONICAL_GEOMETRY_ROLE'));
  assert.equal(validateObject('spatial-assertion', {...record, geometry_role: 'unknown'}).valid, true);
});
