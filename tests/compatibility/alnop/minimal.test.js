const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const {verifyLocal, verifyExternal} = require('../../../compatibility/alnop/verify');
const {toTempora, fromTempora} = require('../../../compatibility/alnop/adapters/alnop-migration');
const fixture = require('../../../compatibility/alnop/fixtures/corpus.json');
const profile = require('../../../compatibility/alnop/profile/profile.json');
const {digest, validateCorpus} = require('../../../src/framework/canonical');
const {prepareImport} = require('../../../src/framework/ingestion');
const {nativeCorpus} = require('../../helpers/tempora');
const root = path.resolve(__dirname, '../../..');

test('Offline fixture integrity and exact round-trip remain pinned', () => {
  verifyLocal();
  assert.equal(digest(fixture), 'cf6c7513a80a515b6ece9a17381ef2224a20be136fd140c3b3df14e0406c804b');
  const converted = toTempora(fixture, profile);
  assert.equal(validateCorpus(converted).valid, true);
  assert.deepEqual(fromTempora(converted), {corpus: fixture, releases: []});
});

test('ALNOP mappings reject a different scientific profile', () => {
  assert.throws(() => prepareImport({corpus: nativeCorpus(), bytes: Buffer.from('[]'),
    mapping: require('../../../compatibility/alnop/profile/imports/json.json'),
    sourceName: 'test.json', observedAt: '2026-11-06T00:00:00Z'}), {code: 'MAPPING_PROFILE_MISMATCH'});
});

test('Full compatibility rejects absent corpus and wrong revision without downloading', () => {
  assert.throws(() => verifyExternal(), /requires --alnop-dir/);
  assert.throws(() => verifyExternal(root), /revision mismatch/);
});

test('Offline compatibility runs without historical modules, schemas or full corpus and rejects altered bytes', t => {
  const parent = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(parent, 'tempora-compatibility-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const file of ['compatibility/alnop', 'src/framework', 'schemas/tempora/v3',
    'schemas/tempora.profile.schema.json', 'schemas/tempora.ingestion-mapping.schema.json']) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive: true});
    fs.cpSync(path.join(root, file), path.join(dir, file), {recursive: true});
  }
  for (const file of ['data', 'api', 'src/canonical.js', 'src/profiles']) assert.equal(fs.existsSync(path.join(dir, file)), false);
  const result = spawnSync(process.execPath, ['-e', `
    const assert=require('node:assert/strict');
    require('./compatibility/alnop/verify').verifyLocal();
    const {toTempora,fromTempora}=require('./compatibility/alnop/adapters/alnop-migration');
    const input=require('./compatibility/alnop/fixtures/corpus.json');
    const profile=require('./compatibility/alnop/profile/profile.json');
    assert.deepEqual(fromTempora(toTempora(input,profile)).corpus,input);
  `], {cwd: dir, env: {...process.env, NODE_PATH: path.join(root, 'node_modules')}, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const copied = path.join(dir, 'compatibility/alnop');
  fs.appendFileSync(path.join(copied, 'fixtures/corpus.json'), ' ');
  assert.throws(() => verifyLocal(copied), /checksum mismatch/);
});
