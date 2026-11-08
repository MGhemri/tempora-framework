import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {dirname} from 'node:path';
import {SYNTHETIC_CASES} from './synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {ProjectManager,TTL_MS}=require('../../bridge/visualization/session.cjs');
const worker=require.resolve('../../bridge/worker.cjs');
test('J2 project handles are opaque, expire, reject unknown handle, and preserve source',()=>{
  let tick=1000;
  const projects=new ProjectManager(()=>tick);
  const corpus=SYNTHETIC_CASES[0].make(),original=structuredClone(corpus);
  const a=projects.create(corpus);
  assert.match(a.project_id,/^[a-f0-9]{48}$/);
  const result=projects.query(a.project_id,{module:'chronos',limit:1});
  assert.equal(result.result.length,1);
  assert.deepEqual(corpus,original);
  assert.throws(()=>projects.query('deadbeef',{module:'chronos'}),/INVALID_PROJECT/);
  tick+=TTL_MS+1;
  assert.throws(()=>projects.query(a.project_id,{module:'chronos'}),/PROJECT_EXPIRED/);
  const b=projects.create(corpus);
  assert.notEqual(a.project_id,b.project_id);
  projects.release(b.project_id);
  assert.throws(()=>projects.query(b.project_id,{module:'chronos'}),/PROJECT_NOT_FOUND/);
});
test('J2 rejects invalid corpus without creating a session',()=>{
  const project=new ProjectManager();
  assert.throws(()=>project.create(SYNTHETIC_CASES[9].make()),/CORPUS_NOT_VALIDATED/);
});
test('V2 persistent Node IPC creates, pages and releases a local corpus; V1 health remains intact',async()=>{
  const child=spawn(process.execPath,[worker],{cwd:dirname(worker),
    stdio:['pipe','pipe','ignore']});
  let buffer='';let serial=0;const waiters=new Map();
  child.stdout.on('data',b=>{
    buffer+=b.toString('utf8');let pos;
    while((pos=buffer.indexOf('\n'))>=0){
      const line=buffer.slice(0,pos);buffer=buffer.slice(pos+1);
      const item=JSON.parse(line),resolve=waiters.get(item.request_id);
      if(resolve){waiters.delete(item.request_id);resolve(item);}
    }
  });
  function send(version,operation,payload){
    const request_id='request_'+(++serial);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{waiters.delete(request_id);reject(Error('IPC_TEST_TIMEOUT'));},10000);
      waiters.set(request_id,response=>{clearTimeout(timer);resolve(response);});
      child.stdin.write(JSON.stringify({protocol_version:version,request_id,operation,payload})+'\n');
    });
  }
  try {
    const old=await send('1.0.0','health',{});
    assert.equal(old.ok,true);assert.equal(old.result.protocol_version,'1.0.0');
    const caps=await send('2.0.0','visualization.capabilities',{});
    assert.equal(caps.ok,true);assert.equal(caps.result.modules.length,6);
    const created=await send('2.0.0','visualization.project.create',{corpus:SYNTHETIC_CASES[0].make()});
    assert.equal(created.ok,true);
    const project_id=created.result.project_id;
    const queried=await send('2.0.0','visualization.project.query',{project_id,module:'chronos',offset:0,limit:1});
    assert.equal(queried.ok,true);assert.equal(queried.result.scope.returned,1);
    const analyzed=await send('2.0.0','visualization.analysis.run',
      {project_id,module:'observatory',limit:20});
    assert.equal(analyzed.ok,true);
    assert.equal(analyzed.result.result.length,9);
    const second=SYNTHETIC_CASES[0].make();
    const snapshotReply=await send('2.0.0','visualization.snapshot.compare',
      {project_id,corpus:second});
    assert.equal(snapshotReply.ok,true);
    assert.equal(snapshotReply.result.rows.find(x=>x.collection==='events').delta,0);
    assert.equal(snapshotReply.result.previous.canonical_sha256,
      snapshotReply.result.current.canonical_sha256);
    const invalidSnapshot=await send('2.0.0','visualization.snapshot.compare',
      {project_id,corpus:SYNTHETIC_CASES[9].make()});
    assert.equal(invalidSnapshot.ok,false);
    assert.equal(invalidSnapshot.error.code,'CORPUS_NOT_VALIDATED');
    const graphReply=await send('2.0.0','visualization.graph.neighborhood',
      {project_id,root:{kind:'event',namespace:'SYNTHETIC_HISTORY',id:'EVENT_001'},
        depth:1,direction:'both',limit:10});
    assert.equal(graphReply.ok,true);
    assert.equal(graphReply.result.scope.total_matched,0);
    const graphInvalid=await send('2.0.0','visualization.graph.neighborhood',
      {project_id,root:{kind:'event',namespace:'SYNTHETIC_HISTORY',id:'EVENT_001'},
        depth:20,direction:'both',limit:10});
    assert.equal(graphInvalid.ok,false);
    assert.equal(graphInvalid.error.code,'INVALID_DEPTH');
    const exportReply=await send('2.0.0','visualization.export.prepare',
      {project_id,module:'chronos',format:'json',offset:0,limit:1});
    assert.equal(exportReply.ok,true);
    assert.equal(JSON.parse(exportReply.result.data).manifest.module,'chronos');
    const malicious=await send('2.0.0','visualization.project.query',
      {project_id,module:'chronos',offset:0,limit:1,path:'/private/file'});
    assert.equal(malicious.ok,false);assert.equal(malicious.error.code,'INVALID_PAYLOAD');
    const released=await send('2.0.0','visualization.project.release',{project_id});
    assert.equal(released.ok,true);
    const missing=await send('2.0.0','visualization.project.query',{project_id,module:'chronos'});
    assert.equal(missing.ok,false);assert.equal(missing.error.code,'PROJECT_NOT_FOUND');
  }finally{
    child.stdin.end();child.kill();
  }
});
