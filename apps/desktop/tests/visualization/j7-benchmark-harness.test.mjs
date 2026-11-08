import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../scripts/bench-visualization.mjs',import.meta.url));
test('Synthetic performance harness emits machine-readable, explicit one-run measurements',()=>{
  const r=spawnSync(process.execPath,[script,'--sizes=1'],{
    encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  assert.equal(r.status,0,r.stderr);
  const result=JSON.parse(r.stdout);
  assert.equal(result.synthetic,true);
  assert.equal(result.sdk,'tempora-framework@3.0.0');
  assert.equal(result.sizes.length,1);
  assert.equal(result.sizes[0].size,1);
  assert.ok(result.sizes[0].bytes>0);
  assert.equal(result.sizes[0].validation.status,'ok');
  assert.equal(result.sizes[0].digest.status,'ok');
  assert.equal(result.sizes[0].chronos_page.status,'ok');
  assert.equal(result.sizes[0].observatory_analysis.status,'ok');
  assert.ok(result.sizes[0].notes.some(n=>n.includes('NOT p95')));
});
test('Large synthetic loads require explicit opt-in and malformed sizes fail closed',()=>{
  for(const sizes of ['100000','0','not-a-number']){
    const r=spawnSync(process.execPath,[script,'--sizes='+sizes],{
      encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
    assert.notEqual(r.status,0,sizes);
    assert.match(r.stderr,/LARGE_BENCHMARK|INVALID_BENCHMARK/);
  }
});
