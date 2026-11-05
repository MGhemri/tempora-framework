const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validateCorpus,readCorpus,root,hash}=require('../src/canonical');
const {publicArtifacts,publishedLegacy,originalIntegrity}=require('../src/publication');
const {artifacts}=require('../scripts/build-canonical');
const {computeStats,filterOperations,toGeoJSON,getTerritorialAffiliations}=require('../api/v1/data-service');
const {withProposal,approve}=require('./helpers/corpus');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
test('Canonical publication reproduces the four original public artifacts',()=>{
  const corpus=readCorpus();
  assert.deepEqual(originalIntegrity(corpus),[]);
  for(const [name,content]of Object.entries(publicArtifacts(corpus)))
    assert.equal(fs.readFileSync(path.join(root,name),'utf8').replace(/\r\n/g,'\n'),content,name);
});
test('A proposed operation and its private source do not change any published artifact',()=>{
  const {corpus}=withProposal();
  assert.deepEqual(artifacts(corpus,{allowSynthetic:true}),artifacts(readCorpus()));
});
test('Reviewed synthetic 264th record updates all formats and v1 statistics in memory',()=>{
  const {corpus,operation}=withProposal();
  for(const status of ['proposed','under_review','disputed','withdrawn']){
    operation.editorial_status=status;assert.equal(publishedLegacy(corpus).operations.length,263);
  }
  approve(operation);assert.deepEqual(validateCorpus(corpus).errors,[]);
  const outputs=artifacts(corpus,{allowSynthetic:true});
  const legacy=JSON.parse(outputs['legacy.json']);
  assert.equal(legacy.operations.length,264);assert.equal(legacy.dataset_metadata.total_records,264);
  const record=legacy.operations.find(op=>op.id===operation.id);
  assert.equal(record.date_debut,'1956');assert.deepEqual(record.localisation.coordonnees_approximatives,{});
  assert.match(record.wilaya_concernee,/Wilaya I /);assert.match(record.wilaya_concernee,/Wilaya III /);
  assert.equal(computeStats(legacy.operations).total_operations,264);
  assert.equal(computeStats(legacy.operations).by_wilaya.OTHER.count,1);
  assert.equal(Object.values(computeStats(legacy.operations).by_wilaya).reduce((sum,w)=>sum+w.count,0),264);
  const affiliations=getTerritorialAffiliations(record);
  assert.equal(affiliations.primary.code,'OTHER');assert.deepEqual(affiliations.affiliations.map(a=>a.code),['W1','W3']);
  assert.ok(affiliations.affiliations.every(a=>a.role==='cross_territorial'));
  assert.match(computeStats(legacy.operations).dataset_scope,/264/);
  assert.equal(filterOperations(legacy.operations,{id:operation.id}).length,1);
  assert.equal(toGeoJSON([record]).features[0].geometry,null);
  assert.equal(JSON.parse(outputs['operations.geojson']).features.length,264);
  assert.equal(outputs['operations.csv'].split('\r\n').length,266);
  const manifest=JSON.parse(outputs['dataset-manifest.json']);
  for(const [file,digest]of Object.entries(manifest.checksums))assert.equal(hash(outputs[file]),digest,file);
});
test('Review, original evidence, references, vocabulary and temporal precision are enforced',()=>{
  for(const mutate of [
    c=>c.operations.shift(),c=>c.operations[0].legacy.description='changed evidence',
    c=>c.operations[0].title.fr='silent correction',
    c=>c.operations.at(-1).territorial_assignments[0].territory_id='MISSING',
    c=>c.operations.at(-1).event_type=['UNREGISTERED'],
    c=>c.operations.at(-1).review_history.at(-1).decision='rejected',
    c=>c.operations.at(-1).source_ids=[],
    c=>c.operations.at(-1).start_date.latest='1956-03-01',
    c=>c.sources.at(-1).url='javascript:alert(1)']){
    const {corpus,operation}=withProposal();approve(operation);mutate(corpus);
    assert.throws(()=>artifacts(corpus,{allowSynthetic:true}));
  }
});
test('Multiple locations stay present in canonical GeoJSON without a fictitious v1 point',()=>{
  const {corpus,operation}=withProposal();approve(operation);
  operation.locations=[{label:'Lieu de test A',geometry:{type:'Point',coordinates:[2,35]},geometry_role:'approximate_site',review_status:'reviewed'},
    {label:'Lieu de test B',geometry:{type:'Point',coordinates:[3,36]},geometry_role:'approximate_site',review_status:'reviewed'}];
  const outputs=artifacts(corpus,{allowSynthetic:true});
  const feature=JSON.parse(outputs['operations.geojson']).features.find(f=>f.id===operation.id);
  assert.equal(feature.geometry.type,'MultiPoint');assert.equal(feature.properties.locations.length,2);
  const legacy=JSON.parse(outputs['legacy.json']).operations.find(op=>op.id===operation.id);
  assert.equal(toGeoJSON([legacy]).features[0].geometry,null);
});
test('Actual v1 handlers read the reviewed 264-record projection in an isolated process',()=>{
  const {corpus,operation}=withProposal();approve(operation);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'alnop-publication-'));
  try{
    for(const [name,content]of Object.entries(publicArtifacts(corpus))){const target=path.join(directory,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
    const script=`const run=(name,query)=>{const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(body){this.body=body;return this;}};require(process.argv[1]+'/api/v1/'+name)({method:'GET',query},res);return res;};const op=run('operations',{id:'TEST_SYNTHETIC_001'});const stats=run('stats',{});console.log(JSON.stringify({status:op.statusCode,id:op.body.data.id,year:op.body.data.date_debut,total:stats.body.data.total_operations}));`;
    const result=spawnSync(process.execPath,['-e',script,root],{cwd:directory,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{status:200,id:operation.id,year:'1956',total:264});
  }finally{
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('alnop-publication-'));
    fs.rmSync(directory,{recursive:true});
  }
});
test('Preparing an emailed proposal creates only an unreviewed draft and excludes contact data',()=>{
  const {prepare}=require('../scripts/prepare-contribution');
  const submission={kind:'new-operation',title:'Fixture de test',description:'Texte synthétique.',
    eventDate:'1956 environ',eventPlace:'Lieu incertain',citation:'Citation à structurer',replyTo:'private@example.org'};
  const result=prepare(submission,{id:'TEST_PREPARATION',sourceCommit:'97eef827834a7463e85eed8b5bd5c81e08069420',createdAt:'2026-11-05T00:00:00Z'});
  assert.equal(result.operation.editorial_status,'proposed');assert.equal(result.operation.start_date.precision,'unknown');
  assert.equal(result.operation.provenance.human_review_recorded,false);assert.equal(result.source.title,null);
  assert.doesNotMatch(JSON.stringify(result),/private@example/);
  assert.throws(()=>prepare(submission,{id:'../unsafe'}));
  const corpus=readCorpus();corpus.operations.push(result.operation);corpus.sources.push(result.source);
  assert.deepEqual(validateCorpus(corpus).errors,[]);assert.equal(publishedLegacy(corpus).operations.length,263);
  const arabic=prepare({...submission,locale:'ar',title:'مقترح تجريبي',description:'وصف تجريبي'},
    {id:'TEST_ARABIC_DRAFT',sourceCommit:'97eef827834a7463e85eed8b5bd5c81e08069420',createdAt:'2026-11-05T00:00:00Z'});
  assert.equal(arabic.operation.title.fr,null);assert.equal(arabic.operation.description.fr,null);
  assert.equal(arabic.operation.title.ar,'مقترح تجريبي');
});
test('Unknown dates and territories stay unknown in v1 and are counted explicitly',()=>{
  const {corpus,operation}=withProposal();approve(operation);
  operation.start_date={earliest:null,latest:null,precision:'unknown',certainty:'unknown'};
  operation.territorial_assignments=[];
  assert.deepEqual(validateCorpus(corpus).errors,[]);
  const document=publishedLegacy(corpus),record=document.operations.find(op=>op.id===operation.id);
  assert.equal(record.date_debut,null);assert.equal(record.wilaya_concernee,null);
  assert.equal(computeStats(document.operations).by_year.unknown,1);
  assert.equal(computeStats(document.operations).by_wilaya.OTHER.count,1);
});
