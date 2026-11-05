const Ajv=require('ajv/dist/2020');
const {digest,validateObject}=require('./canonical');
const {temporal}=require('./temporal');
const {select,segments,reserved,object,strictJson}=require('./ingestion-formats');
const {fail}=require('./ingestion-error');
const schema=require('../../schemas/tempora.ingestion-mapping.schema.json');
const validate=new Ajv({strict:true,allErrors:true}).compile(schema);
const idPattern=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;
const blank=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim());
const reference=(kind,namespace,id)=>({kind,namespace,id});
function checkMapping(input,profile){
 try{digest(input);}catch(e){fail('MAPPING_INVALID',e.message);}
 if(!validate(input))fail('MAPPING_INVALID','Mapping does not match schema 1.0.0',structuredClone(validate.errors));
 const mapping=structuredClone(input),{fields,format}=mapping;
 if(mapping.profile_id!==profile.id||mapping.profile_version!==profile.version)fail('MAPPING_PROFILE_MISMATCH','Mapping belongs to a different profile or profile version');
 if((format!=='json'&&Object.hasOwn(mapping,'records_pointer'))||(format!=='csv'&&Object.hasOwn(mapping,'delimiter')))fail('MAPPING_INVALID','Format-specific mapping option is misplaced');
 if(Object.hasOwn(fields,'longitude')!==Object.hasOwn(fields,'latitude')||(fields.geometry&&fields.longitude))fail('MAPPING_INVALID','Declare one geometry field or both coordinate fields');
 if(fields.evidence&&fields.source_ids)fail('MAPPING_INVALID','Declare evidence or source_ids, not both');
 for(const key of ['title','description','location_label'])for(const language of Object.keys(fields[key]||{}))if(!profile.locales.includes(language))fail('MAPPING_LANGUAGE',`Language ${language} is not declared in the profile`);
 const pointers=[mapping.records_pointer??'',...Object.values(fields).flatMap(v=>typeof v==='string'?[v]:Object.values(v))];
 for(const p of pointers){const keys=segments(p);if(keys.length>24||keys.some(k=>reserved.has(k)))fail('MAPPING_POINTER','Unsafe or excessively deep JSON pointer');}
 return mapping;
}
const text=(value,field)=>{if(blank(value))return null;if(typeof value!=='string')fail('ROW_TEXT_TYPE',`${field} must be text`);return value;};
function list(value,field){
 if(blank(value))return [];
 const items=Array.isArray(value)?value:[value];if(items.some(v=>typeof v!=='string'||!v.trim()))fail('ROW_LIST_TYPE',`${field} must contain nonempty strings`);
 return items;
}
function decimal(value,field){
 if(blank(value))return null;
 if(typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())){const raw=value;value=Number(raw);if(value===0&&/[1-9]/.test(raw.split(/[eE]/)[0]))fail('ROW_NUMBER',`${field} is outside the supported numeric precision`);}
 if(typeof value!=='number'||!Number.isFinite(value)||(Number.isInteger(value)&&!Number.isSafeInteger(value)))fail('ROW_NUMBER',`${field} must be a finite decimal number`);
 return value;
}
function date(value,field){
 if(blank(value))return temporal(null);
 if(typeof value==='string'){try{return {...temporal(value.trim()),original:value};}catch{fail('ROW_DATE',`${field} is not a supported Gregorian date`);}}
 const result=validateObject('temporal-expression',value);if(!result.valid)fail('ROW_DATE',`${field} has invalid temporal bounds`,result.errors);
 return structuredClone(value);
}
function evidenceFor(raw,field,sourceIds,namespace){
 if(blank(raw))return [];
 const entries=field==='source_ids'?list(raw,field).map(source_id=>({source_id})):raw;
 if(!Array.isArray(entries))fail('ROW_EVIDENCE','Evidence must be a JSON array');
 const seen=new Set();return entries.map(e=>{
  if(!object(e)||typeof e.source_id!=='string'||!sourceIds.has(e.source_id))fail('ROW_SOURCE_UNKNOWN','Evidence must reference a source in the working corpus');
  if(Object.keys(e).some(k=>!['source_id','locator','quotation'].includes(k)))fail('ROW_EVIDENCE','Unexpected evidence field');
  const result={source:reference('source',namespace,e.source_id),locator:text(e.locator,'locator'),quotation:text(e.quotation,'quotation')};
  const key=digest(result);if(seen.has(key))fail('ROW_EVIDENCE_DUPLICATE','Duplicate evidence entry');seen.add(key);return result;
 });
}
function mapRecord(row,mapping,context){
 const {profile,inputSha,sourceIds,territoryIds,rules,version}=context,{namespace,default_locale}=profile,{fields}=mapping;
 try{digest(row.raw);}catch(e){fail('ROW_ORIGINAL_INVALID',e.message);}
 const get=key=>fields[key]===undefined?undefined:select(row.raw,fields[key]);
 const localized=key=>Object.fromEntries(Object.entries(fields[key]||{[default_locale]:null}).map(([lang,p])=>[lang,text(p===null?null:select(row.raw,p),`${key}.${lang}`)]));
 const id=text(get('id'),'id')?.trim();if(!id||!idPattern.test(id))fail('ROW_ID','A valid explicit record identifier is required');
 const title=localized('title');if(!Object.values(title).some(Boolean))fail('ROW_TITLE','A nonempty title in a mapped language is required');
 const start_date=date(get('start_date'),'start_date'),end_date=date(get('end_date'),'end_date');
 if(start_date.earliest&&end_date.latest&&start_date.earliest>end_date.latest)fail('ROW_DATE_ORDER','Event ends before its start');
 const event_type=list(get('event_type'),'event_type').map(value=>profile.aliases?.find(a=>a.taxonomy==='event_types'&&a.value===value)?.canonical??value);
 const ids=list(get('territory_ids'),'territory_ids');for(const id of ids)if(!territoryIds.has(id))fail('ROW_TERRITORY_UNKNOWN','Territory must exist in the working corpus');
 const evidenceField=fields.evidence?'evidence':'source_ids',evidence=evidenceFor(get(evidenceField),evidenceField,sourceIds,namespace);
 const transformations=[{method:'tempora-ingestion',version,input_sha256:inputSha,source_path:row.source_path}];
 const event={schema_version:'3.0.0',kind:'event',id,namespace,editorial_status:'proposed',title,description:localized('description'),start_date,end_date,event_type,
  provenance:{evidence,transformations},extensions:{ingestion:{mapping_id:mapping.id,mapping_version:mapping.version,field_paths:structuredClone(fields),original:structuredClone(row.raw)}},
  spatial_refs:[],territory_refs:ids.map(id=>reference('entity',namespace,id)),participant_refs:[],review_refs:[]};
 let geometry=get('geometry'),role=text(get('geometry_role'),'geometry_role');
 if(typeof geometry==='string'&&!blank(geometry)){try{geometry=strictJson(geometry);}catch{fail('ROW_GEOMETRY','Geometry cell does not contain valid JSON');}}
 const lon=decimal(get('longitude'),'longitude'),lat=decimal(get('latitude'),'latitude');
 if((lon===null)!==(lat===null))fail('ROW_COORDINATE_PAIR','Longitude and latitude must be supplied together');
 if(lon!==null)geometry={type:'Point',coordinates:[lon,lat]};
 if(typeof geometry==='string'&&blank(geometry))geometry=undefined;
 const label=localized('location_label'),precision_meters=decimal(get('precision_meters'),'precision_meters'),geocoding_method=text(get('geocoding_method'),'geocoding_method'),reference_version=text(get('reference_version'),'reference_version');
 const spatial=[];
 if(geometry!==undefined||Object.values(label).some(Boolean)||role||precision_meters!==null||geocoding_method||reference_version){
  geometry??=null;role??=geometry===null?'unknown':mapping.default_geometry_role??null;
  if(!role||(geometry===null)!==(role==='unknown'))fail('ROW_GEOMETRY_ROLE','Geometry requires an explicit matching role; null geometry uses unknown');
  const spatialId='ING_SPATIAL_'+digest([namespace,id]).slice(0,40);
  spatial.push({schema_version:'3.0.0',kind:'spatial',id:spatialId,namespace,editorial_status:'proposed',subject:reference('event',namespace,id),
   label:Object.values(label).some(Boolean)?label:null,geometry:structuredClone(geometry),crs:'EPSG:4326',geometry_role:role,precision_meters,geocoding_method,reference_version,place:null,
   provenance:{evidence:[],transformations:structuredClone(transformations)},extensions:{ingestion:{mapping_id:mapping.id,mapping_version:mapping.version}}});
  event.spatial_refs.push(reference('spatial',namespace,spatialId));
 }
 const failures=[...validateObject('event',event).errors,...spatial.flatMap(s=>validateObject('spatial-assertion',s).errors)];
 const checked=rules.validate({...event,territory_ids:ids});failures.push(...checked.diagnostics.filter(d=>d.severity==='error'));
 if(failures.length)fail('ROW_VALIDATION','Mapped record failed technical or profile validation',failures);
 const warnings=checked.diagnostics.filter(d=>d.severity!=='error');
 if(!evidence.length)warnings.push({code:'ROW_NO_EVIDENCE',severity:'warning',message:'No linked source; proposal requires documentary review'});
 return {event,spatial,warnings};
}
module.exports={checkMapping,mapRecord,idPattern};
