// TVRW J11: stable, page-scoped rendering of *declared* graph relations.
// Pure presentation; connected visual groups are NOT scientific claims.
const KINDS=new Set(['event','source','claim','entity','spatial','relation',
 'review','assessment','release']);
function ref(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const {kind,namespace,id}=value;
 if(!KINDS.has(kind)||![namespace,id].every(v=>typeof v==='string'&&
  /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(v)))return null;
 return {kind,namespace,id};
}
const key=r=>JSON.stringify([r.kind,r.namespace,r.id]);
const compare=(a,b)=>a<b?-1:a>b?1:0;
export function layoutDeclaredGraph(rows){
 if(!Array.isArray(rows)||rows.length>50)throw Error('VISUAL_GRAPH_LAYOUT_LIMIT');
 const refs=new Map(),adjacent=new Map(),edges=[];let omitted=0;
 for(const row of rows){
  const src=ref(row?.source),dst=ref(row?.target);
  const relation=ref(row?.ref);
  if(!src||!dst||!relation||relation.kind!=='relation'||
     row?.edge_origin!=='declared_relation'){omitted++;continue;}
  const a=key(src),b=key(dst);
  refs.set(a,src);refs.set(b,dst);
  if(!adjacent.has(a))adjacent.set(a,new Set());
  if(!adjacent.has(b))adjacent.set(b,new Set());
  adjacent.get(a).add(b);adjacent.get(b).add(a);
  edges.push(Object.freeze({reference:key(relation),source:a,target:b,
   predicate:typeof row.predicate==='string'?row.predicate.slice(0,160):null,
   self_loop:a===b}));
 }
 edges.sort((a,b)=>compare(a.reference,b.reference)||
  compare(a.source,b.source)||compare(a.target,b.target));
 const ordered=[...refs.keys()].sort(compare);
 const seen=new Set(),components=[];
 for(const root of ordered){
  if(seen.has(root))continue;
  const queue=[root],component=[];seen.add(root);
  for(let i=0;i<queue.length;i++){
   const vertex=queue[i];component.push(vertex);
   for(const neighbor of [...adjacent.get(vertex)].sort(compare)){
    if(!seen.has(neighbor)){seen.add(neighbor);queue.push(neighbor);}
   }
  }
  components.push(component.sort(compare));
 }
 // Each declared connected component is placed in a separate visual cell.
 // Placement and edge direction are visual only; no historical rank/causality.
 const CELL_H=180,CELL_W=390,COLS=2;
 const height=Math.max(360,Math.ceil(components.length/COLS)*CELL_H+45);
 const nodes=[];
 for(let i=0;i<components.length;i++){
  const c=components[i],cx=205+(i%COLS)*CELL_W;
  const cy=85+Math.floor(i/COLS)*CELL_H;
  for(let j=0;j<c.length;j++){
   const angle=2*Math.PI*j/Math.max(1,c.length)-Math.PI/2;
   nodes.push(Object.freeze({key:c[j],ref:Object.freeze({...refs.get(c[j])}),
    x:cx+(c.length===1?0:Math.cos(angle)*125),
    y:cy+(c.length===1?0:Math.sin(angle)*58),
    component:i}));
  }
 }
 nodes.sort((a,b)=>compare(a.key,b.key));
 return Object.freeze({view:'read_only_declared_relations',
  nodes:Object.freeze(nodes),edges:Object.freeze(edges),
  components:components.length,omitted,height,
  page_edges:rows.length,displayed_edges:edges.length});
}
