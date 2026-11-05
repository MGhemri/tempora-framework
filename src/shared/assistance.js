const {canonical,exact,overlap,compareClaims}=require('../framework/claim-comparison');
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
module.exports={compareClaims,conflicts,operationComparison,canonical};
