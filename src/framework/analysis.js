const {assertCorpus, digest, identity}=require('./canonical');
const {temporalRelation}=require('./temporal');
const {lexical,distance}=require('../shared/similarity');
const {compareClaims}=require('../shared/assistance');

const algorithms={
  duplicates:'documented-event-similarity@1.0.0',
  entities:'documented-name-similarity@1.0.0',
  claims:'typed-claim-context@1.0.0',
  coverage:'observed-documentary-coverage@1.0.0'
};
const defaults={scope:'published',title_threshold:0.5,shared_place_threshold:0.25,entity_threshold:0.65,nearby_km:10,max_pairs:200000};
const sorted=values=>[...new Set(values)].sort();
const intersection=(a,b)=>sorted(a.filter(value=>b.includes(value)));
const sources=evidence=>sorted(evidence.map(item=>item.source.id));
const compare=(a,b)=>a<b?-1:a>b?1:0;
const pairCount=length=>length*(length-1)/2;

function parameters(options){
  if(Object.keys(options).some(key=>!Object.hasOwn(defaults,key)))throw Error('Unknown analysis parameter');
  const result={...defaults,...options};
  if(!['published','working'].includes(result.scope))throw Error('Invalid analysis scope');
  for(const key of ['title_threshold','shared_place_threshold','entity_threshold']){
    if(!Number.isFinite(result[key])||result[key]<=0||result[key]>1)throw Error('Similarity thresholds must be in (0,1]');
  }
  if(!Number.isFinite(result.nearby_km)||result.nearby_km<0)throw Error('Invalid proximity threshold');
  if(!Number.isSafeInteger(result.max_pairs)||result.max_pairs<1)throw Error('Invalid pair budget');
  return result;
}

function names(labels,evidence){
  return Object.entries(labels).sort(([a],[b])=>compare(a,b))
    .filter(([,value])=>typeof value==='string'&&value.trim())
    .map(([language,value])=>({language,value,source_ids:sources(evidence),role:'label'}));
}

function match(left,right){
  let best=null;
  for(const a of left)for(const b of right){
    const score=lexical(a.value,b.value);
    if(!best||score>best.score)best={left:a,right:b,score};
  }
  return best;
}

function boundsRelation(fromA,toA,fromB,toB){
  const first=temporalRelation(toA,fromB),second=temporalRelation(toB,fromA);
  if(first==='before')return 'before';
  if(second==='before')return 'after';
  if(fromA.earliest&&fromB.earliest&&toA.latest&&toB.latest)return 'possible_overlap';
  return 'indeterminate';
}

function proximity(left,right,limit){
  const eligible=site=>['exact_site','approximate_site'].includes(site.geometry_role)
    &&site.geometry?.type==='Point'&&site.precision_meters!==null;
  let closest=null;
  for(const a of left.filter(eligible))for(const b of right.filter(eligible)){
    const km=distance(a.geometry.coordinates,b.geometry.coordinates);
    const radius=(a.precision_meters+b.precision_meters)/1000;
    const lower=Math.max(0,km-radius),upper=km+radius;
    if(!closest||upper<closest.upper_km)closest={spatial_ids:[a.id,b.id],center_km:km,lower_km:lower,upper_km:upper,
      assessment:upper<=limit?'within_declared_radii':lower>limit?'outside_declared_radii':'uncertain'};
  }
  return closest;
}

function duplicatePair(a,b,options){
  const matched=match(a.names,b.names);
  const score=matched?.score??0;
  const date=temporalRelation(a.event.start_date,b.event.start_date);
  const places=intersection(a.places,b.places);
  const overlap=['overlap','contemporary'].includes(date);
  const sharedPlaceRule=score>=options.shared_place_threshold&&places.length>0&&overlap;
  if(score<options.title_threshold&&!sharedPlaceRule)return null;
  return {ids:[a.event.id,b.event.id],requires_human_review:true,
    rule:score>=options.title_threshold?'title_threshold':'title_with_shared_place_and_start_overlap',
    matched_names:matched,start_relation:date,
    span_relation:boundsRelation(a.event.start_date,a.event.end_date,b.event.start_date,b.event.end_date),
    shared_place_ids:places,shared_source_ids:intersection(a.sourceIds,b.sourceIds),
    shared_types:intersection(a.event.event_type,b.event.event_type),
    proximity:proximity(a.sites,b.sites,options.nearby_km)};
}

function entityNames(entity){
  const variants=entity.names.map(n=>({language:n.language,value:n.value,role:n.role,
    valid_from:n.valid_from,valid_to:n.valid_to,source_ids:sources(n.evidence)}));
  const fallback=names(entity.label,entity.provenance.evidence).filter(label=>
    !variants.some(n=>n.language===label.language&&n.value===label.value));
  return [...variants,...fallback];
}

function entityPair(a,b,threshold){
  const matched=match(a.names,b.names);
  if(!matched||matched.score<threshold)return null;
  const {left,right}=matched;
  return {ids:[a.entity.id,b.entity.id],entity_type:a.entity.entity_type,matched_names:matched,
    validity_relation:boundsRelation(left.valid_from??a.entity.valid_from,left.valid_to??a.entity.valid_to,
      right.valid_from??b.entity.valid_from,right.valid_to??b.entity.valid_to),
    shared_source_ids:intersection(left.source_ids,right.source_ids),requires_human_review:true};
}

