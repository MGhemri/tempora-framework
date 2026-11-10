import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutDeclaredGraph as graph} from '../../src/visualization/core/graph-layout.mjs';
const ref=(kind,id,namespace='SYNTHETIC_HISTORY')=>({kind,namespace,id});
const row=(id,source,target)=>({ref:ref('relation',id),
 source,target,edge_origin:'declared_relation',predicate:'declared_by_researcher'});
test('nodes depend on full kind+namespace+id and are stable under input order',()=>{
 const rows=[row('R1',ref('event','X'),ref('event','X','OTHER')),
  row('R2',ref('event','X','OTHER'),ref('source','X'))];
 const before=structuredClone(rows),a=graph(rows),b=graph([...rows].reverse());
 assert.deepEqual(a,b);
 assert.deepEqual(rows,before);
 assert.equal(a.nodes.length,3);
 assert.equal(a.edges.length,2);
 assert.equal(a.components,1);
 assert.equal(new Set(a.nodes.map(x=>x.key)).size,3);
});
test('separate connected groups are visual, preserving parallel directed edges',()=>{
 const a=ref('event','A'),b=ref('event','B');
 const view=graph([row('R1',a,b),row('R2',a,b),
  row('R3',ref('event','C'),ref('event','D'))]);
 assert.equal(view.components,2);
 assert.equal(view.nodes.length,4);
 assert.equal(view.edges.length,3);
 assert.deepEqual(view.edges.slice(0,2).map(x=>x.source),[JSON.stringify(['event','SYNTHETIC_HISTORY','A']),JSON.stringify(['event','SYNTHETIC_HISTORY','A'])]);
 assert.notEqual(view.nodes[0].component,view.nodes[3].component);
});
test('self-loops are retained and not assigned fictitious neighbors',()=>{
 const x=ref('entity','SELF');
 const view=graph([row('R1',x,x)]);
 assert.equal(view.nodes.length,1);
 assert.equal(view.edges.length,1);
 assert.equal(view.edges[0].self_loop,true);
});
test('untrusted/malformed edges remain table-only and never become relations',()=>{
 const x=ref('event','A'),y=ref('event','B');
 const view=graph([{source:x,target:y,ref:ref('relation','R'),edge_origin:'inferred'},
  row('BAD',x,{...y,namespace:'../../unsafe'}),
  {...row('BAD2',x,y),ref:ref('claim','BAD2')},
  row('GOOD',x,y)]);
 assert.equal(view.edges.length,1);
 assert.equal(view.omitted,3);
 assert.equal(view.page_edges,4);
});
test('bounded page and no bogus graph when there are zero valid relations',()=>{
 const none=graph([]);assert.equal(none.nodes.length,0);
 assert.equal(none.components,0);
 assert.equal(none.height,360);
 const many=Array.from({length:50},(_,i)=>row('R'+i,
  ref('event','A'+i),ref('event','B'+i)));
 const view=graph(many);assert.equal(view.edges.length,50);
 assert.equal(view.nodes.length,100);
 assert.ok(view.height>360);
 assert.throws(()=>graph([...many,many[0]]),/VISUAL_GRAPH_LAYOUT_LIMIT/);
});
