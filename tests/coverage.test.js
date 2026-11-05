const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {readCorpus,validateCorpus,root}=require('../src/canonical');
const {FileRepository}=require('../src/api-v2/repository');
const model=require('../src/shared/coverage'),{parseQuery,select}=require('../src/api-v2/query');
const {withProposal,approve}=require('./helpers/corpus'),{contentDigest}=require('../src/review');
const snapshot=new FileRepository().load();
const report=(ops=snapshot.operations,sources=snapshot.sources,claims=snapshot.claims,filters={})=>model.report(ops,sources,claims,snapshot.territories,filters);
test('Coverage describes published metadata, never war completeness or an invented pending count',()=>{
  const r=report();assert.equal(r.summary.total_operations,263);assert.equal(r.pending_contributions,null);
  assert.equal(r.summary.without_identified_primary_source,263);assert.equal(r.summary.without_structured_territory,263);
  assert.equal(r.groups.territory.find(r=>r.key==='territory:W1').total_operations,0);
  assert.equal(r.groups.territory.find(r=>r.key==='unassigned').total_operations,263);
  assert.equal(r.groups.year.reduce((n,r)=>n+r.total_operations,0),263);
  assert.equal(r.corpus_is_incomplete,true);assert.equal(r.methodology.pending_contributions_status,'not_measured');
});
test('Published-only metrics preserve overlapping territories/types and count shared sources once',()=>{
  const {corpus,operation}=withProposal();approve(operation);operation.event_type=['A','B'];
  const other=structuredClone(operation);other.id='TEST_OTHER';corpus.operations.push(other);
  const r=model.report([operation,other],corpus.sources,[],corpus.territorial_units);
  assert.equal(r.summary.total_operations,2);assert.equal(r.summary.unique_sources,1);
  assert.equal(r.groups.territory.reduce((n,r)=>n+r.total_operations,0),4);
  assert.equal(r.groups.type.reduce((n,r)=>n+r.total_operations,0),4);
  assert.equal(r.methodology.group_totals_are_additive.territory,false);
  operation.editorial_status='proposed';assert.equal(model.report([operation],corpus.sources,[],[]).summary.total_operations,0);
});
test('Primary-source identification requires explicit classification and a content-bound review',()=>{
  const {corpus,operation}=withProposal();approve(operation);const s=corpus.sources.at(-1);
  s.document_type='Archive primaire';assert.equal(model.report([operation],corpus.sources,[],[]).summary.without_identified_primary_source,1);
  s.source_classification='primary';assert.ok(validateCorpus(corpus).errors.some(e=>e.includes('classification')));
  s.review_history=[{reviewer:'TEST_REVIEWER',decision:'approved',reference:'https://example.org/review',reason:'Synthetic classification only.',reviewed_at:'2026-11-05T00:00:00Z',content_sha256:contentDigest(s)}];
  assert.deepEqual(validateCorpus(corpus).errors,[]);assert.equal(model.report([operation],corpus.sources,[],[]).summary.without_identified_primary_source,0);
  s.title='changed after review';assert.ok(validateCorpus(corpus).errors.some(e=>e.includes('classification')));
});
test('Unknown dates and representative points stay uncertain; no exactness or zero is invented',()=>{
  const op=structuredClone(snapshot.operations[0]);op.start_date={earliest:null,latest:null,precision:'unknown',certainty:'unknown'};
  const r=report([op]);assert.equal(r.groups.year.find(g=>g.key==='unknown').total_operations,1);assert.equal(r.summary.uncertain_start_dates,1);assert.equal(r.summary.uncertain_locations,1);
  assert.equal(r.summary.without_recorded_review,1);
});
test('Empty temporal selection emits documentary-gap rows; long ranges do not invent thousands of zeros',()=>{
  const q=parseQuery({from:'1900',to:'1900'},'operations'),r=report(select(snapshot.operations,{...q,limit:1000},'operations').data,snapshot.sources,[],q);
  const row=r.groups.year.find(g=>g.key==='year:1900');assert.equal(row.total_operations,0);assert.equal(row.note,'no_current_record');
  assert.equal(r.pending_contributions,null);assert.equal(r.summary.unique_sources,0);
  assert.equal(report([],[],[],{from:'0000-01-01',to:'9999-12-31'}).methodology.year_domain,'observed_years_only');
});
test('Published contested assertions are counted per operation; draft assertions never contribute',()=>{
  const {withClaims}=require('./helpers/claims'),c=withClaims({reviewed:true});const r=model.report(c.operations,c.sources,c.claims,c.territorial_units);
  assert.equal(r.summary.operations_with_contested_claims,1);assert.ok(r.summary.unique_sources>snapshot.sources.length);
  for(const claim of c.claims)claim.editorial_status='proposed';assert.equal(model.report(c.operations,c.sources,c.claims,c.territorial_units).summary.operations_with_contested_claims,0);
});

