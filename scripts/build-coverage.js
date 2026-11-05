const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {FileRepository}=require('../src/api-v2/repository');
const coverage=require('../src/shared/coverage');
const root=path.join(__dirname,'..');
const script=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
function engine(){return {calculation_version:'coverage-v1',model_sha256:crypto.createHash('sha256').update(script('src/shared/coverage.js')).digest('hex'),query_sha256:crypto.createHash('sha256').update(script('src/api-v2/query.js')).digest('hex')};}
function artifacts(snapshot){
  const report=coverage.report(snapshot.operations,snapshot.sources,snapshot.claims,snapshot.territories);
  const meta={snapshot_sha256:snapshot.manifest.canonical_sha256,dataset_release:snapshot.current_release?.id||null,...engine()};
  const files={'docs/data/coverage/report.json':JSON.stringify({data:report,meta},null,2)+'\n'};
  for(const group of ['year','territory','type'])files['docs/data/coverage/'+group+'.csv']=coverage.csv(report,meta,{},group);
  return files;
}
function run(check=process.argv.includes('--check')){
  const files={...artifacts(new FileRepository().load()),'docs/coverage-model.js':script('src/shared/coverage.js'),'docs/coverage-query.js':script('src/api-v2/query.js'),'docs/data/coverage/engine.json':JSON.stringify(engine(),null,2)+'\n'};
  for(const [name,content]of Object.entries(files)){
    const target=path.join(root,name),bytes=Buffer.from(content);
    if(check){if(!fs.existsSync(target)||!fs.readFileSync(target).equals(bytes))throw Error('Stale observatory artifact: '+name);}
    else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
  }
  console.log(check?'Observatory artifacts match.':'Observatory artifacts generated.');
}
if(require.main===module)run();module.exports={run,artifacts};
