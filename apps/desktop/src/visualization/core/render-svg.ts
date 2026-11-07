// Presentation-only, read-only offline SVG renderers for TEMPORA TVRW.
// Canonical interpretation and algorithms are exclusively in the Node worker.
// The original record table remains the accessible fallback for every view.
type R = {kind?:unknown;namespace?:unknown;id?:unknown};
type Row = Record<string,unknown>;
const NS="http://www.w3.org/2000/svg";
function elem(name:string,attrs:Record<string,string|number>={}):SVGElement{
  const el=document.createElementNS(NS,name);
  for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));
  return el;
}
function text(svg:SVGElement,x:number,y:number,content:string){
  const node=elem("text",{x,y,fill:"currentColor","font-size":11});
  node.textContent=content.slice(0,56);svg.append(node);
}
function ref(r:unknown):string{
  if(!r||typeof r!=="object")return "unknown";
  const v=r as R;return [v.kind,v.namespace,v.id].filter(x=>typeof x==="string").join(":").slice(0,120);
}
function canvas(title:string,height=360){
  const svg=elem("svg",{viewBox:`0 0 800 ${height}`,width:"100%",role:"img","aria-label":title});
  svg.setAttribute("preserveAspectRatio","xMidYMid meet");
  return svg;
}
function frame(svg:SVGElement,height:number){
  svg.append(elem("rect",{x:35,y:18,width:730,height:height-55,fill:"none",
    stroke:"currentColor","stroke-opacity":0.2}));
}
function geo(svg:SVGElement,rows:Row[]):void{
  const toX=(lon:number)=>35+(lon+180)/360*730;
  const toY=(lat:number)=>18+(90-lat)/180*305;
  frame(svg,360);text(svg,40,340,"W 180° · E 180° | N 90° · S 90°");
  let drawn=0,skipped=0;
  for(const row of rows){
    const g=row.geometry as {type?:string;coordinates?:unknown}|null;
    if(g?.type!=="Point"||!Array.isArray(g.coordinates)||g.coordinates.length<2){skipped++;continue;}
    const [lon,lat]=g.coordinates;
    if(typeof lon!=="number"||typeof lat!=="number"||lon< -180||lon>180||lat< -90||lat>90){skipped++;continue;}
    const x=toX(lon),y=toY(lat);
    const approximate=row.geometry_role!=="exact_site";
    svg.append(elem("circle",{cx:x,cy:y,r:approximate?7:4,
      fill:approximate?"none":"currentColor",stroke:"currentColor","stroke-width":2}));
    text(svg,Math.min(x+9,690),Math.max(y-6,30),ref(row.ref).split(":").pop()??"");
    drawn++;
  }
  if(skipped)text(svg,40,14,String(skipped)+" geometries: table only / tableau uniquement");
  if(!drawn)text(svg,50,55,"No point coordinates / Aucune coordonnée ponctuelle");
}
function graph(svg:SVGElement,rows:Row[]):void{
  const nodes=[...new Set(rows.flatMap(row=>[ref(row.source),ref(row.target)])
    .filter(id=>id!=="unknown"))].sort();
  const points=new Map<string,[number,number]>();
  nodes.forEach((id,i)=>{
    const a=2*Math.PI*i/Math.max(nodes.length,1)-Math.PI/2;
    points.set(id,[400+260*Math.cos(a),170+122*Math.sin(a)]);
  });
  for(const row of rows){
    const src=points.get(ref(row.source)),dst=points.get(ref(row.target));
    if(!src||!dst)continue;
    svg.append(elem("line",{x1:src[0],y1:src[1],x2:dst[0],y2:dst[1],
      stroke:"currentColor","stroke-opacity":0.5,"stroke-width":1.5}));
  }
  for(const [id,[x,y]] of points){
    svg.append(elem("circle",{cx:x,cy:y,r:6,fill:"currentColor"}));
    text(svg,Math.min(x+10,705),y-8,id.split(":").pop()??id);
  }
  if(!nodes.length)text(svg,45,50,"No declared relation / Aucune relation déclarée");
  text(svg,40,340,"Layout is illustrative; no historical ranking / Placement illustratif uniquement");
}
function chronos(svg:SVGElement,rows:Row[]):void{
  const entries=rows.slice(0,12).map(row=>{
    const start=row.start_date as {earliest?:string|null;latest?:string|null}|null;
    const end=row.end_date as {earliest?:string|null;latest?:string|null}|null;
    const left=start?.earliest?Number(start.earliest.slice(0,4)):null;
    const right=end?.latest?Number(end.latest.slice(0,4)):start?.latest?Number(start.latest.slice(0,4)):null;
    return {label:ref(row.ref).split(":").pop()??"",left,right};
  }).filter(x=>x.left!==null&&x.right!==null&&x.left<=x.right);
  if(!entries.length){text(svg,45,50,"No bounded temporal interval / Pas de bornes temporelles");return;}
  const min=Math.min(...entries.map(x=>x.left!));
  const max=Math.max(...entries.map(x=>x.right!));
  const span=Math.max(max-min,1);
  text(svg,180,22,String(min));text(svg,735,22,String(max));
  svg.append(elem("line",{x1:180,y1:30,x2:745,y2:30,stroke:"currentColor","stroke-opacity":0.5}));
  entries.forEach((entry,i)=>{
    const y=48+i*24; text(svg,8,y+4,entry.label);
    const x=180+(entry.left!-min)/span*560;
    const end=180+(entry.right!-min)/span*560;
    svg.append(elem("rect",{x,y,width:Math.max(end-x,3),height:10,
      fill:"currentColor","fill-opacity":0.65}));
  });
  text(svg,180,347,"Declared civil-year spans; not inferred event dates");
}
/** Render only geometries explicitly represented by returned rows. */
export function renderScientificGraphic(target:HTMLElement,module:string,rows:Row[]):void{
  target.replaceChildren();
  if(!["geo","graph","chronos"].includes(module))return;
  const svg=canvas(module+" — declared data preview");
  if(module==="geo")geo(svg,rows);
  else if(module==="graph")graph(svg,rows);
  else chronos(svg,rows);
  target.append(svg);
}
