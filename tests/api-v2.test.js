const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../src/api-v2/service');
const {FileRepository}=require('../src/api-v2/repository');
const {readCorpus}=require('../src/canonical');
const {artifacts}=require('../scripts/build-canonical');
const {withProposal,approve}=require('./helpers/corpus');
const {withClaims}=require('./helpers/claims');
function snapshot(corpus){const files=artifacts(corpus,{allowSynthetic:true}),parse=name=>JSON.parse(files[name]);return {manifest:parse('dataset-manifest.json'),operations:parse('operations.json').operations,
  sources:parse('sources.json'),claims:parse('claims.json').claims,territories:parse('territorial-units.json').territorial_units,
  ...Object.fromEntries(['persons','places','organizations'].map(k=>[k,parse(k+'.json').entities]))};}
const repository=new FileRepository(),handler=createHandler(repository);
function request(url,{method='GET',headers={},handle=handler}={}){
  const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(c){this.statusCode=c;return this;},json(body){this.body=body;return this;},end(){this.ended=true;return this;}};
  handle({method,url,headers},res);return res;
}
const prefix='/api/v2';
test('v2 exposes every read resource, canonical identity and honest current snapshot/release metadata',()=>{
  for(const resource of ['','operations','sources','places','persons','organizations','territorial-units','claims','stats','coverage','releases','releases/current','exports','openapi.json']){
    const res=request(prefix+'/'+resource);assert.equal(res.statusCode,200,resource);
    if(resource!=='openapi.json'){assert.equal(res.body.meta.corpus_is_incomplete,true);assert.equal(res.body.meta.dataset_release,repository.load().current_release?.id||null);}
  }
  const op=request(prefix+'/operations/OP_1954_001').body.data;assert.equal(op.id,'OP_1954_001');assert.equal(op.schema_version,'2.0.0');
  assert.equal(request(prefix+'/releases').body.data.length,repository.load().releases.length);assert.equal(request(prefix+'/releases').body.meta.release_workflow_enabled,true);
  assert.equal(request(prefix+'/territorial-units').body.data[0].type,'editorial_category');
  assert.equal(request(prefix+'/operations?territory=W1').body.meta.total,0,'No inference from the imported legacy label');
});
test('Invalid, repeated and unsupported filters have structured 400 responses',()=>{
  for(const query of ['page=0','page=-1','page=1.5','page=1e2','limit=201','limit=','limit=abc','page=9007199254740991&limit=200',
    'page=1&page=2','unknown=1','status=proposed','status=published,disputed','has_geometry=1','min_sources=-1','format=csv','sort=title',
    'from=1956-02-30','from=1956-00','to=1956-13','from=1962&to=1954','date_precision=century','territory_role=other',
    'bbox=0,0,1','bbox=NaN,0,1,2','bbox=0,-91,1,2','bbox=0,20,1,10','bbox=0,0,Infinity,2','source_id=,','q='+('x'.repeat(1001))]){
    const r=request(prefix+'/operations?'+query);assert.equal(r.statusCode,400,query);assert.equal(r.body.error.code,'INVALID_QUERY');assert.equal(r.headers['cache-control'],'no-store');
  }
  assert.equal(request(prefix+'/sources?bbox=0,0,1,1').statusCode,400);
  assert.equal(request(prefix+'/stats?page=1').statusCode,400);
  assert.equal(request(prefix+'/operations/OP_1954_001?limit=1').statusCode,400);
});
test('Pagination is stable across pages and date sorting breaks ties by permanent ID',()=>{
  const a=request(prefix+'/operations?limit=2&page=1').body,b=request(prefix+'/operations?limit=2&page=2').body;
  assert.equal(a.meta.total,263);assert.equal(a.meta.has_next,true);
  assert.equal(new Set([...a.data,...b.data].map(o=>o.id)).size,4);
  assert.deepEqual(a.data.map(o=>o.id),[...a.data.map(o=>o.id)].sort());
  assert.ok(request(prefix+'/operations?sort=-id&limit=1').body.data[0].id>a.data[0].id);
  assert.equal(request(prefix+'/operations?page=1000').body.data.length,0);
  const date=request(prefix+'/operations?sort=start_date&limit=200').body.data;
  for(let i=1;i<date.length;i++)assert.ok(date[i-1].start_date.earliest<date[i].start_date.earliest||date[i-1].id<date[i].id);
});
test('Date intervals, list OR and family AND retain year precision and correlated territory roles',()=>{
  const {corpus,operation}=withProposal();approve(operation);
  operation.territorial_assignments[0].role='primary';operation.territorial_assignments[1].role='secondary';
  const handle=createHandler({load:()=>snapshot(corpus)}),run=q=>request(prefix+'/operations?'+q,{handle}).body;
  assert.ok(run('from=1956-08&to=1956-08&date_precision=year').data.some(o=>o.id===operation.id));
  assert.equal(run('territory=W1&territory_role=secondary').meta.total,0);
  assert.equal(run('territory=W1,W3&territory_role=secondary').meta.total,1);
  assert.equal(run('territory=W1&from=1960').meta.total,0);
  assert.equal(run('territory=W1').data[0].start_date.precision,'year');
  assert.equal(run('source_id='+operation.source_ids[0]).meta.total,1);
});
test('GeoJSON is paginated, retains null geometry and supports antimeridian MultiPoint selection',()=>{
  const {corpus,operation}=withProposal();approve(operation);
  operation.locations=[{label:null,geometry:{type:'Point',coordinates:[179,10]},geometry_role:'approximate_site',review_status:'reviewed'},
    {label:null,geometry:{type:'Point',coordinates:[-179,11]},geometry_role:'approximate_site',review_status:'reviewed'}];
  const handle=createHandler({load:()=>snapshot(corpus)});
  const r=request(prefix+'/operations?bbox=170,0,-170,20&format=geojson&limit=1',{handle});assert.equal(r.statusCode,200);
  assert.equal(r.body.features.length,1);assert.equal(r.body.features[0].geometry.type,'MultiPoint');assert.equal(r.body.meta.total,1);
  assert.equal(request(prefix+'/operations?bbox=-10,0,10,20',{handle}).body.meta.total,0);
  operation.locations=[{label:null,geometry:null,geometry_role:'unknown',review_status:'needs_review'}];
  const none=request(prefix+'/operations?has_geometry=false&format=geojson',{handle});assert.equal(none.body.features[0].geometry,null);
});
test('Unknown dates stay unknown and empty selections describe a documentary gap',()=>{
  const {corpus,operation}=withProposal();approve(operation);operation.start_date={earliest:null,latest:null,precision:'unknown',certainty:'unknown'};
  const handle=createHandler({load:()=>snapshot(corpus)});
  assert.equal(request(prefix+'/operations?date_precision=unknown',{handle}).body.meta.total,1);
  assert.equal(request(prefix+'/operations?date_precision=unknown&from=1954',{handle}).body.meta.total,0);
  const empty=request(prefix+'/coverage?from=1900&to=1900',{handle}).body.data;
  assert.equal(empty.total_operations,0);assert.match(empty.empty_selection_message,/currently catalogued/);assert.equal(empty.pending_contributions,null);
});
test('Drafts stay outside the repository snapshot and absent resources return 404',()=>{
  const {corpus,operation}=withProposal();const handle=createHandler({load:()=>snapshot(corpus)});
  assert.equal(request(prefix+'/operations/'+operation.id,{handle}).statusCode,404);
  for(const route of ['/places/PLC_UNKNOWN','/claims/CLM_UNKNOWN','/operations/UNKNOWN/evidence','/operations/OP_1954_001/other','/sources/id/evidence','/unknown','/%2e%2e/secret'])assert.equal(request(prefix+route).statusCode,404,route);
  assert.equal(request(prefix+'/operations?q=zzzz_no_match_zzzz').body.meta.total,0);
});

