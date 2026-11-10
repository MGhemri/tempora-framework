'use strict';
// Host-only pure adapter. Prepares a *read-only transport contract* after
// trusted SDK validation. Does not write, authorize a commit or expose IPC.
const {createHash}=require('node:crypto');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const HASH=/^[0-9a-f]{64}$/;
const FIELDS=['batch_id','source_sha256','base_sha256','mapping_sha256','output_sha256'];
const LIMIT=16*1024*1024;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function buildScientificTransport({sdk,corpus,journal,identity}={}){
 if(typeof sdk?.canonical?.validateCorpus!=='function'||
    typeof sdk?.canonical?.digest!=='function')
   fail('NATIVE_TRANSPORT_SDK_REQUIRED');
 if(!plain(corpus)||!plain(journal)||!plain(identity)||
    Object.keys(identity).length!==FIELDS.length||
    !FIELDS.every(k=>HASH.test(identity[k])))
   fail('NATIVE_TRANSPORT_IDENTITY_INVALID');
 const report=sdk.canonical.validateCorpus(corpus);
 if(report?.valid!==true||sdk.canonical.digest(corpus)!==identity.output_sha256)
   fail('NATIVE_TRANSPORT_CANONICAL_INVALID');
 if(journal.decision!=='accepted_for_local_staging'||
    journal.scientific_approval!==false||
    journal.batch_id!==identity.batch_id||
    journal.base_sha256!==identity.base_sha256||
    journal.output_sha256!==identity.output_sha256)
   fail('NATIVE_TRANSPORT_JOURNAL_INVALID');
 const corpusBytes=Buffer.from(JSON.stringify(corpus)+'\n');
 const journalBytes=Buffer.from(JSON.stringify(journal)+'\n');
 if(corpusBytes.length===0||journalBytes.length===0||
    corpusBytes.length>LIMIT||journalBytes.length>LIMIT)
   fail('NATIVE_TRANSPORT_DOCUMENT_LIMIT');
 const envelope={
  schema_version:'tempora-scientific-transport-v1',
  identity:{...identity},
  corpus_file_sha256:digest(corpusBytes),
  journal_file_sha256:digest(journalBytes),
  sdk_validated:true,
  scientific_approval:false,published:false
 };
 const envelopeBytes=Buffer.from(JSON.stringify(envelope)+'\n');
 return Object.freeze({
  // Returned buffers are a transport representation only, not a write
  // permission. No caller other than a trusted host should persist them.
  'corpus.json':corpusBytes,'journal.json':journalBytes,
  'envelope.json':envelopeBytes
 });
}
module.exports=Object.freeze({buildScientificTransport});
