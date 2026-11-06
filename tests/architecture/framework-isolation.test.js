const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {checkBoundaries,checkPublicSurfaces} = require('../../scripts/check-framework-boundaries');

const root = path.resolve(__dirname, '../..');
const work = path.join(root, 'work');

function scratch(t, directory = work) {
  fs.mkdirSync(directory, {recursive: true});
  const parent = fs.realpathSync(directory);
  assert.equal(parent, directory);
  const dir = fs.mkdtempSync(path.join(parent, 'framework-isolation-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return dir;
}

test('Framework imports stay within the core and generic schemas', () => {
  checkBoundaries(root);
  checkPublicSurfaces(root);
});

test('Boundary checks reject forbidden imports, implicit corpus paths and cycles', t => {
  const dir = scratch(t);
  const core = path.join(dir, 'src/framework');
  fs.mkdirSync(core, {recursive: true});
  fs.writeFileSync(path.join(dir, 'src/historical.js'), '');
  const entry = path.join(core, 'entry.js');
  fs.writeFileSync(entry, "require('../historical')");
  assert.throws(() => checkBoundaries(dir), /forbidden dependency/);
  fs.writeFileSync(entry, "const directory = 'data/canonical'");
  assert.throws(() => checkBoundaries(dir), /data/);
  fs.writeFileSync(entry, 'require(corpusModule)');
  assert.throws(() => checkBoundaries(dir), /unsupported dynamic import/);
  fs.writeFileSync(entry, "const load = requ\\u0069re; load('../historical')");
  assert.throws(() => checkBoundaries(dir), /indirect require/);
  fs.writeFileSync(entry, "module['require']('../historical')");
  assert.throws(() => checkBoundaries(dir), /indirect module access/);
  fs.writeFileSync(entry, "import /* comment */ '../historical.js'");
  assert.throws(() => checkBoundaries(dir), /forbidden dependency/);
  fs.writeFileSync(entry, "import('./other.js')");
  fs.writeFileSync(path.join(core, 'other.js'), 'export const fixture = true');
  checkBoundaries(dir);
  fs.writeFileSync(entry, "require('./analysis')");
  fs.writeFileSync(path.join(core, 'analysis.js'), '');
  assert.throws(() => checkBoundaries(dir), /forbidden layer dependency/);
  fs.writeFileSync(entry, "require('./other')");
  fs.writeFileSync(path.join(core, 'other.js'), "require('./entry')");
  assert.throws(() => checkBoundaries(dir), /Import cycle/);
});

test('Synthetic ingestion and analysis run in an isolated copy with only generic files', t => {
  const dir = scratch(t, path.dirname(fs.realpathSync(root)));
  const files = [
    'src/framework', 'schemas/tempora/v3', 'schemas/tempora.profile.schema.json',
    'schemas/tempora.ingestion-mapping.schema.json', 'scripts/ingest-tempora.js',
    'scripts/evaluate-tempora.js', 'scripts/publish-tempora.js', 'tests/framework-ingestion.test.js',
    'tests/framework-publication.test.js', 'tests/framework-published-api.test.js',
    'tests/helpers/publication-request.js', 'tests/vendor/openapi-3.1-schema.json',
    'tests/framework-analysis.test.js', 'tests/framework-contracts.test.js', 'tests/helpers/tempora.js',
    'tests/helpers/analysis-reference.js', 'tests/fixtures/profiles/synthetic-history',
    'tests/fixtures/analysis-reference.json', 'tests/fixtures/canonical-v3.utf8', 'tests/fixtures/profiles/synthetic-maritime'
  ];
  for (const file of files) {
    const destination = path.join(dir, file);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.cpSync(path.join(root, file), destination, {recursive: true});
  }
  for (const historical of ['data', 'docs', 'profiles', 'src/profiles', 'src/shared']) {
    assert.ok(!fs.existsSync(path.join(dir, historical)), historical);
  }
  const lock = require('../../package-lock.json');
  const runtime = new Set(['ajv', 'ajv-formats']);
  for (const name of runtime) {
    const key = 'node_modules/' + name;
    const pkg = lock.packages[key];
    assert.ok(pkg, `Missing locked dependency: ${name}`);
    for (const dependency of Object.keys(pkg.dependencies ?? {})) runtime.add(dependency);
    fs.cpSync(path.join(root, key), path.join(dir, key), {recursive: true});
  }
  const env = {...process.env, TMP: dir, TEMP: dir, TMPDIR: dir};
  delete env.NODE_PATH;
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [
    '--no-global-search-paths', '--test',
    'tests/framework-ingestion.test.js', 'tests/framework-analysis.test.js', 'tests/framework-contracts.test.js',
    'tests/framework-publication.test.js', 'tests/framework-published-api.test.js'
  ], {
    cwd: dir,
    env,
    encoding: 'utf8',
    timeout: 30000
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /CLI defaults to no writes/);
  assert.match(result.stdout, /Analytical output is reproducible/);
  assert.match(result.stdout, /Two profiles import the same event identifier independently/);
  assert.match(result.stdout, /The canonical vector preserves UTF-8/);
});
