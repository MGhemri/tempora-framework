const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze,compareCoverage,compareEventSpaceTime}=require('../src/framework/analysis');
const {evaluate}=require('../src/framework/analysis-evaluation');
const {temporal}=require('../src/framework/temporal');
const {referenceCorpus}=require('./helpers/analysis-reference');
const {run}=require('../scripts/evaluate-tempora');
const config={scope:'working'};

test('Analytical output is reproducible, scoped, detached from the corpus and traceable to its inputs',()=>{
  const corpus=referenceCorpus(),original=structuredClone(corpus);
  assert.equal(analyze(corpus).coverage.denominator,0);
  const report=analyze(corpus,config);
  assert.deepEqual(report,analyze(corpus,config));
  assert.equal(report.coverage.denominator,5);
  assert.equal(report.profile.id,'synthetic-history');
  assert.match(report.corpus_sha256,/^[a-f0-9]{64}$/);
  const match=report.duplicates.find(pair=>pair.ids.join() === 'EVENT_A,EVENT_D');
  assert.equal(match.start_relation,'before');
  assert.equal(match.span_relation,'indeterminate');
  assert.equal(match.requires_human_review,true);
  const entity=report.entities.find(pair=>pair.ids.join() === 'PERSON_A,PERSON_B');
  assert.equal(entity.matched_names.left.role,'variant');
  assert.deepEqual(entity.matched_names.left.source_ids,['DOCUMENT_1']);
  report.start_sequence[0].start_date.earliest=null;
  assert.deepEqual(corpus,original);
  assert.throws(()=>analyze(corpus,{...config,max_pairs:1}),/budget/);
});

test('Proximity retains declared radii and skips representative points or missing precision',()=>{
  const corpus=referenceCorpus(),[a,b]=corpus.events;
  const point=(event,id,role,precision)=>({
    schema_version:'3.0.0',kind:'spatial',id,namespace:event.namespace,editorial_status:'proposed',
    subject:{kind:'event',id:event.id,namespace:event.namespace},label:null,
    geometry:{type:'Point',coordinates:[0,0]},geometry_role:role,crs:'EPSG:4326',
    precision_meters:precision,geocoding_method:null,reference_version:null,place:null,
    provenance:{evidence:[],transformations:[]},extensions:{}
  });
  const left=point(a,'SITE_A','representative_point',null),right=point(b,'SITE_B','approximate_site',6000);
  corpus.spatial_assertions=[left,right];
  a.spatial_refs=[{kind:'spatial',id:left.id,namespace:a.namespace}];
  b.spatial_refs=[{kind:'spatial',id:right.id,namespace:b.namespace}];
  const check=()=>compareEventSpaceTime(corpus,a.id,b.id,config).proximity;
  assert.equal(check(),null);
  left.geometry_role='approximate_site';
  assert.equal(check(),null);
  left.precision_meters=5000;
  assert.deepEqual(check(),{spatial_ids:['SITE_A','SITE_B'],center_km:0,lower_km:0,upper_km:11,assessment:'uncertain'});
});

test('Claim context, zero and profile languages remain distinct in disagreement detection',()=>{
  const corpus=referenceCorpus();
  corpus.claims[0].value={es:'consta'};
  corpus.claims[1].value={es:'ausente'};
  const pair=()=>analyze(corpus,config).claims.find(row=>row.claim_ids.join() === 'COUNT_A,COUNT_B');
  assert.equal(pair().reason,'text_difference_to_review');
  corpus.claims[1].context.population='different population';
  assert.equal(pair().reason,'different_context');
  corpus.claims[1].context=structuredClone(corpus.claims[0].context);
  corpus.claims[0].value=0;
  corpus.claims[1].value=null;
  assert.equal(pair().reason,'unknown_value');
  corpus.claims[1].value=1;
  assert.equal(pair().reason,'potential_value_conflict');
  corpus.claims[1].context.time_scope='specific_period';
  assert.equal(pair().reason,'context_not_recorded');
});

test('Coverage keeps uncertain periods and uses observed denominators in snapshot comparisons',()=>{
  const corpus=referenceCorpus(),before=analyze(corpus,config);
  corpus.events[0].start_date=temporal(null);
  corpus.events[1].title.es='Título';
  const after=analyze(corpus,config),delta=compareCoverage(before,after);
  assert.deepEqual(delta.groups.period.find(row=>row.key==='unbounded_or_unknown'),
    {key:'unbounded_or_unknown',before:0,after:1,change:1});
  assert.equal(after.coverage.groups.language.reduce((sum,row)=>sum+row.count,0),6);
  assert.equal(after.coverage.denominator,5);
  assert.equal(after.coverage.groups.period.find(row=>row.key==='1701').count,0);
  assert.throws(()=>compareCoverage(before,analyze(corpus)),/same profile, scope and method/);
});

test('Fixed fictional labels record false matches and misses without implying historical performance',()=>{
  const result=run();
  assert.equal(result.scope,'synthetic');
  assert.equal(result.results.duplicates.f1,0.5);
  assert.equal(result.results.duplicates.by_group['cross-language'].fn,1);
  assert.equal(result.results.entities.by_group.homonym.fp,1);
  assert.equal(result.results.claims.tn,3);
  assert.throws(()=>evaluate(analyze(referenceCorpus(),config),{version:'1.0.0',scope:'historical'}),/synthetic/);
});
