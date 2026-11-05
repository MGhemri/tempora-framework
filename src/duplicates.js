// Similarities are review hints. They never change records, IDs or editorial status.
const defaults=Object.freeze({lexical_threshold:0.5,shared_place_threshold:0.25,nearby_km:10});
const {normalize,lexical,distance}=require('./shared/similarity');
function overlap(a,b){return a?.earliest&&b?.earliest?!(a.latest<b.earliest||b.latest<a.earliest):null;}
function pair(a,b,options=defaults){
  options={...defaults,...options};
  const names=o=>[...['fr','ar'].filter(lang=>o.title?.[lang]).map(language=>({value:o.title[language],language,kind:'title',source_ids:o.source_ids||[]})),
    ...(o.aliases||[]).map(alias=>({...alias,kind:'sourced_alias'}))];
  const comparisons=names(a).flatMap(left=>names(b).map(right=>({left,right,score:lexical(left.value,right.value)}))).sort((x,y)=>y.score-x.score);
  const best=comparisons[0],name=best?.score||0;
  const places=o=>o.locations.filter(l=>l.place_id).map(l=>l.place_id);
  const commonPlace=places(a).filter(id=>places(b).includes(id));
  const dates=overlap(a.start_date,b.start_date);
  if(name<options.lexical_threshold && !(name>=options.shared_place_threshold&&commonPlace.length&&dates===true))return null;
  const points=o=>o.locations.filter(l=>l.review_status==='reviewed'&&['exact_site','approximate_site'].includes(l.geometry_role)&&l.geometry?.type==='Point').map(l=>l.geometry.coordinates);
  const distances=points(a).flatMap(x=>points(b).map(y=>distance(x,y)));
  const km=distances.length?Math.min(...distances):null;
  const types=o=>o.event_type||[o.legacy?.type_action].filter(Boolean);
  const commonTypes=types(a).filter(t=>types(b).includes(t));
  return {ids:[a.id,b.id].sort(),classification:'candidate_only',
    factors:{title_trigram_similarity:Number(name.toFixed(4)),matched_names:best?{left:best.left,right:best.right}:null,
      alias_used:best?best.left.kind==='sourced_alias'||best.right.kind==='sourced_alias':false,start_intervals_overlap:dates,
      date_disagreement:dates===false,shared_source_ids:[...new Set((a.source_ids||[]).filter(id=>(b.source_ids||[]).includes(id)))].sort(),
      shared_place_ids:[...new Set(commonPlace)].sort(),shared_types:[...new Set(commonTypes)].sort(),
      reviewed_site_distance_km:km===null?null:Number(km.toFixed(3)),nearby_reviewed_sites:km===null?null:km<=options.nearby_km},
    review_cautions:[...(dates===false?['different_start_intervals']:dates===null?['unknown_start_dates']:[]),...(km===null?['no_comparable_reviewed_sites']:[]),...(best?.left.kind==='sourced_alias'||best?.right.kind==='sourced_alias'?['alias_sources_require_review']:[])],
    requires_human_review:true};
}
function duplicateReport(operations,options={}){
  const parameters={...defaults,...options};
  for(const key of ['lexical_threshold','shared_place_threshold'])if(!Number.isFinite(parameters[key])||parameters[key]<0||parameters[key]>1)throw Error('Similarity thresholds must be in [0,1]');
  if(!Number.isFinite(parameters.nearby_km)||parameters.nearby_km<0)throw Error('Invalid distance threshold');
  const records=operations.filter(o=>['published','under_review','proposed'].includes(o.editorial_status)).sort((a,b)=>a.id.localeCompare(b.id));
  const candidates=[];
  for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){const c=pair(records[i],records[j],parameters);if(c)candidates.push(c);}
  return {algorithm:'sourced-names-trigrams-v2',parameters,record_count:records.length,
    notice:'Suggestions de revue, pas des doublons établis. Aucune fusion automatique.',candidates};
}
module.exports={normalize,lexical,pair,duplicateReport};
