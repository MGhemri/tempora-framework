'use strict';
// TVRW read-only scientific projections. Not a historical truth engine.
// Results are canonical records or declared fields only, never inferred relations.
// This is an INTERNAL Desktop module: no new public SDK API or IPC.
const {canonical}=require('tempora-framework');
const {projection,refKey}=require('./contracts.cjs');
const {applyFacets}=require('./facets.cjs');

const COLLECTIONS=Object.freeze({
  geo:'spatial_assertions',graph:'relations',chronos:'events',
  evidence:'claims',pattern:'events',observatory:'events'
});
const PAGE_LIMIT=100;
const MAX_SCAN=100000;
function bad(code) {const e=new Error(code);e.code=code;throw e;}
function items(c,k) {return Array.isArray(c[k])?c[k]:[];}
function label(x){
  const t=x?.title ?? x?.label ?? x?.name;
  if(typeof t==='string')return t.slice(0,180);
  if(t && typeof t==='object'){
    const first=Object.keys(t).sort().find(k=>typeof t[k]==='string');
    return first?t[first].slice(0,180):null;
  }
  return null;
}
function r(x){
  if(!x || typeof x!=='object')return null;
  if(typeof x.kind!=='string'||typeof x.namespace!=='string'||typeof x.id!=='string')return null;
  return {kind:x.kind,namespace:x.namespace,id:x.id};
}
function recordRef(x){return r(x);}
function key(x){const ref=r(x);return ref?refKey(ref):null;}
function sortRecords(list){return [...list].sort((a,b)=>{
  const x=key(a)??'',y=key(b)??'';
  return x<y?-1:x>y?1:0;
});}
function cutText(s,max=200){return typeof s==='string'?s.slice(0,max):null;}
function summaryCounts(c){
  const out={};
  for(const k of ['events','sources','claims','entities','spatial_assertions','relations','reviews','assessments','releases'])out[k]=items(c,k).length;
  return out;
}
function deriveRow(module,item,c){
  const identity=recordRef(item);
  if(module==='chronos')return {
    ref:identity,label:label(item),event_type:item.event_type??[],
    start_date:item.start_date??null,end_date:item.end_date??null,
    editorial_status:item.editorial_status??null,
    spatial_refs:item.spatial_refs??[],participant_refs:item.participant_refs??[]
  };
  if(module==='geo')return {
    ref:identity,subject:r(item.subject),geometry:item.geometry??null,
    crs:item.crs??null,geometry_role:item.geometry_role??null,
    precision_meters:item.precision_meters??null,
    reference_version:item.reference_version??null,
    provenance:item.provenance??null
  };
  if(module==='graph')return {
    ref:identity,source:r(item.subject),target:r(item.object),
    predicate:cutText(item.predicate),valid_from:item.valid_from??null,
    valid_to:item.valid_to??null,provenance:item.provenance??null,
    edge_origin:'declared_relation'
  };
  if(module==='evidence')return {
    ref:identity,subject:r(item.subject),predicate:cutText(item.predicate),
    assertion_status:item.assertion_status??null,
    evidence_declared:Array.isArray(item.provenance?.evidence)?item.provenance.evidence:[],
    contradicts:Array.isArray(item.contradicts)?item.contradicts:[],
    independence:'unknown'
  };
  if(module==='pattern')return {
    ref:identity,label:label(item),event_type:item.event_type??[],
    // Catalog baseline only. No similarity/clustering performed.
    analysis_status:'not_computed',candidate_links:[]
  };
  if(module==='observatory')return {
    ref:identity,editorial_status:item.editorial_status??null,
    has_start_date:item.start_date!=null,
    has_spatial_reference:Array.isArray(item.spatial_refs)&&item.spatial_refs.length>0,
    // Availability of declared sources is not a measure of historical truth.
    declared_evidence_count:Array.isArray(item.provenance?.evidence)?item.provenance.evidence.length:0
  };
  bad('UNSUPPORTED_MODULE');
}
function build(corpus,options={}){
  if(!options || typeof options!=='object'||Array.isArray(options))bad('INVALID_OPTIONS');
  const {module,offset=0,limit=50,facet=null,generatedAt='2026-01-01T00:00:00Z'}=options;
  if(!Object.hasOwn(COLLECTIONS,module))bad('UNSUPPORTED_MODULE');
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>PAGE_LIMIT)bad('INVALID_PAGE');
  if(!corpus || typeof corpus!=='object'||Array.isArray(corpus))bad('INVALID_CORPUS');
  const valid=canonical.validateCorpus(corpus);
  if(!valid.valid)bad('CORPUS_NOT_VALIDATED');
  const collection=COLLECTIONS[module];
  const raw=items(corpus,collection);
  if(raw.length>MAX_SCAN)bad('LIMIT_EXCEEDED');
  const scoped=facet===null?{records:raw,facets:null,unknownDatesExcluded:0}:applyFacets(raw,module,facet);
  const ordered=sortRecords(scoped.records);
  const selected=ordered.slice(offset,offset+limit);
  const rows=selected.map(item=>deriveRow(module,item,corpus));
  // Offset is part of the scientific parameters; the caller can page
  // deterministically, without pretending a page contains an entire corpus.
  return projection({
    corpus,algorithm:{id:'tvrw.'+module+'.declared-records',
      version:'1.0.0',parameters:{collection,offset,limit,
        ...(scoped.facets!==null?{facet:scoped.facets}:{})}},
    mode:'validated',filters:{module,collection,offset,limit,
      ...(scoped.facets!==null?{facet:scoped.facets}:{})},
    totalMatched:ordered.length,
    result:rows,
    diagnostics:[
      ...(offset+limit<ordered.length?
        [{code:'PARTIAL_PAGE',severity:'warning',count:ordered.length-selected.length}]:[]),
      ...(scoped.unknownDatesExcluded?
        [{code:'TEMPORAL_UNKNOWN_EXCLUDED',severity:'info',count:scoped.unknownDatesExcluded}]:[])
    ],
    generatedAt
  });
}
module.exports=Object.freeze({build,COLLECTIONS,PAGE_LIMIT,MAX_SCAN,summaryCounts});
