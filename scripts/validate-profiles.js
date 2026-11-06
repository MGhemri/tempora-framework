const path=require('node:path');
const {loadProfile}=require('../src/framework/profile-loader');
function run(args=process.argv.slice(2)){
 const root=path.join(__dirname,'..');
 if(args.length){if(args.length!==2||args[0]!=='--profile')throw Error('Usage: node scripts/validate-profiles.js [--profile path/to/profile.json]');const p=loadProfile(path.resolve(args[1]),{rootDirectory:root});console.log(`Profile ${p.id}@${p.version} is valid.`);return;}
 const profiles=[loadProfile(path.join(root,'profiles/synthetic-history/profile.json'),{rootDirectory:root})];
 console.log(`${profiles.length} valid profile configuration(s); no corpus is loaded.`);
}
if(require.main===module){try{run();}catch(e){console.error(e.code?`${e.code}: ${e.message}`:e.message);process.exitCode=1;}}
module.exports={run};
