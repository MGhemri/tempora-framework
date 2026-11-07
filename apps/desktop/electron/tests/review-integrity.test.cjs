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
  assert.match(draft,/navigator\.clipboard\.writeText/);
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
