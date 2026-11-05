// Planar topology on bounded WGS84 coordinates; dateline polygons fail explicitly.
const eq=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(a,b,p)=>cross(a,b,p)===0&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
function intersects(a,b,c,d){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return (x*y<0&&z*w<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);}
function ringsCross(a,b){for(let i=0;i<a.length-1;i++)for(let j=0;j<b.length-1;j++)if(intersects(a[i],a[i+1],b[j],b[j+1]))return true;return false;}
function inside(p,ring){let v=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;}
function polygonErrors(poly){
 const errors=[];
 for(const ring of poly){
  if(!eq(ring[0],ring.at(-1)))errors.push('Ring must be closed');
  if(new Set(ring.slice(0,-1).map(p=>JSON.stringify(p))).size!==ring.length-1)errors.push('Ring has repeated vertices');
  let area=0;for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1];area+=a[0]*b[1]-b[0]*a[1];if(eq(a,b))errors.push('Zero-length ring edge');if(Math.abs(a[0]-b[0])>180)errors.push('Dateline polygon topology is unsupported');
   for(let j=i+1;j<ring.length-1;j++)if(j!==i+1&&!(i===0&&j===ring.length-2)&&intersects(a,b,ring[j],ring[j+1]))errors.push('Self-intersecting ring');
  }
  for(let i=0;i<ring.length-1;i++){const a=ring[(i+ring.length-2)%(ring.length-1)],b=ring[i],c=ring[(i+1)%(ring.length-1)];if(cross(a,b,c)===0&&((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))<0)errors.push('Ring edge reverses over an adjacent edge');}
  if(area===0)errors.push('Ring has zero area');
 }
 for(let i=1;i<poly.length;i++){
  if(!inside(poly[i][0],poly[0])||ringsCross(poly[0],poly[i]))errors.push('Hole is outside or crosses its shell');
  for(let j=1;j<i;j++)if(ringsCross(poly[i],poly[j])||inside(poly[i][0],poly[j])||inside(poly[j][0],poly[i]))errors.push('Holes overlap');
 }
 return errors;
}
function geometryErrors(g){
 if(g===null)return [];
 const errors=[];
 if(g.type==='LineString'&&g.coordinates.every(p=>eq(p,g.coordinates[0])))errors.push('Line has zero length');
 const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
 for(const p of polys)errors.push(...polygonErrors(p));
 const inPoly=(point,poly)=>inside(point,poly[0])&&!poly.slice(1).some(h=>inside(point,h));
 for(let i=0;i<polys.length;i++)for(let j=0;j<i;j++)if(polys[i].some(a=>polys[j].some(b=>ringsCross(a,b)))||inPoly(polys[i][0][0],polys[j])||inPoly(polys[j][0][0],polys[i]))errors.push('Polygon components overlap or touch');
 return [...new Set(errors)];
}
module.exports={geometryErrors};
