'use strict';

// TEMPORA Desktop Windows fallback: Electron/Chromium; NO Edge WebView2 dependency.
// This is an experimental independent host for the existing scientific GUI.
// Canonical validation is delegated exclusively to the pinned TEMPORA 3.0.0 worker.
const {app, BrowserWindow, dialog, ipcMain, session} = require('electron');
const {readFileSync, statSync, existsSync} = require('node:fs');
const {join, basename, extname, resolve} = require('node:path');
const {spawn} = require('node:child_process');

const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
const MAX_CORPUS_BYTES = 3 * 1024 * 1024;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 3 * 256 * 1024 + 4096;
const ENGINE_TIMEOUT_MS = 12_000;
const PREVIEW_LIMIT = 7;
let mainWindow;

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
function title(item) {
  const value = item && (item.title ?? item.name);
  const named = typeof value === 'string' ? value :
    value && typeof value === 'object' ? Object.values(value).find(v => typeof v === 'string') : undefined;
  return label(named, 'Untitled / Sans titre');
}
function preview(data) {
  const json = data.json;
  const geo = json?.type === 'FeatureCollection';
  const records = geo ? json.features :
    (Array.isArray(json) ? json : json?.events ?? json?.operations ?? json?.records);
  const items = Array.isArray(records) ? records : [];
  const count = key => Array.isArray(json?.[key]) ? json[key].length : 0;
  return {
    fileName: data.fileName, format: geo ? 'GeoJSON' : 'JSON',
    bytes: data.bytes, records: items.length,
    sources: count('sources'), assertions: count('claims') + count('assertions'),
    rows: items.slice(0, PREVIEW_LIMIT).map(item => ({
      id: label(item?.id, '—', 80), title: title(item),
      kind: label(item?.kind ?? item?.type, 'record', 40)
    })),
    note: 'Structural preview only. Not canonical validation or historical fact verification.'
  };
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

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  ipcMain.handle('tempora:select_document', selectDocument);
  ipcMain.handle('tempora:validate_corpus_native', validateCorpus);
  mainWindow = new BrowserWindow({
    width: 1330, height: 830, minWidth: 920, minHeight: 610,
    title: 'TEMPORA — Research Workspace (Chromium)',
    icon: join(__dirname, 'build', 'icon.ico'),
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
app.on('window-all-closed', () => app.quit());
