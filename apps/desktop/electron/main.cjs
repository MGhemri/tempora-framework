'use strict';

// TEMPORA Desktop Windows fallback: Electron/Chromium; NO Edge WebView2 dependency.
// This is an experimental independent host for the existing scientific GUI.
// Canonical validation is delegated exclusively to the pinned TEMPORA 3.0.0 worker.
const {app, BrowserWindow, dialog, ipcMain, session, clipboard, shell} = require('electron');
const {readFileSync, statSync, existsSync, writeFileSync, copyFileSync, constants: fsConstants, rmSync} = require('node:fs');
const {randomBytes,createHash}=require('node:crypto');
const {join, basename, extname, resolve} = require('node:path');
const {spawn} = require('node:child_process');
const {createRequire}=require('node:module');
const {assessRecovery}=require('./recovery-assessment.cjs');
const {VisualService}=require('./visualization-service.cjs');
const {preview}=require('./preview-core.cjs');
const {createAssistantSessions}=require('./assistant-session.cjs');
const {createNativePersistenceWorkflow}=require('./native-persistence-workflow.cjs');
const {createAssistantPersistenceAuthority}=require('./assistant-persistence-authority.cjs');
const {localSaveEnabled}=require('./local-save-access.cjs');
const assistantSessions=createAssistantSessions({
  sourceRoot:app.isPackaged?join(process.resourcesPath,'assistant'):resolve(__dirname,'../../..','src'),
  profileRoot:app.isPackaged?join(process.resourcesPath,'assistant','profiles'):resolve(__dirname,'../../..','profiles')
});

const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
const MAX_CORPUS_BYTES = 3 * 1024 * 1024;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 3 * 256 * 1024 + 4096;
const ENGINE_TIMEOUT_MS = 12_000;
let mainWindow;
const visualService=new VisualService(getRuntime);
let persistenceAuthority=null;
const experimentalLocalSave=localSaveEnabled({isPackaged:app.isPackaged,env:process.env});
// This trusted host authority is prepared after a real worker stage. Neither
// its token nor its commit method is exposed through IPC or preload until
// the unresolved native Windows filesystem safety gates are qualified.
function getPersistenceAuthority(){
  if(persistenceAuthority)return persistenceAuthority;
  const runtime=getRuntime();
  const sdk=createRequire(runtime.worker)('tempora-framework');
  const workflow=createNativePersistenceWorkflow({
    sdk,
    confirmNative:async intent=>{
      const outcome=await dialog.showMessageBox(mainWindow,{
        type:'warning',title:'TEMPORA — second local save decision',
        buttons:['Cancel / Annuler','Confirm local save / Confirmer'],
        defaultId:0,cancelId:0,noLink:true,
        message:'Save a new immutable local scientific transaction?',
        detail:'Batch '+intent.batch_id+'\\nSnapshot '+intent.snapshot_sha256+
          '\\nNo scientific approval or publication. The original corpus is not modified.'
      });
      return outcome.response===1;
    },
    chooseDestination:async()=>{
      const selected=await dialog.showOpenDialog(mainWindow,{
        title:'TEMPORA — choose dedicated local transaction folder',
        properties:['openDirectory']
      });
      return selected.canceled?null:selected.filePaths[0]??null;
    }
  });
  persistenceAuthority=createAssistantPersistenceAuthority({
    sessions:assistantSessions,workflow
  });
  return persistenceAuthority;
}

function getRuntime() {
  if (app.isPackaged) {
    const base = join(process.resourcesPath, 'engine');
    const node = join(base, 'node.exe');
    const worker = join(base, 'worker.cjs');
    const sdk = join(base, 'node_modules', 'tempora-framework', 'package.json');
    if (![node, worker, sdk].every(p => existsSync(p))) throw Error('ENGINE_RUNTIME_NOT_BUNDLED');
    const version = JSON.parse(readFileSync(sdk, 'utf8')).version;
    if (version !== '3.0.0') throw Error('ENGINE_VERSION_MISMATCH');
    return {base, node, worker};
  }
  const base = resolve(__dirname, '..');
  return {base, node: 'node', worker: join(base, 'bridge', 'worker.cjs')};
}

