'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const base = join(__dirname, '..', '..');
const src = name => readFileSync(join(base, name), 'utf8');

test('Electron fallback requires no system Edge WebView2', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.devDependencies.electron, '45.2.3');
  assert.equal(pkg.devDependencies['electron-builder'], '26.18.0');
  assert.equal(pkg.build.win.target[0], 'nsis');
  assert.ok(pkg.build.extraResources.some(x => x.to === 'engine'));
  assert.doesNotMatch(JSON.stringify(pkg.build), /webview2|evergreen|edgeupdate/i);
});
test('Tauri and Electron share a fixed, allowlisted native command contract', () => {
  const native = src('src/native.ts');
  const view = src('src/main.ts');
  const preload = src('electron/preload.cjs');
  assert.match(native, /select_document" \| "validate_corpus_native/);
  assert.match(native, /window\.temporaElectron/);
  assert.match(view, /invokeNative<CanonicalResult \| null>/);
  assert.match(view, /invokeNative<DocumentPreview \| null>/);
  assert.doesNotMatch(preload, /ipcRenderer\.send\s*[,:(]/);
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
});
test('Electron native host sandbox and safe local-only picker', () => {
  const host = src('electron/main.cjs');
  for (const expression of [
    /nodeIntegration: false/, /contextIsolation: true/, /sandbox: true/,
    /webSecurity: true/, /setWindowOpenHandler/, /will-navigate/,
    /IPC_SENDER_REJECTED/, /showOpenDialog/, /MAX_CORPUS_BYTES/,
    /MAX_RESPONSE_BYTES/, /ENGINE_TIMEOUT_MS/,
    /tempora-framework/, /ENGINE_VERSION_MISMATCH/,
    /corpus\.validate/, /corpus\.digest/, /sha256/
  ]) assert.match(host, expression);
  assert.doesNotMatch(host, /shell:\s*true|exec\s*\(/);
  assert.doesNotMatch(host, /loadURL\(['"]https?:/);
});
test('Shared Vite assets remain local-file-compatible', () => {
  assert.match(src('vite.config.ts'), /base:\s*["']\.\/["']/);
});