function groupBy(items,key){
  const groups=new Map();
  for(const item of items){
    const value=key(item);
    if(!groups.has(value))groups.set(value,[]);
    groups.get(value).push(item);
  }
  return [...groups.values()];
}
function pairs(groups,calculate){
  const results=[];
  for(const group of groups)for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
    const result=calculate(group[i],group[j]);
    if(result)results.push(result);
  }
  return results;
}

function claimInput(claim){
  const context=claim.context;
  const complete=context?.time_scope!=='specific_period'||(
    context.start_date.earliest&&context.start_date.latest&&context.end_date.earliest&&context.end_date.latest
  );
  return {id:claim.id,subject:identity(claim.subject),predicate:claim.predicate,value:claim.value,unit:claim.unit,
    context:context&&complete?context:null,contradicts:claim.contradicts.map(ref=>ref.id),evidence:claim.provenance.evidence};
}

function claimPair(a,b,languages){
  const result=compareClaims(claimInput(a),claimInput(b),{languages});
  const supported=value=>value===null||['number','boolean'].includes(typeof value)
    ||value?.type==='interval'||(value&&typeof value==='object'&&!Array.isArray(value)
      &&Object.keys(value).length>0&&Object.entries(value).every(([language,text])=>
        languages.includes(language)&&(text===null||typeof text==='string')));
  if(result.reason!=='already_recorded'&&(!supported(a.value)||!supported(b.value))){
    return {...result,subject:a.subject,reason:'unsupported_value',is_candidate:false};
  }
  return {...result,subject:a.subject};
}

function coverage(events,claims,corpus,scope){
  const claimsByEvent=new Map();
  for(const claim of claims){
    if(claim.subject.kind!=='event')continue;
    if(!claimsByEvent.has(claim.subject.id))claimsByEvent.set(claim.subject.id,[]);
    claimsByEvent.get(claim.subject.id).push(claim);
  }
  const groups={period:new Map(),territory:new Map(),type:new Map(),language:new Map(),sources:new Map()};
  const window=corpus.profile.time.coverage;
  if(window.earliest&&window.latest){
    const from=Number(window.earliest.slice(0,4)),to=Number(window.latest.slice(0,4));
    for(let year=from;year<=to;year++)groups.period.set(String(year).padStart(4,'0'),[]);
  }
  for(const entity of corpus.entities){
    if(entity.entity_type==='territory'&&(entity.editorial_status==='unspecified'||visible(entity,scope))){
      groups.territory.set(entity.id,[]);
    }
  }
  for(const type of corpus.taxonomies.event_types??[])groups.type.set(type,[]);
  for(const language of corpus.profile.locales)groups.language.set(language,[]);
  for(const key of ['event_evidence','claim_evidence_only','no_recorded_evidence'])groups.sources.set(key,[]);

  const add=(group,key,eventId)=>{
    if(!group.has(key))group.set(key,[]);
    group.get(key).push(eventId);
  };
  for(const {event,sourceIds} of events){
    const {earliest,latest}=event.start_date;
    const period=earliest&&latest?(earliest.slice(0,4)===latest.slice(0,4)?earliest.slice(0,4):'multiple_years'):'unbounded_or_unknown';
    const related=claimsByEvent.get(event.id)??[];
    const territories=sorted(event.territory_refs.map(ref=>ref.id));
    const types=sorted(event.event_type);
    const languages=sorted([...Object.entries(event.title),...Object.entries(event.description)]
      .filter(([,value])=>value?.trim()).map(([lang])=>lang));
    add(groups.period,period,event.id);
    add(groups.sources,sourceIds.length?'event_evidence':related.some(c=>c.provenance.evidence.length)?'claim_evidence_only':'no_recorded_evidence',event.id);
    for(const key of territories.length?territories:[null])add(groups.territory,key,event.id);
    for(const key of types.length?types:[null])add(groups.type,key,event.id);
    for(const key of languages.length?languages:[null])add(groups.language,key,event.id);
  }
  const denominator=events.length;
  return {denominator,scope:'observed_corpus_density',group_totals_additive:{period:true,territory:false,type:false,language:false,sources:true},
    groups:Object.fromEntries(Object.entries(groups).map(([name,group])=>[name,[...group.entries()]
      .sort(([a],[b])=>a===b?0:a===null?-1:b===null?1:compare(a,b))
      .map(([key,event_ids])=>({key,count:event_ids.length,share:denominator?event_ids.length/denominator:null,event_ids}))])),
    bias_factors_to_review:['selection','preservation','digitization','contribution']};
}

function visible(record,scope){
  return scope==='published'?record.editorial_status==='published':
    ['published','proposed','under_review'].includes(record.editorial_status);
}

function eventSites(event,sites){
  return event.spatial_refs.map(ref=>sites.get(ref.id));
}

