'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createPersistenceGate,TTL_MS}=require('../review-persistence-gate.cjs');
const A='a'.repeat(64),B='b'.repeat(64),HANDLE='c'.repeat(48);
function staged(){
 return {scope:'in_memory_staging_only',canonical_validated:true,
  scientific_approval:false,saved_to_disk:false,published:false,
  import_performed:false,persistence_required:true,
  batch_id:A,source_sha256:B,base_sha256:A,snapshot_sha256:B,
  journal:{decision:'accepted_for_local_staging',batch_id:A,
    base_sha256:A,output_sha256:B,scientific_approval:false}};
}
const expected=s=>({batch_id:s.batch_id,source_sha256:s.source_sha256,
 base_sha256:s.base_sha256,snapshot_sha256:s.snapshot_sha256});
test('an explicit independent confirmation is required; preview is not consent',()=>{
 const gate=createPersistenceGate(),s=staged();
 const token=gate.issue(HANDLE,s);
 assert.equal(token.saved_to_disk,false);
 assert.equal(token.confirmation_required,true);
 assert.throws(()=>gate.claim(HANDLE,token.token,false,expected(s)),
  {code:'PERSIST_GATE_CONFIRMATION_REQUIRED'});
 assert.throws(()=>gate.claim(HANDLE,token.token,true,expected(s)),
  {code:'PERSIST_GATE_EXPIRED'});
});
test('stage receipt with claimed persistence, publication or fake journal is rejected',()=>{
 const gate=createPersistenceGate(),s=staged();
 for(const change of [
   {saved_to_disk:true},{published:true},{scientific_approval:true},
   {snapshot_sha256:'x'.repeat(64)},
   {journal:{...s.journal,output_sha256:A}}
 ]) assert.throws(()=>gate.issue(HANDLE,{...s,...change}),{code:'PERSIST_GATE_STAGE_INVALID'});
});
test('one shot claim is bound to exact batch, base, source and output',()=>{
 const gate=createPersistenceGate(),s=staged(),token=gate.issue(HANDLE,s);
 assert.throws(()=>gate.claim(HANDLE,token.token,true,{...expected(s),batch_id:B}),
  {code:'PERSIST_GATE_STALE'});
 assert.throws(()=>gate.claim(HANDLE,token.token,true,expected(s)),
  {code:'PERSIST_GATE_EXPIRED'});
});
test('successful authorization cannot be replayed',()=>{
 const gate=createPersistenceGate(),s=staged(),token=gate.issue(HANDLE,s);
 const result=gate.claim(HANDLE,token.token,true,expected(s));
 assert.equal(result.persistence_confirmed,true);
 assert.equal(result.authorization_scope,'one_shot_host_save');
 assert.throws(()=>gate.claim(HANDLE,token.token,true,expected(s)),
  {code:'PERSIST_GATE_EXPIRED'});
});
test('cross-session access burns the token without granting authorization',()=>{
 const gate=createPersistenceGate(),s=staged(),token=gate.issue(HANDLE,s);
 assert.throws(()=>gate.claim('d'.repeat(48),token.token,true,expected(s)),
  {code:'PERSIST_GATE_EXPIRED'});
 assert.throws(()=>gate.claim(HANDLE,token.token,true,expected(s)),
  {code:'PERSIST_GATE_EXPIRED'});
});
test('a token expires, and closing a session revokes its pending save',()=>{
 let t=1000;const gate=createPersistenceGate({now:()=>t}),s=staged();
 const token=gate.issue(HANDLE,s);
 t+=TTL_MS;
 assert.throws(()=>gate.claim(HANDLE,token.token,true,expected(s)),
  {code:'PERSIST_GATE_EXPIRED'});
 const next=gate.issue(HANDLE,s);
 gate.revokeHandle(HANDLE);
 assert.throws(()=>gate.claim(HANDLE,next.token,true,expected(s)),
  {code:'PERSIST_GATE_EXPIRED'});
});
test('a new preview supersedes old pending confirmation for one session',()=>{
 const gate=createPersistenceGate(),s=staged(),old=gate.issue(HANDLE,s);
 const newer=gate.issue(HANDLE,s);
 assert.throws(()=>gate.claim(HANDLE,old.token,true,expected(s)),
  {code:'PERSIST_GATE_EXPIRED'});
 assert.equal(gate.claim(HANDLE,newer.token,true,expected(s)).persistence_confirmed,true);
});
