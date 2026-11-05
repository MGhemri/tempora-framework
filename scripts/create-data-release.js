const fs=require('node:fs'),path=require('node:path');
const {makeRelease,gitSource,root,stable}=require('../src/data-releases');
function run(args=process.argv.slice(2),directory=root){
  const options={};for(let i=0;i<args.length;i+=2){if(!['--id','--source','--date','--summary','--changes'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Use --id, --source, --date, --summary, --changes (JSON array)');options[args[i]]=args[i+1];}
  const details={id:options['--id'],source_commit:options['--source'],published_at:options['--date'],summary:options['--summary'],changes:JSON.parse(options['--changes']||'[]')};
  if(!/^data-\d{4}\.(0[1-9]|1[0-2])\.[1-9]\d*$/.test(details.id||''))throw Error('Invalid release ID');
  const folder=path.join(directory,'data/releases'),json=path.join(folder,details.id+'.json'),zip=path.join(folder,details.id+'.zip');
  if(fs.existsSync(json)||fs.existsSync(zip))throw Error('Release IDs are immutable; create a new version');
  const result=makeRelease(gitSource(details.source_commit,directory),details);
  fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(zip,result.archive,{flag:'wx'});fs.writeFileSync(json,stable(result.metadata),{flag:'wx'});
  console.log(`Prepared ${details.id}: ${result.metadata.total} existing records, SHA-256 ${result.metadata.archive_sha256}. No tag or remote release created.`);
  return result;
}
if(require.main===module){try{run();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={run};
