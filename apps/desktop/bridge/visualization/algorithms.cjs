'use strict';
// TVRW deterministic research calculations. Derived/candidate data is NEVER
// a new canonical event, relation, historical fact, or human review.
const {canonical}=require('tempora-framework');
const {projection,refKey}=require('./contracts.cjs');
function fail(code){const e=new Error(code);e.code=code;throw e;}
function arr(c,k){return Array.isArray(c[k])?c[k]:[];}
function ref(r){return r&&typeof r==='object'&&['kind','namespace','id'].every(k=>typeof r[k]==='string')
  ?{kind:r.kind,namespace:r.namespace,id:r.id}:null;}
function key(r){const v=ref(r);return v?refKey(v):null;}
function title(r){const t=r?.title??r?.label??r?.name;if(typeof t==='string')return t;
  if(t&&typeof t==='object'){for(const k of Object.keys(t).sort())if(typeof t[k]==='string')return t[k];}
  return '';}
const CORE=['events','sources','claims','entities','spatial_assertions','relations','reviews','assessments','releases'];
const LIMIT=50;
function sort(rows){return rows.sort((a,b)=>{
  const x=JSON.stringify(a),y=JSON.stringify(b);return x<y?-1:x>y?1:0;
});}
function geo(c){
  let points=0,nonpoints=0,unknown=0,approximate=0;
  const results=[];
  for(const item of arr(c,'spatial_assertions')){
    const role=item.geometry_role??'unknown';
    if(role==='unknown')unknown++;
    if(role!=='exact_site')approximate++;
    const g=item.geometry;
    if(g?.type==='Point'&&Array.isArray(g.coordinates)){points++;}
    else nonpoints++;
    results.push({ref:ref(item),role,geometry_type:g?.type??null,
      precision_meters:item.precision_meters??null,calculation:'geometry_inventory'});
  }
  return {results,notes:{points,nonpoints,unknown,approximate}};
}
function graph(c){
  const map=new Map();
  const add=(r,side)=>{
    const k=key(r);if(!k)return;
    let v=map.get(k);if(!v){v={ref:r,in_degree:0,out_degree:0};map.set(k,v);}
    v[side]++;
  };
  for(const rel of arr(c,'relations')){add(rel.subject,'out_degree');add(rel.object,'in_degree');}
  return {results:[...map.values()],notes:{declared_relations:arr(c,'relations').length}};
}
function chronos(c){
  const results=[];
  for(const ev of arr(c,'events')){
    const start=ev.start_date??null,end=ev.end_date??null;
    results.push({ref:ref(ev),start_earliest:start?.earliest??null,
      end_latest:end?.latest??start?.latest??null,
      start_kind:start?.kind??null,end_kind:end?.kind??null,
      relation:'declared_bounds_only'});
  }
  return {results,notes:{unknown_dates:results.filter(x=>x.start_earliest===null).length}};
}
function evidence(c){
  const known=new Set(arr(c,'sources').map(s=>key(s)));
  const results=[];
  for(const claim of arr(c,'claims')){
    const raw=Array.isArray(claim.provenance?.evidence)?claim.provenance.evidence:[];
    const unique=new Set(raw.map(e=>key(e?.source)).filter(Boolean));
    let unresolved=0;for(const k of unique)if(!known.has(k))unresolved++;
    results.push({ref:ref(claim),entries:raw.length,distinct_declared_sources:unique.size,
      unresolved_declared_sources:unresolved,source_independence:'unknown',
      truth_assessment:'not_computed'});
  }
  return {results,notes:{claims_without_declared_evidence:results.filter(x=>x.entries===0).length}};
}
function trigrams(s){
  const units=Array.from(s.toLowerCase().normalize('NFC').trim().replace(/\s+/g,' '));
  if(units.length<3)return new Set(units.length?[units.join('')]:[]);
  return new Set(Array.from({length:units.length-2},(_,i)=>units.slice(i,i+3).join('')));
}
function pattern(c,threshold){
  if(typeof threshold!=='number'||!Number.isFinite(threshold)||threshold<0||threshold>1)
    fail('INVALID_THRESHOLD');
  const items=arr(c,'events');
  if(items.length>500)fail('PATTERN_SCAN_LIMIT');
  const prepared=items.map(x=>({ref:ref(x),title:title(x),set:trigrams(title(x))}));
  const results=[];
  for(let i=0;i<prepared.length;i++)for(let j=i+1;j<prepared.length;j++){
    const a=prepared[i],b=prepared[j];
    if(!a.set.size||!b.set.size)continue;
    let intersection=0;for(const t of a.set)if(b.set.has(t))intersection++;
    const union=a.set.size+b.set.size-intersection;
    const score=intersection/union;
    if(score>=threshold)results.push({left:a.ref,right:b.ref,
      score:Number(score.toFixed(6)),method:'trigram_jaccard',
      status:'candidate',evidence:'title_similarity_only',
      not_a_canonical_relation:true});
  }
  return {results,notes:{pair_count:items.length*(items.length-1)/2,threshold}};
}
function observatory(c){
  const results=CORE.map(collection=>({collection,count:arr(c,collection).length}));
  return {results,notes:{measurement:'corpus_documentation_only',
    historical_exhaustiveness:'unknown'}};
}
const HANDLERS=Object.freeze({geo,graph,chronos,evidence,pattern,observatory});
function analyze(corpus,{module,limit=LIMIT,threshold=0.6,generatedAt='2026-01-01T00:00:00Z'}={}){
  if(!Object.hasOwn(HANDLERS,module))fail('UNSUPPORTED_MODULE');
  if(!Number.isSafeInteger(limit)||limit<1||limit>LIMIT)fail('LIMIT_EXCEEDED');
  const valid=canonical.validateCorpus(corpus);
  if(!valid.valid)fail('CORPUS_NOT_VALIDATED');
  const calculation=module==='pattern'?pattern(corpus,threshold):HANDLERS[module](corpus);
  const rows=sort(calculation.results);
  return projection({
    corpus,algorithm:{id:'tvrw.'+module+'.deterministic',version:'1.0.0',
      parameters:{limit,...(module==='pattern'?{threshold}:{})}},
    mode:'validated',filters:{module,method:'deterministic'},
    totalMatched:rows.length,result:rows.slice(0,limit),
    diagnostics:rows.length>limit?[{code:'TRUNCATED',severity:'warning',count:rows.length-limit}]:[],
    generatedAt
  });
}
module.exports=Object.freeze({analyze,trigrams,HANDLERS});
