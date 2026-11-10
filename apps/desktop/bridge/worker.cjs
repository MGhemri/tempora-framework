'use strict';

// TEMPORA Studio protocol experiment: Node-only, no filesystem or network operations.
// This is NOT yet bundled as a native Tauri sidecar.
const { canonical, ingestion } = require('tempora-framework');

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
    'visualization.analysis.run','visualization.export.prepare',
    'visualization.graph.neighborhood','visualization.snapshot.compare'].includes(op)){
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
      if(Object.keys(p).some(k=>!['project_id','module','offset','limit','facet'].includes(k)))
        throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
      result=visualization.query(p.project_id,
        {module:p.module,offset:p.offset,limit:p.limit,facet:p.facet??null});
    } else if(op==='visualization.snapshot.compare'){
      if(Object.keys(p).some(k=>!['project_id','corpus'].includes(k)))
        throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
      result=visualization.compareSnapshot(p.project_id,p.corpus);
    } else if(op==='visualization.graph.neighborhood'){
      if(Object.keys(p).some(k=>!['project_id','root','depth','direction','limit'].includes(k)))
        throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
      result=visualization.graphNeighborhood(p.project_id,
        {root:p.root,depth:p.depth,direction:p.direction,limit:p.limit});
    } else if(op==='visualization.export.prepare'){
      if(Object.keys(p).some(k=>!['project_id','module','format','offset','limit','facet'].includes(k)))
        throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
      result=visualization.export(p.project_id,
        {module:p.module,format:p.format,offset:p.offset,limit:p.limit,facet:p.facet??null});
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


// Canonical TEMPORA Engine 3.0.0 is the ONLY source of scientific preview
// status. No acceptance operation is exposed in this IPC protocol.
function assistantPreview(payload){
  const keys=['corpus','mapping','source_name','input_base64','source_sha256'];
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     Object.keys(payload).some(k=>!keys.includes(k))||Object.keys(payload).length!==keys.length)
    throw Object.assign(Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
  if(!payload.corpus||typeof payload.corpus!=='object'||Array.isArray(payload.corpus)||
     !payload.mapping||typeof payload.mapping!=='object'||Array.isArray(payload.mapping)||
     typeof payload.source_name!=='string'||!payload.source_name||
     payload.source_name.length>256||
     typeof payload.source_sha256!=='string'||!/^[0-9a-f]{64}$/.test(payload.source_sha256)||
     typeof payload.input_base64!=='string'||payload.input_base64.length>175000||
     !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.input_base64))
    throw Object.assign(Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
  const bytes=Buffer.from(payload.input_base64,'base64');
  if(!bytes.length||bytes.length>128*1024||bytes.toString('base64')!==payload.input_base64)
    throw Object.assign(Error('INPUT_LIMIT'),{code:'INPUT_LIMIT'});
  if(require('node:crypto').createHash('sha256').update(bytes).digest('hex')!==payload.source_sha256)
    throw Object.assign(Error('SOURCE_DIGEST_MISMATCH'),{code:'SOURCE_DIGEST_MISMATCH'});
  const bundle=ingestion.preview({bytes,mapping:payload.mapping,corpus:payload.corpus,
    sourceName:payload.source_name,observedAt:null});
  const report=bundle.report;
  const statuses=new Set(['create','unchanged','conflict','quarantined']);
  if(!report||!report.summary||!Array.isArray(report.rows)||
     report.rows.some(row=>!statuses.has(row.status)))
    throw Object.assign(Error('ENGINE_PREVIEW_INVALID'),{code:'ENGINE_PREVIEW_INVALID'});
  const fields=['batch_id','base_sha256','profile','mapping','source','summary'];
  const result={preview_schema_version:'1.0.0',scope:'canonical_technical_preview',
    import_performed:false,acceptance_enabled:false,scientific_approval:false,
    ...Object.fromEntries(fields.map(k=>[k,report[k]])),
    total_rows:report.rows.length,
    rows:report.rows.slice(0,50).map(row=>({
      index:row.index,line:row.line,source_path:row.source_path,
      id:row.id,status:row.status,
      diagnostic_codes:row.diagnostics.slice(0,10).map(d=>String(d.code).slice(0,100)),
      changed_fields:row.changed_fields.slice(0,20)
    })),
    rows_truncated:report.rows.length>50};
  return result;
}

// This operation performs the SDK's acceptance in memory only, to calculate
// a reproducible staging receipt. No corpus or journal is written to disk.
function assistantStage(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     Object.keys(payload).sort().join(',')!==[
       'corpus','expected_base_sha256','expected_batch_id','input_base64',
       'mapping','review','source_name','source_sha256'].sort().join(','))
    throw Object.assign(Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'});
  const {review,expected_batch_id,expected_base_sha256}=payload;
  if(typeof expected_batch_id!=='string'||!/^[a-f0-9]{64}$/.test(expected_batch_id)||
     typeof expected_base_sha256!=='string'||!/^[a-f0-9]{64}$/.test(expected_base_sha256)||
     !review||typeof review!=='object'||Array.isArray(review)||
     Object.keys(review).sort().join(',')!=='ids,reason,reviewed_at,reviewer'||
     !Array.isArray(review.ids)||!review.ids.length||review.ids.length>50||
     typeof review.reviewer!=='string'||typeof review.reason!=='string'||
     typeof review.reviewed_at!=='string')
    throw Object.assign(Error('REVIEW_PAYLOAD_INVALID'),{code:'REVIEW_PAYLOAD_INVALID'});
  const input={corpus:payload.corpus,mapping:payload.mapping,
    source_name:payload.source_name,input_base64:payload.input_base64,
    source_sha256:payload.source_sha256};
  // Reapply all bounds/shape/fingerprint guards from the preview contract.
  const authorized=assistantPreview(input);
  if(authorized.batch_id!==expected_batch_id||
     authorized.base_sha256!==expected_base_sha256)
    throw Object.assign(Error('REVIEW_PREVIEW_STALE'),{code:'REVIEW_PREVIEW_STALE'});
  // Preview status classification is recomputed, not submitted from renderer.
  const bytes=Buffer.from(payload.input_base64,'base64');
  const bundle=ingestion.preview({bytes,mapping:payload.mapping,corpus:payload.corpus,
    sourceName:payload.source_name,observedAt:null});
  const eligible=new Set(bundle.report.rows.filter(x=>x.status==='create').map(x=>x.id));
  if(new Set(review.ids).size!==review.ids.length||
     review.ids.some(id=>typeof id!=='string'||!eligible.has(id)))
    throw Object.assign(Error('REVIEW_SELECTION'),{code:'REVIEW_SELECTION'});
  const outcome=ingestion.accept({corpus:payload.corpus,bundle,
    review:{batch_id:expected_batch_id,ids:review.ids,reviewer:review.reviewer,
      reason:review.reason,reviewed_at:review.reviewed_at}});
  const validation=canonical.validateCorpus(outcome.corpus);
  if(!validation.valid)throw Object.assign(Error('REVIEW_STAGING_INVALID'),{code:'REVIEW_STAGING_INVALID'});
  return {review_schema_version:'1.0.0',scope:'in_memory_staging_only',
    source_sha256:payload.source_sha256,base_sha256:expected_base_sha256,
    batch_id:expected_batch_id,mapping_sha256:bundle.report.mapping.sha256,
    snapshot_sha256:outcome.journal.output_sha256,
    journal:outcome.journal,canonical_validated:true,scientific_approval:false,
    saved_to_disk:false,published:false,import_performed:false,
    persistence_required:true};
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
  if(message.operation==='ingestion.stage-review'){
    try{return reply(id,true,{result:assistantStage(message.payload)});}
    catch(error){return reply(id,false,{error:{
      code:typeof error.code==='string'&&/^[A-Z0-9_]{1,100}$/.test(error.code)
        ?error.code:'ENGINE_REVIEW_REJECTED',
      message:'TEMPORA rejected the in-memory staging review'
    }});}
  }
  if(message.operation==='ingestion.preview'){
    try{
      return reply(id,true,{result:assistantPreview(message.payload)});
    }catch(error){
      return reply(id,false,{error:{
        code:typeof error.code==='string'&&/^[A-Z0-9_]{1,100}$/.test(error.code)
          ?error.code:'ENGINE_PREVIEW_REJECTED',
        message:'TEMPORA rejected the canonical preview'
      }});
    }
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
