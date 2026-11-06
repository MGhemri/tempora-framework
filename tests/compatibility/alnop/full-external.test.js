const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {verifyFull} = require('../../../compatibility/alnop/verify');

test('Historical API contracts resolve assets from the pinned owner even with an empty working directory', () => {
  const reference = fs.realpathSync(process.env.ALNOP_REFERENCE);
  const previous = process.cwd();
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'tempora-empty-reference-test-'));
  try {
    process.chdir(directory);
    const report = verifyFull(reference);
    assert.equal(report.records, 263);
    assert.equal(report.v1_contracts, 21);
    assert.equal(report.v2_contracts, 7);
    assert.equal(process.cwd(), directory);
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally {
    process.chdir(previous);
    fs.rmSync(directory, {recursive: true, force: true});
  }
});
