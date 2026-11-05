const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readCorpus,validateCorpus,hash}=require('../src/canonical');
const {publicArtifacts,publishedLegacy,corpusFingerprint}=require('../src/publication');
const {publishedClaims,claimsForOperation}=require('../src/claims');
const {artifacts}=require('../scripts/build-canonical');
const {withClaims}=require('./helpers/claims');
const build=c=>artifacts(c,{allowSynthetic:true});

test('T10: divergent sourced assertions coexist without changing original historical fields',()=>{
  const c=withClaims({reviewed:true});
  assert.deepEqual(validateCorpus(c).errors,[]);
  const out=build(c),claims=JSON.parse(out['claims.json']).claims;
  assert.deepEqual(claims.map(c=>c.value),[12,21]);
  const enriched=publishedLegacy(c).operations.find(o=>o.id==='OP_1954_001');
  const {scientific_claims,...original}=enriched;
  assert.deepEqual(original,c.operations.find(o=>o.id===original.id).legacy);
  assert.equal(scientific_claims.length,2);
  assert.deepEqual(scientific_claims[1].contradicts,['CLM_TEST_A']);
  assert.equal(scientific_claims[0].evidence[0].locator,'p. 12 (exemple fictif)');
  assert.ok(JSON.parse(out['sources.json']).some(s=>s.source_id==='SRC_bbbbbbbbbbbbbbbbbbbbbbbb'));
  assert.ok(JSON.parse(out['operations.geojson']).features.find(f=>f.id===original.id).properties.claim_ids.includes('CLM_TEST_A'));
  assert.equal(JSON.parse(out['dataset-manifest.json']).total,263);
  for(const [name,digest] of Object.entries(JSON.parse(out['dataset-manifest.json']).checksums))assert.equal(hash(out[name]),digest);
});

test('T19: proposed claims, evidence and warnings never leak into any public artifact',()=>{
  const c=withClaims();c.claims[0].status='unverified';c.claims[0].contradicts=[];c.claims[1].status='unverified';
  assert.deepEqual(validateCorpus(c).errors,[]);
  assert.deepEqual(build(c),artifacts(readCorpus()));
  assert.deepEqual(publicArtifacts(c),publicArtifacts(readCorpus()));
  assert.equal(corpusFingerprint(c),corpusFingerprint(readCorpus()));
  assert.equal(publishedClaims(c).length,0);
});

test('Claims require valid subject, sources, locators, review and consistent public conflicts',()=>{
  for(const mutate of [
    c=>c.claims.push(structuredClone(c.claims[0])),
    c=>c.claims[0].subject='MISSING',
    c=>c.claims[0].evidence[0].source_id='SRC_cccccccccccccccccccccccc',
    c=>c.claims[0].evidence[0].locator=' ',
    c=>c.claims[0].evidence=[],
    c=>c.claims[0].review_history=[],
    c=>c.claims[0].review_history[0].decision='rejected',
    c=>c.claims[0].review_history[0].reference='javascript:alert(1)',
    c=>c.claims[0].review_history[0].reviewed_at='2026-11-06T00:00:00Z',
    c=>c.claims[0].contradicts=['CLM_MISSING'],
    c=>c.claims[0].contradicts=['CLM_TEST_A'],
    c=>c.claims[1].predicate='other_fact',
    c=>c.claims[1].subject='OP_1954_003',
    c=>c.claims[1].status='supported',
    c=>c.claims[1].editorial_status='proposed',
    c=>c.claims[0].status='withdrawn',
    c=>c.claims[0].value={fr:null,ar:null},
    c=>c.sources.at(-1).title=null,
    c=>c.claims[0].evidence[0].quotation='x'.repeat(501)
  ]){
    const c=withClaims({reviewed:true});mutate(c);
    assert.throws(()=>build(c),undefined,mutate.toString());
  }
});

test('A reviewed assertion cannot publish a draft subject or a synthetic production fixture',()=>{
  const {withProposal}=require('./helpers/corpus');const {corpus,operation}=withProposal();
  const c=withClaims({reviewed:true});corpus.claims=c.claims;corpus.sources.push(...c.sources.slice(-2));
  for(const claim of corpus.claims)claim.subject=operation.id;
  assert.match(validateCorpus(corpus).errors.join('\n'),/published subject/);
  assert.throws(()=>artifacts(c),/Synthetic assertions/);
});

test('Unverified and Arabic-only values retain their meaning without invented translations',()=>{
  const c=withClaims({reviewed:true});c.claims[0].contradicts=[];
  for(const claim of c.claims){claim.status='unverified';claim.value={fr:null,ar:'إفادة تجريبية'};}
  const out=build(c),claims=JSON.parse(out['claims.json']).claims;
  assert.equal(claims[0].value.fr,null);assert.equal(claims[0].value.ar,'إفادة تجريبية');
  assert.equal(JSON.parse(out['quality-report.json']).warnings.filter(w=>w.code==='unverified_assertion').length,2);
  assert.equal(claimsForOperation('OP_1954_001',c)[0].status,'unverified');
});

test('The actual v1 handler returns both reviewed assertions from the generated public dataset',()=>{
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
  const {spawnSync}=require('node:child_process');const {root}=require('../src/canonical');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'alnop-claims-'));
  try{
    const files=publicArtifacts(withClaims({reviewed:true}));
    for(const [name,content]of Object.entries(files)){
      const target=path.join(directory,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);
    }
    const script=`const res={setHeader(){},status(c){this.code=c;return this;},json(body){console.log(JSON.stringify({code:this.code,data:body.data}));}};require(process.argv[1]+'/api/v1/operations')({method:'GET',query:{id:'OP_1954_001'}},res);`;
    const result=spawnSync(process.execPath,['-e',script,root],{cwd:directory,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);const response=JSON.parse(result.stdout);
    assert.equal(response.code,200);assert.deepEqual(response.data.scientific_claims.map(c=>c.value),[12,21]);
    assert.equal(response.data.scientific_claims[1].evidence[0].locator,'chap. 2, § 3 (exemple fictif)');
  }finally{
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('alnop-claims-'));
    fs.rmSync(directory,{recursive:true});
  }
});
