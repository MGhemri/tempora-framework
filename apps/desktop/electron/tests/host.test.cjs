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
 assert.ok(preload.includes("desktopVersion: '"+pkg.version+"'"),
  'Preload diagnostic version must match Electron package version');
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

test('AG-06: Electron previews prefer generic GeoJSON labels and preserve ALNOP fallback',()=>{
 const {preview}=require('../preview-core.cjs');
 const p=(features)=>preview({fileName:'fixture.geojson',json:{type:'FeatureCollection',features},bytes:100});
 const generic=p([{type:'Feature',id:'GEN_1',properties:{
  title:{es:'Evento sintético',en:'Synthetic event'},name:'Secondary label',
  kind:'archival_record',type:'wrong_fallback',nom_operation:'Legacy label',
  type_action:'legacy_kind'
 },geometry:{type:'Point',coordinates:[0,0]}}]);
 assert.deepEqual(generic.rows,[{id:'GEN_1',title:'Synthetic event',kind:'archival_record'}]);
 assert.equal(generic.note,'Structural preview only. Not canonical validation or historical fact verification.');
 const aln=p([{type:'Feature',properties:{
  id:'OP_ALNOP',nom_operation:'Opération de démonstration',type_action:'fictional_event'
 },geometry:{type:'Point',coordinates:[0,0]}}]);
 assert.deepEqual(aln.rows,[{id:'OP_ALNOP',title:'Opération de démonstration',kind:'fictional_event'}]);
 const anonymous=p([{type:'Feature',geometry:{type:'LineString',coordinates:[]}}]);
 assert.equal(anonymous.rows[0].kind,'LineString');
 assert.equal(anonymous.rows[0].title,'Untitled / Sans titre');
 const mixed=preview({fileName:'synthetic.json',bytes:55,json:{
  events:[{id:'E1',title:{es:'Uno',en:'One'},kind:'event'}],
  records:[{id:'R1'}],operations:[{id:'O1'}]
 }});
 assert.equal(mixed.rows[0].title,'One');
 assert.equal(mixed.records,1);
 assert.equal(preview({fileName:'records.json',bytes:1,json:{
  records:[{id:'R1',title:'Synthetic record'}],operations:[{id:'O1'}]
 }}).rows[0].id,'R1');
 const packaged=require('../package.json').build.files;
 assert.ok(packaged.includes('preview-core.cjs'));
 const host=src('electron/main.cjs');
 assert.match(host,/require\('\.\/preview-core\.cjs'\)/);
 assert.doesNotMatch(host,/properties\?\.nom_operation/);
});


test('packaged worker smoke uses absolute paths despite changing cwd',()=>{
  const smoke=src('electron/tests/packaged-engine-smoke.cjs');
  assert.match(smoke,/const resourceRoot = resolve\(suppliedResourceRoot\)/);
  assert.match(smoke,/isAbsolute\(node\) && isAbsolute\(worker\)/);
  assert.match(smoke,/cwd:join\(resourceRoot,'engine'\)/);
});

