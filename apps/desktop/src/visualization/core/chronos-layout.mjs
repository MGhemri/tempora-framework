// J10: deterministic, presentation-only Gregorian civil date layout.
// Unknown end stays unknown; no implied duration or end date.
const MONTHS=[31,28,31,30,31,30,31,31,30,31,30,31];
const leap=y=>y%4===0&&(y%100!==0||y%400===0);
function date(v){
 if(typeof v!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v))return null;
 const y=+v.slice(0,4),m=+v.slice(5,7),d=+v.slice(8,10);
 if(y<1||m<1||m>12||d<1||d>MONTHS[m-1]+(m===2&&leap(y)?1:0))return null;
 const n=y-1;let ordinal=n*365+Math.floor(n/4)-Math.floor(n/100)+Math.floor(n/400)+d;
 for(let i=0;i<m-1;i++)ordinal+=MONTHS[i]+(i===1&&leap(y)?1:0);
 return {text:v,ordinal};
}
function range(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||v.kind==='unknown')return null;
 const early=date(v.earliest),late=date(v.latest);
 if(!early||!late||early.ordinal>late.ordinal)return null;
 return {early,late};
}
function ref(row){
 const r=row?.ref;
 return r&&['kind','namespace','id'].every(k=>typeof r[k]==='string')?
 [r.kind,r.namespace,r.id].join(':'):'unknown';
}
export function layoutDeclaredChronology(rows){
 if(!Array.isArray(rows)||rows.length>50)throw Error('VISUAL_CHRONOS_LAYOUT_LIMIT');
 const valid=[];let omitted=0,unknownEnds=0,uncertain=0;
 for(const row of rows){
  const start=range(row?.start_date),end=range(row?.end_date);
  const unknownEnd=row?.end_date==null||row.end_date.kind==='unknown';
  if(!start||(!unknownEnd&&!end)||(end&&end.late.ordinal<start.early.ordinal)){
   omitted++;continue;
  }
  const uncertainty=start.early.ordinal!==start.late.ordinal||
   Boolean(end&&end.early.ordinal!==end.late.ordinal);
  if(uncertainty)uncertain++;
  if(unknownEnd)unknownEnds++;
  const identity=ref(row);
  valid.push({reference:identity,
   label:typeof row.label==='string'&&row.label.trim()?row.label.trim().slice(0,72):identity,
   start,end,unknownEnd,uncertainty});
 }
 valid.sort((a,b)=>a.start.early.ordinal-b.start.early.ordinal||
  (a.reference<b.reference?-1:a.reference>b.reference?1:0)||
  (a.label<b.label?-1:a.label>b.label?1:0));
 if(!valid.length)return Object.freeze({view:'read_only_civil_date_plot',
   entries:Object.freeze([]),axis:null,height:360,omitted,
   unknown_end_count:0,uncertain_count:0});
 const dates=valid.flatMap(v=>[v.start.early,v.start.late,
  ...(v.end?[v.end.early,v.end.late]:[])]);
 const min=Math.min(...dates.map(v=>v.ordinal));
 const max=Math.max(...dates.map(v=>v.ordinal));
 const px=d=>205+(d.ordinal-min)*545/Math.max(1,max-min);
 const entries=valid.map((v,i)=>Object.freeze({
  reference:v.reference,label:v.label,y:76+i*28,
  start_earliest:v.start.early.text,start_latest:v.start.late.text,
  end_earliest:v.end?.early.text??null,end_latest:v.end?.late.text??null,
  start_x0:px(v.start.early),start_x1:px(v.start.late),
  end_x0:v.end?px(v.end.early):null,end_x1:v.end?px(v.end.late):null,
  unknown_end:v.unknownEnd,uncertain:v.uncertainty,
  certain_duration:Boolean(v.end&&v.start.late.ordinal<=v.end.early.ordinal)
 }));
 return Object.freeze({view:'read_only_civil_date_plot',entries:Object.freeze(entries),
  axis:Object.freeze({earliest:dates.find(v=>v.ordinal===min).text,
   latest:dates.find(v=>v.ordinal===max).text,x0:205,x1:750}),
  height:Math.max(360,76+entries.length*28+58),omitted,
  unknown_end_count:unknownEnds,uncertain_count:uncertain});
}