function limitedFile(path, limit, requireObject) {
  if (!['.json', '.geojson'].includes(extname(path).toLowerCase())) throw Error('INVALID_EXTENSION');
  const metadata = statSync(path);
  if (!metadata.isFile() || metadata.size === 0 || metadata.size > limit) throw Error('DOCUMENT_LIMIT');
  const data = readFileSync(path);
  if (data.length > limit) throw Error('DOCUMENT_LIMIT');
  let parsed;
  try { parsed = JSON.parse(data.toString('utf8')); } catch { throw Error('INVALID_JSON'); }
  if (requireObject && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
    throw Error('INVALID_CORPUS');
  }
  return {fileName: basename(path), json: parsed, bytes: data.length};
}
function label(value, fallback = '—', n = 140) {
  return typeof value === 'string' ? Array.from(value).slice(0, n).join('') : fallback;
}
function inventoryRows(corpus, name) {
  const records = Array.isArray(corpus[name]) ? corpus[name] : [];
  return records.slice(0, 20).map(item => {
    const evidence = Array.isArray(item?.provenance?.evidence) ? item.provenance.evidence : [];
    return {
      id: label(item?.id), title: label(typeof item?.title === 'string'
        ? item.title
        : item?.title && typeof item.title === 'object'
          ? Object.values(item.title).find(x => typeof x === 'string')
          : item?.predicate),
      status: label(item?.assertion_status ?? item?.editorial_status),
      evidenceCount: evidence.length,
      sourceRefs: evidence.slice(0,20).map(e => e?.source?.id).filter(x => typeof x === 'string').map(x => label(x)),
      subjectRef: typeof item?.subject?.id === 'string' ? label(item.subject.id) : null
    };
  });
}
function inventory(corpus) {
  const arr = key => Array.isArray(corpus[key]) ? corpus[key] : [];
  const claims = arr('claims');
  const claimsIDs = new Set(claims.map(c => String(c?.namespace) + '\0' + String(c?.id)));
  const contradictions = [];
  let contradictionCount = 0;
  for (const claim of claims) {
    for (const target of Array.isArray(claim?.contradicts) ? claim.contradicts : []) {
      contradictionCount++;
      if (contradictions.length < 20) contradictions.push({
        claimId: label(claim?.id),
        targetId: label(target?.id),
        targetPresent: claim?.namespace === target?.namespace
          && claimsIDs.has(String(target?.namespace) + '\0' + String(target?.id))
      });
    }
  }
  const reviews = arr('reviews');
  return {
    eventCount: arr('events').length,
    sourceCount: arr('sources').length,
    claimCount: claims.length,
    unsupportedClaimCount: claims.filter(c => !Array.isArray(c?.provenance?.evidence) || !c.provenance.evidence.length).length,
    events: inventoryRows(corpus, 'events'), sources: inventoryRows(corpus, 'sources'),
    claims: inventoryRows(corpus, 'claims'), contradictionCount, contradictions,
    reviewCount: reviews.length,
    humanReviewCount: reviews.filter(r => r?.agent_type === 'human').length,
    reviews: reviews.slice(0,20).map(r => ({
      id: label(r?.id), subjectId: label(r?.subject?.id),
      agentType: label(r?.agent_type), agent: label(r?.agent),
      method: label(r?.method), decision: label(r?.decision),
      reason: label(r?.reason), reviewedAt: label(r?.reviewed_at),
      contentSha256: label(r?.content_sha256)
    }))
  };
}

