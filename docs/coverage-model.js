(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory();else globalThis.ALNOPCoverage=factory();})(function(){
'use strict';
const keys=['total_operations','unique_sources','without_sources','without_identified_primary_source','uncertain_start_dates','uncertain_locations','without_structured_territory','operations_with_contested_claims','without_recorded_review'];
function report(operations,sources,claims,territories,filters={}){
  const published=operations.filter(o=>o.editorial_status==='published'),ids=new Set(published.map(o=>o.id));
  const publicClaims=claims.filter(c=>c.editorial_status==='published'&&ids.has(c.subject));
  const sourceMap=new Map(sources.map(s=>[s.source_id,s])),claimsMap=new Map();
  for(const c of publicClaims){if(!claimsMap.has(c.subject))claimsMap.set(c.subject,[]);claimsMap.get(c.subject).push(c);}
  function metrics(records){
    const result=Object.fromEntries(keys.map(k=>[k,0])),used=new Set();result.total_operations=records.length;
    for(const o of records){
      const related=claimsMap.get(o.id)||[],refs=new Set([...o.source_ids,...related.flatMap(c=>c.evidence.map(e=>e.source_id))]);for(const id of refs)used.add(id);
      if(!o.source_ids.length)result.without_sources++;
      const primary=[...refs].some(id=>{const s=sourceMap.get(id),r=s?.review_history?.at(-1);return s?.source_classification==='primary'&&s.review_status==='reviewed'&&r?.decision==='approved'&&/^[a-f0-9]{64}$/.test(r.content_sha256||'');});
      if(!primary)result.without_identified_primary_source++;
      if(o.start_date.precision!=='day'||o.start_date.certainty!=='documented')result.uncertain_start_dates++;
      if(!o.locations.length||o.locations.some(l=>!l.geometry||l.geometry_role!=='exact_site'||l.review_status!=='reviewed'))result.uncertain_locations++;
      if(!o.territorial_assignments.length)result.without_structured_territory++;
      if(related.some(c=>c.status==='contested'))result.operations_with_contested_claims++;
      if(!o.provenance.human_review_recorded)result.without_recorded_review++;
    }
    result.unique_sources=used.size;return result;
  }
  const groups={year:new Map(),territory:new Map(),type:new Map()};
  const put=(group,key,label)=>{if(!groups[group].has(key))groups[group].set(key,{key,label,records:[]});};
  const knownYears=published.map(o=>o.start_date.earliest?.slice(0,4)).filter(Boolean);
  let from=filters.from?Number(filters.from.slice(0,4)):Math.min(1954,...knownYears.map(Number)),to=filters.to?Number(filters.to.slice(0,4)):Math.max(1962,...knownYears.map(Number));
  if(from>to){if(filters.from&&!filters.to)to=from;else if(filters.to&&!filters.from)from=to;}
  const bounded=to-from<=200;
  const years=bounded?Array.from({length:Math.max(0,to-from+1)},(_,i)=>String(from+i).padStart(4,'0')):[...new Set(knownYears)].filter(y=>Number(y)>=from&&Number(y)<=to).sort();
  for(const year of years)put('year','year:'+year,{fr:year,ar:year});put('year','unknown',{fr:null,ar:null});
  for(const t of territories)put('territory','territory:'+t.id,t.names);put('territory','unassigned',{fr:null,ar:null});
  put('type','not_recorded',{fr:null,ar:null});
  for(const type of filters.type||[])put('type','type:'+type,{fr:type,ar:null});
  for(const o of published){
    const year=o.start_date.earliest?.slice(0,4),yearKey=year?'year:'+year:'unknown';put('year',yearKey,year?{fr:year,ar:year}:{fr:null,ar:null});groups.year.get(yearKey).records.push(o);
    const territoryIds=[...new Set(o.territorial_assignments.map(t=>t.territory_id))];
    if(!territoryIds.length)groups.territory.get('unassigned').records.push(o);
    for(const id of territoryIds){put('territory','territory:'+id,{fr:id,ar:null});groups.territory.get('territory:'+id).records.push(o);}
    const types=[...new Set(o.event_type||[o.legacy?.type_action].filter(Boolean))];
    if(!types.length)groups.type.get('not_recorded').records.push(o);
    for(const type of types){const key='type:'+type;put('type',key,{fr:type,ar:null});groups.type.get(key).records.push(o);}
  }
  const rows=Object.fromEntries(Object.entries(groups).map(([group,map])=>[group,[...map.values()].sort((a,b)=>group==='year'&&(a.key==='unknown'||b.key==='unknown')?(a.key==='unknown'?1:-1):a.key<b.key?-1:a.key>b.key?1:0).map(({key,label,records})=>({key,label,...metrics(records),note:records.length?null:'no_current_record'}))]));
  return {calculation_version:'coverage-v1',scope:'ALNOP documentary corpus only; not historical war coverage',corpus_is_incomplete:true,pending_contributions:null,
    summary:metrics(published),groups:rows,methodology:{year_domain:bounded?'inclusive_calendar_years':'observed_years_only',
      year_basis:'Recorded start year, not expansion across every year of an event.',
      group_totals_are_additive:{year:true,territory:false,type:false},
      primary_source_rule:'Explicit primary classification with recorded, content-bound review; legacy source labels are never inferred.',
      pending_contributions_status:'not_measured'}};
}
function csv(report,metadata,filters={},group='year'){
  if(!['year','territory','type'].includes(group))throw Error('Invalid coverage grouping');
  const headers=['snapshot_sha256','dataset_release','calculation_version','model_sha256','query_sha256','group_by','key','label_fr','label_ar',...keys,'row_note','group_totals_additive','source_counts_additive','pending_contributions','pending_status','filters','corpus_is_incomplete'];
  const cell=value=>{let v=String(value??'');if(/^[\s]*[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
  return '\uFEFF'+[headers,...report.groups[group].map(row=>[metadata.snapshot_sha256,metadata.dataset_release,report.calculation_version,metadata.model_sha256,metadata.query_sha256,group,row.key,row.label.fr,row.label.ar,...keys.map(k=>row[k]),row.note,report.methodology.group_totals_are_additive[group],false,null,'not_measured',JSON.stringify(filters),true])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
return {report,csv,keys};
});
