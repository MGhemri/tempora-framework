'use strict';
// Source-level stable-candidate contract. This is NOT a certification of a
// clean Windows VM, Authenticode signature, or Store publication.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../../..');
const load=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const desktop=JSON.parse(load('apps/desktop/electron/package.json'));
const frontend=JSON.parse(load('apps/desktop/package.json'));
const lock=JSON.parse(load('apps/desktop/electron/package-lock.json'));
const store=require('../store-appx.config.cjs');

test('all shipped Desktop 1.0.0 version identifiers agree',()=>{
 assert.equal(desktop.version,'1.0.0');
 assert.equal(frontend.version,'1.0.0');
 assert.equal(lock.version,desktop.version);
 assert.equal(lock.packages[''].version,desktop.version);
 const preload=load('apps/desktop/electron/preload.cjs');
 const index=load('apps/desktop/index.html');
 const renderer=load('apps/desktop/src/main.ts');
 assert.ok(preload.includes("desktopVersion: '"+desktop.version+"'"));
 assert.ok(index.includes('class="edition">1.0.0 / STABLE</span>'));
 assert.ok(index.includes('id="about-desktop-version">1.0.0</dd>'));
 assert.match(renderer,/edition\.textContent\s*=\s*.*STABLE/);
 assert.doesNotMatch(renderer,/edition\.textContent\s*=\s*.*BETA/);
});
test('Store upgrade retains package family and NSIS app identity',()=>{
 assert.equal(desktop.build.appId,'org.tempora.framework.desktop.chromium');
 assert.equal(desktop.build.appx.identityName,'GhemriM.TEMPORADesktop');
 assert.equal(desktop.build.appx.publisher,
  'CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455');
 assert.equal(desktop.build.appx.applicationId,'TEMPORADesktop');
 assert.equal(store.appx.identityName,desktop.build.appx.identityName);
 assert.equal(store.appx.publisher,desktop.build.appx.publisher);
 assert.equal(store.appx.applicationId,desktop.build.appx.applicationId);
 assert.equal(store.appx.publisherDisplayName,'Ghemri M');
 assert.deepEqual(store.win.target,['appx']);
 assert.deepEqual(desktop.build.win.target,['nsis']);
 assert.match(desktop.build.win.artifactName,/SETUP\.exe/);
 assert.match(store.appx.artifactName,/TEMPORA-Desktop-/);
});
test('scientific runtime and offline examples remain bundled',()=>{
 assert.equal(frontend.dependencies['tempora-framework'],'3.0.0');
 assert.equal(desktop.build.asar,true);
 assert.equal(desktop.build.extraResources.find(x=>x.to==='engine')?.from,
  '../src-tauri/resources/engine');
 assert.equal(desktop.build.extraResources.find(x=>x.to==='examples')?.from,
  '../examples');
 assert.ok(desktop.build.files.includes('local-save-access.cjs'));
 assert.ok(desktop.build.files.includes('preload.cjs'));
 assert.equal(lock.packages[''].devDependencies.electron,
  desktop.devDependencies.electron);
 assert.equal(lock.packages[''].devDependencies['electron-builder'],
  desktop.devDependencies['electron-builder']);
});
test('packaged scientific writes and automated publication remain forbidden',()=>{
 const {localSaveEnabled}=require('../local-save-access.cjs');
 for(const flag of [undefined,'1','true','0']){
  assert.equal(localSaveEnabled({isPackaged:true,
   env:{TEMPORA_EXPERIMENTAL_M15_SAVE:flag}}),false);
 }
 const host=load('apps/desktop/electron/main.cjs');
 assert.match(host,/localSaveEnabled\(\{isPackaged:app\.isPackaged/);
 const unsigned=load('.github/workflows/desktop-foundation.yml');
 const manualStore=load('.github/workflows/desktop-electron-microsoft-store-candidate.yml');
 const signed=load('.github/workflows/desktop-electron-signed-candidate.yml');
 for(const flow of [unsigned,manualStore,signed]){
  assert.doesNotMatch(flow,/gh release create|store publish|partnercenter.*upload/i);
 }
 assert.match(manualStore,/workflow_dispatch:/);
 assert.match(signed,/workflow_dispatch:/);
 assert.match(signed,/WINDOWS_CODE_SIGNING_CERTIFICATE_REQUIRED/);
 assert.match(signed,/forceCodeSigning=true/);
 assert.match(unsigned,/Get-FileHash/);
 assert.match(unsigned,/RELEASE-PROVENANCE\.json/);
 assert.match(unsigned,/SHA256SUMS\.txt/);
 assert.match(unsigned,/verify-release-evidence\.cjs electron\/release --both --source-sha/);
 const preflight=load('apps/desktop/electron/scripts/stable-windows-preflight.ps1');
 assert.match(preflight,/Get-AppxPackage/);
 assert.match(preflight,/Get-AuthenticodeSignature/);
 assert.match(preflight,/Get-FileHash/);
 assert.doesNotMatch(preflight,/Add-AppxPackage|Remove-AppxPackage|Start-Process|Invoke-WebRequest/);
});
