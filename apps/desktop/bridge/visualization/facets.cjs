'use strict';
// Scoped research facets for declared canonical records only.
// Never infer date precision, add historical relations, or mutate original files.
const {ref,refKey}=require('./contracts.cjs');
const MODES=new Set(['possible-overlap','certain-only','declared-start']);
const STATUSES=new Set(['proposed','under_review','published','withdrawn','unspecified']);
const TEMPORAL_COLLECTIONS=new Set(['events','relations']);
function fail(code){const e=new Error(code);e.code=code;throw e;}
function plain(v){return v!==null && typeof v==='object' && !Array.isArray(v) &&
  (Object.getPrototypeOf(v)===Object.prototype || Object.getPrototypeOf(v)===null);}
function realDate(s){
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const [y,m,d]=s.split('-').map(Number);
  if(m<1||m>12||d<1)return false;
  const days=[31,(y%4===0&&(y%100!==0||y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
  return d<=days[m-1];
}
function normalizeFacets(facet,module){
  if(!plain(facet)||Object.keys(facet).some(k=>!['time','statuses','selectedRef'].includes(k)))
    fail('INVALID_FACET');
  const out={};
  if(facet.time!==undefined && facet.time!==null){
    if(!TEMPORAL_COLLECTIONS.has(module) && !['chronos','graph'].includes(module))fail('TEMPORAL_FILTER_UNSUPPORTED');
    const t=facet.time;
    if(!plain(t)||Object.keys(t).some(k=>!['mode','earliest','latest'].includes(k))||
      !MODES.has(t.mode)||!realDate(t.earliest)||!realDate(t.latest)||
      t.earliest>t.latest)fail('INVALID_TIME_FILTER');
    out.time={mode:t.mode,earliest:t.earliest,latest:t.latest};
  }
  if(facet.statuses!==undefined && facet.statuses!==null){
    if(!Array.isArray(facet.statuses)||facet.statuses.length>STATUSES.size||
      !facet.statuses.every(s=>STATUSES.has(s)))fail('INVALID_STATUS_FILTER');
    out.statuses=[...new Set(facet.statuses)].sort();
  }
  if(facet.selectedRef!==undefined&&facet.selectedRef!==null){
    out.selectedRef=ref(facet.selectedRef);
  }
  return out;
}
function dateBounds(record,module){
  const from=module==='chronos'||module==='events'?record.start_date:record.valid_from;
  const to=module==='chronos'||module==='events'?record.end_date:record.valid_to;
  if(!from||!to||from.kind==='unknown'||to.kind==='unknown')return null;
  if(!realDate(from.earliest)||!realDate(to.latest))return null;
  return {earliest:from.earliest,latest:to.latest,
    start:from,finish:to};
}
function timePass(record,module,t){
  const bounds=dateBounds(record,module);
  if(!bounds)return {pass:false,unknown:true};
  if(t.mode==='possible-overlap')
    return {pass:bounds.earliest<=t.latest&&bounds.latest>=t.earliest,unknown:false};
  if(t.mode==='certain-only')
    return {pass:bounds.earliest>=t.earliest&&bounds.latest<=t.latest,unknown:false};
  // Exact declared-start only: a year or uncertain interval cannot be
  // silently coerced to the first day of that year.
  const start=bounds.start;
  const certain=start.kind==='exact'&&start.precision==='day'&&
    start.earliest===start.latest;
  return {pass:certain&&start.earliest>=t.earliest&&start.latest<=t.latest,
    unknown:!certain};
}
function applyFacets(records,module,facet){
  const f=normalizeFacets(facet,module);
  const selected=f.selectedRef?refKey(f.selectedRef):null;
  let unknownDatesExcluded=0;
  const out=records.filter(item=>{
    if(f.statuses&&(!f.statuses.length||!f.statuses.includes(item.editorial_status)))return false;
    // Direct typed record identity only, no unreviewed neighboring relation.
    if(selected && refKey({kind:item.kind,namespace:item.namespace,id:item.id})!==selected)return false;
    if(f.time){
      const verdict=timePass(item,module,f.time);
      if(verdict.unknown)unknownDatesExcluded++;
      return verdict.pass;
    }
    return true;
  });
  return {records:out,facets:f,unknownDatesExcluded};
}
module.exports=Object.freeze({normalizeFacets,applyFacets,realDate});
