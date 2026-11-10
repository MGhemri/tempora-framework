// Deterministic, presentation-only local coordinate layout.
// NEVER interpreted as geocoding, spatial precision or a new canonical fact.
const BOX=Object.freeze({width:800,height:360,x:35,y:18,w:730,h:305});
const compare=(a,b)=>a<b?-1:a>b?1:0;
const wrap=lon=>((lon+180)%360+360)%360-180;
const ref=row=>[row?.ref?.kind,row?.ref?.namespace,row?.ref?.id]
  .every(v=>typeof v==='string')?
  [row.ref.kind,row.ref.namespace,row.ref.id].join(':'):'unknown';
function validPoint(row){
 const g=row?.geometry;
 if(g?.type!=='Point'||!Array.isArray(g.coordinates)||g.coordinates.length<2)return null;
 const [lon,lat]=g.coordinates;
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||
    lon< -180||lon>180||lat< -90||lat>90)return null;
 return {reference:ref(row),lon,lat,
  approximate:row.geometry_role!=='exact_site',
  precision_meters:Number.isFinite(row.precision_meters)&&row.precision_meters>=0?
   row.precision_meters:null};
}
export function layoutGeographicPoints(rows){
 if(!Array.isArray(rows)||rows.length>100)throw Error('VISUAL_GEO_LAYOUT_LIMIT');
 const points=[],skipped=[];
 for(const row of rows){
  const point=validPoint(row);
  if(point)points.push(point);else skipped.push(ref(row));
 }
 if(!points.length)return Object.freeze({
  total:0,skipped:skipped.length,clusters:[],extent:null,
  view:'read_only_coordinate_plot'
 });
 // Find the shortest circular longitude arc, including ±180° antimeridian.
 // This avoids placing two neighboring observations at opposite chart edges.
 const circle=points.map(p=>(p.lon+360)%360).sort((a,b)=>a-b);
 let largest=-1,cut=0;
 for(let i=0;i<circle.length;i++){
  const gap=(i===circle.length-1?circle[0]+360:circle[i+1])-circle[i];
  if(gap>largest){largest=gap;cut=(i+1)%circle.length;}
 }
 const begin=circle[cut];
 const unwrapped=points.map(p=>{
  const angle=(p.lon+360)%360;
  return {...p,u:angle<begin?angle+360:angle};
 });
 const west=Math.min(...unwrapped.map(p=>p.u));
 const east=Math.max(...unwrapped.map(p=>p.u));
 const south=Math.min(...points.map(p=>p.lat));
 const north=Math.max(...points.map(p=>p.lat));
 const middleLon=(west+east)/2,middleLat=(south+north)/2;
 const cos=Math.max(.15,Math.cos(middleLat*Math.PI/180));
 const xSpan=Math.max((east-west)*cos,.30),ySpan=Math.max(north-south,.30);
 const scale=Math.min(BOX.w/(xSpan*1.24),BOX.h/(ySpan*1.24));
 const sorted=unwrapped.sort((a,b)=>
  compare(a.reference,b.reference)||a.lat-b.lat||a.lon-b.lon);
 const cells=new Map();
 for(const p of sorted){
  const x=BOX.x+BOX.w/2+(p.u-middleLon)*cos*scale;
  const y=BOX.y+BOX.h/2-(p.lat-middleLat)*scale;
  const radius=p.precision_meters===null?0:
   Math.min(65,p.precision_meters*scale/111320);
  const key=Math.floor(x/26)+':'+Math.floor(y/26);
  if(!cells.has(key))cells.set(key,[]);
  cells.get(key).push({x,y,reference:p.reference,approximate:p.approximate,
   precision_pixels:radius});
 }
 const clusters=[...cells.values()].map(group=>Object.freeze({
  x:group.reduce((n,p)=>n+p.x,0)/group.length,
  y:group.reduce((n,p)=>n+p.y,0)/group.length,
  count:group.length,
  approximate:group.some(p=>p.approximate),
  declared_precision_pixels:Math.max(...group.map(p=>p.precision_pixels)),
  references:Object.freeze(group.map(p=>p.reference))
 })).sort((a,b)=>compare(a.references[0],b.references[0]));
 return Object.freeze({total:points.length,skipped:skipped.length,
  clusters:Object.freeze(clusters),view:'read_only_coordinate_plot',
  extent:Object.freeze({west:wrap(west),east:wrap(east),
   south,north,antimeridian:west<180&&east>180||east>360})
 });
}
