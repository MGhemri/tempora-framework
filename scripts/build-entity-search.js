const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildIndex}=require('../src/shared/entity-search'),root=path.join(__dirname,'..'),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function artifacts(canonical){
 const manifest=JSON.parse(canonical['dataset-manifest.json']),operations=canonical['operations.json'];if(hash(operations)!==manifest.checksums['operations.json'])throw Error('Unverified operation index input');
 const model=fs.readFileSync(path.join(root,'src/shared/entity-search.js'),'utf8').replace(/\r\n/g,'\n'),index=JSON.stringify(buildIndex(JSON.parse(operations).operations))+'\n';
 return {'docs/entity-search-model.js':model,'docs/data/entity-search/index.json':index,'docs/data/entity-search/manifest.json':JSON.stringify({version:'entity-mentions-v1',snapshot_manifest_sha256:hash(canonical['dataset-manifest.json']),snapshot_sha256:manifest.canonical_sha256,index_sha256:hash(index),model_sha256:hash(model)},null,2)+'\n'};
}
function run(check=process.argv.includes('--check')){const canonical=Object.fromEntries(['dataset-manifest.json','operations.json'].map(f=>[f,fs.readFileSync(path.join(root,'docs/data/canonical',f))]));for(const [file,content]of Object.entries(artifacts(canonical))){const target=path.join(root,file);if(check){if(!fs.existsSync(target)||!fs.readFileSync(target).equals(Buffer.from(content)))throw Error('Stale entity search: '+file);}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}}console.log(check?'Entity search matches.':'Entity search generated.');}
if(require.main===module)run();module.exports={run,artifacts};
