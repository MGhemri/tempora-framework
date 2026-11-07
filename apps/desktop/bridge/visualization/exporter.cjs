'use strict';
// Explicit user-triggered export of bounded, noncanonical projection results.
// The source corpus is never edited. Scientific hashes must verify before export.
const {canonical}=require('tempora-framework');
const {createHash}=require('node:crypto');
const {refKey}=require('./contracts.cjs');
const MAX_EXPORT_BYTES=256*1024;
const FORMATS=Object.freeze(['json','geojson','csv','graphml']);
function fail(code){const e=new Error(code);e.code=code;throw e;}
function verify(p){
  if(!p||typeof p!=='object'||!Array.isArray(p.result)||!p.source||
     !p.algorithm||!p.corpus||!p.scope||!Array.isArray(p.diagnostics))
    fail('INVALID_PROJECTION');
  const body={projection_schema_version:p.projection_schema_version,
    algorithm:p.algorithm,corpus:p.corpus,
    engine_version:p.source.engine_version,mode:p.source.mode,
    scope:p.scope,diagnostics:p.diagnostics,result:p.result};
  let hash;
  try{hash=canonical.digest(body);}catch{fail('INVALID_PROJECTION');}
  if(hash!==p.scientific_sha256)fail('PROJECTION_DIGEST_MISMATCH');
  if(p.source.mode!=='validated')fail('CORPUS_NOT_VALIDATED');
  if(p.scope.returned!==p.result.length)fail('INVALID_PROJECTION');
  return hash;
}
function csvCell(value){
  let s=typeof value==='string'?value:
    value===null?'':typeof value==='object'?canonical.stringify(value):String(value);
  // Spreadsheet formula injection is still dangerous in a local CSV file.
  if(/^[\s\uFEFF]*[=+\-@]/u.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function csv(rows,manifest){
  const keys=[...new Set(rows.flatMap(x=>Object.keys(x)))].sort();
  const lines=[keys.map(csvCell).join(',')];
  for(const r of rows)lines.push(keys.map(k=>csvCell(r[k]??null)).join(','));
  // A sidecar manifest preserves machine-readable CSV semantics.
  return {data:lines.join('\r\n')+'\r\n',
    manifestText:JSON.stringify(manifest,null,2)+'\n'};
}
function xmlEscape(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function graphml(rows,manifest){
  const nodes=new Map(),edges=[];
  for(const row of rows){
    const source=row.source,target=row.target;
    if(!source||!target)continue;
    const a=refKey(source),b=refKey(target);
    nodes.set(a,source);nodes.set(b,target);
    edges.push({id:row.ref?refKey(row.ref):JSON.stringify([a,b,edges.length]),
      source:a,target:b,predicate:row.predicate??''});
  }
  const lines=['<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
    '<key id="predicate" for="edge" attr.name="predicate" attr.type="string"/>',
    '<key id="tempora_manifest" for="graph" attr.name="tempora_manifest" attr.type="string"/>',
    '<graph id="tempora" edgedefault="directed">',
    '<data key="tempora_manifest">'+xmlEscape(JSON.stringify(manifest))+'</data>'];
  for(const [key] of [...nodes].sort(([a],[b])=>a<b?-1:a>b?1:0))
    lines.push('<node id="'+xmlEscape(key)+'"/>');
  for(const edge of edges){
    lines.push('<edge id="'+xmlEscape(edge.id)+'" source="'+xmlEscape(edge.source)+
      '" target="'+xmlEscape(edge.target)+'"><data key="predicate">'+
      xmlEscape(edge.predicate)+'</data></edge>');
  }
  lines.push('</graph>','</graphml>');
  return {data:lines.join('\n')+'\n',manifestText:null};
}
function buildExport(p,{format='json',module}={}){
  if(!FORMATS.includes(format))fail('UNSUPPORTED_FORMAT');
  if(!['geo','graph','chronos','evidence','pattern','observatory'].includes(module))
    fail('UNSUPPORTED_MODULE');
  if(p.scope?.filters?.module!==module)fail('MISMATCHED_MODULE');
  const sha=verify(p);
  const manifest={
    document_type:'tempora.visualization.export',
    manifest_version:'1.0.0',module,format,
    generated_at:p.source.generated_at,
    corpus:p.corpus,algorithm:p.algorithm,
    scientific_sha256:sha,
    source_mode:p.source.mode,
    filters:p.scope.filters,partial:p.scope.truncated,
    total_matched:p.scope.total_matched,returned:p.scope.returned,
    diagnostics:p.diagnostics,
    notice:'Derived research data only. Not historical certification. Source corpus unmodified.'
  };
  let output;
  if(format==='json'){
    output={data:JSON.stringify({manifest,records:p.result},null,2)+'\n',manifestText:null};
  }else if(format==='geojson'){
    if(module!=='geo')fail('UNSUPPORTED_MODULE_FORMAT');
    const features=p.result.map(row=>({type:'Feature',geometry:row.geometry??null,
      properties:{ref:row.ref,subject:row.subject,crs:row.crs,
        geometry_role:row.geometry_role,precision_meters:row.precision_meters,
        reference_version:row.reference_version,provenance:row.provenance}}));
    output={data:JSON.stringify({type:'FeatureCollection',tempora_manifest:manifest,features},null,2)+'\n',manifestText:null};
  }else if(format==='graphml'){
    if(module!=='graph')fail('UNSUPPORTED_MODULE_FORMAT');
    output=graphml(p.result,manifest);
  }else output=csv(p.result,manifest);
  if(Buffer.byteLength(output.data,'utf8')>MAX_EXPORT_BYTES||
     (output.manifestText&&Buffer.byteLength(output.manifestText,'utf8')>MAX_EXPORT_BYTES))
    fail('EXPORT_LIMIT');
  return {extension:format,manifest,
    bytes:Buffer.byteLength(output.data,'utf8'),sha256:createHash('sha256').update(output.data).digest('hex'),
    ...output};
}
module.exports=Object.freeze({buildExport,FORMATS,MAX_EXPORT_BYTES});
