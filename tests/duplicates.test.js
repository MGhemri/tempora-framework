const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalize,lexical,duplicateReport}=require('../src/duplicates');
const {evaluate,records}=require('../scripts/evaluate-duplicates');
test('FR/AR normalization preserves input and identifies diacritic variants',()=>{
  assert.equal(normalize('DÉFILÉ'),normalize('defile'));assert.equal(normalize('كَمِين'),normalize('كمين'));
  assert.equal(lexical('',''),0);assert.equal(lexical('Événement','Evenement'),1);
});
test('Same time and place alone never creates a duplicate decision',()=>{
  const ops=records({a:'Embuscade du col',b:'Réunion politique',same_date:true,same_site:true}),before=structuredClone(ops);
  assert.deepEqual(duplicateReport(ops).candidates,[]);assert.deepEqual(ops,before);
});
test('Candidate factors retain partial dates and ignore representative points',()=>{
  const ops=records({a:'Combat du col',b:'Combat du col',same_date:true,same_site:true});
  ops[0].start_date={earliest:'1956-01-01',latest:'1956-12-31'};
  ops[0].locations[0].geometry_role='representative_point';
  const report=duplicateReport(ops),c=report.candidates[0];assert.equal(c.requires_human_review,true);
  assert.equal(c.factors.start_intervals_overlap,true);assert.equal(c.factors.reviewed_site_distance_km,null);
  assert.deepEqual(duplicateReport([...ops].reverse()),report);assert.equal(ops.length,2);
  assert.throws(()=>duplicateReport(ops,{lexical_threshold:2}));
});
test('Annotated synthetic evaluation explicitly reports false positives and missed cross-language pairs',()=>{
  const e=evaluate();assert.equal(e.true_positive,3);assert.equal(e.false_positive,1);assert.equal(e.false_negative,1);
  assert.equal(e.precision,.75);assert.equal(e.recall,.75);
});
