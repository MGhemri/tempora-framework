const fs=require('node:fs'),path=require('node:path');
const {root,stable}=require('../src/canonical');
function rewrite(value,owner='Operation'){
  if(Array.isArray(value))return value.map(v=>rewrite(v,owner));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['$id','$schema'].includes(k)).map(([k,v])=>[k,k==='$ref'?v.replace('https://alnop.vercel.app/schemas/operation.schema.json#','#/components/schemas/Operation').replace('https://alnop.vercel.app/schemas/operation.schema.json','#/components/schemas/Operation').replace(/^#\/\$defs\//,'#/components/schemas/'+owner+'/$defs/'):rewrite(v,owner)]));
  return value;
}
function document(){
  const ref=name=>({$ref:'#/components/schemas/'+name}),integer={type:'integer',minimum:0};
  const meta={type:'object',additionalProperties:false,required:['api_version','dataset_release','snapshot_sha256','corpus_is_incomplete'],properties:{
    api_version:{const:'v2'},dataset_release:{type:['string','null'],pattern:'^data-[0-9]{4}\\.(0[1-9]|1[0-2])\\.[1-9][0-9]*$'},snapshot_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},corpus_is_incomplete:{const:true},
    total:integer,count:integer,page:{type:'integer',minimum:1},limit:{type:'integer',minimum:1,maximum:200},has_next:{type:'boolean'},sort:{type:'string'},
    release_workflow_enabled:{type:'boolean'},notice:{type:'string'},manifest_url:{type:'string'},calculation_version:{const:'coverage-v1'},model_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},query_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}};
  const schemas={Meta:meta,CollectionMeta:{...meta,required:[...meta.required,'total','count','page','limit','has_next','sort']},
    Error:{type:'object',additionalProperties:false,required:['error'],properties:{error:{type:'object',additionalProperties:false,required:['code','message'],properties:{code:{type:'string'},message:{type:'string'}}}}}};
  for(const [name,file]of Object.entries({Operation:'operation',Source:'source',Entity:'entity',Claim:'claim',Territory:'territorial-unit',CoverageReport:'coverage-report'}))schemas[name]=rewrite(require('../schemas/'+file+'.schema.json'),name);
  const envelope=(data,collection=false)=>({type:'object',additionalProperties:false,required:['data','meta'],properties:{data,meta:ref(collection?'CollectionMeta':'Meta')}});
  for(const name of ['Operation','Source','Entity','Claim','Territory']){
    schemas[name+'Response']=envelope(ref(name));schemas[name+'Collection']=envelope({type:'array',items:ref(name)},true);
  }
  schemas.GeoJSON={type:'object',additionalProperties:false,required:['type','features','meta'],properties:{type:{const:'FeatureCollection'},meta:ref('CollectionMeta'),features:{type:'array',items:{type:'object',additionalProperties:false,required:['type','id','geometry','properties'],properties:{type:{const:'Feature'},id:{type:'string'},geometry:{oneOf:[{type:'null'},{type:'object',required:['type','coordinates'],properties:{type:{enum:['Point','MultiPoint']},coordinates:{type:'array'}}}]},properties:ref('Operation')}}}}};
  const counts={type:'object',additionalProperties:integer};
  schemas.Stats=envelope({type:'object',additionalProperties:false,required:['total_operations','total_sources','total_claims','by_start_year','by_start_precision','by_type'],properties:{total_operations:integer,total_sources:integer,total_claims:integer,by_start_year:counts,by_start_precision:counts,by_type:counts}});
  schemas.Coverage=envelope({type:'object',additionalProperties:false,required:['scope','total_operations','unknown_start_dates','without_geometry','without_structured_territory','without_sources','legacy_imports_needing_review','contested_claims','pending_contributions','by_start_year','empty_selection_message'],properties:{scope:{type:'string'},...Object.fromEntries(['total_operations','unknown_start_dates','without_geometry','without_structured_territory','without_sources','legacy_imports_needing_review','contested_claims'].map(k=>[k,integer])),pending_contributions:{type:'null'},by_start_year:counts,empty_selection_message:{type:['string','null']}}});
  schemas.Coverage.properties.data.required.push('documentary_report');schemas.Coverage.properties.data.properties.documentary_report=ref('CoverageReport');
  schemas.Manifest={type:'object',required:['schema_version','publication_status','canonical_sha256','corpus_is_incomplete','total','checksums'],properties:{schema_version:{const:'2.0.0'},publication_status:{const:'validated_snapshot'},canonical_sha256:{type:'string'},total:integer,corpus_is_incomplete:{const:true},checksums:{type:'object',additionalProperties:{type:'string',pattern:'^[a-f0-9]{64}$'}}}};
  schemas.Current=envelope(ref('Manifest'));
  schemas.Release=rewrite(require('../schemas/release.schema.json'));
  for(const key of ['archive_url','manifest_url','citation_url','changelog_url','checksum_url'])schemas.Release.properties[key]={type:'string',pattern:'^/data/releases/'};
  schemas.Releases=envelope({type:'array',items:ref('Release')});schemas.ReleaseResponse=envelope(ref('Release'));
  schemas.Exports=envelope({type:'array',items:{type:'object',additionalProperties:false,required:['name','url','sha256'],properties:{name:{type:'string'},url:{type:'string',pattern:'^/data/canonical/'},sha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}}});
  schemas.Evidence=envelope({type:'object',additionalProperties:false,required:['operation_id','claims','sources','legacy_evidence','notice'],properties:{operation_id:{type:'string'},claims:{type:'array',items:ref('Claim')},sources:{type:'array',items:ref('Source')},legacy_evidence:{type:'boolean'},notice:{type:'string'}}});
  schemas.Index=envelope({type:'object',additionalProperties:false,required:['resources','documentation'],properties:{resources:{type:'array',items:{type:'string'}},documentation:{type:'string'}}});
  const param=(name,schema,description)=>({name,in:'query',required:false,schema,description});
  const common=[param('q',{type:'string',minLength:1,maxLength:1000},'Case and diacritic insensitive substring; no automatic translation.'),param('source_id',{type:'string'},'Comma-separated source IDs (OR).'),
    param('status',{const:'published'},'Only the published snapshot is public.'),param('sort',{type:'string',enum:['id','-id'],default:'id'},'Deterministic ordering.'),param('page',{type:'integer',minimum:1,default:1},'Page starts at 1.'),param('limit',{type:'integer',minimum:1,maximum:200,default:20},'Maximum records per page.')];
  const operations=[param('from',{type:'string'},'YYYY[-MM[-DD]]; interval overlap, unknown starts excluded.'),param('to',{type:'string'},'Inclusive bound; partial dates expanded only for filtering.'),
    ...['date_precision','territory','territory_role','type'].map(name=>param(name,{type:'string'},'Comma-separated values, OR within this family; AND between families.')),
    param('has_geometry',{type:'boolean'},'Any documented geometry, including representative points; not a precision guarantee.'),param('min_sources',{type:'integer',minimum:0},'Minimum number of operation-level source IDs.'),param('bbox',{type:'string'},'west,south,east,north in WGS84; west > east crosses the antimeridian. Any point intersects.'),param('format',{enum:['json','geojson'],default:'json'},'Pagination applies to both formats; null geometry is retained.')];
  const responses=name=>({'200':{description:'Published snapshot response',headers:{ETag:{schema:{type:'string'},description:'SHA-256 of this response representation.'}},content:{'application/json':{schema:ref(name)}}},'304':{description:'Representation unchanged'},
    ...Object.fromEntries([400,404,405,413,500].map(code=>[code,{description:{400:'Invalid query or path',404:'Resource absent',405:'Read-only resource',413:'Response exceeds 4 MiB; reduce limit',500:'Published snapshot unavailable'}[code],content:{'application/json':{schema:ref('Error')}}}]))});
  const paths={};
  const add=(route,name,parameters=[])=>{paths['/api/v2'+route]={get:{operationId:(route||'/index').replace(/[^A-Za-z0-9]/g,'_'),summary:name,parameters,responses:responses(name)}};};
  add('','Index');
  for(const [resource,name]of Object.entries({operations:'Operation',sources:'Source',places:'Entity',persons:'Entity',organizations:'Entity','territorial-units':'Territory',claims:'Claim'})){
    const params=structuredClone(common);
    if(resource==='operations'){params.find(p=>p.name==='sort').schema.enum.push('start_date','-start_date');params.push(...operations);}
    if(resource==='claims')params.push(param('subject',{type:'string'},'Operation ID.'),param('claim_status',{enum:['supported','contested','unverified']},'Documentary status, distinct from publication.'));
    add('/'+resource,name+'Collection',params);
    if(resource==='operations')paths['/api/v2/operations'].get.responses[200].content['application/geo+json']={schema:ref('GeoJSON')};
    add('/'+resource+'/{id}',name+'Response',[{name:'id',in:'path',required:true,schema:{type:'string',pattern:'^[A-Za-z0-9_-]+$'}}]);
  }
  add('/operations/{id}/evidence','Evidence',[{name:'id',in:'path',required:true,schema:{type:'string',pattern:'^[A-Za-z0-9_-]+$'}}]);
  for(const [route,name]of [['stats','Stats'],['coverage','Coverage']])add('/'+route,name,[...common.filter(p=>!['sort','page','limit'].includes(p.name)),...operations.filter(p=>p.name!=='format')]);
  for(const [route,name]of [['releases','Releases'],['releases/current','Current'],['exports','Exports']])add('/'+route,name);
  add('/releases/{id}','ReleaseResponse',[{name:'id',in:'path',required:true,schema:{type:'string',pattern:'^data-[0-9]{4}\\.(0[1-9]|1[0-2])\\.[1-9][0-9]*$'}}]);
  paths['/api/v2/openapi.json']={get:{operationId:'openapi',summary:'OpenAPI 3.1 contract',responses:{200:{description:'OpenAPI document',content:{'application/json':{schema:{type:'object',required:['openapi','info','paths','components']}}}}}}};
  return {openapi:'3.1.0',jsonSchemaDialect:'https://json-schema.org/draft/2020-12/schema',info:{title:'ALNOP public research API',version:'2.2.0',description:'Read-only published snapshot, immutable releases and documentary coverage. Incomplete corpus; technical metrics do not imply historical war coverage.'},servers:[{url:'https://alnop.vercel.app'}],paths,components:{schemas}};
}
function run(check=process.argv.includes('--check')){
  const content=stable(document());
  for(const name of ['openapi/v2.json','docs/data/api-v2/openapi.json']){
    const target=path.join(root,name);if(check){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==content)throw Error('Stale OpenAPI: '+name);}
    else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
  }
  console.log(check?'OpenAPI matches.':'OpenAPI generated.');
}
if(require.main===module)run();module.exports={document,run};
