const {collections,digest,validateCorpus,validateObject}=require('./canonical');
const {object,select,strictJson}=require('./ingestion-formats');
const {idPattern}=require('./ingestion-mapping');
const {IngestionError,fail}=require('./ingestion-error');

const schemas={event:'event',source:'source',entity:'entity',claim:'claim',spatial:'spatial-assertion',relation:'relation'};
const collectionByKind=Object.fromEntries(Object.entries(collections).map(([collection,kind])=>[kind,collection]));
const diagnostic=(code,message)=>({code,message});

function appendRecord(corpus,record){
 corpus[collectionByKind[record.kind]].push(record);
}

function payload(row,mapping){
 let value=object(row.raw)?select(row.raw,mapping.fields.record):null;
 if(mapping.format==='csv'&&typeof value==='string'){
  try{value=strictJson(value);}catch(error){fail('ROW_CANONICAL_JSON','Canonical CSV cell must contain strict JSON',[diagnostic(error.code,error.message)]);}
 }
 if(!object(value))fail('ROW_CANONICAL_PAYLOAD','Mapped payload must be a canonical JSON object');
 return value;
}

function stageRecord(raw,row,mapping,namespace,inputSha,version){
 if(typeof raw.id!=='string'||!idPattern.test(raw.id))fail('ROW_ID','A valid explicit record identifier is required');
 if(!Object.hasOwn(schemas,raw.kind)||(mapping.record_kind!=='mixed'&&mapping.record_kind!==raw.kind))fail('ROW_CANONICAL_KIND','Record kind does not match the mapping');
 if(raw.namespace!==namespace)fail('ROW_NAMESPACE','Record namespace does not match the profile');
 if(raw.editorial_status!=='proposed'||raw.review_refs?.length)fail('ROW_EDITORIAL_STATUS','Imports must be proposed and carry no review references');
 if(object(raw.extensions)&&Object.hasOwn(raw.extensions,'ingestion'))fail('ROW_EXTENSION_RESERVED','Input cannot supply the ingestion extension');
 const checked=validateObject(schemas[raw.kind],raw);
 if(!checked.valid)fail('ROW_VALIDATION','Canonical payload failed validation',checked.errors);
 const record=structuredClone(raw);
 record.provenance.transformations.push({method:'tempora-ingestion',version,input_sha256:inputSha,source_path:row.source_path});
 record.extensions.ingestion={mapping_id:mapping.id,mapping_version:mapping.version,field_paths:structuredClone(mapping.fields),original:structuredClone(row.raw)};
 return record;
}

function fingerprint(record){
 const {extensions,provenance,...rest}=record;
 const {ingestion,...domain}=extensions;
 const imported=ingestion&&provenance.transformations.at(-1)?.method==='tempora-ingestion';
 const transformations=imported?provenance.transformations.slice(0,-1):provenance.transformations;
 return digest({...rest,extensions:domain,provenance:{...provenance,transformations}});
}

function previewRecords(rows,mapping,corpus,inputSha,version){
 const existing=new Map(Object.keys(collections).flatMap(key=>corpus[key].map(record=>[record.id,record])));
 const entries=[], groups=new Map(), invalid=new Set();
 for(const row of rows){
  const entry={index:row.index,line:row.line,source_path:row.source_path,id:null,status:'quarantined',diagnostics:structuredClone(row.errors),changed_fields:[]};
  entries.push(entry);
  if(entry.diagnostics.length)continue;
  try{
   const raw=payload(row,mapping);
   if(typeof raw.id==='string'&&idPattern.test(raw.id))entry.id=raw.id;
   try{digest(row.raw);}catch(error){fail('ROW_ORIGINAL_INVALID',error.message);}
   const record=stageRecord(raw,row,mapping,corpus.profile.namespace,inputSha,version);
   if(!groups.has(record.id))groups.set(record.id,[]);
   groups.get(record.id).push({entry,record,record_sha256:fingerprint(record)});
  }catch(error){
   if(!(error instanceof IngestionError))throw error;
   entry.diagnostics.push(diagnostic(error.code,error.message),...error.details);
   if(entry.id)invalid.add(entry.id);
  }
 }
 const pending=new Map();
 for(const [id,group] of groups){
  const first=group[0],previous=existing.get(id);
  const disagreement=new Set(group.map(item=>item.record_sha256)).size>1;
  for(const item of group){
   if(invalid.has(id)||disagreement){
    item.entry.status='conflict';
    item.entry.diagnostics.push(diagnostic(invalid.has(id)?'BATCH_ID_QUARANTINED_PEER':'BATCH_ID_CONFLICT','Rows sharing this identifier cannot be reconciled'));
   }else if(previous){
    item.entry.status=fingerprint(previous)===item.record_sha256?'unchanged':'conflict';
    if(item.entry.status==='conflict')item.entry.diagnostics.push(diagnostic('BASE_ID_CONTENT_CONFLICT','Existing record differs; automatic replacement is disabled'));
   }else pending.set(id,first);
  }
 }
 for(let pass=0;pending.size;pass++){
  if(pass===32)fail('BATCH_DEPENDENCY_LIMIT','Too many cascading invalid dependencies; split the import');
  const prospective={...corpus};
  for(const key of Object.keys(collections))prospective[key]=[...corpus[key]];
  for(const {record} of pending.values())appendRecord(prospective,record);
  const result=validateCorpus(prospective);
  if(result.valid){
   for(const warning of result.warnings)pending.get(warning.id)?.entry.diagnostics.push(warning);
   break;
  }
  const failures=new Map();
  for(const error of result.errors){
   if(!pending.has(error.id))fail('BATCH_CANONICAL_INVALID','Prospective corpus failed validation',result.errors);
   if(!failures.has(error.id))failures.set(error.id,[]);
   failures.get(error.id).push(error);
  }
  for(const [id,errors] of failures){
   for(const {entry} of groups.get(id))entry.diagnostics.push(...errors);
   pending.delete(id);
  }
 }
 const candidates=[];
 for(const {entry,record,record_sha256} of pending.values()){
  entry.status='create';
  candidates.push({index:entry.index,record_sha256,record});
  for(const duplicate of groups.get(record.id).slice(1)){
   duplicate.entry.status='unchanged';
   duplicate.entry.diagnostics.push(diagnostic('BATCH_EXACT_DUPLICATE','Equivalent mapped record already appears in this batch'));
  }
 }
 return {entries,candidates};
}

module.exports={appendRecord,previewRecords};
