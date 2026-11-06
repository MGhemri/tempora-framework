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
  const policy = fs.readFileSync(path.join(root, 'RELEASE_POLICY.md'), 'utf8');
  assert.match(policy, /Logiciel TEMPORA/);
  assert.match(policy, /Versions historiques ALNOP/);
  assert.doesNotMatch(policy, /data-AAAA\.MM\.N/);
});
