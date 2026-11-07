'use strict';

// J1A — private, pure scientific projection contracts. This is NOT an IPC
// implementation and does not extend the published TEMPORA Framework API.
// Never mutate a canonical corpus, derive historical truth or accept paths.
const {canonical} = require('tempora-framework');

const PROJECTION_VERSION = '1.0.0';
const SELECTION_VERSION = '1.0.0';
const ENGINE_VERSION = '3.0.0';
const REF_KINDS = Object.freeze(['event','source','claim','entity','spatial','relation','review','assessment','release']);
const MODES = Object.freeze(['validated','unvalidated-preview']);
const SEVERITIES = Object.freeze(['info','warning','error']);
const TIME_MODES = Object.freeze(['certain-only','possible-overlap','declared-start']);
const MAX_REFS = 256;
const MAX_DIAGNOSTICS = 200;
const MAX_RESULT_BYTES = 256 * 1024;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;
const SHA = /^[a-f0-9]{64}$/;

class ProjectionError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProjectionError';
    this.code = code;
  }
}

function fail(code) { throw new ProjectionError(code); }
function plain(value) { return value !== null && typeof value === 'object' &&
  !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype ||
  Object.getPrototypeOf(value) === null); }
function knownOnly(obj, keys) {
  if (!plain(obj) || Object.keys(obj).some(key => !keys.includes(key))) fail('INVALID_ENVELOPE');
}
function identifier(s) {
  if (typeof s !== 'string' || !IDENTIFIER.test(s)) fail('INVALID_REFERENCE');
  return s;
}
function sha(s) {
  if (typeof s !== 'string' || !SHA.test(s)) fail('INVALID_DIGEST');
  return s;
}
function ref(input) {
  knownOnly(input,['kind','namespace','id']);
  if (!REF_KINDS.includes(input.kind)) fail('INVALID_REFERENCE');
  return Object.freeze({
    kind:input.kind, namespace:identifier(input.namespace), id:identifier(input.id)
  });
}
function refKey(input) {
  const r = ref(input);
  // The tuple includes kind, namespace and ID, avoiding homonym collisions.
  return JSON.stringify([r.kind,r.namespace,r.id]);
}
function refs(value) {
  if (!Array.isArray(value) || value.length > MAX_REFS) fail('LIMIT_EXCEEDED');
  const dedup = new Map();
  for (const raw of value) {
    const typed = ref(raw);
    dedup.set(refKey(typed),typed);
  }
  return Object.freeze([...dedup.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>v));
}
function selection(input) {
  knownOnly(input,[
    'selection_schema_version','corpusKey','viewId','selectedRefs',
    'timeFilter','spatialFilter','predicateFilter','statusFilter',
    'language','evidenceFilter','algorithmContext','partialResult'
  ]);
  if (input.selection_schema_version !== SELECTION_VERSION) fail('UNSUPPORTED_SELECTION_SCHEMA');
  if (typeof input.corpusKey !== 'string' || !SHA.test(input.corpusKey)) fail('INVALID_DIGEST');
  const viewId=identifier(input.viewId);
  if (!['geo','graph','chronos','evidence','pattern','observatory'].includes(viewId)) fail('INVALID_VIEW');
  const lang=identifier(input.language);
  if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(lang)) fail('INVALID_LOCALE');
  if (typeof input.partialResult !== 'boolean') fail('INVALID_SELECTION');
  if (!plain(input.timeFilter)) fail('INVALID_FILTER');
  knownOnly(input.timeFilter,['mode','earliest','latest']);
  if (!TIME_MODES.includes(input.timeFilter.mode)) fail('INVALID_FILTER');
  for(const key of ['earliest','latest']) {
    const date=input.timeFilter[key];
    if(date!==null && (typeof date!=='string'|| !/^\d{4}-\d{2}-\d{2}$/.test(date))) fail('INVALID_FILTER');
  }
  if(input.timeFilter.earliest && input.timeFilter.latest &&
      input.timeFilter.earliest > input.timeFilter.latest) fail('INVALID_FILTER');
  // J1A permits no free-form spatial, filter or algorithm expressions.
  // These must be added as typed, versioned contracts in later PRs.
  for(const key of ['spatialFilter','predicateFilter','statusFilter','evidenceFilter','algorithmContext']) {
    if (input[key] !== null) fail('UNSUPPORTED_FILTER');
  }
  const clean={
    selection_schema_version:SELECTION_VERSION, corpusKey:input.corpusKey,
    viewId, selectedRefs:refs(input.selectedRefs), timeFilter:{
      mode:input.timeFilter.mode,earliest:input.timeFilter.earliest,
      latest:input.timeFilter.latest
    },
    spatialFilter:null,predicateFilter:null,statusFilter:null,
    language:lang,evidenceFilter:null,algorithmContext:null,
    partialResult:input.partialResult
  };
  // Own output; callers cannot modify the normalized selection.
  return Object.freeze({...clean,timeFilter:Object.freeze(clean.timeFilter)});
}
function diagnostics(input) {
  if(!Array.isArray(input)||input.length>MAX_DIAGNOSTICS) fail('LIMIT_EXCEEDED');
  return input.map(item=>{
    knownOnly(item,['code','severity','count']);
    if(typeof item.code!=='string' || !/^[A-Z][A-Z0-9_]{1,79}$/.test(item.code) ||
       !SEVERITIES.includes(item.severity)) fail('INVALID_DIAGNOSTIC');
    if(item.count!==undefined && (!Number.isSafeInteger(item.count)||item.count<0)) fail('INVALID_DIAGNOSTIC');
    return item.count===undefined?{code:item.code,severity:item.severity}:
      {code:item.code,severity:item.severity,count:item.count};
  }).sort((a,b)=>(a.code<b.code?-1:a.code>b.code?1:0)||
      (a.severity<b.severity?-1:a.severity>b.severity?1:0)||(a.count??0)-(b.count??0));
}
function jsonCopy(value) {
  let copied;
  try {copied=JSON.parse(canonical.stringify(value));} catch {fail('NONCANONICAL_JSON');}
  return copied;
}
function algorithm(input) {
  knownOnly(input,['id','version','parameters']);
  const id=identifier(input.id),version=identifier(input.version);
  if(!/^\d+\.\d+\.\d+$/.test(version)) fail('INVALID_ALGORITHM_VERSION');
  const parameters=jsonCopy(input.parameters);
  if(!plain(parameters)) fail('INVALID_PARAMETERS');
  return {id,version,parameters,parameters_sha256:canonical.digest(parameters)};
}
function projection(input) {
  knownOnly(input,['corpus','algorithm','mode','filters','totalMatched','result','diagnostics','generatedAt']);
  const corpus=input.corpus;
  if(!plain(corpus)||corpus.schema_version!=='3.0.0') fail('CORPUS_UNSUPPORTED_VERSION');
  const check=canonical.validateCorpus(corpus);
  if(input.mode!=='validated') {
    // J1A does NOT implement an unvalidated-preview projection or hidden
    // interpretation of invalid sources. Explicitly reject until a separate
    // preview-only contract has been reviewed.
    fail('UNSUPPORTED_PROJECTION_MODE');
  }
  if(!check.valid) fail('CORPUS_NOT_VALIDATED');
  const a=algorithm(input.algorithm);
  const filters=jsonCopy(input.filters);
  if(!plain(filters)) fail('INVALID_FILTER');
  const results=jsonCopy(input.result);
  if(!Array.isArray(results)) fail('INVALID_RESULT');
  if(!Number.isSafeInteger(input.totalMatched)||input.totalMatched<results.length) fail('INVALID_TOTAL');
  if(results.length>250) fail('LIMIT_EXCEEDED');
  const issues=diagnostics(input.diagnostics);
  const corpusHash=canonical.digest(corpus);
  const generatedAt=input.generatedAt;
  if(typeof generatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(generatedAt)||
     Number.isNaN(Date.parse(generatedAt))) fail('INVALID_TIMESTAMP');
  const body={
    projection_schema_version:PROJECTION_VERSION,
    algorithm:{id:a.id,version:a.version,parameters_sha256:a.parameters_sha256},
    corpus:{canonical_sha256:corpusHash,schema_version:'3.0.0',profile_id:corpus.profile.id},
    source:{engine_version:ENGINE_VERSION,generated_at:generatedAt,mode:'validated'},
    scope:{filters,total_matched:input.totalMatched,returned:results.length,
      truncated:input.totalMatched>results.length},
    diagnostics:issues,
    result:results
  };
  // Generated timestamp must not influence scientific reproducibility.
  const scientific= {
    projection_schema_version:body.projection_schema_version,
    algorithm:body.algorithm,corpus:body.corpus,
    engine_version:body.source.engine_version,mode:body.source.mode,
    scope:body.scope,diagnostics:body.diagnostics,result:body.result
  };
  body.scientific_sha256=canonical.digest(scientific);
  if(Buffer.byteLength(canonical.stringify(body),'utf8')>MAX_RESULT_BYTES) fail('RESPONSE_LIMIT');
  return body;
}

module.exports=Object.freeze({
  PROJECTION_VERSION,SELECTION_VERSION,REF_KINDS,ProjectionError,
  ref,refKey,refs,selection,diagnostics,projection
});
