'use strict';

// TEMPORA Desktop Windows fallback: Electron/Chromium; NO Edge WebView2 dependency.
// This is an experimental independent host for the existing scientific GUI.
// Canonical validation is delegated exclusively to the pinned TEMPORA 3.0.0 worker.
const {app, BrowserWindow, dialog, ipcMain, session, clipboard, shell} = require('electron');
const {readFileSync, statSync, existsSync, writeFileSync, copyFileSync, constants: fsConstants, rmSync} = require('node:fs');
const {randomBytes,createHash}=require('node:crypto');
const {join, basename, extname, resolve} = require('node:path');
const {spawn} = require('node:child_process');
const {VisualService}=require('./visualization-service.cjs');
const {preview}=require('./preview-core.cjs');
const {createAssistantSessions}=require('./assistant-session.cjs');
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
  const runtime = getRuntime();
  const request = Buffer.from(JSON.stringify({
    protocol_version: '1.0.0', request_id: requestId, operation,
    payload: corpus === undefined ? {} : {corpus}
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
  ipcMain.handle('tempora:assistant:inspect',(event,handle_id)=>{
    validSender(event);return assistantSessions.inspect(handle_id);
  });
  ipcMain.handle('tempora:assistant:sheet',(event,handle_id,sheet_name)=>{
    validSender(event);return assistantSessions.selectSheet(handle_id,sheet_name);
  });
  ipcMain.handle('tempora:assistant:suggest',(event,handle_id,profile_id,choice)=>{
    validSender(event);return assistantSessions.suggest(handle_id,profile_id,choice);
  });
  ipcMain.handle('tempora:assistant:close',(event,handle_id)=>{
    validSender(event);return assistantSessions.close(handle_id);
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
app.on('window-all-closed', () => {assistantSessions.clear();visualService.stop();app.quit();});
