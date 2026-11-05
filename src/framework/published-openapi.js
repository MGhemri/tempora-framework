const string = {type:'string'};
const hash = {type:'string',pattern:'^[a-f0-9]{64}$'};
const param = (name,schema=string,description,where='query') =>
  ({name,in:where,required:where==='path',schema,...(description?{description}:{})});
const profile = param('profileId',string,'Published profile identifier','path');
const version = param('release',string,'Published release ID or latest');
const item = param('recordId',string,'Permanent record identifier','path');
const page = [param('limit',{type:'integer',minimum:1,maximum:100,default:25}),param('cursor')];
const filters = [
  param('year',{type:'string',pattern:'^[0-9]{4}$'}),
  param('from',{type:'string',format:'date'}),param('to',{type:'string',format:'date'}),
  ...['type','place','territory','lang','entity'].map(name=>param(name)),
  param('q',{type:'string',maxLength:512},'Case-insensitive substring of the event title or description'),
  param('has_source',{type:'boolean'}),param('status',{type:'string',enum:['published']})
];
const error = {type:'object',required:['error'],properties:{error:{type:'object',required:['code','message','field'],
  properties:{code:string,message:string,field:{type:['string','null']}}}}};
const meta = {type:'object',required:['profile_id','profile_version','schema_version','release_id','snapshot_sha256'],
  properties:{profile_id:string,profile_version:string,schema_version:string,release_id:string,snapshot_sha256:hash,
    total:{type:'integer',minimum:0},next_cursor:{type:['string','null']}}};
const envelope = (data,hasMeta=true) => ({type:'object',required:hasMeta?['data','meta']:['data'],
  properties:{data,...(hasMeta?{meta}:{})}});
const object = {type:'object'};
const list = {type:'array',items:object};
function get(summary,parameters,schema) {
  const responses = {
    200:{description:'Published representation',content:{'application/json':{schema}}},
    304:{description:'Representation unchanged'}
  };
  for (const [status,description] of Object.entries({400:'Invalid query',404:'Resource absent',409:'Cursor mismatch',
    413:'Size limit exceeded',500:'Read failure'})) {
    responses[status] = {description,content:{'application/json':{schema:error}}};
  }
  return {get:{summary,parameters,responses}};
}

const paths = {
  '/health':get('Service health',[],{type:'object',required:['status','api_version'],properties:{status:string,api_version:string}}),
  '/openapi.json':get('API contract',[],object),
  '/profiles':get('List published profiles',[],envelope(list,false)),
  '/profiles/{profileId}':get('Published profile metadata',[profile,version],envelope(object)),
  '/profiles/{profileId}/releases':get('List published releases',[profile],envelope(list,false)),
  '/profiles/{profileId}/releases/{releaseId}':get('Published release manifest',[profile,param('releaseId',string,undefined,'path')],envelope(object)),
  '/profiles/{profileId}/manifest':get('Snapshot manifest',[profile,version],envelope(object)),
  '/profiles/{profileId}/stats':get('Observed documentary counts',[profile,version],envelope(object))
};
for (const name of ['events','sources','entities','claims','relations','spatial']) {
  const options=name==='events'?filters:name==='spatial'?[param('format',{type:'string',enum:['geojson']})]:[];
  const data=name==='spatial'?{oneOf:[list,{type:'object',required:['type','features'],
    properties:{type:{const:'FeatureCollection'},features:list}}]}:list;
  paths['/profiles/{profileId}/'+name] = get('List '+name,[profile,version,...page,...options],envelope(data));
  paths['/profiles/{profileId}/'+name+'/{recordId}'] = get('Read '+name+' record',[profile,version,item],envelope(object));
}
for (const path of Object.values(paths)) {
  const {summary,parameters,responses}=path.get;
  path.head={summary:'Headers for '+summary,parameters,responses:Object.fromEntries(Object.entries(responses).map(([status,{description}])=>[status,{description}]))};
  path.options={summary:'Read-only CORS preflight',parameters:parameters.filter(parameter=>parameter.in==='path'),responses:{204:{description:'Preflight accepted'}}};
}
const openapi = {openapi:'3.1.0',info:{title:'TEMPORA Published Snapshots API',version:'3.0.0'},
  servers:[{url:'/api/v3'}],paths};
module.exports = {openapi};
