'use strict';
// J8A: experimental, read-only, in-memory scientific segment catalog.
// Not a file parser, persistent database, IPC operation or large-corpus UI.
const {canonical}=require('tempora-framework');
const {ref,refKey}=require('./contracts.cjs');

const COLLECTIONS=Object.freeze([
  'events','sources','claims','entities','spatial_assertions',
  'relations','reviews','assessments','releases'
]);
const INDEX_VERSION='1.0.0';
const MAX_INPUT_BYTES=16*1024*1024;
const MAX_RECORDS=100000;
const MAX_SEGMENTS=512;
const SEGMENT_SIZE=256;
const MAX_PAGE_SIZE=100;

function fail(code){const error=new Error(code);error.code=code;throw error;}
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);}
function validArgs(options,allowed){
  if(!plain(options)||Object.keys(options).some(x=>!allowed.includes(x)))fail('INVALID_OPTIONS');
}
function digest(value){return canonical.digest(value);}
function buildSegmentIndex(corpus,options={}){
  validArgs(options,['collection','segmentSize']);
  const collection=options.collection??'events';
  const segmentSize=options.segmentSize??SEGMENT_SIZE;
  if(!COLLECTIONS.includes(collection))fail('INVALID_COLLECTION');
  if(!Number.isSafeInteger(segmentSize)||segmentSize<32||segmentSize>1024)
    fail('INVALID_SEGMENT_SIZE');
  if(!plain(corpus))fail('INVALID_CORPUS');
  let input;
  try{input=canonical.stringify(corpus);}catch{fail('INVALID_CORPUS');}
  if(Buffer.byteLength(input,'utf8')>MAX_INPUT_BYTES)fail('INDEX_INPUT_LIMIT');
  if(!canonical.validateCorpus(corpus).valid)fail('CORPUS_NOT_VALIDATED');
  const records=Array.isArray(corpus[collection])?corpus[collection]:[];
  if(records.length>MAX_RECORDS||Math.ceil(records.length/segmentSize)>MAX_SEGMENTS)
    fail('INDEX_RECORD_LIMIT');
  const corpusSha=digest(corpus);
  const entries=records.map((item,position)=>{
    const identity=ref({kind:item.kind,namespace:item.namespace,id:item.id});
    return Object.freeze({key:refKey(identity),ref:identity,position});
  });
  entries.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  // Duplicate canonical identities must never be silently merged.
  for(let i=1;i<entries.length;i++)
    if(entries[i].key===entries[i-1].key)fail('DUPLICATE_REFERENCE');
  const segments=[];
  for(let start=0;start<entries.length;start+=segmentSize){
    const batch=entries.slice(start,start+segmentSize);
    const ordinal=segments.length;
    const fingerprint=digest({
      version:INDEX_VERSION,corpus_sha256:corpusSha,collection,segment_size:segmentSize,
      ordinal,refs:batch.map(x=>x.ref)
    });
    segments.push(Object.freeze({
      ordinal,offset:start,count:batch.length,
      first_ref:batch[0].ref,last_ref:batch[batch.length-1].ref,
      scientific_sha256:fingerprint
    }));
  }
  const manifest=Object.freeze({
    index_schema_version:INDEX_VERSION,mode:'derived-read-only-volatile',
    corpus_sha256:corpusSha,collection,segment_size:segmentSize,
    total_records:entries.length,segment_count:segments.length,
    segments:Object.freeze(segments),
    // Describes this catalog only. Not a canonical corpus or historical claim.
    scientific_sha256:digest({
      version:INDEX_VERSION,corpus_sha256:corpusSha,collection,
      segment_size:segmentSize,total_records:entries.length,
      segment_sha256:segments.map(x=>x.scientific_sha256)
    })
  });
  return Object.freeze({manifest,entries:Object.freeze(entries)});
}
function readSegment(index,corpus,options={}){
  validArgs(options,['segment','offset','limit']);
  if(!index||!index.manifest||!Array.isArray(index.entries))fail('INVALID_INDEX');
  const segment=options.segment??0,offset=options.offset??0,limit=options.limit??50;
  if(!Number.isSafeInteger(segment)||segment<0||
    !Number.isSafeInteger(offset)||offset<0||
    !Number.isSafeInteger(limit)||limit<1||limit>MAX_PAGE_SIZE)
    fail('INVALID_PAGE');
  if(!plain(corpus))fail('INVALID_CORPUS');
  // Fail closed if a caller changes ANY canonical field after index creation.
  if(digest(corpus)!==index.manifest.corpus_sha256)fail('INDEX_STALE_CORPUS');
  const descriptor=index.manifest.segments[segment];
  if(!descriptor)fail('SEGMENT_NOT_FOUND');
  if(offset>descriptor.count)fail('INVALID_PAGE');
  const rows=index.entries.slice(descriptor.offset+offset,
    descriptor.offset+Math.min(descriptor.count,offset+limit))
    .map(entry=>({ref:entry.ref,record_index:entry.position}));
  const result={
    index_schema_version:INDEX_VERSION,
    corpus_sha256:index.manifest.corpus_sha256,
    index_scientific_sha256:index.manifest.scientific_sha256,
    collection:index.manifest.collection,
    segment,segment_scientific_sha256:descriptor.scientific_sha256,
    offset,returned:rows.length,segment_total:descriptor.count,
    partial:offset+rows.length<descriptor.count,
    rows
  };
  if(Buffer.byteLength(canonical.stringify(result),'utf8')>256*1024)
    fail('RESPONSE_LIMIT');
  return result;
}
module.exports=Object.freeze({
  buildSegmentIndex,readSegment,COLLECTIONS,INDEX_VERSION,
  MAX_INPUT_BYTES,MAX_RECORDS,MAX_SEGMENTS,SEGMENT_SIZE,MAX_PAGE_SIZE
});
