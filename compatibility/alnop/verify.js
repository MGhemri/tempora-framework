const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const pin = require('./pin.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const textHash = file => sha(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));

function verifyLocal(directory = __dirname) {
  for (const [file, expected] of Object.entries(pin.local_files)) {
    assert.equal(textHash(path.join(directory, file)), expected, `ALNOP checksum mismatch: ${file}`);
  }
  return {files: Object.keys(pin.local_files).length};
}

function verifyExternal(directory) {
  if (!directory) throw Error('Full compatibility requires --alnop-dir pointing to the pinned ALNOP checkout; no automatic download.');
  const root = fs.realpathSync(directory);
  const git = args => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8'}).trim();
  assert.equal(fs.realpathSync(git(['rev-parse', '--show-toplevel'])), root, 'Expected an ALNOP repository root');
  assert.equal(git(['rev-parse', 'HEAD']), pin.git_commit, 'ALNOP revision mismatch');
  assert.equal(git(['status', '--porcelain', '--untracked-files=normal']), '', 'ALNOP reference must be clean');
  verifyLocal();
  const baseline = require('./baselines/alnop-compatibility.json').baseline;
  for (const [file, expected] of Object.entries(baseline.files)) {
    assert.equal(textHash(path.join(root, file)), expected, `ALNOP checksum mismatch: ${file}`);
  }
  for (const [file, expected] of Object.entries(baseline.archives)) {
    assert.equal(sha(fs.readFileSync(path.join(root, file))), expected, `ALNOP archive mismatch: ${file}`);
  }
  for (const [file, expected] of Object.entries(baseline.v1.files)) {
    assert.equal(textHash(path.join(root, file)), expected, `ALNOP export mismatch: ${file}`);
  }
  return {root, baseline};
}

function verifyFull(directory) {
  // Only load historical code after checking the pinned, clean working tree and data.
  const {root, baseline} = verifyExternal(directory);
  const {readCorpus} = require(path.join(root, 'src/canonical'));
  const corpus = readCorpus();
  const collections = Object.fromEntries(Object.entries(corpus).filter(([, records]) => Array.isArray(records))
    .map(([name, records]) => [name, {count: records.length, ids_sha256: sha(JSON.stringify(records.map(r => r.id ?? r.source_id).sort()))}]));
  assert.deepEqual(collections, baseline.collections, 'ALNOP collection identities changed');
  assert.equal(corpus.operations.length, pin.dataset_records);
  const {toTempora, fromTempora} = require('./adapters/alnop-migration');
  const profile = require('./profile/profile.json');
  const migrated = toTempora(corpus, profile);
  assert.deepEqual(fromTempora(migrated).corpus, corpus, 'ALNOP round-trip changed scientific values');
  const {prepareImport} = require('../../src/framework/ingestion');
  const batch = prepareImport({corpus: migrated, bytes: fs.readFileSync(path.join(root, 'operations_fln_1954_1962.json')),
    mapping: require('./profile/imports/json.json'), sourceName: 'pinned-alnop.json', observedAt: '2026-11-06T00:00:00Z'});
  assert.equal(batch.report.summary.total, pin.dataset_records);
  assert.equal(batch.report.summary.create, 0);
  assert.equal(batch.report.summary.quarantined, 0);
  // Historical handlers resolve some assets against cwd. Bind them to their owner,
  // so a successful comparison cannot accidentally read TEMPORA's remaining copies.
  const previousDirectory = process.cwd();
  try {
  process.chdir(root);
  const snapshot = require(path.join(root, 'scripts/capture-v1-baseline')).snapshot();
  assert.deepEqual(snapshot, baseline.v1, 'ALNOP v1 contracts changed');
  const handler = require(path.join(root, 'api/v2/handler'));
  for (const expected of baseline.v2) {
    const response = {statusCode: 200, headers: {}, body: null,
      setHeader(k, v) {this.headers[k.toLowerCase()] = v;},
      status(code) {this.statusCode = code; return this;}, json(body) {this.body = body; return this;}, end() {}};
    handler({url: expected.url, method: expected.method, headers: {}}, response);
    const {date, ...headers} = response.headers;
    assert.deepEqual({url: expected.url, method: expected.method, status: response.statusCode, headers,
      body_sha256: sha(JSON.stringify(response.body))}, expected, `ALNOP v2 contract changed: ${expected.url}`);
  }
  } finally {process.chdir(previousDirectory);}
  return {revision: pin.git_commit, records: corpus.operations.length, collections,
    checked_files: Object.keys(baseline.files).length, checked_archives: Object.keys(baseline.archives).length,
    v1_contracts: baseline.v1.contracts.length, v2_contracts: baseline.v2.length, round_trip: true, ingestion: true};
}

if (require.main === module) {
  const {values} = require('node:util').parseArgs({options: {'alnop-dir': {type: 'string'}, output: {type: 'string'}}});
  let report;
  try {
    report = {ok: true, ...verifyFull(values['alnop-dir'])};
    const root = path.resolve(__dirname, '../..');
    const directory = path.join(root, 'tests/compatibility/alnop');
    const files = fs.readdirSync(directory).filter(name => /^full-.*\.test\.js$/.test(name)).sort();
    const result = require('node:child_process').spawnSync(process.execPath,
      ['--test', ...files.map(file => path.join(directory, file))],
      {cwd:fs.realpathSync(values['alnop-dir']), env:{...process.env, ALNOP_REFERENCE:fs.realpathSync(values['alnop-dir'])}, encoding:'utf8', timeout:120000});
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stdout + result.stderr);
    report.regression_suites = files;
    console.log(result.stdout);
  }
  catch (error) {report = {ok: false, revision: pin.git_commit, error: error.message}; process.exitCode = 1;}
  const output = path.resolve(values.output || 'work/compatibility-alnop-result.json');
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
module.exports = {verifyLocal, verifyExternal, verifyFull};