// Exactly one JSON line per operation; do not let the renderer select worker,
// Node executable, command, raw file contents, or arbitrary filesystem paths.
function engine(operation, corpus, requestId) {
  return enginePayload(operation,corpus===undefined?{}:{corpus},requestId);
}
function enginePayload(operation, payload, requestId) {
  const runtime = getRuntime();
  const request = Buffer.from(JSON.stringify({
    protocol_version: '1.0.0', request_id: requestId, operation,
    payload
  }) + '\n');
  if (request.length > MAX_REQUEST_BYTES) throw Error('FRAME_LIMIT');
  return new Promise((resolveResult, reject) => {
    const child = spawn(runtime.node, [runtime.worker], {
      cwd: runtime.base, windowsHide: true, shell: false,
      env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !['NODE_OPTIONS','NODE_PATH'].includes(k))),
      stdio: ['pipe', 'pipe', 'ignore']
    });
    let done = false, bytes = 0;
    const chunks = [];
    const stop = (error, value) => {
      if (done) return;
      done = true; clearTimeout(timer); child.kill();
      error ? reject(error) : resolveResult(value);
    };
    const timer = setTimeout(() => stop(Error('ENGINE_TIMEOUT')), ENGINE_TIMEOUT_MS);
    child.on('error', () => stop(Error('ENGINE_START_FAILED')));
    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > MAX_RESPONSE_BYTES) return stop(Error('ENGINE_RESPONSE_LIMIT'));
      chunks.push(chunk);
    });
    child.on('close', code => {
      if (done) return;
      if (code !== 0) return stop(Error('ENGINE_EXIT_FAILED'));
      const frames = Buffer.concat(chunks).toString('utf8').trim().split('\n');
      if (frames.length !== 1) return stop(Error('ENGINE_PROTOCOL_FRAME_COUNT'));
      let message;
      try { message = JSON.parse(frames[0]); } catch { return stop(Error('ENGINE_PROTOCOL_JSON')); }
      if (message.protocol_version !== '1.0.0' || message.request_id !== requestId || message.ok !== true || !message.result) {
        return stop(Error('ENGINE_PROTOCOL_REJECTED'));
      }
      stop(null, message.result);
    });
    child.stdin.end(request);
  });
}

async function selectFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'], filters: [{name: 'Historical documents', extensions: ['json','geojson']}]
  });
  return result.canceled ? null : result.filePaths[0];
}
function validSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw Error('IPC_SENDER_REJECTED');
}
async function selectDocument(event) {
  validSender(event);
  const path = await selectFile();
  return path ? preview(limitedFile(path, MAX_PREVIEW_BYTES, false)) : null;
}
async function validateCorpus(event) {
  validSender(event);
  const path = await selectFile();
  if (!path) return null;
  const data = limitedFile(path, MAX_CORPUS_BYTES, true);
  const health = await engine('health', undefined, 'health_01');
  if (health.engine_version !== '3.0.0') throw Error('ENGINE_VERSION_MISMATCH');
  const validation = await engine('corpus.validate', data.json, 'validation_01');
  const digest = await engine('corpus.digest', data.json, 'digest_01');
  if (typeof validation.valid !== 'boolean' || !Array.isArray(validation.errors) ||
    typeof digest.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(digest.sha256)) throw Error('ENGINE_INVALID_RESULT');
  return {
    fileName: data.fileName, engineVersion: health.engine_version,
    valid: validation.valid, errors: validation.errors,
    warnings: Array.isArray(validation.warnings) ? validation.warnings : [],
    sha256: digest.sha256,
    note: 'Canonical schema validation only; historical claims still require source review.',
    overview: inventory(data.json)
  };
}

