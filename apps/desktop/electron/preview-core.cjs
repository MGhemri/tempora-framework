'use strict';
// Structural-only previews shared by Electron and the host contract tests.
// Generic metadata wins; ALNOP names are compatibility-only fallbacks.
const PREVIEW_LIMIT=7;
function label(value,fallback='—',limit=140){
  return typeof value==='string'?Array.from(value).slice(0,limit).join(''):fallback;
}
function textual(value){
  if(typeof value==='string')return value;
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    // Prefer a declared default if available, else a stable locale key order.
    const keys=Object.keys(value).sort();
    for(const key of keys)if(typeof value[key]==='string')return value[key];
  }
  return undefined;
}
function firstText(...values){
  for(const item of values){
    const v=textual(item);
    if(typeof v==='string'&&v.trim())return v;
  }
  return undefined;
}
function preview(data){
  const json=data.json;
  const geo=json?.type==='FeatureCollection';
  const records=geo?json.features:(Array.isArray(json)?json:json?.events??json?.records??json?.operations);
  const items=Array.isArray(records)?records:[];
  const count=key=>Array.isArray(json?.[key])?json[key].length:0;
  return {
    fileName:data.fileName,format:geo?'GeoJSON':'JSON',
    bytes:data.bytes,records:items.length,
    sources:count('sources'),assertions:count('claims')+count('assertions'),
    rows:items.slice(0,PREVIEW_LIMIT).map(item=>{
      const properties=geo&&item?.properties&&typeof item.properties==='object'&&!Array.isArray(item.properties)
        ?item.properties:{};
      const name=geo?
        firstText(properties.title,properties.name,properties.nom_operation):
        firstText(item?.title,item?.name);
      const type=geo?
        firstText(properties.kind,properties.event_type,properties.type,
          properties.type_action,item?.geometry?.type):
        firstText(item?.kind,item?.type);
      return {
        id:label(item?.id??(geo?properties.id:undefined),'—',80),
        title:label(name,'Untitled / Sans titre'),
        kind:label(type,'record',40)
      };
    }),
    note:'Structural preview only. Not canonical validation or historical fact verification.'
  };
}
module.exports=Object.freeze({preview});
