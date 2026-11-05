const {parseArgs}=require('node:util');
const {getBase,json}=require('./ingest-tempora');
const {analyze,compareCoverage,compareEventSpaceTime}=require('../src/framework/analysis');
const {evaluate}=require('../src/framework/analysis-evaluation');

function run(args=process.argv.slice(2)){
  const {values}=parseArgs({args,options:{
    base:{type:'string'},scope:{type:'string'},parameters:{type:'string'},compare:{type:'string'},annotations:{type:'string'},event:{type:'string',multiple:true}
  }});
  if(!values.base)throw Error('Supply an explicit --base corpus or working snapshot');
  const config=values.parameters?json(values.parameters,128*1024):{};
  if(!config||typeof config!=='object'||Array.isArray(config))throw Error('Expected a JSON parameter object');
  if(values.scope!==undefined)config.scope=values.scope;
  const base=getBase({base:values.base});
  if(values.event){
    if(values.event.length!==2||values.compare||values.annotations)throw Error('Supply exactly two --event IDs for a space-time comparison');
    return compareEventSpaceTime(base,...values.event,config);
  }
  const report=analyze(base,config);
  if(values.compare)report.coverage_comparison=compareCoverage(analyze(getBase({base:values.compare}),config),report);
  if(values.annotations)report.evaluation=evaluate(report,json(values.annotations,16*1024*1024));
  return report;
}

if(require.main===module){
  try{console.log(JSON.stringify(run(),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={run};
