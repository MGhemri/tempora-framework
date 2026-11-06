import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const worker = fileURLToPath(new URL('../bridge/worker.cjs', import.meta.url));
const desktopPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url),'utf8'));
const request = (operation, payload={}, id='req_01') =>
  JSON.stringify({protocol_version:'1.0.0',request_id:id,operation,payload})+'\n';
const run = input => {
  const out=spawnSync(process.execPath,[worker],{input,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
  assert.ifError(out.error);
  assert.equal(out.status,0,out.stderr+'\n'+out.stdout);
  return out.stdout.trim().split('\n').map(JSON.parse);
};

test('Desktop worker pins the published TEMPORA Engine 3.0.0',() => {
  assert.equal(desktopPackage.dependencies['tempora-framework'],'3.0.0');
  const [health]=run(request('health'));
  assert.equal(health.ok,true);
  assert.equal(health.result.engine_version,'3.0.0');
  assert.deepEqual(health.result.capabilities,['health','corpus.validate','corpus.digest']);
});
test('Worker uses the genuine SDK for canonical corpus validation',() => {
  const [answer]=run(request('corpus.validate',{corpus:{}}));
  assert.equal(answer.ok,true);
  assert.equal(answer.result.valid,false);
  assert.ok(Array.isArray(answer.result.errors));
});
test('Worker returns stable SHA256 from the engine, not a duplicated algorithm',() => {
  const input=request('corpus.digest',{corpus:{b:2,a:1}});
  const [first]=run(input),[second]=run(input);
  assert.equal(first.ok,true);
  assert.match(first.result.sha256,/^[a-f0-9]{64}$/);
  assert.equal(first.result.sha256,second.result.sha256);
});
test('Unknown operation and invalid envelope are rejected without shell execution',() => {
  const [unknown,bad]=run(request('shell.execute',{command:'whoami'})+'{"nope":1}\n');
  assert.equal(unknown.ok,false);
  assert.equal(unknown.error.code,'UNSUPPORTED_OPERATION');
  assert.equal(bad.ok,false);
  assert.equal(bad.error.code,'INVALID_ENVELOPE');
});
test('Oversized incoming frames fail closed',() => {
  const input=request('corpus.validate',{corpus:{oversized:'x'.repeat(4*1024*1024)}});
  const out=spawnSync(process.execPath,[worker],{input,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
  assert.equal(out.status,1);
  assert.equal(JSON.parse(out.stdout.trim()).error.code,'FRAME_LIMIT');
});

test('Scientific workbench preserves canonical validation as the sole scientific authority',()=>{
  const rust=readFileSync(new URL('../src-tauri/src/engine_bridge.rs',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(rust,/overview: research_overview\(&corpus\)/);
  assert.match(rust,/invoke_worker\(\s*&message\("validation_01", "corpus\.validate"/);
  assert.match(rust,/items\.iter\(\)\.take\(20\)/);
  assert.match(ui,/function renderWorkbench\(\)/);
  assert.match(ui,/td\.textContent = value/);
  assert.match(html,/id="workbench-panel"/);
  assert.match(html,/id="workbench-claims"/);
});

test('Evidence navigation displays bounded references declared by the corpus',()=>{
 const rust=readFileSync(new URL('../src-tauri/src/engine_bridge.rs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(rust,/pub source_refs: Vec<String>/);
 assert.match(rust,/pub subject_ref: Option<String>/);
 assert.match(rust,/evidence\.iter\(\)\.take\(20\)/);
 assert.match(ui,/function showEvidenceLinks\(/);
 assert.match(ui,/event\.key === "Enter"/);
 assert.match(ui,/paragraph\.textContent = label/);
 assert.match(html,/id="workbench-evidence-detail"/);
});

test('Declared contradictions are rendered only from explicit corpus references',()=>{
 const rust=readFileSync(new URL('../src-tauri/src/engine_bridge.rs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(rust,/fn declared_contradictions\(/);
 assert.match(rust,/claim\.get\("contradicts"\)/);
 assert.match(rust,/preview\.len\(\) < 20/);
 assert.match(rust,/fn only_explicit_contradictions_are_listed_and_unresolved_links_marked/);
 assert.match(ui,/overview\.contradictions/);
 assert.match(ui,/td\.textContent = value/);
 assert.match(html,/id="workbench-contradictions"/);
});

test('Canonical review records are read-only and human authorship must be explicit',()=>{
 const rust=readFileSync(new URL('../src-tauri/src/engine_bridge.rs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(rust,/fn declared_reviews\(/);
 assert.match(rust,/Some\("human"\)/);
 assert.match(rust,/items\.iter\(\)\.take\(20\)/);
 assert.match(rust,/fn human_review_dossier_never_promotes_automatic_agents_to_human/);
 assert.match(ui,/overview\.humanReviewCount/);
 assert.match(ui,/reviews\.replaceChildren\(\)/);
 assert.match(html,/id="workbench-reviews"/);
});

test('Human review draft remains noncanonical, manual, and bound to validated corpus',()=>{
  const ui=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(ui,/function buildReviewDraft\(/);
  assert.match(ui,/if \(!result\?\.valid\) return null/);
  assert.match(ui,/identifiers\.includes\(subjectId\)/);
  assert.match(ui,/document_type: "tempora\.review_draft"/);
  assert.match(ui,/approved: false/);
  assert.match(ui,/signed: false/);
  assert.match(ui,/corpus_sha256: result\.sha256/);
  assert.match(ui,/navigator\.clipboard\.writeText/);
  assert.doesNotMatch(ui,/invoke\([^)]*save.*review/i);
  for(const id of ['draft-reviewer','draft-subject','draft-method','draft-reason','draft-copy'])
    assert.ok(html.includes('id="'+id+'"'),id);
});
