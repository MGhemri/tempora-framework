const {digest}=require('./canonical');
const key=ids=>JSON.stringify([...ids].sort());

function metrics(cases){
  const counts={tp:0,fp:0,fn:0,tn:0};
  for(const item of cases){
    const outcome=item.expected?(item.detected?'tp':'fn'):(item.detected?'fp':'tn');
    counts[outcome]++;
  }
  const {tp,fp,fn}=counts;
  return {...counts,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,
    f1:2*tp+fp+fn?2*tp/(2*tp+fp+fn):null};
}

function evaluate(report,annotations){
  if(annotations?.version!=='1.0.0'||annotations.scope!=='synthetic'||annotations.corpus_sha256!==report.corpus_sha256
      ||typeof annotations.protocol!=='string'||!annotations.protocol.trim()||!Array.isArray(annotations.cases)||!annotations.cases.length){
    throw Error('Expected synthetic reference annotations bound to this corpus');
  }
  const tasks=['duplicates','entities','claims'];
  const population=Object.fromEntries(tasks.map(task=>[task,new Set(report.population[task])]));
  const predictions={
    duplicates:new Set(report.duplicates.map(row=>key(row.ids))),
    entities:new Set(report.entities.map(row=>key(row.ids))),
    claims:new Set(report.claims.filter(row=>row.reason==='potential_value_conflict').map(row=>key(row.claim_ids)))
  };
  const recorded=new Set(report.claims.filter(row=>row.reason==='already_recorded').map(row=>key(row.claim_ids)));
  const seen=new Set(),cases=[];
  for(const item of annotations.cases){
    const {task,ids,expected,group,rationale}=item;
    if(!tasks.includes(task)||!Array.isArray(ids)||ids.length!==2||ids[0]===ids[1]||!ids.every(id=>population[task].has(id))
        ||typeof expected!=='boolean'||typeof group!=='string'||!group.trim()||typeof rationale!=='string'||!rationale.trim()){
      throw Error('Invalid reference case');
    }
    const pair=key(ids),caseKey=JSON.stringify([task,pair]);
    if(seen.has(caseKey)||task==='claims'&&recorded.has(pair))throw Error('Repeated case or already recorded contradiction');
    seen.add(caseKey);
    cases.push({task,ids:[...ids].sort(),expected,group,rationale,detected:predictions[task].has(pair)});
  }
  const results={};
  for(const task of tasks){
    const selected=cases.filter(row=>row.task===task);
    const groups=[...new Set(selected.map(row=>row.group))].sort();
    results[task]={cases:selected.length,...metrics(selected),by_group:Object.fromEntries(groups.map(group=>[group,metrics(selected.filter(row=>row.group===group))]))};
  }
  return {version:'1.0.0',scope:annotations.scope,corpus_sha256:report.corpus_sha256,annotations_sha256:digest(annotations),
    profile:report.profile,parameters:report.parameters,algorithms:report.algorithms,protocol:annotations.protocol,results,cases};
}

module.exports={evaluate};
