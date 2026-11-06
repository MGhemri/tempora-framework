const groups={persons:'person',organizations:'organization',places:'place'};
const prefixes={person:'PER_',organization:'ORG_',place:'PLC_'};
function allEntities(corpus){return Object.keys(groups).flatMap(k=>corpus[k]||[]);}
function publicEntities(corpus){return allEntities(corpus).filter(e=>e.editorial_status==='published')
  .map(e=>({...e,relations:e.relations.filter(r=>r.type==='same_as')})).sort((a,b)=>a.id.localeCompare(b.id));}
function validateEntities(corpus,validateSchema,sourceIds,errors){
  const entities=new Map();
  for(const [group,kind]of Object.entries(groups))for(const e of corpus[group]||[]){
    if(!validateSchema(e)){errors.push(`Entity ${e?.id}: ${JSON.stringify(validateSchema.errors)}`);continue;}
    if(e.kind!==kind||!e.id.startsWith(prefixes[kind]))errors.push(`${e.id}: entity kind/directory mismatch`);
    if(entities.has(e.id))errors.push(`Duplicate entity: ${e.id}`);entities.set(e.id,e);
    const published=e.editorial_status==='published';
    if(![e.label.fr,e.label.ar].some(s=>s?.trim()))errors.push(`${e.id}: missing label`);
    for(const [lang,value]of Object.entries(e.label))if(value&&!e.names.some(n=>n.language===lang&&n.value===value))errors.push(`${e.id}: label must retain a documented name`);
    if(Date.parse(e.created_at)>Date.parse(e.updated_at))errors.push(`${e.id}: inverted editorial timestamps`);
    if(published&&(!e.source_ids.length||e.review_history.at(-1)?.decision!=='approved'))errors.push(`${e.id}: publication requires sources and approved review`);
    if(published)for(const r of e.review_history){
      try{if(!['http:','https:'].includes(new URL(r.reference).protocol))throw Error();}catch{errors.push(`${e.id}: unsafe review reference`);}
      if(!r.reviewer.trim()||!r.reason.trim()||Date.parse(r.reviewed_at)<Date.parse(e.created_at)||Date.parse(r.reviewed_at)>Date.parse(e.updated_at))errors.push(`${e.id}: inconsistent review`);
    }
    for(const id of e.source_ids)if(!sourceIds.has(id))errors.push(`${e.id}: missing source ${id}`);
    for(const n of e.names){
      if(!n.value.trim())errors.push(`${e.id}: empty name`);
      if(n.valid_from&&n.valid_to&&n.valid_from>n.valid_to)errors.push(`${e.id}: inverted name validity`);
      if(published&&!n.source_ids.length)errors.push(`${e.id}: published names require evidence`);
      for(const id of n.source_ids)if(!e.source_ids.includes(id))errors.push(`${e.id}: name evidence not among entity sources`);
    }
    if(kind!=='place'&&['geometry','geometry_role','geometry_source_ids'].some(k=>k in e))errors.push(`${e.id}: geometry belongs to places only`);
    if(kind==='place'){
      if(e.geometry && (!e.geometry_role||e.geometry_role==='unknown'||!e.geometry_source_ids?.length))errors.push(`${e.id}: geometry requires precision and evidence`);
      if(!e.geometry && e.geometry_role && e.geometry_role!=='unknown')errors.push(`${e.id}: absent geometry cannot claim precision`);
      for(const id of e.geometry_source_ids||[])if(!e.source_ids.includes(id))errors.push(`${e.id}: geometry evidence not among entity sources`);
    }
    if(published)for(const id of e.source_ids)if(!corpus.sources.find(s=>s.source_id===id)?.title?.trim())errors.push(`${e.id}: source needs a bibliographic title`);
  }
  for(const e of entities.values())for(const r of e.relations){
    const target=entities.get(r.target_id);
    if(!target||target.kind!==e.kind||target.id===e.id)errors.push(`${e.id}: invalid identity relation ${r.target_id}`);
    for(const id of r.source_ids)if(!e.source_ids.includes(id))errors.push(`${e.id}: relation evidence not among entity sources`);
    if(r.type==='same_as'){
      if(!r.source_ids.length||r.review_history.at(-1)?.decision!=='approved')errors.push(`${e.id}: same_as requires evidence and approved review`);
      if(e.editorial_status==='published'&&target?.editorial_status!=='published')errors.push(`${e.id}: public identity relation points to a draft`);
    }
  }
  return entities;
}
module.exports={groups,allEntities,publicEntities,validateEntities};
