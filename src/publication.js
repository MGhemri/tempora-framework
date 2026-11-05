const {stable,hash}=require('./canonical');
const initial=require('../migrations/legacy-initial.json');
const {toGeoJSON}=require('../api/v1/data-service');
const {publishedClaims,publicSources,claimsForOperation}=require('./claims');
const {publicEntities}=require('./entities');
function dateForV1(date){
  if(!date?.earliest)return null;
  if(date.precision==='day')return date.earliest;
  if(date.precision==='month')return date.earliest.slice(0,7);
  if(date.precision==='year')return date.earliest.slice(0,4);
  // A range cannot be expressed as an exact legacy date.
  return null;
}
function sourceForV1(source){
  if(source.legacy)return structuredClone(source.legacy);
  return {titre:source.title,auteur:source.author||null,url:source.url||null,
    type_source:source.document_type||'Non renseigné',...(source.locator?{localisation_passage:source.locator}:{})};
}
function operationForV1(op,corpus){
  const claims=claimsForOperation(op.id,corpus);
  const supplement=claims.length?{scientific_claims:claims}:{};
  if(op.provenance.publication_basis==='previously_public_legacy_corpus')return {...structuredClone(op.legacy),...supplement};
  const sources=new Map(corpus.sources.map(s=>[s.source_id,s]));
  const territories=new Map((corpus.territorial_units||[]).map(t=>[t.id,t]));
  const point=op.locations.length===1?op.locations[0].geometry:null;
  const coordinates=point?.type==='Point'?{latitude:point.coordinates[1],longitude:point.coordinates[0]}:{};
  return {...(op.legacy||{}),...supplement,id:op.id,nom_operation:op.title.fr,date_debut:dateForV1(op.start_date),
    date_fin:dateForV1(op.end_date),wilaya_concernee:op.territorial_assignments.length
      ?op.territorial_assignments.map(t=>territories.get(t.territory_id).names.fr).join(' ; '):op.legacy_territorial_label,
    localisation:{region_ou_ville:op.locations.map(l=>l.label).filter(Boolean).join(' ; ')||null,
      coordonnees_approximatives:coordinates},commandement_aln:op.commanders||op.legacy?.commandement_aln||[],type_action:op.event_type.join(' / '),
    description:op.description.fr,bilan_et_pertes:op.outcomes||op.legacy?.bilan_et_pertes||{},
    impact_strategique:op.strategic_impact?.fr??op.legacy?.impact_strategique??null,
    sources:op.source_ids.map(id=>sourceForV1(sources.get(id))),
    canonical_metadata:{schema_version:op.schema_version,title_ar:op.title.ar,start_date:op.start_date,end_date:op.end_date,
      locations:op.locations,territories:op.territorial_assignments.map(t=>({...t,names:territories.get(t.territory_id).names})),
      editorial_status:op.editorial_status,last_review:op.review_history.at(-1)||null}};
}
function publishedLegacy(corpus){
  const rank=new Map(corpus.metadata.legacy_order.map((id,index)=>[id,index]));
  const published=corpus.operations.filter(op=>op.editorial_status==='published')
    .sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity)||a.id.localeCompare(b.id));
  return {dataset_metadata:{...corpus.metadata.dataset_metadata,total_records:published.length},
    operations:published.map(op=>operationForV1(op,corpus))};
}
function publicArtifacts(corpus){
  const document=publishedLegacy(corpus);
  const geojson=toGeoJSON(document.operations);
  geojson.properties.generated_at='1954-1962 (Historical Corpus Publication)';
  const json=stable(document),geo=stable(geojson);
  return {'operations_fln_1954_1962.json':json,'operations_fln_1954_1962.geojson':geo,
    'docs/data/operations_fln_1954_1962.json':json,'docs/data/operations_fln_1954_1962.geojson':geo};
}
function originalIntegrity(corpus){
  const errors=[];
  if(JSON.stringify(corpus.metadata?.legacy_order)!==JSON.stringify(initial.operations.map(op=>op.id)))errors.push('Original ID order changed');
  if(JSON.stringify(corpus.metadata?.dataset_metadata)!==JSON.stringify(initial.dataset_metadata))errors.push('Original dataset metadata evidence changed');
  const byId=new Map(corpus.operations.map(op=>[op.id,op]));
  for(const original of initial.operations){
    const op=byId.get(original.id);
    if(!op){errors.push(`Missing original ID: ${original.id}`);continue;}
    if(JSON.stringify(op.legacy)!==JSON.stringify(original))errors.push(`${op.id}: original legacy evidence changed`);
    if(op.editorial_status!=='published')errors.push(`${op.id}: withdrawal requires a documented tombstone workflow`);
  }
  return errors;
}
function corpusFingerprint(corpus){
  const operations=corpus.operations.filter(op=>op.editorial_status==='published');
  const sources=publicSources(corpus);
  return hash(stable({operations:[...operations].sort((a,b)=>a.id.localeCompare(b.id)),
  sources:[...sources].sort((a,b)=>a.source_id.localeCompare(b.source_id)),
  territorial_units:corpus.territorial_units||[],vocabularies:corpus.vocabularies,metadata:corpus.metadata,
  claims:publishedClaims(corpus),entities:publicEntities(corpus)}));}
module.exports={dateForV1,operationForV1,publishedLegacy,publicArtifacts,originalIntegrity,corpusFingerprint};
