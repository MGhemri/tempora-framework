const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateCorpus,validateObject,digest,canonicalStringify}=require('../src/framework/canonical');
const {temporal,temporalRelation}=require('../src/framework/temporal');
const {nativeCorpus}=require('./helpers/tempora');
function ok(corpus){const r=validateCorpus(corpus);assert.equal(r.valid,true,JSON.stringify(r.errors));}
function invalid(corpus,code){const r=validateCorpus(corpus);assert.equal(r.valid,false);if(code)assert.ok(r.errors.some(e=>e.code===code),JSON.stringify(r.errors));}
function spatial(corpus,geometry,role='approximate_area'){
 const e=corpus.events[0],ref={kind:'spatial',namespace:e.namespace,id:'GEOMETRY_1'};
 corpus.spatial_assertions=[{...e,kind:'spatial',id:ref.id,subject:{kind:'event',namespace:e.namespace,id:e.id}}];
 const s=corpus.spatial_assertions[0];for(const key of ['title','description','start_date','end_date','event_type','spatial_refs','territory_refs','participant_refs','review_refs'])delete s[key];
 Object.assign(s,{label:null,geometry,crs:'EPSG:4326',geometry_role:geometry?role:'unknown',precision_meters:null,geocoding_method:null,reference_version:null,place:null});e.spatial_refs=[ref];return s;
}




test('The same canonical validator accepts an independent nonmilitary profile with English and Spanish and honest unknowns',()=>{
 const c=nativeCorpus(),before=structuredClone(c);ok(c);assert.equal(c.claims[0].value,0);assert.equal(c.events[0].end_date.earliest,null);assert.deepEqual(c,before);
 const changed=structuredClone(c);changed.events[0].start_date=temporal('1956');invalid(changed,'DATE_OUTSIDE_PROFILE');
 changed.events[0].start_date=temporal('1700');changed.events[0].event_type=['undeclared'];const checked=validateCorpus(changed);assert.equal(checked.valid,true);assert.ok(checked.warnings.some(d=>d.code==='VOCABULARY_UNKNOWN'));
});
test('Gregorian exact, year, month, interval, before, after and unknown remain distinct',()=>{
 for(const raw of [null,'0001','0099-02','1600-02','1700','1800-02','1700-01-02'])assert.equal(validateObject('temporal-expression',temporal(raw)).valid,true);
 assert.equal(temporal('0099-02').latest,'0099-02-28');assert.equal(temporal('1600-02').latest,'1600-02-29');
 for(const raw of ['0000','1700-02-29','-0044-01-01','1700-13','1700-01-00'])assert.throws(()=>temporal(raw));
 const before={...temporal(null),kind:'before',precision:'range',latest:'1700-01-01'};
 const after={...temporal(null),kind:'after',precision:'range',earliest:'1700-01-01'};
 const interval={...temporal(null),kind:'interval',precision:'range',earliest:'1700-01-01',latest:null};
 for(const t of [before,after,interval])assert.equal(validateObject('temporal-expression',t).valid,true);
 assert.equal(temporalRelation(before,after),'before');assert.equal(temporalRelation(temporal('1700'),temporal('1700-06')),'overlap');
 assert.equal(temporalRelation(temporal('1700-01-01'),temporal('1700-01-01')),'contemporary');assert.equal(temporalRelation(temporal(null),after),'indeterminate');
 for(const t of [{...temporal('1700'),precision:'day'},{...temporal(null),earliest:'1700-01-01'},{...before,earliest:'1600-01-01'},{...temporal('1700'),calendar:'julian'}])assert.equal(validateObject('temporal-expression',t).valid,false);
});
test('Supported GeoJSON geometries and null require explicit roles and never manufacture coordinates',()=>{
 const square=[[0,0],[4,0],[4,4],[0,4],[0,0]];
 for(const geometry of [null,{type:'Point',coordinates:[-180,90]},{type:'MultiPoint',coordinates:[[1,2],[3,4]]},{type:'LineString',coordinates:[[1,2],[3,4]]},{type:'Polygon',coordinates:[square]},{type:'MultiPolygon',coordinates:[[square],[[[5,5],[6,5],[6,6],[5,6],[5,5]]]]}]){const c=nativeCorpus();spatial(c,geometry);ok(c);}
 for(const geometry of [{type:'Point',coordinates:[1,91]},{type:'Point',coordinates:[0,0,5]},{type:'LineString',coordinates:[[1,2],[1,2]]},{type:'Polygon',coordinates:[[[0,0],[1,1],[0,1],[1,0],[0,0]]]},{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1]]]},{type:'Polygon',coordinates:[square,[[6,6],[7,6],[7,7],[6,7],[6,6]]]},{type:'Polygon',coordinates:[[[179,0],[-179,0],[-179,2],[179,2],[179,0]]]}]){const c=nativeCorpus();spatial(c,geometry);invalid(c);}
 const c=nativeCorpus();const s=spatial(c,null);s.geometry_role='exact_site';invalid(c,'CANONICAL_GEOMETRY_ROLE');
});
test('Broken provenance, cross-profile references, duplicate identifiers, draft leaks and inverted dates fail explicitly',()=>{
 for(const mutate of [c=>c.events.push(structuredClone(c.events[0])),c=>c.sources.splice(0),c=>c.events[0].provenance.evidence[0].source.namespace='OTHER',c=>c.events[0].end_date=temporal('1600'),c=>{c.events[0].editorial_status='published';},c=>c.events[0].namespace='OTHER',c=>c.events[0].provenance.evidence[0].source.kind='event',c=>c.sources[0].url='javascript:alert(1)']){const c=nativeCorpus();mutate(c);invalid(c);}
 const bad=nativeCorpus();bad.entities.push({...bad.events[0],kind:'person'});invalid(bad,'CANONICAL_SCHEMA_INVALID');
});

test('Canonical JSON hashing is deterministic and refuses unsafe, cyclic, inherited or nonfinite values',()=>{
 assert.equal(digest({b:2,a:1}),digest({a:1,b:2}));assert.equal(canonicalStringify({x:null}),'{"x":null}');
 const cyclic={};cyclic.self=cyclic;
 for(const value of [cyclic,{x:NaN},{x:undefined},Array(1),Object.assign([],{custom:1}),Object.create({x:1}),JSON.parse('{"__proto__":{}}')])assert.throws(()=>digest(value));
});
