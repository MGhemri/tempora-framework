(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory();else globalThis.ALNOPQuery=factory();})(function(){
class HttpError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const invalid=message=>{throw new HttpError(400,'INVALID_QUERY',message);};
const shared=['q','source_id','status','sort','page','limit'];
const operationFilters=['from','to','date_precision','territory','territory_role','type','has_geometry','min_sources','bbox','format'];
const listKeys=['source_id','date_precision','territory','territory_role','type','status'];
function bounds(raw){
  if(!/^\d{4}(-\d{2}){0,2}$/.test(raw))invalid('Dates must use YYYY, YYYY-MM or YYYY-MM-DD.');
  const [year,month,day]=raw.split('-').map(Number),m=month??1,d=day??1;
  const first=`${String(year).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  if(m<1||m>12||d<1||!Number.isFinite(Date.parse(first))||new Date(first).toISOString().slice(0,10)!==first)invalid('Invalid calendar date.');
  const monthEnd=new Date(first);monthEnd.setUTCMonth(monthEnd.getUTCMonth()+1,0);
  const last=day?first:month?monthEnd.toISOString().slice(0,10):`${String(year).padStart(4,'0')}-12-31`;
  return {first,last};
}
function parseQuery(raw,resource){
  const allowed=new Set([...shared,...(resource==='operations'?operationFilters:resource==='claims'?['subject','claim_status']:[])]);
  const q={page:1,limit:20,sort:'id',format:'json',status:['published']};
  for(const [key,value]of Object.entries(raw)){
    if(!allowed.has(key))invalid(`Unsupported parameter: ${key}`);
    if(typeof value!=='string'||!value.length||value.length>1000)invalid(`Invalid or repeated parameter: ${key}`);
    if(['page','limit','min_sources'].includes(key)){
      if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))invalid(`Invalid integer: ${key}`);
      q[key]=Number(value);
    }else if(listKeys.includes(key)){
      q[key]=value.split(',');if(q[key].some(v=>!v.trim()||v!==v.trim())||q[key].length>30)invalid(`Invalid list: ${key}`);
    }else q[key]=value;
  }
  if(q.page<1||q.limit<1||q.limit>200)invalid('page must be positive; limit must be between 1 and 200.');
  if(!Number.isSafeInteger((q.page-1)*q.limit))invalid('Pagination offset is too large.');
  if(!['id','-id',...(resource==='operations'?['start_date','-start_date']:[])].includes(q.sort))invalid('Unsupported sort.');
  if(!['json','geojson'].includes(q.format))invalid('Unsupported format.');
  if(q.status.some(s=>s!=='published'))invalid('Only published records are publicly accessible.');
  if(q.from)q.from=bounds(q.from).first;if(q.to)q.to=bounds(q.to).last;
  if(q.from&&q.to&&q.from>q.to)invalid('Inverted date range.');
  if(q.date_precision?.some(v=>!['day','month','year','range','unknown'].includes(v)))invalid('Invalid date precision.');
  if(q.territory_role?.some(v=>!['primary','secondary','cross_territorial','uncertain'].includes(v)))invalid('Invalid territory role.');
  if(q.has_geometry!==undefined){if(!['true','false'].includes(q.has_geometry))invalid('has_geometry must be true or false.');q.has_geometry=q.has_geometry==='true';}
  if(q.bbox){
    const parts=q.bbox.split(',');if(parts.length!==4||parts.some(p=>!p.trim()||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(p)))invalid('bbox requires four finite numbers.');
    q.bbox=parts.map(Number);const [west,south,east,north]=q.bbox;
    if(Math.abs(west)>180||Math.abs(east)>180||Math.abs(south)>90||Math.abs(north)>90||south>north)invalid('Invalid bbox bounds.');
  }
  if(q.claim_status&&!['supported','contested','unverified'].includes(q.claim_status))invalid('Invalid claim status.');
  return q;
}
function normalize(s){return String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ـ/g,'').toLowerCase();}
function matches(record,q,resource){
  if(q.q){const text=resource==='operations'?[record.title?.fr,record.title?.ar,record.description?.fr,record.description?.ar,record.legacy?.description].join(' '):
    resource==='sources'?[record.title,record.author||record.legacy?.auteur].join(' '):resource==='claims'?[record.predicate,record.value&&typeof record.value==='object'?Object.values(record.value).join(' '):String(record.value)].join(' '):[...Object.values(record.label||(!Array.isArray(record.names)&&record.names)||{}),...(record.names instanceof Array?record.names.map(n=>n.value):[])].join(' ');
    if(!normalize(text).includes(normalize(q.q)))return false;}
  const sourceIds=resource==='claims'?record.evidence.map(e=>e.source_id):resource==='sources'?[record.source_id]:record.source_ids||[];
  if(q.source_id&&!q.source_id.some(s=>sourceIds.includes(s)))return false;
  if(resource==='claims'&&((q.subject&&q.subject!==record.subject)||(q.claim_status&&q.claim_status!==record.status)))return false;
  if(resource!=='operations')return true;
  const start=record.start_date,end=record.end_date;
  const earliest=start.earliest,latest=end.latest||start.latest;
  if((q.from||q.to)&&(!earliest||!latest||(q.from&&latest<q.from)||(q.to&&earliest>q.to)))return false;
  if(q.date_precision&&!q.date_precision.includes(start.precision))return false;
  const assignments=record.territorial_assignments;
  if((q.territory||q.territory_role)&&!assignments.some(t=>(!q.territory||q.territory.includes(t.territory_id))&&(!q.territory_role||q.territory_role.includes(t.role))))return false;
  if(q.type&&!q.type.some(t=>(record.event_type||[record.legacy?.type_action]).includes(t)))return false;
  const points=record.locations.filter(l=>l.geometry?.type==='Point').map(l=>l.geometry.coordinates);
  if(q.has_geometry!==undefined&&q.has_geometry!==(points.length>0))return false;
  if(q.min_sources!==undefined&&record.source_ids.length<q.min_sources)return false;
  if(q.bbox){const [w,s,e,n]=q.bbox;if(!points.some(([x,y])=>y>=s&&y<=n&&(w<=e?x>=w&&x<=e:x>=w||x<=e)))return false;}
  return true;
}
function select(records,q,resource){
  const filtered=records.filter(r=>matches(r,q,resource)),desc=q.sort.startsWith('-'),date=q.sort.includes('start_date');
  filtered.sort((a,b)=>{
    if(date){const x=a.start_date.earliest,y=b.start_date.earliest;if(!x||!y){if(x!==y)return x?-1:1;}else if(x!==y)return (x<y?-1:1)*(desc?-1:1);}
    const x=a.id||a.source_id,y=b.id||b.source_id;return (x<y?-1:x>y?1:0)*(date?1:desc?-1:1);
  });
  const offset=(q.page-1)*q.limit;
  return {total:filtered.length,data:filtered.slice(offset,offset+q.limit),has_next:offset+q.limit<filtered.length};
}
return {HttpError,invalid,bounds,parseQuery,select};
});
