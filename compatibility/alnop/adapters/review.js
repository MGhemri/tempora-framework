const crypto=require('node:crypto');
function canonicalValue(value){
  if(Array.isArray(value))return value.map(canonicalValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(k=>k!=='review_history').sort().map(k=>[k,canonicalValue(value[k])]));
  return value;
}
function contentDigest(record){return crypto.createHash('sha256').update(JSON.stringify(canonicalValue(record))).digest('hex');}
function approved(record){
  const r=record?.review_history?.at(-1);
  if(!r||r.decision!=='approved'||!r.reviewer?.trim()||!r.reason?.trim()||!Number.isFinite(Date.parse(r.reviewed_at)))return false;
  try{if(!['https:','http:'].includes(new URL(r.reference).protocol))return false;}catch{return false;}
  return r.content_sha256===contentDigest(record);
}
function checkChanges(changes,{publicSourceIds=new Set()}={}){
  const errors=[];
  for(const {file,before,after}of changes){
    if(!/^data\/(operations|claims|persons|organizations|places|sources|territorial-units|duplicate-assessments)\/[A-Za-z0-9_-]+\.json$/.test(file))continue;
    if(before&&!after){errors.push(`${file}: retain the ID and record a withdrawal instead of deleting`);continue;}
    if(!after||JSON.stringify(before)===JSON.stringify(after))continue;
    const isPublic=r=>['published','reviewed'].includes(r?.editorial_status)||(file.includes('/sources/')&&publicSourceIds.has(r?.source_id))||file.includes('/territorial-units/');
    if(!isPublic(before)&&!isPublic(after))continue;
    if(before&&(before.id||before.source_id)!==(after.id||after.source_id))errors.push(`${file}: permanent identity changed`);
    const oldHistory=before?.review_history||[],history=after.review_history||[];
    if(history.length<=oldHistory.length||JSON.stringify(history.slice(0,oldHistory.length))!==JSON.stringify(oldHistory))errors.push(`${file}: append a new review; preserve the previous decisions`);
    if(!approved(after))errors.push(`${file}: a new approved review must match the exact content_sha256`);
  }
  return errors;
}
module.exports={contentDigest,approved,checkChanges};
