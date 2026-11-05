const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {parseArgs,TextDecoder}=require('node:util');
const {validateCorpus,digest}=require('../src/framework/canonical');
const {loadProfile}=require('../src/framework/profile-loader');
const {strictJson,MAX_BYTES}=require('../src/framework/ingestion-formats');
const {createWorkingCorpus,prepareImport,acceptImport,renderMarkdown}=require('../src/framework/ingestion');
const {fail}=require('../src/framework/ingestion-error');
const root=path.join(__dirname,'..'),MAX_SNAPSHOT_BYTES=128*1024*1024;
const spec=Object.fromEntries(['input','mapping','base','profile','taxonomies','batch','reviewer','reason','report'].map(key=>[key,{type:'string'}]));
spec.id={type:'string',multiple:true};spec.write={type:'boolean'};
function read(file,limit){
 if(typeof file!=='string'||!file.trim())fail('CLI_FILE_REQUIRED','An explicit input path is required');
 const fd=fs.openSync(path.resolve(file),'r');try{const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>limit)fail('CLI_FILE_SIZE','Input file is empty, not a regular file, or exceeds its size limit');
  const bytes=Buffer.alloc(stat.size+1);let used=0,n;while(used<bytes.length&&(n=fs.readSync(fd,bytes,used,bytes.length-used,null)))used+=n;
  if(used!==stat.size)fail('CLI_FILE_CHANGED','Input file changed while it was read');return bytes.subarray(0,used);
 }finally{fs.closeSync(fd);}
}
function json(file,limit){const bytes=read(file,limit);let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('CLI_ENCODING','Only UTF-8 JSON is accepted');}return strictJson(text);}
function getBase(options){
 if(options.base){if(options.profile||options.taxonomies)fail('CLI_BASE_OPTIONS','Use --base or --profile with --taxonomies');
  const document=json(options.base,MAX_SNAPSHOT_BYTES);
  if(document?.kind==='tempora-working-corpus'){
   if(document.snapshot_version!=='1.0.0'||!document.corpus||digest(document.corpus)!==document.journal?.output_sha256)fail('CLI_SNAPSHOT_INVALID','Working snapshot integrity check failed');return document.corpus;
  }
  return document;
 }
 if(!options.profile||!options.taxonomies)fail('CLI_BASE_REQUIRED','Supply --base or both --profile and --taxonomies');
 return createWorkingCorpus(loadProfile(path.resolve(options.profile)),json(options.taxonomies,128*1024));
}
function save(document,name,rootDirectory){
 const data=Buffer.from(JSON.stringify(document,null,2)+'\n','utf8');if(data.length>MAX_SNAPSHOT_BYTES)fail('CLI_OUTPUT_SIZE','Local output exceeds 128 MiB');
 const directory=path.resolve(rootDirectory,'work/tempora-v3/ingestion');fs.mkdirSync(directory,{recursive:true});
 if(path.relative(directory,fs.realpathSync(directory)))fail('CLI_OUTPUT_PATH','Local output directory cannot be redirected');
 const target=path.join(directory,name),temp=path.join(directory,'.temp-'+randomUUID());
 try{fs.writeFileSync(temp,data,{flag:'wx'});fs.linkSync(temp,target);}
 catch(e){if(e.code==='EEXIST')fail('CLI_OUTPUT_EXISTS',`Local output already exists: ${name}`);throw e;}
 finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 return path.relative(rootDirectory,target).split(path.sep).join('/');
}
function run(args=process.argv.slice(2),{rootDirectory=root,clock=()=>new Date().toISOString(),writeLine=value=>console.log(value)}={}){
 let options,positionals;try{({values:options,positionals}=parseArgs({args,options:spec,allowPositionals:true,strict:true}));}catch(e){fail('CLI_ARGUMENT',e.message);}
 const [command]=positionals,common=['base','profile','taxonomies'],allowed={import:[...common,'input','mapping','report','write'],validate:common,accept:[...common,'batch','id','reviewer','reason','write']};
 if(positionals.length!==1||!Object.hasOwn(allowed,command)||Object.keys(options).some(key=>!allowed[command].includes(key)))fail('CLI_ARGUMENT','Expected import, validate or accept; see the ingestion guide');
 const corpus=getBase(options);
 if(command==='validate'){
  const result=validateCorpus(corpus);writeLine(JSON.stringify({valid:result.valid,scope:result.scope,errors:result.errors,warnings:result.warnings},null,2));return {exitCode:result.valid?0:1,result};
 }
 if(command==='import'){
  if(options.report&&!['json','markdown'].includes(options.report))fail('CLI_REPORT','Report format must be json or markdown');
  const bundle=prepareImport({bytes:read(options.input,MAX_BYTES),mapping:json(options.mapping,128*1024),corpus,sourceName:path.basename(options.input),observedAt:clock()});
  const markdown=renderMarkdown(bundle.report);
  const name=`batch-${bundle.report.batch_id}-${bundle.report.base_sha256.slice(0,16)}.json`;
  const local_output=options.write?save({kind:'tempora-ingestion-package',bundle,markdown},name,rootDirectory):null;
  const summary={mode:options.write?'local_stage':'dry_run',batch_id:bundle.report.batch_id,summary:bundle.report.summary,local_output};
  if(options.report==='markdown')writeLine(markdown+(local_output?`\nCopie locale : ${local_output}\n`:''));
  else writeLine(JSON.stringify(options.report==='json'?{...summary,report:bundle.report}:summary,null,2));
  return {exitCode:0,bundle,local_output};
 }
 const staged=json(options.batch,MAX_SNAPSHOT_BYTES);
 if(staged?.kind!=='tempora-ingestion-package'||!staged.bundle)fail('CLI_BUNDLE_INVALID','Expected an ingestion package created with import --write');
 const snapshot=acceptImport({corpus,bundle:staged.bundle,review:{ids:options.id,reviewer:options.reviewer,reason:options.reason,reviewed_at:clock()}});
 if(staged.markdown!==renderMarkdown(staged.bundle.report))fail('CLI_BUNDLE_INVALID','Staged Markdown no longer matches its JSON report');
 const local_output=options.write?save(snapshot,`working-${snapshot.journal.output_sha256}.json`,rootDirectory):null;
 writeLine(JSON.stringify({mode:options.write?'local_acceptance':'dry_run',journal:snapshot.journal,local_output},null,2));return {exitCode:0,snapshot,local_output};
}
if(require.main===module){try{process.exitCode=run().exitCode;}catch(e){console.error(`${e.code||'INGESTION_FAILED'}: ${e.message}`);if(e.details?.length)console.error(JSON.stringify(e.details,null,2));process.exitCode=1;}}
module.exports={run,getBase,json};
