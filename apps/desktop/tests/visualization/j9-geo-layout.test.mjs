import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutGeographicPoints} from '../../src/visualization/core/geo-layout.mjs';
const row=(id,lon,lat,role='exact_site',precision=null)=>({
 ref:{kind:'spatial',namespace:'SYNTHETIC_HISTORY',id},
 geometry:{type:'Point',coordinates:[lon,lat]},
 geometry_role:role,precision_meters:precision
});
test('local Algerian points use the plot area rather than being compressed on a world map',()=>{
 const l=layoutGeographicPoints([row('ORAN',-0.64,35.69),row('TLEMCEN',-1.31,34.89),
   row('MOSTAGANEM',0.09,35.93)]);
 assert.equal(l.total,3);
 assert.equal(l.skipped,0);
 assert.equal(l.view,'read_only_coordinate_plot');
 assert.ok(l.clusters.every(p=>p.x>=35&&p.x<=765&&p.y>=18&&p.y<=323));
 const range=Math.max(...l.clusters.map(x=>x.x))-Math.min(...l.clusters.map(x=>x.x));
 assert.ok(range>100,'auto-focus should spread nearby provincial observations');
});
test('antimeridian points remain adjacent without external map tiles',()=>{
 const l=layoutGeographicPoints([row('WEST',179.6,20),row('EAST',-179.7,20.1)]);
 assert.equal(l.extent.antimeridian,true);
 const [a,b]=l.clusters;
 assert.ok(Math.abs(a.x-b.x)<730,'shortest circular longitude arc');
});
test('overlap is visual grouping, not an inferred historical relation',()=>{
 const input=[row('C',-0.64,35.7,'approximate_site',2000),
  row('B',-0.64,35.7,'exact_site'),row('A',-0.64,35.7,'unknown')];
 const a=layoutGeographicPoints(input),b=layoutGeographicPoints([...input].reverse());
 assert.deepEqual(a,b);
 assert.equal(a.clusters.length,1);
 assert.equal(a.clusters[0].count,3);
 assert.equal(a.clusters[0].approximate,true);
 assert.ok(a.clusters[0].declared_precision_pixels>0);
 assert.deepEqual(a.clusters[0].references,[
  'spatial:SYNTHETIC_HISTORY:A','spatial:SYNTHETIC_HISTORY:B',
  'spatial:SYNTHETIC_HISTORY:C']);
});
test('non-points, invalid coordinates and no data are transparent',()=>{
 const bad={ref:{kind:'spatial',namespace:'X',id:'POLYGON'},
  geometry:{type:'Polygon',coordinates:[]}};
 const l=layoutGeographicPoints([row('REAL',0,0),row('INVALID',181,0),bad]);
 assert.equal(l.total,1);
 assert.equal(l.skipped,2);
 assert.equal(layoutGeographicPoints([]).extent,null);
 assert.equal(layoutGeographicPoints([bad]).clusters.length,0);
 assert.throws(()=>layoutGeographicPoints(Array.from({length:101},(_,i)=>row(String(i),0,0))),
  /VISUAL_GEO_LAYOUT_LIMIT/);
});
test('input coordinates and roles are never modified by presentation',()=>{
 const rows=[row('A',-1,35,'approximate_site',500)];
 const copy=structuredClone(rows);
 layoutGeographicPoints(rows);
 assert.deepEqual(rows,copy);
});