test('An interval selected by overlap stays grouped by its recorded start year',()=>{
  const op=structuredClone(snapshot.operations[0]);op.start_date={earliest:'1954-01-01',latest:'1954-12-31',precision:'year',certainty:'approximate'};op.end_date={earliest:'1960-01-01',latest:'1960-12-31',precision:'year',certainty:'approximate'};
  const q=parseQuery({from:'1956',to:'1956'},'operations'),selected=select([op],q,'operations').data,r=report(selected,snapshot.sources,[],q);
  assert.equal(r.summary.total_operations,1);assert.equal(r.groups.year.find(g=>g.key==='year:1954').total_operations,1);assert.equal(r.groups.year.find(g=>g.key==='year:1956').total_operations,0);
});
test('CSV includes provenance, filters and non-additivity, neutralizes formulas and retains UTF-8 Arabic',()=>{
  const op=structuredClone(snapshot.operations[0]);op.event_type=['=HYPERLINK("bad")'];const r=report([op]);
  const csv=model.csv(r,{snapshot_sha256:'a'.repeat(64),dataset_release:'data-2026.11.1'},{q:'مثال'},'type');
  assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/group_totals_additive/);assert.match(csv,/not_measured/);assert.match(csv,/مثال/);assert.match(csv,/'=HYPERLINK/);
  assert.throws(()=>model.csv(r,{}, {},'bad'));
});
test('Browser and API models share identical behavior, and coverage report matches JSON Schema',()=>{
  const sandbox={};vm.runInNewContext(fs.readFileSync(path.join(root,'src/shared/coverage.js'),'utf8'),sandbox);
  const browser=sandbox.ALNOPCoverage.report(snapshot.operations,snapshot.sources,snapshot.claims,snapshot.territories);
  assert.equal(JSON.stringify(browser),JSON.stringify(report()));
  const generated=require('../scripts/build-coverage').artifacts(snapshot),meta=JSON.parse(generated['docs/data/coverage/report.json']).meta;
  assert.match(meta.model_sha256,/^[a-f0-9]{64}$/);assert.equal(meta.calculation_version,'coverage-v1');
  const Ajv=require('ajv/dist/2020'),validate=new Ajv({strict:true,allErrors:true}).compile(require('../schemas/coverage-report.schema.json'));
  assert.equal(validate(report()),true,JSON.stringify(validate.errors));
  const {createHandler}=require('../src/api-v2/service'),res={setHeader(){},status(c){this.statusCode=c;return this;},json(b){this.body=b;return this;}};
  createHandler({load:()=>snapshot})({method:'GET',url:'/api/v2/coverage?from=1956&to=1956'},res);
  const q=parseQuery({from:'1956',to:'1956'},'operations'),selected=select(snapshot.operations,{...q,limit:1000},'operations').data;
  assert.deepEqual(res.body.data.documentary_report,report(selected,snapshot.sources,snapshot.claims,q));
});
