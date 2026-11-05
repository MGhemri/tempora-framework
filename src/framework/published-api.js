const {createHash} = require('node:crypto');
const {digest} = require('./canonical');
const {validDay} = require('./profile');
const {createPublishedCatalog} = require('./published-catalog');
const {openapi} = require('./published-openapi');

const prefix = '/api/v3';
const resourceKeys = {
  events:'events', sources:'sources', entities:'entities', claims:'claims',
  relations:'relations', spatial:'spatial_assertions'
};
const eventFilters = ['year','from','to','type','place','territory','lang','entity','has_source','status','q'];
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
function fail(status,code,message,field=null) { throw Object.assign(Error(message),{status,code,field}); }
const invalid = (message,field) => fail(400,'INVALID_QUERY',message,field);
const absent = () => fail(404,'NOT_FOUND','Published resource not found');

function parseTarget(url) {
  if (typeof url !== 'string' || Buffer.byteLength(url)>4096) fail(413,'REQUEST_LIMIT','Request target exceeds the limit');
  const separator = url.indexOf('?');
  const pathname = separator<0 ? url : url.slice(0,separator);
  if (pathname === '/health') return {segments:['health'],query:new URLSearchParams(separator<0?'':url.slice(separator+1))};
  if (pathname !== prefix && !pathname.startsWith(prefix+'/')) absent();
  const suffix = pathname.slice(prefix.length).replace(/^\//,'').replace(/\/$/,'');
  const segments = suffix ? suffix.split('/') : [];
  for (const [index,raw] of segments.entries()) {
    let segment;
    try { segment=decodeURIComponent(raw); } catch { invalid('Invalid path encoding'); }
    if (!idPattern.test(segment)) invalid('Invalid path identifier');
    segments[index]=segment;
  }
  return {segments,query:new URLSearchParams(separator<0?'':url.slice(separator+1))};
}

function queryObject(query, allowed) {
  const result = {};
  for (const [key,value] of query) {
    if (!allowed.includes(key) || Object.hasOwn(result,key) || !value || value.length>512) invalid('Unknown, repeated or invalid parameter',allowed.includes(key)?key:null);
    result[key] = value;
  }
  return result;
}

function filterEvents(events, snapshot, filters) {
  const {year,from,to,type,place,territory,lang,entity,has_source,status,q} = filters;
  const normalize = text => text.normalize('NFKC').toLowerCase();
  const search = q && normalize(q.trim());
  if(q&&!search) invalid('Search must contain non-whitespace text','q');
  if ((year && (!/^\d{4}$/.test(year)||year==='0000'||from||to))
      || (from&&!validDay(from)) || (to&&!validDay(to)) || (from&&to&&from>to)) invalid('Invalid time filter');
  if (lang&&!snapshot.profile.locales.includes(lang)) invalid('Unknown profile language');
  if ([place,territory,entity].some(id=>id&&!idPattern.test(id))) invalid('Invalid entity reference filter');
  if ((has_source&&!['true','false'].includes(has_source))||(status&&status!=='published')) invalid('Invalid published filter');
  const lower = year ? year+'-01-01' : from;
  const upper = year ? year+'-12-31' : to;
  const sites = new Map(snapshot.records.spatial_assertions.map(site=>[site.id,site]));
  return events.filter(event=>{
    const {earliest,latest,kind} = event.start_date;
    if ((lower||upper) && ((!earliest&&!latest)
        || (lower&&latest&&(latest<lower||(latest===lower&&kind==='before')))
        || (upper&&earliest&&(earliest>upper||(earliest===upper&&kind==='after'))))) return false;
    if (type&&!event.event_type.includes(type)) return false;
    if (search&&![...Object.values(event.title),...Object.values(event.description)]
      .some(text=>typeof text==='string'&&normalize(text).includes(search))) return false;
    if (lang&&!(event.title[lang]?.trim()||event.description[lang]?.trim())) return false;
    if (place&&!event.spatial_refs.some(ref=>sites.get(ref.id)?.place?.id===place)) return false;
    if (territory&&!event.territory_refs.some(ref=>ref.id===territory)) return false;
    if (entity&&!event.participant_refs.some(ref=>ref.id===entity)) return false;
    return !has_source || (event.provenance.evidence.length>0)===(has_source==='true');
  });
}

function paginate(items, query, binding) {
  const limit = query.limit ?? '25';
  if (!/^[1-9][0-9]{0,2}$/.test(limit) || Number(limit)>100) invalid('Limit must be between 1 and 100','limit');
  const pageSize = Number(limit);
  let offset = 0;
  if (query.cursor) {
    let cursor;
    try {
      const bytes = Buffer.from(query.cursor,'base64url');
      if (bytes.toString('base64url') !== query.cursor) throw Error();
      cursor = JSON.parse(bytes.toString('utf8'));
    } catch { invalid('Malformed cursor'); }
    if (!cursor||!Number.isSafeInteger(cursor.offset)||cursor.offset<1
        ||typeof cursor.binding!=='string') invalid('Malformed cursor');
    if (cursor.binding!==binding) fail(409,'CURSOR_MISMATCH','Cursor belongs to another snapshot or query');
    if (cursor.offset>=items.length) invalid('Cursor is outside this collection');
    offset = cursor.offset;
  }
  const next = offset+pageSize;
  return {data:items.slice(offset,next),total:items.length,
    next_cursor:next<items.length?Buffer.from(JSON.stringify({offset:next,binding})).toString('base64url'):null};
}

function resolve(catalog,url) {
  const {segments,query} = parseTarget(url);
  const [root,profile,resource,objectId] = segments;
  if (segments.length===1 && ['health','openapi.json','profiles'].includes(root)) {
    queryObject(query,[]);
    if (root==='openapi.json') return {body:openapi,immutable:false};
    return {body:root==='health'?{status:'ok',api_version:'3.0.0'}:{data:catalog.list()},immutable:false};
  }
  if (root!=='profiles'||!profile||segments.length>4) absent();
  if (resource==='releases' && !objectId) {
    queryObject(query,[]);
    if (!catalog.resolve(profile)) absent();
    return {body:{data:catalog.releases(profile)},immutable:false};
  }
  const isCollection = Object.hasOwn(resourceKeys,resource) && !objectId;
  const filters = isCollection && resource==='events' ? eventFilters : isCollection && resource==='spatial' ? ['format'] : [];
  const options = queryObject(query,resource==='releases'?[]:['release',...(isCollection?['limit','cursor',...filters]:[])]);
  if(options.format&&options.format!=='geojson') invalid('Unsupported spatial format','format');
  const release = resource==='releases'?objectId:options.release ?? 'latest';
  const entry = catalog.resolve(profile,release);
  if (!entry) absent();
  const {manifest,snapshot} = entry;
  const meta = {profile_id:profile,profile_version:manifest.profile_version,schema_version:snapshot.schema_version,
    release_id:manifest.release_id,snapshot_sha256:manifest.snapshot_sha256};
  const immutable = release!=='latest';
  let data;
  if (resource==='releases'||resource==='manifest') {
    if (resource==='manifest'&&objectId) absent();
    data = manifest;
  } else if (!resource) data = snapshot.profile;
  else if (resource==='stats'&&!objectId) {
    const events = snapshot.records.events;
    data = {scope:'observed_corpus_density',events:events.length,
      with_evidence:events.filter(event=>event.provenance.evidence.length).length,
      with_spatial_assertions:events.filter(event=>event.spatial_refs.length).length};
  } else if (Object.hasOwn(resourceKeys,resource)) {
    let items = [...snapshot.records[resourceKeys[resource]]].sort((a,b)=>compare(a.id,b.id));
    if (objectId) {
      data = items.find(item=>item.id===objectId);
      if (!data) absent();
    } else {
      if (resource==='events') items = filterEvents(items,snapshot,options);
      const {cursor,...boundQuery} = options;
      const binding = digest({profile,resource,snapshot:meta.snapshot_sha256,query:boundQuery});
      const page = paginate(items,options,binding);
      const data=options.format==='geojson'?{type:'FeatureCollection',features:page.data.map(site=>({
        type:'Feature',id:site.id,geometry:site.geometry,properties:{subject:site.subject,geometry_role:site.geometry_role,
          precision_meters:site.precision_meters}
      }))}:page.data;
      return {body:{data,meta:{...meta,total:page.total,next_cursor:page.next_cursor}},immutable};
    }
  } else absent();
  return {body:{data,meta},immutable};
}

function createPublishedHandler(catalog=createPublishedCatalog(),{corsOrigin='*'}={}) {
  if(corsOrigin!=='*'&&corsOrigin!==null){
    const url=new URL(corsOrigin);
    if(!['http:','https:'].includes(url.protocol)||url.origin!==corsOrigin) throw Error('Invalid CORS origin');
  }
  return (request,response) => {
    response.setHeader('X-Content-Type-Options','nosniff');
    if(corsOrigin==='*') response.setHeader('Access-Control-Allow-Origin','*');
    else if(corsOrigin!==null){
      response.setHeader('Vary','Origin');
      if(request.headers?.origin===corsOrigin) response.setHeader('Access-Control-Allow-Origin',corsOrigin);
    }
    response.setHeader('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers','If-None-Match');
    response.setHeader('Access-Control-Expose-Headers','ETag');
    response.setHeader('Content-Type','application/json; charset=utf-8');
    try {
      if (request.method==='OPTIONS') {
        parseTarget(request.url);
        response.statusCode=204;
        return response.end();
      }
      if (!['GET','HEAD'].includes(request.method)) {
        response.setHeader('Allow','GET, HEAD, OPTIONS');
        fail(405,'METHOD_NOT_ALLOWED','Published API accepts read operations only');
      }
      const {body,immutable} = resolve(catalog,request.url);
      const bytes = JSON.stringify(body);
      if (Buffer.byteLength(bytes)>2*1024*1024) fail(413,'RESPONSE_LIMIT','Representation exceeds the limit');
      const etag = '"'+createHash('sha256').update(bytes).digest('hex')+'"';
      response.setHeader('ETag',etag);
      response.setHeader('Cache-Control',immutable?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate');
      const condition = request.headers?.['if-none-match'];
      if (typeof condition==='string'&&condition.split(',').some(value=>['*',etag].includes(value.trim().replace(/^W\//,'')))) {
        response.statusCode=304;
        return response.end();
      }
      response.statusCode=200;
      return response.end(request.method==='HEAD'?undefined:bytes);
    } catch(error) {
      response.statusCode=error.status ?? 500;
      response.setHeader('Cache-Control','no-store');
      return response.end(request.method==='HEAD'?undefined:JSON.stringify({error:{
        code:error.code&&error.status?error.code:'INTERNAL_ERROR',message:error.status?error.message:'Published resource could not be read',field:error.status?error.field??null:null
      }}));
    }
  };
}

module.exports = {createPublishedHandler};
