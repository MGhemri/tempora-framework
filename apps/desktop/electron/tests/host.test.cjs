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

test('Electron packaging preserves complete scientific SDK, not just Node executable',()=>{
 const pkg=require('../package.json');
 const hook=src('electron/after-pack.cjs');
 assert.equal(pkg.build.afterPack,'./after-pack.cjs');
 assert.match(hook,/TEMPORA_ELECTRON_STAGED_SDK_MISSING/);
 assert.match(hook,/cpSync\(source, dest/);
 assert.match(hook,/sdk\.version !== '3\.0\.0'/);
 assert.match(hook,/TEMPORA_ELECTRON_PACKAGED_SDK_MISSING/);
});


test('TEMPORA Windows icon uses white-background official artwork and UI uses transparent branding',()=>{
 const {existsSync,readFileSync}=require('node:fs');
 const root=join(__dirname,'..');
 const icon=join(root,'build','icon-white-256.png');
 const logo=join(base,'public','branding','tempora-logo-transparent.png');
 assert.ok(existsSync(icon),'official white-background icon must be committed');
 assert.ok(existsSync(logo),'transparent in-app logo must be committed');
 const data=readFileSync(icon);
 assert.equal(data.subarray(1,4).toString('ascii'),'PNG');
 assert.equal(data.readUInt32BE(16),256);
 assert.equal(data.readUInt32BE(20),256);
 const pkg=require('../package.json');
 assert.equal(pkg.productName,'TEMPORA Desktop');
 assert.equal(pkg.build.productName,'TEMPORA Desktop');
 assert.equal(pkg.build.win.icon,'build/icon-white-256.png');
 assert.ok(pkg.build.files.includes('build/icon-white-256.png'));
 assert.doesNotMatch(pkg.build.win.artifactName,/Chromium/i);
 assert.match(src('electron/main.cjs'),/title: 'TEMPORA Desktop'/);
 assert.match(src('electron/main.cjs'),/icon: join\(__dirname, 'build', 'icon-white-256\.png'\)/);
 const html=src('index.html');
 assert.match(html,/branding\/tempora-logo-transparent\.png/);
});
test('About is bilingual and authorship attribution is confined to About view',()=>{
 const html=src('index.html');
 const main=src('src/main.ts');
 assert.match(html,/id="view-about"/);
 assert.match(html,/Ghemri M/);
 assert.equal(html.split('Ghemri M').length-1,1);
 assert.match(html,/https:\/\/connect-gm\.com/);
 assert.match(main,/about: "À propos"/);
 assert.match(main,/about: "About"/);
 assert.match(main,/about-desktop-version/);
 assert.match(src('electron/main.cjs'),/UNAPPROVED_EXTERNAL_URL/);
});
test('Electron Beta version in the GUI matches the shipped package',()=>{
 const pkg=require('../package.json');
 const preload=src('electron/preload.cjs');
 const view=src('src/main.ts');
 assert.equal(pkg.version,'0.1.2-beta.3');
 assert.match(preload,/desktopVersion: '0\.1\.1-beta\.2'/);
 assert.match(view,/window\.temporaElectron\.desktopVersion/);
 assert.match(view,/sidebarVersion\.textContent/);
});

test('Windows signing is fail-closed and never mislabels an unsigned build',()=>{
 const sign=src('../../.github/workflows/desktop-electron-signed-candidate.yml');
 assert.match(sign,/workflow_dispatch:/);
 assert.match(sign,/WIN_CSC_LINK:/);
 assert.match(sign,/WIN_CSC_KEY_PASSWORD:/);
 assert.match(sign,/WINDOWS_CODE_SIGNING_CERTIFICATE_REQUIRED/);
 assert.match(sign,/forceCodeSigning=true/);
 assert.match(sign,/Get-AuthenticodeSignature/);
 assert.match(sign,/AUTHENTICODE_SIGNATURE_INVALID/);
 assert.match(sign,/TEMPORA-Desktop-Windows-x64-SIGNED-CANDIDATE-NOT-PUBLISHED/);
 assert.doesNotMatch(sign,/gh release create|publish-prerelease/);
});

test('Microsoft Store distribution uses actual Partner Center identity and never claims local signing',()=>{
 const storeSource=src('electron/store-appx.config.cjs');
 const flow=src('../../.github/workflows/desktop-electron-microsoft-store-candidate.yml');
 const appxConfig=require('../store-appx.config.cjs');
 const nsisConfig=require('../package.json').build.win;
 assert.match(storeSource,/MICROSOFT_STORE_PARTNER_CENTER_IDENTITY_MISMATCH/);
 assert.equal(appxConfig.appx.identityName,'GhemriM.TEMPORADesktop');
 assert.equal(appxConfig.appx.publisher,'CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455');
 assert.equal(appxConfig.appx.publisherDisplayName,'Ghemri M');
 assert.equal(appxConfig.appx.displayName,'TEMPORA Desktop');
 assert.deepEqual(appxConfig.appx.capabilities,['runFullTrust']);
 assert.match(appxConfig.appx.artifactName,/^TEMPORA-Desktop-/);
 assert.match(nsisConfig.artifactName,/SETUP\.exe$/);
 assert.deepEqual(appxConfig.win.target,['appx']);
 assert.doesNotMatch(appxConfig.win.artifactName,/SETUP\.exe/i);
 assert.doesNotMatch(appxConfig.appx.artifactName,/SETUP\.exe/i);
 assert.match(flow,/workflow_dispatch:/);
 assert.match(flow,/TEMPORA_STORE_IDENTITY_NAME/);
 assert.match(flow,/TEMPORA_STORE_PUBLISHER/);
 assert.match(flow,/TEMPORA_STORE_PUBLISHER_DISPLAY_NAME/);
 assert.match(flow,/--win appx --x64/);
 assert.match(flow,/STORE_MANIFEST_PARTNER_CENTER_IDENTITY_MISMATCH/);
 assert.match(flow,/STORE_SCIENTIFIC_ENGINE_MISSING_IN_APPX/);
 assert.match(flow,/STORE_PACKAGED_ENGINE_TEST_FAILED/);
 assert.match(flow,/UNSIGNED-NOT-PUBLISHED/);
 assert.doesNotMatch(flow,/gh release create|store publish|partnercenter.*upload/i);
});


test('Electron NSIS and Store package the same fully offline sample corpora',()=>{
  const pkg=require('../package.json');
  const examples=pkg.build.extraResources.find(x=>x.to==='examples');
  assert.ok(examples,'examples must be electron-builder extraResources');
  assert.equal(examples.from,'../examples');
  assert.deepEqual(examples.filter,['**/*']);
  const store=require('../store-appx.config.cjs');
  assert.ok(store.extraResources.some(x=>x.to==='examples'),'Store must also include examples');
  const smoke=src('electron/tests/packaged-engine-smoke.cjs');
  assert.match(smoke,/installedCanonical/);
  assert.match(smoke,/installedAlnop/);
  assert.match(smoke,/smoke_example/);
});

test('Electron GeoJSON preview renders ALNOP operation title and type from feature properties',()=>{
  const host=src('electron/main.cjs');
  assert.match(host,/item\?\.properties\?\.nom_operation/);
  assert.match(host,/item\?\.properties\?\.type_action/);
  assert.match(host,/item\?\.geometry\?\.type/);
});


test('packaged worker smoke uses absolute paths despite changing cwd',()=>{
  const smoke=src('electron/tests/packaged-engine-smoke.cjs');
  assert.match(smoke,/const resourceRoot = resolve\(suppliedResourceRoot\)/);
  assert.match(smoke,/isAbsolute\(node\) && isAbsolute\(worker\)/);
  assert.match(smoke,/cwd:join\(resourceRoot,'engine'\)/);
});
