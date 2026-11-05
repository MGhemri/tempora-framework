const fs=require('node:fs'),path=require('node:path');
const {readCorpus,root}=require('../src/canonical');
const {load}=require('../src/profiles/alnop');
const {toTempora,fromTempora}=require('../src/profiles/alnop-migration');
const {digest,validateCorpus,CanonicalError}=require('../src/framework/canonical');
function run(args=process.argv.slice(2)){
 const write=args.includes('--write'),reverse=args.indexOf('--reverse');
 const allowed=reverse<0?args.every(v=>v==='--write'):args.length-(write?1:0)===2&&args[reverse+1]&&!args[reverse+1].startsWith('--')&&args.every((v,i)=>i===reverse||i===reverse+1||v==='--write');
 if(!allowed||args.filter(a=>a==='--write').length>1)throw new CanonicalError('MIGRATION_ARGUMENT_INVALID','Usage: npm run migrate:tempora -- [--write] [--reverse FILE]');
 let document,summary,filename;
 if(reverse>=0){
  const input=path.resolve(args[reverse+1]);if(fs.statSync(input).size>128*1024*1024)throw new CanonicalError('MIGRATION_SIZE_LIMIT','Migration file exceeds 128 MiB');
  const v3=JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,''));document=fromTempora(v3);filename='restored-alnop.json';summary={direction:'tempora-v3-to-alnop-v2',restored_sha256:digest(document.corpus),events:document.corpus.operations.length,releases:document.releases.length};
 }else{
  const input=readCorpus(),directory=path.join(root,'data/releases');
  const releases=fs.readdirSync(directory).filter(n=>/^data-\d{4}\.\d{2}\.\d+\.json$/.test(n)).sort().map(n=>JSON.parse(fs.readFileSync(path.join(directory,n),'utf8')));
  document=toTempora(input,load(root),{releases});const restored=fromTempora(document);
  if(digest(input)!==digest(restored.corpus))throw new CanonicalError('MIGRATION_ROUNDTRIP_FAILED','Round trip mismatch');
  filename='corpus-v3.json';const validation=validateCorpus(document);
  summary={direction:'alnop-v2-to-tempora-v3',input_sha256:digest(input),output_sha256:digest(document),events:document.events.length,sources:document.sources.length,releases:document.releases.length,roundtrip_verified:true,warnings:validation.warnings.length,scope:validation.scope};
 }
 if(write){const directory=path.join(root,'work/tempora-v3');fs.mkdirSync(directory,{recursive:true});const target=path.join(directory,filename);fs.writeFileSync(target,JSON.stringify(document,null,2)+'\n',{flag:'wx'});summary.local_output=path.relative(root,target).replace(/\\/g,'/');}
 console.log(JSON.stringify({mode:write?'local_file':'dry_run',...summary},null,2));return {document,summary};
}
if(require.main===module){try{run();}catch(e){console.error(`${e.code||'MIGRATION_FAILED'}: ${e.message}`);process.exitCode=1;}}
module.exports={run};
