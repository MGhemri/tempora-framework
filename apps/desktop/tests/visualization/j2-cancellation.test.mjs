import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {VisualService}=require('../../electron/visualization-service.cjs');
const worker=require.resolve('../../bridge/worker.cjs');
const runtime=()=>({node:process.execPath,worker,base:dirname(worker)});

test('cancellation terminates an in-flight native worker operation',async()=>{
  const service=new VisualService(runtime);
  const pending=service.request('visualization.project.create',
    {corpus:SYNTHETIC_CASES[0].make()});
  const status=service.cancel();
  assert.equal(status.cancelled,true);
  assert.equal(status.session_closed,true);
  await assert.rejects(pending,/VISUAL_WORKER_CLOSED/);
  assert.equal(service.projectId,null);
  assert.equal(service.child,null);
});

test('a fresh worker can open new project after cancellation without stale old-worker teardown',async()=>{
  const service=new VisualService(runtime);
  try{
    const first=await service.create(SYNTHETIC_CASES[0].make());
    assert.match(first.canonical_sha256,/^[0-9a-f]{64}$/);
    assert.equal((await service.query('chronos',0,1)).scope.returned,1);
    service.cancel();
    assert.throws(()=>service.query('chronos',0,1),/VISUAL_PROJECT_NOT_OPEN/);
    const second=await service.create(SYNTHETIC_CASES[0].make());
    assert.equal(second.canonical_sha256,first.canonical_sha256);
    assert.equal((await service.query('chronos',0,1)).scope.returned,1);
  }finally{service.stop();}
});