test('Published entity resources retain name variants and support detail and source filters',()=>{
  const {withEntities,entity,approve:review}=require('./helpers/entities');const c=withEntities();
  for(const [group,kind]of [['places','place'],['persons','person'],['organizations','organization']])c[group].push(review(entity(kind)));
  const handle=createHandler({load:()=>snapshot(c)});
  for(const [group,prefix]of [['places','PLC'],['persons','PER'],['organizations','ORG']]){
    const result=request('/api/v2/'+group+'/'+prefix+'_TEST_A',{handle});assert.equal(result.statusCode,200);assert.equal(result.body.data.names[0].value,'Nom de test A');
    assert.equal(request('/api/v2/'+group+'?q=nom&source_id=SRC_aaaaaaaaaaaaaaaaaaaaaaaa',{handle}).body.meta.total,1);
  }
});

test('File repository rejects a changed export and retains a previously validated instance snapshot',()=>{
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alnop-v2-'));
  try{
    const files=artifacts(readCorpus());for(const [name,content]of Object.entries(files))fs.writeFileSync(path.join(dir,name),content);
    const repo=new FileRepository(dir);assert.equal(repo.load().operations.length,263);
    fs.writeFileSync(path.join(dir,'operations.json'),'{}');assert.equal(repo.load().operations.length,263);
    assert.throws(()=>new FileRepository(dir).load(),/Invalid published snapshot/);
  }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('alnop-v2-'));fs.rmSync(dir,{recursive:true});}
});
test('Evidence preserves both contradictions, their locators and referenced sources',()=>{
  const c=withClaims({reviewed:true}),handle=createHandler({load:()=>snapshot(c)});
  const result=request(prefix+'/operations/OP_1954_001/evidence',{handle}).body.data;
  assert.deepEqual(result.claims.map(c=>c.value),[12,21]);assert.match(result.claims[0].evidence[0].locator,/p. 12/);
  assert.ok(result.sources.some(s=>s.source_id==='SRC_aaaaaaaaaaaaaaaaaaaaaaaa'));
  assert.equal(request(prefix+'/claims?subject=OP_1954_001&claim_status=contested',{handle}).body.meta.total,2);
});
test('Read-only methods, CORS, representation ETags and conditional caching behave consistently',()=>{
  const first=request(prefix+'/operations?limit=1'),etag=first.headers.etag;
  assert.equal(first.headers['access-control-allow-origin'],'*');assert.equal(first.headers['access-control-expose-headers'],'ETag');
  const second=request(prefix+'/operations?limit=1',{headers:{'if-none-match':'W/'+etag}});assert.equal(second.statusCode,304);assert.equal(second.body,undefined);
  assert.notEqual(request(prefix+'/operations?limit=2').headers.etag,etag);
  assert.equal(request(prefix+'/operations',{method:'OPTIONS'}).statusCode,204);
  const post=request(prefix+'/operations',{method:'POST'});assert.equal(post.statusCode,405);assert.equal(post.headers.allow,'GET, OPTIONS');
});

