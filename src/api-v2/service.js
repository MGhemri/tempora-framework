const crypto=require('node:crypto');
const {FileRepository}=require('./repository');
const {HttpError,invalid,parseQuery,select}=require('./query');
const {report:coverageReport}=require('../shared/coverage');
const collections=['operations','sources','places','persons','organizations','territorial-units','claims'];
function geometry(op){const points=op.locations.filter(l=>l.geometry?.type==='Point').map(l=>l.geometry.coordinates);
  return points.length>1?{type:'MultiPoint',coordinates:points}:points.length?{type:'Point',coordinates:points[0]}:null;}
function metrics(operations,claims,sources){
  const years={},precisions={},types={};
  for(const o of operations){const year=o.start_date.earliest?.slice(0,4)||'unknown';years[year]=(years[year]||0)+1;
    const precision=o.start_date.precision;precisions[precision]=(precisions[precision]||0)+1;
    for(const type of o.event_type||[o.legacy?.type_action].filter(Boolean))types[type]=(types[type]||0)+1;}
  return {total_operations:operations.length,total_sources:sources.length,total_claims:claims.length,by_start_year:years,by_start_precision:precisions,by_type:types};
}
function createHandler(repository=new FileRepository()){
  return (req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Accept, If-None-Match');res.setHeader('Access-Control-Expose-Headers','ETag');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
    const send=(status,body,type='application/json; charset=utf-8')=>{
      const text=JSON.stringify(body);
      if(Buffer.byteLength(text)>4*1024*1024)throw new HttpError(413,'RESPONSE_TOO_LARGE','Reduce the page limit or use the static exports.');
      res.setHeader('Content-Type',type);
      if(status===200){const etag='"'+crypto.createHash('sha256').update(text).digest('hex')+'"';res.setHeader('ETag',etag);
        const condition=req.headers?.['if-none-match'];if(typeof condition==='string'&&condition.split(',').some(t=>t.trim().replace(/^W\//,'')===etag||t.trim()==='*'))return res.status(304).end();}
      return res.status(status).json(body);
    };
    try{
      if(req.method==='OPTIONS')return res.status(204).end();
      if(req.method!=='GET'){res.setHeader('Allow','GET, OPTIONS');throw new HttpError(405,'METHOD_NOT_ALLOWED','Only GET and OPTIONS are supported.');}
      const url=new URL(req.url||'/api/v2','https://alnop.vercel.app');
      let route=url.pathname.replace(/^\/api\/v2\/?/,'').replace(/\/$/,'');
      if(!route||route==='index')route='';
      if(route==='handler'){const routed=req.query?.path||url.searchParams.get('path');route=routed?(Array.isArray(routed)?routed.join('/'):routed):'';}
      try{route=decodeURIComponent(route);}catch{throw new HttpError(400,'INVALID_PATH','Invalid URL encoding.');}
      const parts=route?route.split('/'):[];
      if(parts.some(p=>!p||p==='.'||p==='..'||!/^[A-Za-z0-9_.-]+$/.test(p)))throw new HttpError(404,'NOT_FOUND','Unknown resource.');
      const query={};
      // Read query strings independently of routing parameters; repeated filters are rejected.
      for(const [key,value]of url.searchParams){
        // Vercel can retain the original pathname while appending rewrite params.
        if(key==='path'){if(value===route)continue;invalid('Reserved routing parameter.');}
        if(key in query)invalid(`Repeated parameter: ${key}`);query[key]=value;
      }
      if(req.query)for(const [key,value]of Object.entries(req.query))if(key!=='path'&&!Object.hasOwn(query,key))query[key]=value;
      if(parts[0]==='openapi.json'&&parts.length===1){if(Object.keys(query).length)invalid('This resource takes no parameters.');return send(200,require('../../openapi/v2.json'));}
      const s=repository.load();
      const meta=extra=>({api_version:'v2',dataset_release:s.current_release?.id||null,snapshot_sha256:s.manifest.canonical_sha256,
        corpus_is_incomplete:true,...extra});
      const envelope=(data,extra={})=>({data,meta:meta(extra)});
      const plain=()=>{if(Object.keys(query).length)invalid('This resource takes no parameters.');};
      if(!parts.length){plain();return send(200,envelope({resources:[...collections,'stats','coverage','releases','releases/current','exports','openapi.json'],documentation:'/documentation/api-v2'}));}
      const [resource,id,sub]=parts;
      if(collections.includes(resource)){
        const records=s[resource==='territorial-units'?'territories':resource];
        if(parts.length>3||sub&&(resource!=='operations'||sub!=='evidence'))throw new HttpError(404,'NOT_FOUND','Unknown resource.');
        if(id){plain();const record=records.find(r=>(r.id||r.source_id)===id);if(!record)throw new HttpError(404,'NOT_FOUND','Resource not found.');
          if(sub){const claims=s.claims.filter(c=>c.subject===id),ids=new Set([...record.source_ids,...claims.flatMap(c=>c.evidence.map(e=>e.source_id))]);
            return send(200,envelope({operation_id:id,claims,sources:s.sources.filter(source=>ids.has(source.source_id)),legacy_evidence:record.provenance.publication_basis==='previously_public_legacy_corpus',
              notice:'Claims remain separate from inherited narrative; no automatic historical arbitration.'}));}
          return send(200,envelope(record));}
        const q=parseQuery(query,resource),result=select(records,q,resource);
        const pagination={total:result.total,count:result.data.length,page:q.page,limit:q.limit,has_next:result.has_next,sort:q.sort};
        if(q.format==='geojson')return send(200,{type:'FeatureCollection',features:result.data.map(o=>({type:'Feature',id:o.id,geometry:geometry(o),properties:o})),meta:meta(pagination)},'application/geo+json; charset=utf-8');
        return send(200,envelope(result.data,pagination));
      }
      if(['stats','coverage'].includes(resource)&&parts.length===1){
        const q=parseQuery(query,'operations');if('format'in query||'page'in query||'limit'in query||'sort'in query)invalid('Aggregates accept filters, not pagination, sort or GeoJSON.');
        const all=select(s.operations,{...q,page:1,limit:Math.max(1,s.operations.length)},'operations').data;
        const ids=new Set(all.map(o=>o.id)),claims=s.claims.filter(c=>ids.has(c.subject));
        const usedSources=new Set([...all.flatMap(o=>o.source_ids),...claims.flatMap(c=>c.evidence.map(e=>e.source_id))]);
        if(resource==='stats')return send(200,envelope(metrics(all,claims,s.sources.filter(source=>usedSources.has(source.source_id))),{total:all.length}));
        const count=f=>all.filter(f).length;
        return send(200,envelope({scope:'ALNOP documentary corpus; not a measure of historical war coverage',total_operations:all.length,
          unknown_start_dates:count(o=>o.start_date.precision==='unknown'),without_geometry:count(o=>!geometry(o)),
          without_structured_territory:count(o=>!o.territorial_assignments.length),without_sources:count(o=>!o.source_ids.length),
          legacy_imports_needing_review:count(o=>o.quality_flags.includes('legacy_import_needs_review')),
          contested_claims:claims.filter(c=>c.status==='contested').length,pending_contributions:null,
          by_start_year:metrics(all,claims,s.sources).by_start_year,empty_selection_message:all.length?null:'No records currently catalogued for this selection.',
          documentary_report:coverageReport(all,s.sources,claims,s.territories,q)},{total:all.length,...(s.coverage_engine||{})}));
      }
      if(resource==='releases'&&parts.length===1){plain();return send(200,envelope(s.releases||[],{total:(s.releases||[]).length,release_workflow_enabled:true,notice:'Versioned technical publications preserve the documentary corpus and its historical review limitations.'}));}
      if(resource==='releases'&&id==='current'&&parts.length===2){plain();return send(200,envelope(s.manifest));}
      if(resource==='releases'&&id&&parts.length===2){plain();const release=(s.releases||[]).find(r=>r.id===id);if(!release)throw new HttpError(404,'NOT_FOUND','Data release not found.');return send(200,envelope(release));}
      if(resource==='exports'&&parts.length===1){plain();return send(200,envelope(Object.entries(s.manifest.checksums).map(([name,sha256])=>({name,sha256,url:'/data/canonical/'+name})),{manifest_url:'/data/canonical/dataset-manifest.json'}));}
      throw new HttpError(404,'NOT_FOUND','Unknown resource.');
    }catch(error){res.setHeader('Cache-Control','no-store');const known=error instanceof HttpError;
      return send(known?error.status:500,{error:{code:known?error.code:'INTERNAL_ERROR',message:known?error.message:'The published snapshot is temporarily unavailable.'}});}
  };
}
module.exports={createHandler,geometry,metrics};
