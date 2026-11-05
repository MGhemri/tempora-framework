const {performance}=require('node:perf_hooks');
const {parseArgs}=require('node:util');
const {analyze}=require('../src/framework/analysis');
const {createWorkingCorpus}=require('../src/framework/ingestion');
const {temporal}=require('../src/framework/temporal');
const {grams}=require('../src/framework/similarity');
const profile=require('../tests/fixtures/profiles/synthetic-history/profile.json');

function benchmark(size) {
  const corpus=createWorkingCorpus(profile,{event_types:['fictional assembly'],territorial_units:[]});
  const date=temporal('1700'),unknown=temporal(null);
  const template={schema_version:'3.0.0',kind:'event',namespace:profile.namespace,editorial_status:'proposed',
    description:{en:null},start_date:date,end_date:unknown,event_type:['fictional assembly'],
    spatial_refs:[],territory_refs:[],participant_refs:[],review_refs:[],provenance:{evidence:[],transformations:[]},extensions:{}};
  for(let i=0;i<size;i++){
    const group=Math.floor(i/5);
    const title=String.fromCodePoint(0x4e00+group,0x4e00+(group+(i%5)*5003)%20992);
    corpus.events.push({...template,id:'BENCH_'+String(i).padStart(6,'0'),title:{en:title}});
  }
  const labels=[[0,1],[2,3],[4,5]];
  const titles=['Fictional assembly','Fictional assembly','Réunion fictive','Réunion fictive','Historic council','مجلس تاريخي'];
  for(const [index,title] of titles.entries())corpus.events[index].title={en:title};
  const recalled=labels.filter(([left,right])=>{
    const index=grams(titles[left]);
    return [...grams(titles[right])].some(key=>index.has(key));
  }).length;
  const start=performance.now(),cpuStart=process.cpuUsage();
  const report=analyze(corpus,{scope:'working',max_pairs:500000});
  const cpu=process.cpuUsage(cpuStart),elapsed=performance.now()-start;
  return {size,elapsed_ms:Math.round(elapsed),cpu_ms:Math.round((cpu.user+cpu.system)/1000),
    events_per_second:Math.round(size*1000/elapsed),max_rss_kib:process.resourceUsage().maxRSS,
    blocking_reference:{positive:labels.length,recalled,recall:recalled/labels.length},
    input_sha256:report.corpus_sha256,compared:report.pair_count,excluded:report.blocking.excluded_pairs,
    candidates:report.duplicates.length};
}

if(require.main===module){
  const {values}=parseArgs({options:{size:{type:'string',multiple:true}}});
  const sizes=(values.size??['1000','10000','100000']).map(Number);
  if(sizes.some(size=>![1000,10000,100000].includes(size)))throw Error('Use benchmark size 1000, 10000 or 100000');
  console.log(JSON.stringify({scope:'synthetic_sparse_lexical_buckets',node:process.version,platform:process.platform,
    results:sizes.map(benchmark)},null,2));
}