test('Assistant IPC is fixed, host-authorized and packaged without renderer paths',()=>{
 const main=src('electron/main.cjs');
 const preload=src('electron/preload.cjs');
 const pkg=require('../package.json');
 assert.match(main,/createAssistantSessions/);
 assert.match(main,/tempora:assistant:open/);
 assert.match(main,/tempora:assistant:inspect/);
 assert.match(main,/tempora:assistant:sheet/);
 assert.match(main,/tempora:assistant:close/);
 assert.match(main,/validSender\(event\)/);
 assert.match(preload,/assistantOpen: \(\) => ipcRenderer\.invoke\('tempora:assistant:open'\)/);
 assert.doesNotMatch(preload,/require\(['"]node:fs['"]\)|readFileSync/);
 assert.ok(pkg.build.files.includes('assistant-session.cjs'));
 const extra=pkg.build.extraResources;
 assert.ok(extra.some(x=>x.to==='assistant/framework/assist-inspection.js'));
 assert.ok(extra.some(x=>x.to==='assistant/assist-io'));
 const hostFile=require('../assistant-session.cjs');
 assert.equal(typeof hostFile.createAssistantSessions,'function');
});

test('Assistant initial GUI remains read-only and Electron-only',()=>{
 const ui=src('src/assistant-view.ts');
 const html=src('index.html');
 const main=src('src/main.ts');
 const styles=src('src/style.css');
 assert.match(main,/initAssistantView\(window\.temporaElectron/);
 assert.match(html,/id="view-assistant"/);
 assert.match(html,/id="assistant-sheet"/);
 assert.match(html,/id="assistant-columns"/);
 assert.match(html,/id="assistant-targets"/);
 assert.match(ui,/assistantSelectSheet/);
 assert.match(ui,/assistantClose/);
 assert.match(ui,/textContent/);
 assert.doesNotMatch(ui,/innerHTML|writeFileSync|fetch\(/);
 assert.match(styles,/\.assistant-columns/);
});

test('Assistant suggestion command stays host-only and profile-scoped',()=>{
 const main=src('electron/main.cjs');
 const preload=src('electron/preload.cjs');
 const session=src('electron/assistant-session.cjs');
 const pkg=require('../package.json');
 assert.match(main,/tempora:assistant:suggest/);
 assert.match(preload,/assistantSuggest/);
 assert.match(session,/suggestColumnMappings/);
 assert.match(session,/ASSIST_PROFILE_NOT_REGISTERED/);
 assert.match(session,/ASSIST_DELIMITER_CONFIRMATION_REQUIRED/);
 assert.ok(pkg.build.extraResources.some(x=>x.to==='assistant/framework/assist-mapping.js'));
 assert.ok(pkg.build.extraResources.some(x=>x.to==='assistant/profiles/synthetic-history/profile.json'));
});

test('Assistant confirmation remains in trusted Electron process',()=>{
 const main=src('electron/main.cjs'),preload=src('electron/preload.cjs');
 const view=src('src/assistant-view.ts'),html=src('index.html');
 assert.match(main,/tempora:assistant:confirm/);
 assert.match(preload,/assistantConfirm/);
 assert.match(view,/confirmed_by_user/);
 assert.match(view,/checkbox.checked=selections.has/);
 assert.match(view,/compiled=response/);
 assert.match(html,/assistant-bindings/);
 assert.match(html,/assistant-confirm-result/);
 assert.doesNotMatch(view,/writeFile|innerHTML|fetch\(/);
});

test('Assistant dry-run is host-owned, read-only and bundled in Electron',()=>{
 const main=src('electron/main.cjs'),preload=src('electron/preload.cjs');
 const view=src('src/assistant-view.ts'),html=src('index.html');
 const pkg=require('../package.json');
 assert.match(main,/tempora:assistant:dryrun/);
 assert.match(preload,/assistantDryRun/);
 assert.match(view,/batch_accepted/);
 assert.match(html,/assistant-normalization-preview/);
 assert.ok(pkg.build.extraResources.some(r=>r.to==='assistant/framework/assist-preview.js'));
 assert.ok(pkg.build.extraResources.some(r=>r.to==='assistant/framework/assist-normalization.js'));
 assert.doesNotMatch(view,/writeFileSync|innerHTML/);
});

test('Assistant canonical preview is a read-only host/worker operation and never an acceptance',()=>{
 const main=src('electron/main.cjs'),preload=src('electron/preload.cjs');
 const worker=src('bridge/worker.cjs'),ui=src('src/assistant-view.ts');
 const smoke=src('electron/tests/packaged-engine-smoke.cjs');
 assert.match(main,/tempora:assistant:canonical-preview/);
 assert.match(main,/assistantSessions\.canonicalInput/);
 assert.match(main,/dialog\.showOpenDialog/);
 assert.match(main,/enginePayload\('ingestion\.preview'/);
 assert.match(preload,/assistantCanonicalPreview/);
 assert.match(worker,/ingestion\.preview\(/);
 assert.match(worker,/acceptance_enabled:false/);
 assert.doesNotMatch(worker,/ingestion\.accept\(/);
 assert.match(smoke,/PACKAGED_TEMPORA_CANONICAL_PREVIEW_NO_ACCEPTANCE_OK/);
 assert.match(ui,/canonical\.summary\.conflict/);
 assert.doesNotMatch(ui,/acceptImport|writeFileSync|innerHTML/);
});

test('Assistant staging review is host-controlled, one-shot and never a filesystem write',()=>{
 const main=src('electron/main.cjs'),preload=src('electron/preload.cjs');
 const worker=src('bridge/worker.cjs'),view=src('src/assistant-view.ts');
 const html=src('index.html'),smoke=src('electron/tests/packaged-engine-smoke.cjs');
 assert.match(main,/tempora:assistant:review-stage/);
 assert.match(main,/claimCanonicalReview/);
 assert.match(main,/ASSIST_REVIEW_CORPUS_CHANGED/);
 assert.match(worker,/ingestion\.accept\(/);
 assert.match(worker,/saved_to_disk:false/);
 assert.doesNotMatch(worker,/writeFileSync|copyFileSync|appendFileSync|renameSync/);
 assert.match(preload,/assistantReviewStage/);
 assert.match(view,/reviewIds\.add/);
 assert.match(html,/id="assistant-reviewer"/);
 assert.match(html,/id="assistant-reviewed-at"/);
 assert.match(smoke,/PACKAGED_TEMPORA_IN_MEMORY_STAGING_REVIEW_OK/);
});
