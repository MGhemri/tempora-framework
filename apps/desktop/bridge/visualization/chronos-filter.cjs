'use strict';
// Chronos science-only interval filters. Unknown dates remain UNKNOWN, never
// silently imputed or transformed into "exact" days.
const {canonical}=require('tempora-framework');
const {projection,refKey}=require('./contracts.cjs');
const MAX_EVENTS=100000,MAX_RESULTS=100;
function fail(code){const e=new Error(code);e.code=code;throw e;}
function date(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('INVALID_DATE');
  const timestamp=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(timestamp.valueOf())||timestamp.toISOString().slice(0,10)!==value)
    fail('INVALID_DATE');
  return value;
}
function filter(corpus,{earliest,latest,mode='possible-overlap',offset=0,limit=50,
  generatedAt='2026-01-01T00:00:00Z'}={}){
  if(!corpus||typeof corpus!=='object'||Array.isArray(corpus))fail('INVALID_CORPUS');
  if(!['possible-overlap','certain-only','declared-start'].includes(mode))fail('INVALID_TIME_MODE');
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>MAX_RESULTS)
    fail('INVALID_PAGE');
  const from=date(earliest),to=date(latest);
  if(from>to)fail('INVERTED_TIME_WINDOW');
  const check=canonical.validateCorpus(corpus);
  if(!check.valid)fail('CORPUS_NOT_VALIDATED');
  const events=Array.isArray(corpus.events)?corpus.events:[];
  if(events.length>MAX_EVENTS)fail('LIMIT_EXCEEDED');
  let unknown=0,excluded=0;
  const selected=[];
  for(const ev of events){
    const start=ev.start_date,end=ev.end_date;
    const lo=start?.earliest??null;
    const hi=mode==='declared-start'?(start?.latest??null):(end?.latest??start?.latest??null);
    // One missing bound is not evidence of a day, even for before/after.
    if(!lo||!hi){unknown++;continue;}
    const matches=mode==='certain-only'?
      lo>=from&&hi<=to : lo<=to&&hi>=from;
    if(matches)selected.push(ev);
    else excluded++;
  }
  selected.sort((a,b)=>{
    const ka=refKey({kind:'event',namespace:a.namespace,id:a.id});
    const kb=refKey({kind:'event',namespace:b.namespace,id:b.id});
    return ka<kb?-1:ka>kb?1:0;
  });
  const page=selected.slice(offset,offset+limit).map(ev=>({
    ref:{kind:'event',namespace:ev.namespace,id:ev.id},
    start_date:ev.start_date,end_date:ev.end_date,
    matched_by:mode,source:'declared_temporal_bounds'
  }));
  const diagnostics=[];
  if(unknown)diagnostics.push({code:'UNKNOWN_TEMPORAL_BOUNDS',severity:'warning',count:unknown});
  if(selected.length>offset+limit)diagnostics.push({
    code:'PARTIAL_PAGE',severity:'warning',count:selected.length-(offset+limit)});
  return projection({
    corpus,algorithm:{id:'tvrw.chronos.interval-filter',version:'1.0.0',
      parameters:{mode,earliest:from,latest:to,offset,limit}},
    mode:'validated',filters:{module:'chronos',mode,earliest:from,latest:to,
      offset,limit,unknown_count:unknown,excluded_count:excluded},
    totalMatched:selected.length,result:page,diagnostics,generatedAt
  });
}
module.exports=Object.freeze({filter,date,MAX_EVENTS,MAX_RESULTS});
