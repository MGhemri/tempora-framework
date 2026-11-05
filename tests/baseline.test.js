const {test} = require('node:test');
const assert = require('node:assert/strict');
const baseline = require('./baselines/v1.json');
const {snapshotInitial} = require('../scripts/capture-v1-baseline');
test('Phase 0: original corpus and v1 responses remain unchanged', () => {
  const current = snapshotInitial();
  assert.equal(current.ids.length,263);
  assert.equal(new Set(current.ids).size,263);
  assert.deepEqual(current,baseline,
    'Review changes against the phase 0 reference; do not regenerate it to hide a regression.');
});
