const fs=require('node:fs'),path=require('node:path');
const {readReleases,root,hash,stable,citation,changelog}=require('../src/data-releases');
function releaseArtifacts(releases){
  const files={},entries=releases.map(({metadata:r,archive,payload})=>{
    const folder='docs/data/releases/'+r.id+'/';
    files[folder+'alnop-'+r.id+'.zip']=archive;files[folder+'release.json']=stable(r);
    for(const name of ['CITATION.cff','CHANGELOG.md','SHA256SUMS.txt'])files[folder+name]=payload[name];
    files[folder+'archive.sha256']=r.archive_sha256+'  alnop-'+r.id+'.zip\n';
    return {...r,archive_url:'/data/releases/'+r.id+'/alnop-'+r.id+'.zip',manifest_url:'/data/releases/'+r.id+'/release.json',
      citation_url:'/data/releases/'+r.id+'/CITATION.cff',changelog_url:'/data/releases/'+r.id+'/CHANGELOG.md',checksum_url:'/data/releases/'+r.id+'/archive.sha256'};
  }).sort((a,b)=>b.published_at.localeCompare(a.published_at)||b.id.localeCompare(a.id,undefined,{numeric:true}));
  files['docs/data/releases/index.json']=stable({releases:entries,corpus_is_incomplete:true});
  if(entries.length)files['CITATION.cff']=citation(entries[0]);
  files['CHANGELOG.md']='# Versions du corpus ALNOP\n\nLes versions des données sont distinctes des versions logicielles. Corpus incomplet ; les réserves scientifiques restent explicites.\n\n'+entries.map(r=>changelog(r).replace(/^# /,'## ')).join('\n');
  return files;
}
function run(args=process.argv.slice(2),directory=root){
  const check=args.includes('--check'),releases=readReleases(directory,{sources:args.includes('--sources')}),files=releaseArtifacts(releases);
  for(const [name,value]of Object.entries(files)){
    const target=path.join(directory,name),bytes=Buffer.from(value);
    if(check){if(!fs.existsSync(target)||hash(fs.readFileSync(target))!==hash(bytes))throw Error('Stale release artifact: '+name);}
    else{fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target)||hash(fs.readFileSync(target))!==hash(bytes))fs.writeFileSync(target,bytes);}
  }
  console.log(`${releases.length} data release(s) ${check?'verified':'generated'}${args.includes('--sources')?' and reproduced from source commits':''}.`);
  return files;
}
if(require.main===module){try{run();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={run,releaseArtifacts};
