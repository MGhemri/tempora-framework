const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const {nativeCorpus} = require('./helpers/tempora');
const {fixture,operator,later,ref} = require('./helpers/publication-request');
const {buildPublicationArtifacts} = require('../src/framework/publication');
const {createPublicationStore} = require('../src/framework/publication-store');
const {createPublishedCatalog} = require('../src/framework/published-catalog');
const {createPublishedHandler} = require('../src/framework/published-api');
const schema = require('./vendor/openapi-3.1-schema.json');

function storeFor(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(),'tempora-api-test-'));
  t.after(()=>{
    const real=fs.realpathSync(folder);
    assert.equal(path.dirname(real),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(real).startsWith('tempora-api-test-'));
    fs.rmSync(real,{recursive:true,force:true});
  });
  return {folder,store:createPublicationStore(folder)};
}
function activate(store,request) {
  const bundle = buildPublicationArtifacts(request);
  store.stage(bundle);
  store.promote(request,{snapshot_sha256:bundle.manifest.snapshot_sha256,operator});
  return bundle;
}
function call(handler,url,method='GET',headers={}) {
  const res={headers:{},statusCode:200,setHeader(name,value){this.headers[name.toLowerCase()]=value;},
    end(body){this.body=body===undefined?null:JSON.parse(body);}};
  handler({url:'/api/v3'+url,method,headers},res);
  return res;
}
function addEvent(data) {
  const {request,event,append} = data;
  const extra = {...structuredClone(event),id:'EXAMPLE_2'};
  request.corpus.events.push(extra);
  append(extra,'submitted','proposed','under_review');
  append(extra,'approved','under_review','published');
  request.subjects.push(ref(extra));
}
test('A real HTTP server reads promoted synthetic releases and isolates profiles and staged bundles', async t=>{
  const {store,folder} = storeFor(t), first=fixture();
  addEvent(first);
  const published=activate(store,first.request);
  const profileId=first.request.corpus.profile.id;
  const secondCorpus=JSON.parse(JSON.stringify(nativeCorpus()).replaceAll('SYNTHETIC_HISTORY','SECOND_HISTORY'));
  secondCorpus.profile.id='second-history';
  const second=fixture({corpus:secondCorpus});
  activate(store,second.request);

  const staged={...first.request,previous:published,release:{...first.request.release,id:'staged-only'}};
  store.stage(buildPublicationArtifacts(staged));
  fs.writeFileSync(path.join(folder,profileId,'staged-only.bundle.json'),'unreadable staged data');
  const catalog=createPublishedCatalog([store.readPublished(profileId),store.readPublished('second-history')]);
  const server=http.createServer(createPublishedHandler(catalog));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port+'/api/v3';
  assert.equal((await fetch(new URL('/health',base))).status,200);
  assert.equal((await fetch(base+'/profiles/'+profileId+'/events?q=1%2B2').then(r=>r.json())).meta.total,2);
  const geo=await fetch(base+'/profiles/'+profileId+'/spatial?format=geojson').then(r=>r.json());
  assert.deepEqual(geo.data,{type:'FeatureCollection',features:[]});
  assert.equal((await fetch(base+'/profiles/'+profileId+'/stats').then(r=>r.json())).data.events,2);
  assert.equal((await fetch(base+'/profiles/'+profileId+'/events/%45XAMPLE_1')).status,200);
  const list=await fetch(base+'/profiles').then(response=>response.json());
  assert.deepEqual(list.data.map(row=>row.id),['second-history',profileId]);
  const response=await fetch(base+'/profiles/'+profileId+'/events?year=1700&limit=1');
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.meta.total,2);
  assert.equal(body.data[0].namespace,'SYNTHETIC_HISTORY');
  assert.equal((await fetch(base+'/profiles/second-history/events/EXAMPLE_2')).status,404);
  assert.equal((await fetch(base+'/profiles/'+profileId+'/events?release=staged-only')).status,404);
  assert.equal((await fetch(base+'/profiles/'+profileId+'/claims/ASSERTION_1')).status,404);
  const details=await fetch(base+'/profiles/second-history/events/EXAMPLE_1').then(r=>r.json());
  assert.equal(details.data.namespace,'SECOND_HISTORY');
  assert.doesNotMatch(JSON.stringify(details),/PRIVATE_|private-review/);
});
test('Cursor and ETag bind to the exact published version and selection',t=>{
  const {store}=storeFor(t),data=fixture();
  addEvent(data);
  const {request}=data,first=activate(store,request),profile=request.corpus.profile.id;
  const url='/profiles/'+profile+'/events';
  const original=createPublishedHandler(createPublishedCatalog([store.readPublished(profile)]));
  const page=call(original,url+'?limit=1');
  const cursor=page.body.meta.next_cursor;
  assert.equal(call(original,url+'?limit=1&cursor='+cursor).body.data[0].id,'EXAMPLE_2');
  assert.equal(call(original,url+'?limit=1&year=1700&cursor='+cursor).statusCode,409);
  assert.equal(call(original,url+'?limit=1','GET',{'if-none-match':'W/'+page.headers.etag}).statusCode,304);
  assert.equal(call(original,url+'?release=fictional-1').headers['cache-control'],'public, max-age=31536000, immutable');
  const next={...request,previous:first,asOf:later,release:{...request.release,id:'fictional-2'}};
  activate(store,next);
  const updated=createPublishedHandler(createPublishedCatalog([store.readPublished(profile)]));
  assert.equal(call(updated,url+'?limit=1&cursor='+cursor).statusCode,409);
  assert.equal(call(updated,url+'?release=fictional-1').body.meta.release_id,'fictional-1');
  assert.equal(call(updated,url+'?year=1701').body.meta.total,0);
});
test('Published HTTP contract rejects malformed requests and validates against OpenAPI',()=>{
  const handler=createPublishedHandler();
  const spec=call(handler,'/openapi.json').body;
  const ajv=new Ajv({strict:false});
  addFormats(ajv);
  ajv.addFormat('media-range',/^[^\s/]+\/[^\s/]+$/);
  const bind=value=>Array.isArray(value)?value.map(bind):value&&typeof value==='object'?
    Object.fromEntries(Object.entries(value).map(([key,child])=>key==='$dynamicRef'&&child==='#meta'?['$ref','#/$defs/schema']:[key,bind(child)])):value;
  const validate=ajv.compile(bind(schema));
  assert.ok(validate(spec),JSON.stringify(validate.errors));
  assert.deepEqual(call(handler,'/profiles').body,{data:[]});
  for (const url of ['/profiles?unexpected=1','/profiles?release=1&release=2','/profiles/%2e%2e/events']) {
    const response=call(handler,url);
    assert.equal(response.statusCode,400);
    assert.ok(ajv.compile(spec.paths['/profiles'].get.responses[400].content['application/json'].schema)(response.body));
  }
  assert.equal(call(handler,'/profiles/unknown').statusCode,404);
  assert.equal(call(handler,'/profiles','POST').statusCode,405);
  assert.equal(call(handler,'/profiles','OPTIONS').statusCode,204);
  const restricted=createPublishedHandler(undefined,{corsOrigin:'https://example.org'});
  assert.equal(call(restricted,'/profiles','GET',{origin:'https://example.org'}).headers['access-control-allow-origin'],'https://example.org');
  assert.equal(call(restricted,'/profiles','GET',{origin:'https://other.example.org'}).headers['access-control-allow-origin'],undefined);
  assert.equal(call(handler,'/profiles').headers['x-content-type-options'],'nosniff');
  assert.equal(call(handler,'/profiles','HEAD').body,null);
  assert.equal(call(handler,'/profiles?q='+ 'a'.repeat(5000)).statusCode,413);
  const faulty=createPublishedHandler({list(){throw Error('C:/private/path');}});
  const error=call(faulty,'/profiles');
  assert.equal(error.statusCode,500);
  assert.doesNotMatch(JSON.stringify(error.body),/private\/path/);
});
