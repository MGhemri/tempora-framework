const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {root,readCorpus}=require('../src/canonical');
const {publicSources}=require('../src/claims');
const {checkChanges,contentDigest}=require('../src/review');
function run(args=process.argv.slice(2),directory=root){
  const git=(...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  if(args[0]==='--digest'){
    const file=args[1]?.replaceAll('\\','/');
    if(!/^data\/[a-z-]+\/[A-Za-z0-9_-]+\.json$/.test(file||''))throw Error('Use --digest data/<collection>/<id>.json');
    console.log(contentDigest(JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'))));return;
  }
  const base=args[0]==='--base'?args[1]:null;
  if(!/^[a-f0-9]{40}$/.test(base||'')||/^0+$/.test(base))throw Error('An explicit existing base commit SHA is required');
  git('cat-file','-e',base+'^{commit}');
  const changedReleases=git('diff','--name-only','--no-renames',base,'--','data/releases').split('\n').filter(f=>/^data\/releases\/data-[A-Za-z0-9_.-]+\.(json|zip)$/.test(f));
  for(const file of changedReleases)if(git('ls-tree','--name-only',base,'--',file))throw Error(`${file}: existing release bytes are immutable; publish a new version`);
  const files=[...new Set([...git('diff','--name-only','--no-renames',base,'--','data').split('\n'),...git('ls-files','--others','--exclude-standard','--','data').split('\n')])].filter(f=>/^data\/(operations|claims|persons|organizations|places|sources|territorial-units|duplicate-assessments)\/[A-Za-z0-9_-]+\.json$/.test(f));
  const changes=files.map(file=>{
    let before=null;try{before=JSON.parse(git('show',base+':'+file));}catch(e){if(git('ls-tree','--name-only',base,'--',file))throw e;}
    return {file,before,after:fs.existsSync(path.join(directory,file))?JSON.parse(fs.readFileSync(path.join(directory,file),'utf8')):null};
  });
  const sources=new Set(publicSources(readCorpus(path.join(directory,'data'))).map(s=>s.source_id));
  // Previously public evidence also needs review if the patch removes its last use.
  for(const c of changes)if(c.before&&c.file.includes('/sources/'))sources.add(c.before.source_id);
  const errors=checkChanges(changes,{publicSourceIds:sources});
  if(errors.length)throw Error(errors.join('\n'));
  console.log(`Review changes checked against ${base.slice(0,7)}: ${changes.length} canonical files, no blocking errors.`);
}
if(require.main===module){try{run();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={run};
