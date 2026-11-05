const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
function run(check=process.argv.includes('--check')){
 const model=fs.readFileSync(path.join(root,'src/shared/assistance.js'),'utf8').replace(/\r\n/g,'\n');
 const files={'docs/assistance-model.js':model,'docs/data/assistance/engine.json':JSON.stringify({version:'assistance-v1',model_sha256:crypto.createHash('sha256').update(model).digest('hex')},null,2)+'\n'};
 for(const [file,content]of Object.entries(files)){const target=path.join(root,file);if(check){if(!fs.existsSync(target)||!fs.readFileSync(target).equals(Buffer.from(content)))throw Error('Stale assistance artifact: '+file);}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}}
 console.log(check?'Assistance artifacts match.':'Assistance artifacts generated.');
}
if(require.main===module)run();module.exports={run};
