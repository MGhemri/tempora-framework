'use strict';
// Scientific safeguards of the shared GUI: no implicit endorsement by machine.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const src=readFileSync(join(__dirname,'..','..','src','main.ts'),'utf8');
const main=readFileSync(join(__dirname,'..','main.cjs'),'utf8');
const html=readFileSync(join(__dirname,'..','..','index.html'),'utf8');

test('Human review drafts cannot claim canonical approval or write to a corpus',()=>{
  const from=src.indexOf('function buildReviewDraft():');
  const to=src.indexOf('async function validateCorpus():',from);
  assert.ok(from>0&&to>from);
  const draft=src.slice(from,to);
  assert.match(draft,/if \(!result\?\.valid\) return null/);
  assert.match(draft,/if \(!identifiers\.includes\(subjectId\)\) return null/);
  assert.match(draft,/document_type: "tempora\.review_draft"/);
  assert.match(draft,/approved: false/);
  assert.match(draft,/signed: false/);
  assert.match(draft,/status: "draft"/);
  assert.match(draft,/corpus_sha256: result\.sha256/);
  assert.match(draft,/copyNativeReviewDraft\(JSON\.stringify\(draft, null, 2\)\)/);
  assert.doesNotMatch(draft,/invokeNative\s*\(|writeFile|fetch\s*\(/);
});
test('Scientific worker only allows health, corpus.validate, corpus.digest',()=>{
  assert.match(main,/engine\('health'/);
  assert.match(main,/engine\('corpus\.validate'/);
  assert.match(main,/engine\('corpus\.digest'/);
  assert.doesNotMatch(main,/ipcMain\.handle\(\s*['"]tempora:(?:write|delete|approve|publish)/);
  assert.match(main,/MAX_CORPUS_BYTES = 3 \* 1024 \* 1024/);
  assert.match(main,/MAX_PREVIEW_BYTES = 8 \* 1024 \* 1024/);
});
test('Research views exist in the same interface for both desktop backends',()=>{
  for(const view of ['view-overview','view-documents','view-research','view-models']) {
    assert.ok(html.includes(view),'missing '+view);
  }
  assert.match(html,/draft-reviewer/);
  assert.match(html,/draft-reason/);
  assert.match(html,/validate-corpus/);
});

test('Electron native clipboard accepts only human-authored unsigned draft records',()=>{
 const native=readFileSync(join(__dirname,'..','..','src','native.ts'),'utf8');
 const preload=readFileSync(join(__dirname,'..','preload.cjs'),'utf8');
 assert.match(native,/window\.temporaElectron\.copyReviewDraft\(draft\)/);
 assert.match(preload,/tempora:copy_review_draft/);
 assert.match(main,/ipcMain\.handle\('tempora:copy_review_draft', copyReviewDraft\)/);
 assert.match(main,/Buffer\.byteLength\(raw, 'utf8'\) > 16 \* 1024/);
 assert.match(main,/REVIEW_DRAFT_NOT_NONCANONICAL/);
 assert.match(main,/draft\.approved !== false/);
 assert.match(main,/draft\.signed !== false/);
 assert.match(main,/clipboard\.writeText\(raw\)/);
});
test('Research renderer forbids network and remote scripts by policy',()=>{
 assert.match(main,/webRequest\.onBeforeRequest/);
 assert.match(main,/scheme !== 'file:' && scheme !== 'data:'/);
 assert.match(html,/Content-Security-Policy/);
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/object-src 'none'/);
});
