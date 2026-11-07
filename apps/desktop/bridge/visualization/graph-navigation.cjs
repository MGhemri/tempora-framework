'use strict';
// Read-only graph navigation through explicitly declared canonical relations.
// No inferred relationship is added to the corpus or scientific record.
const {canonical}=require('tempora-framework');
const {ref,refKey,projection}=require('./contracts.cjs');
const MAX_EDGES=5000,MAX_VISITED=1000,MAX_DEPTH=5,MAX_RETURN=100;
function fail(code){const e=new Error(code);e.code=code;throw e;}
function tuple(x){try{return ref(x);}catch{fail('INVALID_REFERENCE');}}
function walk(corpus,{root,depth=1,direction='both',limit=50,
  generatedAt='2026-01-01T00:00:00Z'}={}){
  if(!corpus||typeof corpus!=='object'||Array.isArray(corpus))fail('INVALID_CORPUS');
  if(!['in','out','both'].includes(direction))fail('INVALID_DIRECTION');
  if(!Number.isSafeInteger(depth)||depth<0||depth>MAX_DEPTH)fail('INVALID_DEPTH');
  if(!Number.isSafeInteger(limit)||limit<1||limit>MAX_RETURN)fail('INVALID_LIMIT');
  const validation=canonical.validateCorpus(corpus);
  if(!validation.valid)fail('CORPUS_NOT_VALIDATED');
  const origin=tuple(root), originKey=refKey(origin);
  const relations=Array.isArray(corpus.relations)?corpus.relations:[];
  if(relations.length>MAX_EDGES)fail('GRAPH_EDGE_LIMIT');
  const adj=new Map();
  function put(key,entry){
    if(!adj.has(key))adj.set(key,[]);
    adj.get(key).push(entry);
  }
  for(const relation of relations){
    const source=tuple(relation.subject),target=tuple(relation.object),
      edge=tuple({kind:'relation',namespace:relation.namespace,id:relation.id});
    const sk=refKey(source),tk=refKey(target),ek=refKey(edge);
    if(direction!=='in')put(sk,{source,target,edge,from:sk,to:tk,direction:'out'});
    if(direction!=='out')put(tk,{source,target,edge,from:tk,to:sk,direction:'in'});
  }
  for(const entries of adj.values())entries.sort((a,b)=>{
    const x=JSON.stringify([a.to,a.edge.id,a.direction]),y=JSON.stringify([b.to,b.edge.id,b.direction]);
    return x<y?-1:x>y?1:0;
  });
  let frontier=[originKey];
  const refs=new Map([[originKey,origin]]),dist=new Map([[originKey,0]]);
  const discovered=[];
  for(let level=0;level<depth && frontier.length;level++){
    const next=[];
    for(const key of frontier){
      for(const edge of adj.get(key)??[]){
        if(discovered.length>=MAX_EDGES)fail('GRAPH_EDGE_LIMIT');
        discovered.push({relation:edge.edge,source:edge.source,target:edge.target,
          traversal_direction:edge.direction,depth:level+1,
          edge_origin:'declared_relation'});
        if(!dist.has(edge.to)){
          if(dist.size>=MAX_VISITED)fail('GRAPH_NODE_LIMIT');
          dist.set(edge.to,level+1);
          const target=refKey(edge.target)===edge.to?edge.target:edge.source;
          refs.set(edge.to,target);next.push(edge.to);
        }
      }
    }
    frontier=next.sort();
  }
  discovered.sort((a,b)=>{
    const x=JSON.stringify([a.depth,refKey(a.relation),a.traversal_direction,
      refKey(a.source),refKey(a.target)]),
      y=JSON.stringify([b.depth,refKey(b.relation),b.traversal_direction,
      refKey(b.source),refKey(b.target)]);
    return x<y?-1:x>y?1:0;
  });
  const results=discovered.slice(0,limit);
  return projection({
    corpus,algorithm:{id:'tvrw.graph.bfs-declared',version:'1.0.0',
      parameters:{root:origin,depth,direction,limit}},
    mode:'validated',filters:{module:'graph',root:origin,depth,direction,limit},
    totalMatched:discovered.length,result:results,
    diagnostics:discovered.length>limit?
      [{code:'TRUNCATED',severity:'warning',count:discovered.length-limit}]:[],
    generatedAt
  });
}
module.exports=Object.freeze({walk,MAX_DEPTH,MAX_EDGES,MAX_VISITED});
