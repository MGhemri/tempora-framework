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
  assert.equal(result.iterations,3);
  assert.equal(result.sizes[0].validation.completed_iterations,3);
  assert.equal(result.sizes[0].validation.samples_ms.length,3);
  assert.ok(result.sizes[0].validation.min_ms<=result.sizes[0].validation.elapsed_ms);
  assert.ok(result.sizes[0].validation.elapsed_ms<=result.sizes[0].validation.max_ms);
  assert.equal(result.sdk,'tempora-framework@3.0.0');
  assert.equal(result.sizes.length,1);
  assert.equal(result.sizes[0].size,1);
  assert.ok(result.sizes[0].bytes>0);
  assert.equal(result.sizes[0].validation.status,'ok');
  assert.equal(result.sizes[0].digest.status,'ok');
  assert.equal(result.sizes[0].chronos_page.status,'ok');
  assert.equal(result.sizes[0].observatory_analysis.status,'ok');
  assert.equal(result.sizes[0].chronos_scoped_page.status,'ok');
  assert.equal(result.sizes[0].chronos_filtered_json_export.status,'ok');
  assert.ok(result.sizes[0].notes.some(n=>n.includes('NOT p95')));
});
test('Benchmark iterations are bounded, deterministic in shape and explicit',()=>{
  const valid=spawnSync(process.execPath,[script,'--sizes=1','--iterations=2'],{
    encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  assert.equal(valid.status,0,valid.stderr);
  const output=JSON.parse(valid.stdout);
  assert.equal(output.iterations,2);
  assert.equal(output.sizes[0].digest.completed_iterations,2);
  for(const iterations of ['0','11','non-integer']){
    const rejected=spawnSync(process.execPath,[script,'--sizes=1','--iterations='+iterations],{
      encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
    assert.notEqual(rejected.status,0);
    assert.match(rejected.stderr,/INVALID_BENCHMARK_ITERATIONS/);
  }
});
test('Representative 100-record synthetic benchmark executes without data access',()=>{
  const r=spawnSync(process.execPath,[script,'--sizes=100','--iterations=1'],{
    encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});
  assert.equal(r.status,0,r.stderr);
  const sample=JSON.parse(r.stdout).sizes[0];
  assert.equal(sample.size,100);
  assert.equal(sample.validation.status,'ok');
  assert.equal(sample.chronos_scoped_page.status,'ok');
  assert.equal(sample.chronos_filtered_json_export.status,'ok');
  assert.equal(sample.native_project_create.status,'ok');
});
test('Large synthetic loads require explicit opt-in and malformed sizes fail closed',()=>{
  for(const sizes of ['100000','0','not-a-number']){
    const r=spawnSync(process.execPath,[script,'--sizes='+sizes],{
      encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
    assert.notEqual(r.status,0,sizes);
    assert.match(r.stderr,/LARGE_BENCHMARK|INVALID_BENCHMARK/);
  }
});
