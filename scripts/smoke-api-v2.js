const fs=require('node:fs'),path=require('node:path');
const examples=require('../openapi/examples.json');
function verify(example,status,body,headers){
  if(status!==example.status)throw Error(`${example.path}: expected ${example.status}, got ${status}`);
  if(example.kind==='error'){if(!body.error?.code||!body.error?.message)throw Error('Unstructured API error');return;}
  if(example.kind==='openapi'){if(body.openapi!=='3.1.0')throw Error('OpenAPI contract missing');return;}
  if(!/^[a-f0-9]{64}$/.test(body.meta?.snapshot_sha256)||body.meta?.corpus_is_incomplete!==true)throw Error('Snapshot metadata missing');
  if(example.kind==='geojson'){if(body.type!=='FeatureCollection'||!Array.isArray(body.features)||body.features.length>2)throw Error('GeoJSON pagination failed');if(!headers['content-type']?.includes('application/geo+json'))throw Error('Incorrect GeoJSON content type');}
  if(example.kind==='collection'&&(!Array.isArray(body.data)||!Number.isInteger(body.meta.total)))throw Error('Invalid collection');
  if(example.kind==='record'&&body.data.id!=='OP_1954_001')throw Error('Initial ID unavailable');
  if(example.kind==='empty'&&(body.data.length||body.meta.total!==0))throw Error('Empty selection contract failed');
  if(example.kind==='releases'&&(!Array.isArray(body.data)||body.meta.release_workflow_enabled!==true))throw Error('Release catalogue unavailable');
  if(example.kind==='coverage'&&(body.data.total_operations!==0||!body.data.empty_selection_message))throw Error('Documentary gap message missing');
}
async function run(base='https://alnop.vercel.app'){
  const parsed=new URL(base);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash)throw Error('Invalid API base URL');
  const results=[];
  for(const example of examples){const response=await fetch(base.replace(/\/$/,'')+example.path,{signal:AbortSignal.timeout(20000)}),body=await response.json();
    verify(example,response.status,body,Object.fromEntries(response.headers));results.push({path:example.path,status:response.status});}
  const first=await fetch(base+'/api/v2/operations?limit=1'),etag=first.headers.get('etag');if(!etag)throw Error('Missing ETag');
  const conditional=await fetch(base+'/api/v2/operations?limit=1',{headers:{'If-None-Match':etag}});if(conditional.status!==304)throw Error('Conditional GET failed');
  const report={base,examples:results,conditional_status:304};fs.mkdirSync(path.join(__dirname,'../work'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../work/api-v2-smoke.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`${results.length} GET examples passed; conditional GET 304. No mutations sent.`);return report;
}
if(require.main===module)run(process.argv[2]||undefined).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={verify,run};
