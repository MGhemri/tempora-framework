import {layoutGeographicPoints} from "./geo-layout.mjs";
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
  const layout=layoutGeographicPoints(rows);
  frame(svg,360);
  // Coordinate plot only. No unverified base map, no inferred spatial joins.
  for(let i=1;i<4;i++){
    const x=35+i*730/4,y=18+i*305/4;
    svg.append(elem("line",{x1:x,y1:18,x2:x,y2:323,
      stroke:"currentColor","stroke-opacity":0.13}));
    svg.append(elem("line",{x1:35,y1:y,x2:765,y2:y,
      stroke:"currentColor","stroke-opacity":0.13}));
  }
  if(!layout.extent){
    text(svg,50,55,"No point coordinates / Aucune coordonnée ponctuelle");
    return;
  }
  const bounds=layout.extent;
  text(svg,40,344,"Lon "+bounds.west.toFixed(2)+"°…"+bounds.east.toFixed(2)+
    "° · Lat "+bounds.south.toFixed(2)+"°…"+bounds.north.toFixed(2)+"°");
  if(layout.skipped)text(svg,40,14,layout.skipped+" non-point/invalid: table only");
  for(const cluster of layout.clusters){
    if(cluster.declared_precision_pixels>1){
      svg.append(elem("circle",{cx:cluster.x,cy:cluster.y,
        r:Math.max(5,cluster.declared_precision_pixels),fill:"none",
        stroke:"currentColor","stroke-width":1,"stroke-dasharray":"4 4",
        "stroke-opacity":0.42}));
    }
    const circle=elem("circle",{cx:cluster.x,cy:cluster.y,
      r:cluster.count>1?10:cluster.approximate?7:5,
      fill:cluster.approximate?"none":"currentColor",
      stroke:"currentColor","stroke-width":cluster.count>1?3:2});
    const detail=elem("title");
    detail.textContent=cluster.references.slice(0,5).join(", ")+
      (cluster.references.length>5?"…":"")+
      " — local visual grouping only";
    circle.append(detail);
    svg.append(circle);
    if(cluster.count>1)text(svg,cluster.x+11,cluster.y-6,String(cluster.count)+" locations");
    else if(layout.clusters.length<=12)
      text(svg,Math.min(cluster.x+11,690),Math.max(cluster.y-6,30),
        cluster.references[0].split(":").pop()??"");
  }
}
function interactiveGeo(target:HTMLElement,svg:SVGElement):void{
  const bar=document.createElement("div");
  bar.className="visual-geo-controls";
  const view={x:0,y:0,w:800,h:360};
  const apply=()=>svg.setAttribute("viewBox",
    [view.x,view.y,view.w,view.h].join(" "));
  const zoom=(factor:number)=>{
    const w=Math.min(800,Math.max(100,view.w/factor)),h=w*360/800;
    view.x=Math.max(0,Math.min(800-w,view.x+(view.w-w)/2));
    view.y=Math.max(0,Math.min(360-h,view.y+(view.h-h)/2));
    view.w=w;view.h=h;apply();
  };
  const control=(label:string,symbol:string,action:()=>void)=>{
    const button=document.createElement("button");
    button.type="button";button.className="visual-geo-button";
    button.textContent=symbol;button.setAttribute("aria-label",label);
    button.addEventListener("click",action);bar.append(button);
  };
  control("Zoom in / Agrandir","+ ",()=>zoom(1.5));
  control("Zoom out / Réduire","−",()=>zoom(1/1.5));
  control("Reset map view / Recentrer","↺",()=>{
    Object.assign(view,{x:0,y:0,w:800,h:360});apply();
  });
  svg.style.touchAction="none";
  svg.addEventListener("wheel",event=>{
    event.preventDefault();
    zoom((event as WheelEvent).deltaY<0?1.2:1/1.2);
  },{passive:false});
  let dragging:{x:number;y:number}|null=null;
  svg.addEventListener("pointerdown",event=>{
    const e=event as PointerEvent;
    if(e.button!==0)return;
    dragging={x:e.clientX,y:e.clientY};
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove",event=>{
    if(!dragging||view.w>=800)return;
    const e=event as PointerEvent;
    const bounds=svg.getBoundingClientRect();
    if(bounds.width<=0||bounds.height<=0)return;
    view.x=Math.max(0,Math.min(800-view.w,
      view.x-(e.clientX-dragging.x)*view.w/bounds.width));
    view.y=Math.max(0,Math.min(360-view.h,
      view.y-(e.clientY-dragging.y)*view.h/bounds.height));
    dragging={x:e.clientX,y:e.clientY};apply();
  });
  for(const name of ["pointerup","pointercancel"])
    svg.addEventListener(name,()=>{dragging=null;});
  const note=document.createElement("p");
  note.className="visual-geo-note";
  note.textContent="Repère local auto-ajusté · agrégation visuelle, non historique · "+
    "aucun fond cartographique ni géocodage · tableau complet ci-dessous / "+
    "Local coordinate view, not a verified map.";
  target.append(bar,svg,note);
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
  if(module==="geo"){
    geo(svg,rows);
    interactiveGeo(target,svg);
  }else{
    if(module==="graph")graph(svg,rows);
    else chronos(svg,rows);
    target.append(svg);
  }
}
