const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {parseArgs} = require('node:util');

const root = path.resolve(__dirname,'..');
const inputs = ['LICENSE','README.md','src/framework','src/sdk','src/cli','schemas/tempora',
  'schemas/tempora.profile.schema.json','schemas/tempora.ingestion-mapping.schema.json',
  'scripts/ingest-tempora.js','scripts/analyze-tempora.js','scripts/publish-tempora.js','scripts/serve-tempora.js'];

function npm(args,cwd,offline=false) {
  const cli=process.env.npm_execpath;
  if (!cli) throw Error('Run packaging via npm');
  const env={...process.env};
  delete env.NODE_PATH;
  delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,[cli,...args,...(offline?['--offline']:[])],
    {cwd,env,encoding:'utf8',timeout:120000});
  if(result.error) throw result.error;
  if(result.status!==0) throw Error('npm command failed: '+result.stderr);
  return result.stdout;
}

function pack(directory,{write=false,offline=false}={}) {
  const destination=fs.realpathSync(directory);
  const staging=fs.mkdtempSync(path.join(destination,'.tempora-package-'));
  try {
    for(const entry of inputs){
      const file=path.join(staging,entry);
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.cpSync(path.join(root,entry),file,{recursive:true});
    }
    fs.copyFileSync(path.join(root,'distribution/package.json'),path.join(staging,'package.json'));
    const [preview]=JSON.parse(npm(['pack','--dry-run','--json','--ignore-scripts'],staging,offline));
    for(const file of preview.files){
      if(file.path==='package.json'||inputs.some(entry=>file.path===entry||file.path.startsWith(entry+'/'))) continue;
      throw Error('Unexpected package entry: '+file.path);
    }
    if(!write)return preview;
    npm(['pack','--json','--ignore-scripts'],staging,offline);
    const file=path.join(destination,preview.filename);
    fs.linkSync(path.join(staging,preview.filename),file);
    return {...preview,file};
  } finally {
    fs.rmSync(staging,{recursive:true,force:true});
  }
}

if(require.main===module){
  try{
    const {values}=parseArgs({options:{out:{type:'string'},write:{type:'boolean'},offline:{type:'boolean'}}});
    if(!values.out)throw Error('Supply an existing --out directory');
    console.log(JSON.stringify(pack(values.out,values),null,2));
  }catch(error){
    console.error(error.message);
    process.exitCode=1;
  }
}

module.exports={pack,npm};
