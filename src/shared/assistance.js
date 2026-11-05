(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory();else globalThis.ALNOPAssistance=factory();})(function(){
'use strict';
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
const exact=v=>JSON.stringify(canonical(v));
function overlap(a,b){return a?.earliest&&a.latest&&b?.earliest&&b.latest?!(a.latest<b.earliest||b.latest<a.earliest):null;}
function contextKnown(c){return c&&c.scope?.trim()&&c.population?.trim()&&['entire_event','specific_period'].includes(c.time_scope);}
function compareClaims(a,b,{languages:locales=['fr','ar']}={}){
  const base={claim_ids:[a.id,b.id].sort(),subject:a.subject,predicate:a.predicate,requires_human_review:true,
    values:[{claim_id:a.id,value:a.value,unit:a.unit||null,evidence:a.evidence},{claim_id:b.id,value:b.value,unit:b.unit||null,evidence:b.evidence}]};
  let reason;
  if(a.subject!==b.subject||a.predicate!==b.predicate)reason='different_subject_or_predicate';
  else if(a.contradicts.includes(b.id)||b.contradicts.includes(a.id))reason='already_recorded';
  else if(!contextKnown(a.context)||!contextKnown(b.context))reason='context_not_recorded';
  else if(exact(a.context)!==exact(b.context))reason='different_context';
  else if(a.value===null||b.value===null)reason='unknown_value';
  else if(a.unit&&b.unit&&a.unit!==b.unit)reason='different_units';
  else{
    const interval=v=>typeof v==='number'?[v,v]:v?.type==='interval'?[v.lower,v.upper]:null,x=interval(a.value),y=interval(b.value);
    if(x&&y){
      if(!a.unit||!b.unit)reason='unit_not_recorded';
      else if(a.unit!==b.unit)reason='different_units';
      else if(x[0]===y[0]&&x[1]===y[1])reason='same_value';
      else if(x[1]>=y[0]&&y[1]>=x[0])reason='compatible_precision';
      else reason='potential_value_conflict';
    }else if(typeof a.value==='boolean'&&typeof b.value==='boolean')reason=a.value===b.value?'same_value':'potential_value_conflict';
    else if(a.value&&b.value&&typeof a.value==='object'&&typeof b.value==='object'&&!x&&!y){
      const languages=locales.filter(lang=>typeof a.value[lang]==='string'&&typeof b.value[lang]==='string');
      reason=!languages.length?'no_shared_language':languages.every(lang=>a.value[lang]===b.value[lang])?'same_value':'text_difference_to_review';
    }else reason='different_value_types';
  }
  return {...base,reason,is_candidate:['potential_value_conflict','text_difference_to_review','context_not_recorded','unit_not_recorded','different_units','different_value_types','no_shared_language'].includes(reason)};
}
function conflicts(claims,{publishedOnly=false}={}){
  const active=claims.filter(c=>(publishedOnly?c.editorial_status==='published':['published','under_review','proposed'].includes(c.editorial_status))&&c.status!=='withdrawn').sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),groups=new Map();
  for(const c of active){const key=exact([c.subject,c.predicate]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
  const comparisons=[];for(const list of groups.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)comparisons.push(compareClaims(list[i],list[j]));
  return {algorithm:'claim-context-v1',notice:'Candidates require contextual source review; no assertion is changed.',comparisons};
}
function operationComparison(a,b){
  const shared=(left,right)=>[...new Set(left.filter(x=>right.includes(x)))].sort();
  return {ids:[a.id,b.id],start_intervals_overlap:overlap(a.start_date,b.start_date),
    shared_source_ids:shared(a.source_ids,b.source_ids),shared_territory_ids:shared(a.territorial_assignments.map(t=>t.territory_id),b.territorial_assignments.map(t=>t.territory_id)),
    notice:'Similarity, common sources and simultaneous events do not establish identity.'};
}
return {compareClaims,conflicts,operationComparison,canonical};
});
