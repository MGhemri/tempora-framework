// Explicit, opt-in benchmark harness for fictional TEMPORA v3 corpora.
// Never benchmark users' real research data; no network or persistent indexes.
// Usage: node scripts/bench-visualization.mjs [--large] [--sizes=100,1000,10000]
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
import {SYNTHETIC_CASES} from '../tests/visualization/synthetic-cases.mjs';
const require=createRequire(import.meta.url);
const {canonical}=require('tempora-framework');
const {build}=require('../bridge/visualization/projections.cjs');
const {analyze}=require('../bridge/visualization/algorithms.cjs');
const {ProjectManager}=require('../bridge/visualization/session.cjs');

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
  const start=performance.now();
  let status='ok',message=null;
  try{fn();}catch(error){
    status='rejected';
    message=error?.code??error?.message??String(error);
  }
  return {status,elapsed_ms:Number((performance.now()-start).toFixed(3)),
    ...(message?{message}:{})};
}
const args=process.argv.slice(2);
const large=args.includes('--large');
const param=args.find(a=>a.startsWith('--sizes='));
let sizes=param?param.slice(8).split(',').map(Number):[100,1000,10000];
if(!sizes.length||sizes.some(n=>!Number.isSafeInteger(n)||n<1||n>100000))
  throw Error('INVALID_BENCHMARK_SIZES');
if(sizes.some(n=>n>10000)&&!large)
  throw Error('LARGE_BENCHMARK_REQUIRES_EXPLICIT_OPT_IN');
const output={name:'TEMPORA Visual Research Workbench — synthetic performance audit',
  synthetic:true,architecture:process.arch,node:process.version,platform:process.platform,
  sdk:'tempora-framework@3.0.0',sizes:[]};
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
    observatory_analysis:timed(()=>analyze(corpus,{module:'observatory',limit:50})),
    native_project_create:timed(()=>{
      const projects=new ProjectManager();
      const p=projects.create(corpus);
      projects.release(p.project_id);
    })};
  rows.mem_after_mb=Number((process.memoryUsage().rss/1048576).toFixed(2));
  rows.notes=['Measurements are single-run wall-clock samples, NOT p95 or a Windows UI benchmark.',
    'Errors and quotas are measured as rejections; do not extrapolate to untested sizes.'];
  output.sizes.push(rows);
}
process.stdout.write(JSON.stringify(output,null,2)+'\n');