function compareEventSpaceTime(corpus,leftId,rightId,options={}){
  assertCorpus(corpus);
  const config=parameters(options);
  const [left,right]=[leftId,rightId].map(id=>corpus.events.find(e=>e.id===id&&visible(e,config.scope)));
  if(!left||!right||leftId===rightId)throw Error('Expected two distinct events in the selected scope');
  const sites=new Map(corpus.spatial_assertions.map(site=>[site.id,site]));
  return {version:'1.0.0',algorithm:'event-space-time@1.0.0',parameters:config,
    profile:{id:corpus.profile.id,version:corpus.profile.version,sha256:digest(corpus.profile)},
    corpus_sha256:digest(corpus),ids:[leftId,rightId],
    start_relation:temporalRelation(left.start_date,right.start_date),
    span_relation:boundsRelation(left.start_date,left.end_date,right.start_date,right.end_date),
    proximity:proximity(eventSites(left,sites),eventSites(right,sites),config.nearby_km)};
}

function analyze(corpus,options={}){
  assertCorpus(corpus);
  const config=parameters(options);
  const ordered=records=>records.filter(record=>visible(record,config.scope)).sort((a,b)=>compare(a.id,b.id));
  const sites=new Map(corpus.spatial_assertions.map(site=>[site.id,site]));
  const events=ordered(corpus.events).map(event=>{
    const locations=eventSites(event,sites);
    return {event,sites:locations,places:sorted(locations.filter(site=>site.place).map(site=>site.place.id)),
      sourceIds:sources(event.provenance.evidence),names:names(event.title,event.provenance.evidence)};
  });
  const entities=ordered(corpus.entities).map(entity=>({entity,names:entityNames(entity)}));
  const visibleSubjects=new Set([...events.map(r=>r.event),...entities.map(r=>r.entity),
    ...ordered(corpus.sources),...ordered(corpus.spatial_assertions),...ordered(corpus.relations),
    ...ordered(corpus.reviews),...ordered(corpus.assessments),...ordered(corpus.releases),
    ...ordered(corpus.claims).filter(claim=>claim.assertion_status!=='withdrawn')].map(identity));
  const claims=ordered(corpus.claims).filter(claim=>claim.assertion_status!=='withdrawn'&&visibleSubjects.has(identity(claim.subject)));
  const entityGroups=groupBy(entities,item=>item.entity.entity_type);
  const claimGroups=groupBy(claims,item=>JSON.stringify([identity(item.subject),item.predicate]));
  const compared=pairCount(events.length)+[...entityGroups,...claimGroups].reduce((n,g)=>n+pairCount(g.length),0);
  if(compared>config.max_pairs)throw Error(`Analysis needs ${compared} pairs, above the configured budget of ${config.max_pairs}`);
  return structuredClone({version:'1.0.0',algorithms:{...algorithms},parameters:config,
    profile:{id:corpus.profile.id,version:corpus.profile.version,namespace:corpus.profile.namespace,sha256:digest(corpus.profile)},
    corpus_sha256:digest(corpus),pair_count:compared,
    protocol:'within_one_profile_manual_review_candidates',
    limitations:['lexical_similarity_is_not_identity','declared_radii_are_not_verified_error_bounds','observed_counts_are_not_historical_frequencies'],
    population:{duplicates:events.map(r=>r.event.id),entities:entities.map(r=>r.entity.id),claims:claims.map(r=>r.id)},
    start_sequence:events.map(({event})=>({id:event.id,start_date:event.start_date})).sort((a,b)=>
      compare(a.start_date.earliest??'~',b.start_date.earliest??'~')||compare(a.id,b.id)),
    duplicates:pairs([events],(a,b)=>duplicatePair(a,b,config)),
    entities:pairs(entityGroups,(a,b)=>entityPair(a,b,config.entity_threshold)),
    claims:pairs(claimGroups,(a,b)=>claimPair(a,b,corpus.profile.locales)),
    coverage:coverage(events,claims,corpus,config.scope)});
}

function compareCoverage(previous,current){
  if(previous.profile.sha256!==current.profile.sha256||previous.parameters.scope!==current.parameters.scope
      ||previous.algorithms.coverage!==current.algorithms.coverage)throw Error('Coverage comparisons require the same profile, scope and method');
  const groups={};
  for(const [name,rows] of Object.entries(previous.coverage.groups)){
    const left=new Map(rows.map(r=>[r.key,r.count]));
    const right=new Map(current.coverage.groups[name].map(r=>[r.key,r.count]));
    groups[name]=[...new Set([...left.keys(),...right.keys()])].map(key=>{
      const before=left.get(key)??0,after=right.get(key)??0;
      return {key,before,after,change:after-before};
    });
  }
  return {algorithm:current.algorithms.coverage,profile:current.profile,scope:current.parameters.scope,
    previous:{corpus_sha256:previous.corpus_sha256,denominator:previous.coverage.denominator},
    current:{corpus_sha256:current.corpus_sha256,denominator:current.coverage.denominator},groups};
}

module.exports={analyze,compareCoverage,compareEventSpaceTime};
