const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');

const root = path.resolve(__dirname, '../..');
const legacy = [
  'data', 'api', 'docs/data', 'docs/documentation', 'docs/tempora.html',
  'docs/alnop-compat.html', 'docs/ADR/002-canonical-publication.md',
  'docs/schemas', 'profiles/alnop', 'src/profiles/alnop.js',
  'src/profiles/alnop-migration.js', 'src/shared/assistance.js',
  'src/duplicates.js', 'scripts/build-documentation.js',
  'scripts/build-assistance.js', 'scripts/check-tempora-baseline.js',
  'playwright.legacy.config.js', 'tests/browser/standalone.spec.js',
  'tests/alnop-ingestion-compatibility.test.js', 'tests/alnop-minimal-compatibility.test.js',
  'tests/baselines/alnop-compatibility.json',
  'TEMPORA_CHANGELOG.md', 'EDITORIAL_POLICY.md',
  'ENTITY_REVIEW_GUIDE.md', 'PROVENANCE_POLICY.md'
];

test('Obsolete ALNOP files cannot be reintroduced into the TEMPORA framework', () => {
  for (const file of legacy) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  }
});

test('TEMPORA uses its own software release policy', () => {
  const policy = fs.readFileSync(path.join(root, 'docs/reference/RELEASE_POLICY.md'), 'utf8');
  assert.match(policy, /Logiciel TEMPORA/);
  assert.match(policy, /Versions historiques ALNOP/);
  assert.doesNotMatch(policy, /data-AAAA\.MM\.N/);
});

test('The repository root contains only standard project documentation', () => {
  const keep = new Set(['README.md','CHANGELOG.md','CODE_OF_CONDUCT.md','CONTRIBUTING.md','SECURITY.md']);
  const unexpected = fs.readdirSync(root).filter(file => /\.md$/i.test(file) && !keep.has(file));
  assert.deepEqual(unexpected, [], 'Move technical documents to docs/reference/');
});

test('Legacy audit and correction artifacts stay out of source and docs', () => {
  const forbidden = /(?:^|[\\/])(?:audit|correction|cdc|phase[_-][0-9]+|rapport[_-]de[_-]correction)[^\\/]*\.(?:md|pdf|html|json)$/i;
  for (const directory of [root,path.join(root, 'docs')]) {
    for (const file of fs.readdirSync(directory, {recursive:true})) {
      assert.equal(forbidden.test(file),false,'Obsolete report: '+file);
    }
  }
});