test('Vercel rewrites retain original filters and resolve the API root',()=>{
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(b){this.body=b;return this;},end(){}};
  handler({method:'GET',url:'/api/v2/handler?path=operations',query:{path:'operations',limit:'1'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.data.length,1);assert.equal(res.body.meta.limit,1);
  handler({method:'GET',url:'/api/v2/handler',query:{}},res);assert.equal(res.statusCode,200);assert.ok(res.body.data.resources.includes('operations'));
  handler({method:'GET',url:'/api/v2/operations?limit=2&path=operations',query:{path:'operations',limit:'2'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.data.length,2);
  assert.equal(request(prefix+'/operations?path=sources').statusCode,400);
});
test('Repository failures and oversized representations produce safe, bounded errors',()=>{
  const broken=createHandler({load(){throw Error('SECRET internal path');}}),r=request(prefix+'/operations',{handle:broken});
  assert.equal(r.statusCode,500);assert.doesNotMatch(JSON.stringify(r.body),/SECRET|stack/);
  const s=repository.load(),large={...s,operations:[{...s.operations[0],description:{fr:'x'.repeat(4*1024*1024),ar:null}}]};
  assert.equal(request(prefix+'/operations',{handle:createHandler({load:()=>large})}).statusCode,413);
});
test('OpenAPI 3.1 is valid and successful/error/GeoJSON responses conform to its schemas',()=>{
  const Ajv=require('ajv/dist/2020'),formats=require('ajv-formats'),spec=require('../openapi/v2.json');
  const official=new Ajv({strict:false,allErrors:true});formats(official);
  official.addFormat('media-range',/^[^\s/]+\/[^\s/]+$/);
  // Bind the official schema's default meta anchor explicitly: Ajv does not
  // resolve this nested dynamic anchor correctly. Components are checked below.
  const bind=v=>Array.isArray(v)?v.map(bind):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>k==='$dynamicRef'&&x==='#meta'?['$ref','#/$defs/schema']:[k,bind(x)])):v;
  const validate=official.compile(bind(require('./vendor/openapi-3.1-schema.json')));assert.equal(validate(spec),true,JSON.stringify(validate.errors?.slice(0,5)));
  const ajv=new Ajv({strict:false,allErrors:true});formats(ajv);
  const refs=v=>Array.isArray(v)?v.map(refs):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='$ref'?x.replace(/^#\/components\/schemas\/([^/]+)(.*)$/,(_,name,tail)=>'urn:alnop:'+name+(tail?'#'+tail:'')):refs(x)])):v;
  for(const [name,schema]of Object.entries(spec.components.schemas))ajv.addSchema({...refs(schema),$id:'urn:alnop:'+name});
  for(const [path,item]of Object.entries(spec.paths)){
    if(path.endsWith('openapi.json'))continue;
    if(path==='/api/v2/releases/{id}'&&!repository.load().releases.length)continue;
    const route=path.replace('{id}',path.includes('/sources/')?repository.load().sources[0].source_id:path.includes('/territorial-units/')?'W1':path.includes('/releases/')?repository.load().releases[0]?.id:'OP_1954_001');
    if(/\/(places|persons|organizations|claims)\//.test(path))continue;
    const response=request(route);assert.equal(response.statusCode,200,path);
    const schema=item.get.responses[200].content['application/json'].schema;
    const check=ajv.getSchema(refs(schema).$ref);assert.equal(check(response.body),true,path+' '+JSON.stringify(check.errors));
  }
  assert.equal(ajv.getSchema('urn:alnop:Error')(request(prefix+'/operations?limit=0').body),true);
  const geo=request(prefix+'/operations?format=geojson&limit=2').body,check=ajv.getSchema('urn:alnop:GeoJSON');assert.equal(check(geo),true,JSON.stringify(check.errors));
});
test('Executable examples pass through the actual HTTP handler without external network',async()=>{
  const http=require('node:http'),{verify}=require('../scripts/smoke-api-v2');
  const actual=require('../api/v2/handler');
  const server=http.createServer((req,res)=>{res.status=c=>{res.statusCode=c;return res;};res.json=b=>res.end(JSON.stringify(b));actual(req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{for(const example of require('../openapi/examples.json')){
    const response=await fetch('http://127.0.0.1:'+server.address().port+example.path);const body=await response.json();
    verify(example,response.status,body,Object.fromEntries(response.headers));
  }}finally{await new Promise(resolve=>server.close(resolve));}
});