function copyReviewDraft(event, raw) {
  validSender(event);
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 16 * 1024) {
    throw Error('REVIEW_DRAFT_LIMIT');
  }
  let draft;
  try { draft = JSON.parse(raw); } catch { throw Error('REVIEW_DRAFT_JSON_INVALID'); }
  if (!draft || Array.isArray(draft) || typeof draft !== 'object' ||
      draft.document_type !== 'tempora.review_draft' ||
      draft.draft_schema_version !== '1.0.0' ||
      draft.status !== 'draft' || draft.approved !== false || draft.signed !== false ||
      !draft.target || typeof draft.target.id !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(draft.target.corpus_sha256) ||
      typeof draft.reviewer !== 'string' || !draft.reviewer.trim() ||
      typeof draft.method !== 'string' || !draft.method.trim() ||
      typeof draft.rationale !== 'string' || !draft.rationale.trim() ||
      draft.reviewer.length > 200 || draft.method.length > 300 ||
      draft.rationale.length > 10000 || draft.target.id.length > 200) {
    throw Error('REVIEW_DRAFT_NOT_NONCANONICAL');
  }
  // Clipboard only: no filesystem, canonical review write, network or approval.
  clipboard.writeText(raw);
  return true;
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  // Dedicated read-only Assistant session IPC. Only the host supplies paths.
  // The renderer sees random handles and bounded data-only inspection reports.
  ipcMain.handle('tempora:assistant:open',async event=>{
    validSender(event);
    const selection=await dialog.showOpenDialog(mainWindow,{
      properties:['openFile'],filters:[{name:'Source tabulaire',extensions:['csv','tsv','xlsx']}]
    });
    return selection.canceled?null:assistantSessions.open(selection.filePaths[0]);
  });
  // Explicit operator-selected folder, read-only. No path, archive data or
  // arbitrary canonical adapter may be provided by renderer IPC.
  ipcMain.handle('tempora:assistant:assess-recovery',async event=>{
    validSender(event);
    const chosen=await dialog.showOpenDialog(mainWindow,{
      title:'TEMPORA — inspect transaction folder (read-only)',
      properties:['openDirectory']
    });
    if(chosen.canceled||!chosen.filePaths[0])return null;
    // Resolve from the embedded engine location on packaged Windows.
    try {
      const runtime=getRuntime();
      const canonical=createRequire(runtime.worker)('tempora-framework').canonical;
      const report=assessRecovery(chosen.filePaths[0],canonical);
      // Preserve IPC budgets: no unbounded lists of attacker-controlled names.
      if(Object.values(report).some(v=>Array.isArray(v)&&v.length>100)||
         Buffer.byteLength(JSON.stringify(report),'utf8')>32*1024)
        throw Error('ASSIST_RECOVERY_REPORT_LIMIT');
      return report;
    } catch {
      // Native filesystem exceptions may contain absolute private paths.
      // Never propagate raw stack traces or selected paths to renderer IPC.
      throw Error('ASSIST_RECOVERY_ASSESSMENT_FAILED');
    }
  });
  ipcMain.handle('tempora:assistant:inspect',(event,handle_id)=>{
    validSender(event);return assistantSessions.inspect(handle_id);
  });
  ipcMain.handle('tempora:assistant:sheet',(event,handle_id,sheet_name)=>{
    validSender(event);
    persistenceAuthority?.revoke(handle_id);
    return assistantSessions.selectSheet(handle_id,sheet_name);
  });
  ipcMain.handle('tempora:assistant:suggest',(event,handle_id,profile_id,choice)=>{
    validSender(event);
    persistenceAuthority?.revoke(handle_id);
    return assistantSessions.suggest(handle_id,profile_id,choice);
  });
  ipcMain.handle('tempora:assistant:confirm',(event,handle_id,proposal_token,bindings)=>{
    validSender(event);
    persistenceAuthority?.revoke(handle_id);
    return assistantSessions.confirm(handle_id,proposal_token,bindings);
  });
  ipcMain.handle('tempora:assistant:dryrun',(event,handle_id,rules)=>{
    validSender(event);
    persistenceAuthority?.revoke(handle_id);
    return assistantSessions.normalizePreview(handle_id,rules);
  });
  ipcMain.handle('tempora:assistant:canonical-preview',async(event,handle_id)=>{
    validSender(event);
    persistenceAuthority?.revoke(handle_id);
    // Source paths and bytes, corpus paths, mapping and worker payload never cross renderer IPC.
    const input=assistantSessions.canonicalInput(handle_id);
    const selected=await dialog.showOpenDialog(mainWindow,{
      title:'Choose existing TEMPORA canonical v3 corpus (read-only)',
      properties:['openFile'],filters:[{name:'TEMPORA canonical corpus',extensions:['json']}]
    });
    if(selected.canceled||!selected.filePaths[0])return null;
    const corpusFile=limitedFile(selected.filePaths[0],2*1024*1024,true);
    if(corpusFile.json.schema_version!=='3.0.0'||!corpusFile.json.profile||
       corpusFile.json.profile.id!==input.profile_id)
      throw Error('ASSIST_CORPUS_PROFILE_MISMATCH');
    // Enforce the 4 MiB worker frame BEFORE spawning the pinned Node runtime.
    const payload={corpus:corpusFile.json,mapping:input.mapping,
      source_name:input.sourceName,input_base64:input.bytes.toString('base64'),
      source_sha256:input.sourceSha256};
    if(Buffer.byteLength(JSON.stringify(payload),'utf8')>3*1024*1024)
      throw Error('ASSIST_CANONICAL_REQUEST_LIMIT');
    const report=await enginePayload('ingestion.preview',payload,randomBytes(12).toString('hex'));
    // Only complete, bounded previews are eligible for a later human decision.
    // An opaque review token is NOT a bundle or approval; it is scoped to
    // this exact source, corpus, mapping and displayed creation set.
    let reviewGate={staging_review_enabled:false,review_token:null};
    if(report.scope==='canonical_technical_preview'&&
       report.source?.sha256===input.sourceSha256&&
       !report.rows_truncated&&report.rows?.length===report.total_rows&&
       report.summary?.total===report.total_rows&&
       report.mapping?.sha256&&report.base_sha256&&report.batch_id){
      const create_ids=report.rows.filter(r=>r.status==='create').map(r=>r.id);
      reviewGate=assistantSessions.saveCanonicalPreview(handle_id,{
        corpus_path:selected.filePaths[0],
        corpus_raw_sha256:createHash('sha256').update(readFileSync(selected.filePaths[0])).digest('hex'),
        base_sha256:report.base_sha256,batch_id:report.batch_id,
        mapping_sha256:report.mapping.sha256,source_sha256:input.sourceSha256,
        create_ids
      });
    }
    return {corpus_name:corpusFile.fileName,source_sha256:input.sourceSha256,
      ...report,...reviewGate};
  });
  ipcMain.handle('tempora:assistant:review-stage',async(event,handle_id,review_token,review)=>{
    validSender(event);
    persistenceAuthority?.revoke(handle_id);
    const claimed=assistantSessions.claimCanonicalReview(handle_id,review_token,review);
    const {input,preview}=claimed;
    // Reopen the SAME corpus selected for the preview. A changed corpus,
    // even if it has the same filename, forces a fresh technical review.
    const corpusFile=limitedFile(preview.corpus_path,2*1024*1024,true);
    const rawHash=createHash('sha256').update(readFileSync(preview.corpus_path)).digest('hex');
    if(rawHash!==preview.corpus_raw_sha256)
      throw Error('ASSIST_REVIEW_CORPUS_CHANGED');
    if(corpusFile.json.schema_version!=='3.0.0'||corpusFile.json.profile?.id!==input.profile_id)
      throw Error('ASSIST_REVIEW_CORPUS_PROFILE_MISMATCH');
    const payload={corpus:corpusFile.json,mapping:input.mapping,
      source_name:input.sourceName,input_base64:input.bytes.toString('base64'),
      source_sha256:input.sourceSha256,expected_batch_id:preview.batch_id,
      expected_base_sha256:preview.base_sha256,
      review:claimed.review};
    if(Buffer.byteLength(JSON.stringify(payload),'utf8')>3*1024*1024)
      throw Error('ASSIST_REVIEW_REQUEST_LIMIT');
    const result=await enginePayload('ingestion.stage-review',payload,randomBytes(12).toString('hex'));
    if(result.scope!=='in_memory_staging_only'||result.saved_to_disk!==false||
       result.published!==false||result.scientific_approval!==false||
       result.batch_id!==preview.batch_id||
       result.source_sha256!==input.sourceSha256)
      throw Error('ASSIST_REVIEW_RESULT_INVALID');
    // Keep a second-decision intent exclusively in the trusted host,
    // bound to the source session, selected corpus and worker receipt.
    // Errors in this optional preparation NEVER convert staging to a save.
    let prepared=false;
    if(experimentalLocalSave){
      try{
        getPersistenceAuthority().recordStaging({
          handle:handle_id,preview,input,stage:result
        });
        prepared=true;
      }catch{
        persistenceAuthority?.revoke(handle_id);
      }
    }
    // A development-only flag advertises the ability to REQUEST a native
    // second confirmation. The staging receipt remains explicitly unsaved.
    return {...result,experimental_local_save_ready:prepared};
  });
  // Packaged releases are unconditionally refused, even if an environment
  // variable is set. No token, destination path or scientific data is
  // accepted from the renderer. The host alone displays both native dialogs.
  ipcMain.handle('tempora:assistant:local-save',async(event,handle_id)=>{
    validSender(event);
    if(!experimentalLocalSave)throw Error('ASSIST_EXPERIMENTAL_SAVE_DISABLED');
    if(typeof handle_id!=='string'||!/^[a-f0-9]{48}$/.test(handle_id))
      throw Error('ASSIST_HANDLE_INVALID');
    if(!persistenceAuthority)throw Error('ASSIST_PERSIST_NOT_PREPARED');
    try{
      return await persistenceAuthority.commitTrusted(handle_id);
    }catch(error){
      // Electron exceptions can carry absolute filesystem paths.
      // Always discard underlying error details at the renderer boundary.
      const allowed=new Set([
        'ASSIST_PERSIST_AUTHORITY_NOT_PREPARED',
        'NATIVE_PERSIST_BUSY','NATIVE_PERSIST_CANCELLED',
        'TRANSACTION_WRITER_BUSY','TRANSACTION_ALREADY_COMMITTED',
        'TRANSACTION_PREEXISTING_INVALID',
        'TRANSACTION_PENDING_RECOVERY_REQUIRED'
      ]);
      throw Error(allowed.has(error?.code)?error.code:'ASSIST_LOCAL_SAVE_REJECTED');
    }
  });
  ipcMain.handle('tempora:assistant:close',(event,handle_id)=>{
    validSender(event);
    persistenceAuthority?.revoke(handle_id);
    return assistantSessions.close(handle_id);
  });
  ipcMain.handle('tempora:select_document', selectDocument);
  ipcMain.handle('tempora:validate_corpus_native', validateCorpus);
  ipcMain.handle('tempora:copy_review_draft', copyReviewDraft);
  ipcMain.handle('tempora:visualization:open', async event=>{
    validSender(event);
    const path=await selectFile();
    if(!path)return null;
    const selected=limitedFile(path,MAX_CORPUS_BYTES,true);
    const info=await visualService.create(selected.json);
    return {fileName:selected.fileName,...info};
  });
  ipcMain.handle('tempora:visualization:query', async(event,module,offset,limit,facet)=>{
    validSender(event);
    return visualService.query(module,offset,limit,facet??null);
  });
  ipcMain.handle('tempora:visualization:analyze', async(event,module,limit,threshold)=>{
    validSender(event);
    return visualService.analyze(module,limit,threshold);
  });
  ipcMain.handle('tempora:visualization:compare-snapshot',async event=>{
    validSender(event);
    const path=await selectFile();
    if(!path)return null;
    const selected=limitedFile(path,MAX_CORPUS_BYTES,true);
    const comparison=await visualService.compareSnapshot(selected.json);
    return {fileName:selected.fileName,...comparison};
  });
  ipcMain.handle('tempora:visualization:neighborhood',async(event,root,depth,direction,limit)=>{
    validSender(event);
    return visualService.neighborhood(root,depth,direction,limit);
  });
  ipcMain.handle('tempora:visualization:export', async(event,module,format,offset,limit,facet)=>{
    validSender(event);
    const output=await visualService.prepareExport(module,format,offset,limit,facet??null);
    const choice=await dialog.showSaveDialog(mainWindow,{
      title:'Export TEMPORA scientific view',
      defaultPath:'TEMPORA-'+module+'.'+format,
      filters:[{name:format.toUpperCase()+' scientific export',extensions:[format]}]
    });
    if(choice.canceled||!choice.filePath)return null;
    const target=choice.filePath;
    if(extname(target).toLowerCase()!=='.'+format)throw Error('VISUAL_EXPORT_EXTENSION_MISMATCH');
    // Refuse replacement: an export must not overwrite user documents or a
    // prior reproducibility manifest, even after the save picker returns.
    const sidecar=output.manifestText?target+'.manifest.json':null;
    if(existsSync(target)||(sidecar&&existsSync(sidecar)))throw Error('VISUAL_EXPORT_ALREADY_EXISTS');
    const token=randomBytes(8).toString('hex');
    const temp=target+'.'+token+'.tmp';
    const tempManifest=sidecar?sidecar+'.'+token+'.tmp':null;
    let installed=false;
    try{
      if(typeof output.data!=='string'||typeof output.sha256!=='string')throw Error('VISUAL_EXPORT_INVALID');
      if(createHash('sha256').update(output.data).digest('hex')!==output.sha256)
        throw Error('VISUAL_EXPORT_DIGEST_MISMATCH');
      writeFileSync(temp,output.data,{flag:'wx'});
      if(tempManifest)writeFileSync(tempManifest,output.manifestText,{flag:'wx'});
      copyFileSync(temp,target,fsConstants.COPYFILE_EXCL);installed=true;
      if(tempManifest)copyFileSync(tempManifest,sidecar,fsConstants.COPYFILE_EXCL);
      rmSync(temp,{force:true});
      if(tempManifest)rmSync(tempManifest,{force:true});
    }catch(error){
      rmSync(temp,{force:true});
      if(tempManifest)rmSync(tempManifest,{force:true});
      if(installed)rmSync(target,{force:true});
      throw error;
    }
    return {fileName:basename(target),sha256:output.sha256,
      bytes:output.bytes,partial:Boolean(output.manifest?.partial)};
  });
  ipcMain.handle('tempora:visualization:cancel', event=>{
    validSender(event);
    return visualService.cancel();
  });
  ipcMain.handle('tempora:visualization:close', async event=>{
    validSender(event);
    return visualService.release();
  });
  ipcMain.handle('tempora:open-official-link', async (event, url) => {
    validSender(event);
    if (url !== 'https://connect-gm.com' &&
        url !== 'https://github.com/MGhemri/tempora-framework') {
      throw Error('UNAPPROVED_EXTERNAL_URL');
    }
    await shell.openExternal(url);
    return true;
  });
  // Research data never initiate network requests from the offline renderer.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const scheme = new URL(details.url).protocol;
    callback({cancel: scheme !== 'file:' && scheme !== 'data:'});
  });
  mainWindow = new BrowserWindow({
    width: 1330, height: 830, minWidth: 920, minHeight: 610,
    title: 'TEMPORA Desktop',
    icon: join(__dirname, 'build', 'icon-white-256.png'),
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, webSecurity: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadFile(join(__dirname, app.isPackaged ? 'dist' : '../dist', 'index.html'));
});
app.on('window-all-closed', () => {persistenceAuthority?.clear();assistantSessions.clear();visualService.stop();app.quit();});
