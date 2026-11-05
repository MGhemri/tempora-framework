const {contentDigest,approved}=require('./review');
function state(assessment,corpus){
  if(assessment.editorial_status!=='reviewed')return 'unreviewed';
  const left=corpus.operations.find(o=>o.id===assessment.left_id),right=corpus.operations.find(o=>o.id===assessment.right_id);
  if(!left||!right||contentDigest(left)!==assessment.operation_fingerprints.left||contentDigest(right)!==assessment.operation_fingerprints.right)return 'stale';
  for(const e of assessment.evidence){const source=corpus.sources.find(s=>s.source_id===e.source_id);if(!source||contentDigest(source)!==assessment.source_fingerprints[e.source_id])return 'stale';}
  return approved(assessment)?'current':'unapproved';
}
function validateAssessments(corpus,validate,errors,warnings){
  const seen=new Set(),pairs=new Set();
  for(const a of corpus.duplicate_assessments||[]){
    if(!validate(a)){errors.push(`Assessment ${a?.id}: ${JSON.stringify(validate.errors)}`);continue;}
    if(seen.has(a.id))errors.push(`Duplicate assessment: ${a.id}`);seen.add(a.id);
    if(a.left_id===a.right_id)errors.push(`${a.id}: assessment must compare two records`);
    for(const id of [a.left_id,a.right_id])if(!corpus.operations.some(o=>o.id===id))errors.push(`${a.id}: missing operation ${id}`);
    for(const e of a.evidence){if(!e.locator.trim())errors.push(`${a.id}: empty evidence locator`);if(!corpus.sources.some(s=>s.source_id===e.source_id))errors.push(`${a.id}: missing evidence source`);}
    if(!a.rationale.trim()||Date.parse(a.created_at)>Date.parse(a.updated_at))errors.push(`${a.id}: invalid assessment explanation/timestamps`);
    if(a.editorial_status==='reviewed'){
      if(!approved(a)||!a.evidence.length)errors.push(`${a.id}: reviewed assessment requires precise evidence and content-bound approval`);
      for(const e of a.evidence)if(!Object.hasOwn(a.source_fingerprints,e.source_id))errors.push(`${a.id}: missing evidence fingerprint`);
      for(const r of a.review_history)if(Date.parse(r.reviewed_at)<Date.parse(a.created_at)||Date.parse(r.reviewed_at)>Date.parse(a.updated_at))errors.push(`${a.id}: review outside editorial timestamps`);
      const pair=[a.left_id,a.right_id].sort().join(':');if(pairs.has(pair))errors.push(`${a.id}: multiple active reviewed assessments for the same pair`);pairs.add(pair);
      if(state(a,corpus)==='stale')warnings.push({id:a.id,code:'duplicate_assessment_outdated'});
    }
  }
}
function evaluate(corpus,report){
  const candidates=new Set(report.candidates.map(c=>[...c.ids].sort().join(':'))),details=[];let tp=0,fp=0,fn=0,tn=0;
  for(const a of corpus.duplicate_assessments||[]){const status=state(a,corpus);const usable=status==='current'&&a.label!=='uncertain';
    const predicted=candidates.has([a.left_id,a.right_id].sort().join(':'));
    details.push({assessment_id:a.id,label:a.label,status,included:usable,predicted_candidate:predicted});
    if(usable){if(a.label==='same_event'){if(predicted)tp++;else fn++;}else if(predicted)fp++;else tn++;}
  }
  return {scope:'Human-reviewed, source-bound annotations only; no historical calibration is inferred from synthetic tests.',
    annotated_pairs:tp+fp+fn+tn,true_positive:tp,false_positive:fp,false_negative:fn,true_negative:tn,
    precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,details};
}
module.exports={state,validateAssessments,evaluate};
