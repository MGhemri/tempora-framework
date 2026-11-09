'use strict';

// M1.5 privileged verification adapter. Never load this module in the renderer.
// An opaque consent token is not sufficient: re-read source and original
// corpus in the host, then recompute preview+accept with the pinned SDK.
// Storage is a separate, host-authorized operation.
const crypto=require('node:crypto');
const sdk=require('tempora-framework');
const HASH=/^[0-9a-f]{64}$/;
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a===b;
const fail=code=>{throw Object.assign(new Error(code),{code});};
function preparePersistence({bytes,corpus,mapping,sourceName,review,authorization}){
 if(sdk.ingestion?.preview===undefined||sdk.ingestion?.accept===undefined||
    !sdk.canonical?.validateCorpus||!sdk.canonical?.digest)
   fail('PERSIST_ENGINE_UNAVAILABLE');
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>128*1024||
    !corpus||typeof corpus!=='object'||Array.isArray(corpus)||
    !mapping||typeof mapping!=='object'||Array.isArray(mapping)||
    typeof sourceName!=='string'||!sourceName||sourceName.length>256||
    !review||typeof review!=='object'||Array.isArray(review)||
    !authorization||authorization.authorization_scope!=='one_shot_host_save'||
    authorization.persistence_confirmed!==true)
   fail('PERSIST_RECOMPUTE_INPUT_INVALID');
 const source_sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 if(!eq(authorization.source_sha256,source_sha256))fail('PERSIST_SOURCE_CHANGED');
 const valid=sdk.canonical.validateCorpus(corpus);
 if(!valid.valid)fail('PERSIST_BASE_INVALID');
 const base_sha256=sdk.canonical.digest(corpus);
 if(!eq(authorization.base_sha256,base_sha256))fail('PERSIST_BASE_CHANGED');
 const bundle=sdk.ingestion.preview({corpus,bytes,mapping,sourceName,observedAt:null});
 const report=bundle.report;
 if(!report||!HASH.test(report.batch_id)||!HASH.test(report.mapping?.sha256)||
    !eq(report.batch_id,authorization.batch_id)||
    !eq(report.base_sha256,authorization.base_sha256)||
    !eq(report.source.sha256,source_sha256))
   fail('PERSIST_PREVIEW_CHANGED');
 if(!Array.isArray(review.ids)||review.ids.length<1||review.ids.length>50||
    typeof review.reviewer!=='string'||typeof review.reason!=='string'||
    typeof review.reviewed_at!=='string')
   fail('PERSIST_REVIEW_INVALID');
 const selected=report.rows.filter(x=>x.status==='create').map(x=>x.id);
 if(new Set(review.ids).size!==review.ids.length||
    review.ids.some(id=>typeof id!=='string'||!selected.includes(id)))
   fail('PERSIST_REVIEW_STALE');
 const accepted=sdk.ingestion.accept({corpus,bundle,review:{
   batch_id:report.batch_id,ids:[...review.ids],
   reviewer:review.reviewer,reason:review.reason,reviewed_at:review.reviewed_at
 }});
 if(!accepted||accepted.kind!=='tempora-working-corpus'||
    accepted.journal?.decision!=='accepted_for_local_staging'||
    accepted.journal.scientific_approval!==false)
   fail('PERSIST_ACCEPT_INVALID');
 const output_sha256=sdk.canonical.digest(accepted.corpus);
 if(!sdk.canonical.validateCorpus(accepted.corpus).valid||
    !eq(accepted.journal.output_sha256,output_sha256)||
    !eq(output_sha256,authorization.snapshot_sha256)||
    !eq(accepted.journal.base_sha256,base_sha256)||
    !eq(accepted.journal.batch_id,report.batch_id))
   fail('PERSIST_OUTPUT_CHANGED');
 return Object.freeze({
   corpus:accepted.corpus,journal:accepted.journal,
   identity:Object.freeze({batch_id:report.batch_id,source_sha256,
     base_sha256,mapping_sha256:report.mapping.sha256,output_sha256})
 });
}
module.exports=Object.freeze({preparePersistence});
