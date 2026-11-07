'use strict';

// TEMPORA Studio protocol experiment: Node-only, no filesystem or network operations.
// This is NOT yet bundled as a native Tauri sidecar.
const { canonical } = require('tempora-framework');

const PROTOCOL = '1.0.0';
const ENGINE = '3.0.0';
const MAX_FRAME = 4 * 1024 * 1024;
const MAX_RESPONSE = 256 * 1024;
const REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

// TVRW protocol v2 is opt-in. Existing protocol 1.0.0 operations and
// wire responses stay unchanged for already-distributed desktop packages.
const {ProjectManager}=require('./visualization/session.cjs');
const visualization=new ProjectManager();
const V2='2.0.0';
function v2Reply(id,ok,body){
  let message=JSON.stringify({protocol_version:V2,request_id:id,ok,...body});
  if(Buffer.byteLength(message,'utf8')>MAX_RESPONSE){
    message=JSON.stringify({protocol_version:V2,request_id:id,ok:false,
      error:{code:'RESPONSE_LIMIT',message:'Bounded response limit exceeded'}});
  }
  return message+'\n';
}
function v2Respond(message){
  const id=message.request_id;
  if(!REQUEST_ID.test(id??'') || !message.payload ||
      typeof message.payload!=='object'||Array.isArray(message.payload)){
    return v2Reply(null,false,{error:{code:'INVALID_ENVELOPE'}});
  }
  const op=message.operation,p=message.payload;
  if(!['visualization.capabilities','visualization.project.create',
    'visualization.project.query','visualization.project.release',
    'visualization.analysis.run'].includes(op)){
    return v2Reply(id,false,{error:{code:'UNSUPPORTED_OPERATION'}});
  }
  try {
    let result;
    if(op==='visualization.capabilities'){
      if(Object.keys(p).length)throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
      result={protocol_version:V2,engine_version:ENGINE,
        modules:['geo','graph','chronos','evidence','pattern','observatory'],
        max_page_size:100,session_ttl_ms:600000};
    } else if(op==='visualization.project.create'){
      if(Object.keys(p).some(k=>k!=='corpus'))throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
      result=visualization.create(p.corpus);
    } else if(op==='visualization.project.query'){
      if(Object.keys(p).some(k=>!['project_id','module','offset','limit'].includes(k)))
        throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
      result=visualization.query(p.project_id,
        {module:p.module,offset:p.offset,limit:p.limit});
    } else if(op==='visualization.analysis.run'){
      if(Object.keys(p).some(k=>!['project_id','module','limit','threshold'].includes(k)))
        throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
      result=visualization.analyze(p.project_id,
        {module:p.module,limit:p.limit,threshold:p.threshold});
    } else {
      if(Object.keys(p).some(k=>k!=='project_id'))throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
      result=visualization.release(p.project_id);
    }
    return v2Reply(id,true,{result});
  } catch(e){
    return v2Reply(id,false,{error:{code:typeof e.code==='string'?e.code:'ENGINE_FAILURE'}});
  }
}


function reply(requestId, ok, body) {
  const message = JSON.stringify({
    protocol_version: PROTOCOL,
    request_id: typeof requestId === 'string' && REQUEST_ID.test(requestId) ? requestId : null,
    ok,
    ...body
  });
  if (Buffer.byteLength(message, 'utf8') > MAX_RESPONSE) {
    return JSON.stringify({
      protocol_version: PROTOCOL, request_id: requestId ?? null, ok: false,
      error: { code: 'RESPONSE_LIMIT', message: 'Response exceeds protocol limit' }
    }) + '\n';
  }
  return message + '\n';
}

function respond(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return reply(null, false, { error: { code: 'INVALID_JSON', message: 'Malformed request envelope' } });
  }
  if (message?.protocol_version === V2) return v2Respond(message);
  if (!message || typeof message !== 'object' || Array.isArray(message) ||
      !REQUEST_ID.test(message.request_id ?? '') || message.protocol_version !== PROTOCOL ||
      typeof message.operation !== 'string') {
    return reply(null, false, { error: { code: 'INVALID_ENVELOPE', message: 'Invalid protocol envelope or version' } });
  }
  const id = message.request_id;
  if (message.operation === 'health') {
    return reply(id, true, { result: { engine_version: ENGINE, protocol_version: PROTOCOL, capabilities: ['health', 'corpus.validate', 'corpus.digest'] } });
  }
  if (!['corpus.validate', 'corpus.digest'].includes(message.operation)) {
    return reply(id, false, { error: { code: 'UNSUPPORTED_OPERATION', message: 'Operation is not allowlisted' } });
  }
  if (!message.payload || typeof message.payload !== 'object' || Array.isArray(message.payload) ||
      !message.payload.corpus || typeof message.payload.corpus !== 'object' ||
      Array.isArray(message.payload.corpus)) {
    return reply(id, false, { error: { code: 'INVALID_PAYLOAD', message: 'Expected a corpus object' } });
  }
  try {
    if (message.operation === 'corpus.validate') {
      const validation = canonical.validateCorpus(message.payload.corpus);
      return reply(id, true, { result: validation });
    }
    const sha256 = canonical.digest(message.payload.corpus);
    return reply(id, true, { result: { sha256 } });
  } catch (error) {
    // Do not leak stack traces, paths, or document contents across IPC.
    return reply(id, false, { error: { code: typeof error.code === 'string' ? error.code : 'ENGINE_FAILURE',
      message: 'TEMPORA engine rejected the operation' } });
  }
}

let pending = Buffer.alloc(0);
process.stdin.on('data', chunk => {
  pending = Buffer.concat([pending, chunk]);
  if (pending.length > MAX_FRAME && !pending.includes(10)) {
    process.stdout.write(reply(null, false, { error: { code: 'FRAME_LIMIT', message: 'Request exceeds 4 MiB' } }));
    process.exitCode = 1;
    process.stdin.destroy();
    return;
  }
  let index;
  while ((index = pending.indexOf(10)) !== -1) {
    const frame = pending.subarray(0, index);
    pending = pending.subarray(index + 1);
    if (frame.length > MAX_FRAME) {
      process.stdout.write(reply(null, false, { error: { code: 'FRAME_LIMIT', message: 'Request exceeds 4 MiB' } }));
      process.exitCode = 1;
      process.stdin.destroy();
      return;
    }
    process.stdout.write(respond(frame.toString('utf8')));
  }
});
process.stdin.on('end', () => {
  if (pending.length) process.stdout.write(reply(null, false, {error:{code:'INCOMPLETE_FRAME',message:'Missing frame delimiter'}}));
});
