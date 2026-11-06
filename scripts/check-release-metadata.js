'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function check(root = path.resolve(__dirname, '..')) {
  const read = file => fs.readFileSync(path.join(root,file),'utf8');
  const json = file => JSON.parse(read(file));
  const pkg = json('package.json'), lock = json('package-lock.json');
  const dist = json('distribution/package.json'), version = pkg.version;
  assert.match(version, /^\d+\.\d+\.\d+(?:-(?:dev|rc)\.\d+)?$/);
  assert.equal(pkg.name, dist.name);
  assert.equal(dist.version, version, 'distribution/package.json version mismatch');
  assert.equal(lock.version, version, 'package-lock.json version mismatch');
  assert.equal(lock.packages[''].version, version, 'lockfile root package version mismatch');
  assert.equal(pkg.private, true, 'Repository must remain private from npm publication until approved');
  assert.equal(dist.private, true, 'Distribution must remain private from npm publication until approved');
  assert.equal(dist.engines.node, '>=20');
  assert.equal(dist.license, 'MIT');
  assert.deepEqual(Object.keys(dist.dependencies).sort(), ['ajv','ajv-formats']);
  const citation = read('CITATION.cff');
  assert.ok(citation.includes('version: "'+version+'"'), 'CITATION.cff version mismatch');
  for (const file of ['README.md','CHANGELOG.md','docs/reference/RELEASE_POLICY.md','docs/index.html']) {
    assert.ok(read(file).includes(version), file + ': missing current version');
  }
  console.log('Release metadata verified: '+version+' (private, local candidate)');
  return {version,private:true};
}
if (require.main === module) {
  try { check(); } catch(e) { console.error(e.stack||e); process.exitCode=1; }
}
module.exports={check};
