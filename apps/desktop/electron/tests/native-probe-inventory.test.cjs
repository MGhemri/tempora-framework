'use strict';
// Real Windows process exits at native fsync/visibility boundaries.
// The inventory must report evidence without ever recovering or deleting it.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const sdk=require('tempora-framework');
const {buildScientificTransport}=require('../scientific-native-transport.cjs');
const binary=path.resolve(__dirname,
 '../../native-windows-guard/target/release/tempora-windows-guard.exe');
const windows=test.skip===undefined?test:test; // Portable test runner; Windows cases guard below.
function dir(t,prefix){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),prefix));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return root;
}
function run(args,env={}){
 return spawnSync(binary,args,{encoding:'utf8',timeout:15000,
  windowsHide:true,env:{...process.env,...env}});
}
function inspect(root){
 const report=run(['--inspect-probe',root]);
 assert.equal(report.status,0,report.stderr);
 return JSON.parse(report.stdout);
}
test('probe inventory starts empty and never mutates the target',t=>{
 if(process.platform!=='win32')return;
 const root=dir(t,'tempora-probe-inspect-');
 const before=fs.readdirSync(root);
 const report=inspect(root);
 assert.equal(report.schema_version,'tempora-native-probe-inventory-v1');
 assert.equal(report.lock_status,'absent');
 assert.equal(report.committed_verified,0);
 assert.equal(report.requires_manual_attention,false);
 assert.equal(report.inspected_only,true);
 assert.equal(report.files_modified,false);
 assert.equal(report.production_recovery_authorized,false);
 assert.deepEqual(fs.readdirSync(root),before);
});
test('native crash after owner reservation leaves orphaned lock and refuses replay',t=>{
 if(process.platform!=='win32')return;
 const root=dir(t,'tempora-probe-owner-');
 const crashed=run(['--synthetic-commit',root],{
  TEMPORA_NATIVE_SYNTHETIC_TEST:'1',TEMPORA_NATIVE_TEST_CRASH_POINT:'after_lock'});
 assert.equal(crashed.status,81,crashed.stderr);
 const report=inspect(root);
 assert.equal(report.lock_status,'reserved');
 assert.equal(report.committed_verified,0);
 assert.equal(report.pending_complete,0);
 assert.equal(report.pending_incomplete,0);
 assert.equal(report.requires_manual_attention,true);
 const blocked=run(['--synthetic-commit',root],{TEMPORA_NATIVE_SYNTHETIC_TEST:'1'});
 assert.equal(blocked.status,3);
 assert.equal(fs.existsSync(path.join(root,'.native-probe-lock','owner.txt')),true);
});
test('native crash after rename exposes verified result but keeps its writer lock',t=>{
 if(process.platform!=='win32')return;
 const root=dir(t,'tempora-probe-visible-');
 const crashed=run(['--synthetic-commit',root],{
  TEMPORA_NATIVE_SYNTHETIC_TEST:'1',TEMPORA_NATIVE_TEST_CRASH_POINT:'after_rename'});
 assert.equal(crashed.status,83,crashed.stderr);
 const report=inspect(root);
 assert.equal(report.committed_verified,1);
 assert.equal(report.pending_incomplete,0);
 assert.equal(report.lock_status,'reserved');
 assert.equal(report.requires_manual_attention,true);
 assert.equal(report.files_modified,false);
 assert.equal(fs.readdirSync(path.join(root,'native-probe-complete')).length,1);
});
test('partial SDK-transport write remains an incomplete candidate, never promoted',t=>{
 if(process.platform!=='win32')return;
 const root=dir(t,'tempora-probe-partial-'),source=dir(t,'tempora-probe-source-');
 const corpus=JSON.parse(fs.readFileSync(path.join(__dirname,
  '../../examples/synthetic-canonical-v3.json'),'utf8'));
 const digest=sdk.canonical.digest(corpus),H='a'.repeat(64);
 const identity={batch_id:H,source_sha256:'b'.repeat(64),
  base_sha256:'c'.repeat(64),mapping_sha256:'d'.repeat(64),output_sha256:digest};
 const journal={decision:'accepted_for_local_staging',batch_id:identity.batch_id,
  base_sha256:identity.base_sha256,output_sha256:digest,scientific_approval:false};
 const transport=buildScientificTransport({sdk,corpus,journal,identity});
 for(const [name,bytes] of Object.entries(transport))
  fs.writeFileSync(path.join(source,name),bytes,{flag:'wx'});
 const child=run(['--synthetic-transport-commit',root,source],{
  TEMPORA_NATIVE_SYNTHETIC_TEST:'1',TEMPORA_NATIVE_TEST_CRASH_POINT:'after_corpus'});
 assert.equal(child.status,82,child.stderr);
 const report=inspect(root);
 assert.equal(report.lock_status,'reserved');
 assert.equal(report.pending_incomplete,1);
 assert.equal(report.committed_verified,0);
 assert.equal(report.requires_manual_attention,true);
 assert.equal(report.production_recovery_authorized,false);
 assert.equal(fs.readdirSync(path.join(root,'native-probe-complete')).length,0);
});
test('reparse substitution and extraneous names are never marked clean',t=>{
 if(process.platform!=='win32')return;
 const root=dir(t,'tempora-probe-unsafe-');
 fs.mkdirSync(path.join(root,'.native-probe-pending'));
 fs.mkdirSync(path.join(root,'.native-probe-pending','not-a-transaction'));
 const report=inspect(root);
 assert.equal(report.unsafe_entries,1);
 assert.equal(report.requires_manual_attention,true);
 assert.equal(report.files_modified,false);
});
