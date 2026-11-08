// Explicit, opt-in benchmark harness for fictional TEMPORA v3 corpora.
// Never benchmark users' real research data; no network or persistent indexes.
// Usage: node scripts/bench-visualization.mjs [--large] [--sizes=100,1000,10000] [--iterations=3]
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from '../tests/visualization/synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {build}=require('../bridge/visualization/projections.cjs');
const {analyze}=require('../bridge/visualization/algorithms.cjs');
const {buildExport}=require('../bridge/visualization/exporter.cjs');
const {ProjectManager}=require('../bridge/visualization/session.cjs');
const {buildSegmentIndex}=require('../bridge/visualization/segment-index.cjs');

function makeSynthetic(size){
  if(!Number.isSafeInteger(size)||size<1||size>100000)throw Error('INVALID_BENCHMARK_SIZE');
  const c=SYNTHETIC_CASES[0].make();
  const template=c.events[0];
  c.events=[];
  for(let i=0;i<size;i++){
    const item=structuredClone(template);
    item.id='EVENT_'+String(i).padStart(6,'0');
    item.title.en='Fictional documentation '+String(i%31);
    c.events.push(item);
  }
  return c;
}
function timed(fn){
  const samples=[];
  let status='ok',message=null;
  for(let iteration=0;iteration<iterations;iteration++){
    const start=performance.now();
    try{fn();}catch(error){
      status='rejected';
      message=error?.code??error?.message??String(error);
    }
    samples.push(Number((performance.now()-start).toFixed(3)));
    if(status==='rejected')break;
  }
  const ordered=[...samples].sort((a,b)=>a-b);
  const middle=Math.floor(ordered.length/2);
  const median=ordered.length%2?ordered[middle]:
    (ordered[middle-1]+ordered[middle])/2;
  return {status,elapsed_ms:Number(median.toFixed(3)),
    min_ms:ordered[0],max_ms:ordered[ordered.length-1],
    samples_ms:samples,completed_iterations:samples.length,
    ...(message?{message}:{})};
}
const args=process.argv.slice(2);
const large=args.includes('--large');
const iterationArg=args.find(a=>a.startsWith('--iterations='));
const iterations=iterationArg?Number(iterationArg.slice('--iterations='.length)):3;
if(!Number.isSafeInteger(iterations)||iterations<1||iterations>10)
  throw Error('INVALID_BENCHMARK_ITERATIONS');

const param=args.find(a=>a.startsWith('--sizes='));
let sizes=param?param.slice(8).split(',').map(Number):[100,1000,10000];
if(!sizes.length||sizes.some(n=>!Number.isSafeInteger(n)||n<1||n>100000))
  throw Error('INVALID_BENCHMARK_SIZES');
if(sizes.some(n=>n>10000)&&!large)
  throw Error('LARGE_BENCHMARK_REQUIRES_EXPLICIT_OPT_IN');
const output={name:'TEMPORA Visual Research Workbench — synthetic performance audit',
  synthetic:true,architecture:process.arch,node:process.version,platform:process.platform,
  sdk:'tempora-framework@3.0.0',iterations,statistics:'median/min/max of repeated wall-clock samples; not p95',sizes:[]};
for(const count of sizes){
  const corpus=makeSynthetic(count);
  const json=canonical.stringify(corpus);
  const bytes=Buffer.byteLength(json,'utf8');
  const validated=canonical.validateCorpus(corpus);
  if(!validated.valid)throw Error('SYNTHETIC_CORPUS_INVALID_'+count);
  const rows={size:count,bytes,mem_before_mb:Number((process.memoryUsage().rss/1048576).toFixed(2)),
    validation:timed(()=>{if(!canonical.validateCorpus(corpus).valid)throw Error('INVALID');}),
    digest:timed(()=>canonical.digest(corpus)),
    chronos_page:timed(()=>build(corpus,{module:'chronos',limit:50})),
    derived_segment_catalog:timed(()=>buildSegmentIndex(corpus,{collection:'events'})),
    chronos_scoped_page:timed(()=>build(corpus,{module:'chronos',limit:50,
      facet:{statuses:['proposed'],time:{mode:'possible-overlap',
        earliest:'1784-01-01',latest:'1784-12-31'}}})),
    chronos_filtered_json_export:timed(()=>{
      const filtered=build(corpus,{module:'chronos',limit:50,
        facet:{statuses:['proposed'],time:{mode:'possible-overlap',
          earliest:'1784-01-01',latest:'1784-12-31'}}});
      buildExport(filtered,{module:'chronos',format:'json'});
    }),
    observatory_analysis:timed(()=>analyze(corpus,{module:'observatory',limit:50})),
    native_project_create:timed(()=>{
      const projects=new ProjectManager();
      const p=projects.create(corpus);
      projects.release(p.project_id);
    })};
  rows.mem_after_mb=Number((process.memoryUsage().rss/1048576).toFixed(2));
  rows.notes=['Measurements are single-run wall-clock samples, NOT p95 or a Windows UI benchmark.',
    'Errors and quotas are measured as rejections; do not extrapolate to untested sizes.',
    'Samples may include JIT/GC variation; compare like-for-like hardware and process versions.'];
  output.sizes.push(rows);
}
process.stdout.write(JSON.stringify(output,null,2)+'\n');
