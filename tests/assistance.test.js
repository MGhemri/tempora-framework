const {test}=require('node:test'),assert=require('node:assert/strict');
const {compareClaims,conflicts}=require('../src/shared/assistance');
const {readCorpus,validateCorpus}=require('../src/canonical');
const {contentDigest}=require('../src/review');
const {state,evaluate}=require('../src/duplicate-assessments');
const {withClaims}=require('./helpers/claims');
const {records}=require('../scripts/evaluate-duplicates');
const {duplicateReport}=require('../src/duplicates');
const context={scope:'TEST événement entier',population:'TEST participants',time_scope:'entire_event',valid_from:null,valid_to:null};
function claim(id,value){return {id,subject:'OP_TEST',predicate:'test',value,unit:'personnes',context:structuredClone(context),contradicts:[],evidence:[],editorial_status:'proposed',status:'unverified'};}
test('Claim assistance distinguishes unknown, zero, units and overlapping numeric precision',()=>{
 const a=claim('A',0),b=claim('B',5),reason=()=>compareClaims(a,b).reason;
 assert.equal(reason(),'potential_value_conflict');b.value=null;assert.equal(reason(),'unknown_value');
 b.value={type:'interval',lower:0,upper:10};assert.equal(reason(),'compatible_precision');
 b.unit='autre unité';assert.equal(reason(),'different_units');b.unit=null;assert.equal(reason(),'unit_not_recorded');
 b.unit=a.unit;b.value=0;assert.equal(reason(),'same_value');
});
test('Contexts and multilingual texts require human interpretation without invented translations',()=>{
 const a=claim('A',{fr:'TEST A'}),b=claim('B',{ar:'اختبار'}),reason=()=>compareClaims(a,b).reason;
 assert.equal(reason(),'no_shared_language');b.value={fr:'TEST B'};assert.equal(reason(),'text_difference_to_review');
 b.context.population='TEST autre population';assert.equal(reason(),'different_context');
 delete b.context;assert.equal(reason(),'context_not_recorded');b.contradicts=['A'];assert.equal(reason(),'already_recorded');
});
test('Boolean comparisons and draft filtering never alter assertions or create contradiction links',()=>{
 const a=claim('A',false),b=claim('B',true),before=structuredClone([a,b]);
 assert.equal(compareClaims(a,b).reason,'potential_value_conflict');assert.deepEqual(conflicts([a,b],{publishedOnly:true}).comparisons,[]);
 assert.equal(conflicts([a,b]).comparisons.length,1);assert.deepEqual([a,b],before);
 b.status='withdrawn';assert.equal(conflicts([a,b]).comparisons.length,0);
});
test('Canonical validation rejects inverted ranges, undocumented context periods and orphan alias sources',()=>{
 const c=withClaims();c.claims[0].value={type:'interval',lower:20,upper:10};
 assert.ok(validateCorpus(c).errors.some(e=>e.includes('inverted value interval')));
 c.claims[0].value=12;c.claims[0].context={...context,time_scope:'specific_period'};
 assert.ok(validateCorpus(c).errors.some(e=>e.includes('invalid context period')));
 c.operations[0].aliases=[{value:'TEST alias',language:'fr',source_ids:['SRC_aaaaaaaaaaaaaaaaaaaaaaaa']}];
 assert.ok(validateCorpus(c).errors.some(e=>e.includes('alias evidence')));
});
test('Sourced names retain their evidence and flag conflicting dates without an automatic merge',()=>{
 const ops=records({a:'TEST alpha',b:'اختبار مختلف',same_date:false,same_site:false});
 ops[1].aliases=[{value:'TEST alpha',language:'fr',source_ids:['SRC_aaaaaaaaaaaaaaaaaaaaaaaa']}];
 const before=structuredClone(ops),r=duplicateReport(ops),pair=r.candidates[0];
 assert.equal(pair.factors.alias_used,true);assert.equal(pair.factors.matched_names.right.source_ids[0],'SRC_aaaaaaaaaaaaaaaaaaaaaaaa');
 assert.ok(pair.review_cautions.includes('alias_sources_require_review'));assert.equal(pair.requires_human_review,true);assert.deepEqual(ops,before);
});
function assessed(){
 const c=readCorpus(),[left,right]=c.operations,source=c.sources[0];
 const a={id:'QA_TEST_ONE',left_id:left.id,right_id:right.id,label:'same_event',rationale:'TEST synthétique, aucune conclusion historique',
 evidence:[{source_id:source.source_id,locator:'TEST p. 1'}],operation_fingerprints:{left:contentDigest(left),right:contentDigest(right)},
 source_fingerprints:{[source.source_id]:contentDigest(source)},editorial_status:'reviewed',review_history:[],created_at:'2026-11-05T00:00:00Z',updated_at:'2026-11-05T01:00:00Z'};
 a.review_history.push({reviewer:'TEST',decision:'approved',reason:'TEST',reference:'https://example.org/review',reviewed_at:'2026-11-05T00:30:00Z',content_sha256:contentDigest(a)});
 c.duplicate_assessments=[a];return {c,a};
}
test('Historical benchmark remains unmeasured until explicit source-bound reviewed annotations exist',()=>{
 assert.equal(evaluate(readCorpus(),{candidates:[]}).precision,null);
 const {c,a}=assessed();assert.deepEqual(validateCorpus(c).errors,[]);assert.equal(state(a,c),'current');
 const report={candidates:[{ids:[a.left_id,a.right_id]}]};assert.equal(evaluate(c,report).precision,1);
 c.operations[0].title.fr+=' TEST change';assert.equal(state(a,c),'stale');assert.equal(evaluate(c,report).annotated_pairs,0);
});
test('Source changes invalidate calibration and assessment edits require renewed approval',()=>{
 const {c,a}=assessed();c.sources[0].title+=' TEST';assert.equal(state(a,c),'stale');
 const fresh=assessed();fresh.a.label='distinct_events';assert.equal(state(fresh.a,fresh.c),'unapproved');
 assert.ok(validateCorpus(fresh.c).errors.some(e=>e.includes('content-bound approval')));
});
