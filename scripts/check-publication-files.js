const fs=require('node:fs'),path=require('node:path');
function forbidden(name){
 const normalized=name.replace(/\\/g,'/');
 return /(?:^|\/)CDC(?:_[^/]*)?\.(?:md|pdf|docx)$/i.test(normalized)||
 /^docs\/work\//i.test(normalized)||
 /\.bundle\.json$/i.test(normalized)||
 /(?:^|\/)(?:PHASE_\d+_(?:AUDIT|PROGRESS)|v3-(?:baseline|audit))\.(?:md|html)$/i.test(normalized)||
 /(?:^|\/)(?:audit|correction)[-_](?:report|rapport|bilan)[^/]*\.(?:md|html|json|pdf)$/i.test(normalized)||
 /(?:^|\/)(?:v\d+-)?(?:baseline|audit)(?:[-_][^/]*)?\.(?:md|html|pdf)$/i.test(normalized)||
 /(?:^|\/)(?:corpus-v3|restored-alnop|batch-[a-f0-9]{64}-[a-f0-9]{16}|working-[a-f0-9]{64})\.json$/i.test(normalized)||
 /(?:^|\/)private-reports\//i.test(normalized)||/^docs\/documentation\/progress\.html$/i.test(normalized);
}
function inspect(root){
 const candidates=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>e.name);
 function walk(directory){if(!fs.existsSync(directory))return;for(const e of fs.readdirSync(directory,{withFileTypes:true})){const target=path.join(directory,e.name);if(e.isDirectory())walk(target);else if(e.isFile())candidates.push(path.relative(root,target).replace(/\\/g,'/'));}}
 walk(path.join(root,'docs'));
 if(fs.existsSync(path.join(root,'.git'))){
  const tracked=require('node:child_process').execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  candidates.push(...tracked.filter(name=>fs.existsSync(path.join(root,name))));
 }
 return [...new Set(candidates.filter(forbidden))].sort();
}
function run(root=path.join(__dirname,'..')){const files=inspect(root);if(files.length)throw Error('Private documents must remain outside the repository and public output:\n'+files.join('\n'));console.log('Public files contain no private specifications or implementation reports.');}
if(require.main===module){try{run();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={forbidden,inspect,run};
