import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../',import.meta.url);
const read=f=>readFileSync(new URL(f,base),'utf8');
test('Windows NSIS configuration must bundle engine resources and never expose generic shell',()=>{
 const conf=JSON.parse(read('src-tauri/tauri.windows.conf.json'));
 assert.deepEqual(conf.bundle.targets,['nsis']);
 assert.equal(conf.bundle.active,true);
 assert.equal(conf.bundle.resources['resources/engine/'],'engine/');
 assert.match(read('src-tauri/src/engine_bridge.rs'),/resource_dir\(\)/);
 assert.match(read('src-tauri/src/engine_bridge.rs'),/node\.exe/);
 assert.doesNotMatch(read('src-tauri/src/engine_bridge.rs'),/Command::new\(.*user/);
});
test('Windows staging requires pinned SDK and performs bundled-runtime smoke',()=>{
 const script=read('scripts/stage-windows-engine.mjs');
 assert.match(script,/tempora-framework@3\.0\.0/);
 assert.match(script,/windows_smoke/);
 assert.match(script,/sha256/);
 assert.doesNotMatch(script,/https?:\/\//);
});

test('Distribution qualification asserts installed GUI startup, lockfile integrity and npm audit',()=>{
 const stage=read('scripts/stage-windows-engine.mjs');
 const installed=read('scripts/verify-windows-install.ps1');
 assert.match(stage,/--audit-level=high/);
 assert.match(stage,/lock_sha256/);
 assert.match(stage,/dependencies:inventory/);
 assert.match(installed,/INSTALLED_LOCKFILE_DIGEST_MISMATCH/);
 assert.match(installed,/INSTALLED_TAURI_GUI_EXITED_EARLY/);
 assert.match(installed,/Get-AuthenticodeSignature/);
});
