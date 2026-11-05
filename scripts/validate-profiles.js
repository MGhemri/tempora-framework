const path=require('node:path');
const {loadProfile,discoverProfiles}=require('../src/framework/profile-loader');
const {readCorpus}=require('../src/canonical');
const adapter=require('../src/profiles/alnop');
function run(args=process.argv.slice(2)){
 const root=path.join(__dirname,'..');
 if(args.length){if(args.length!==2||args[0]!=='--profile')throw Error('Usage: node scripts/validate-profiles.js [--profile path/to/profile.json]');const p=loadProfile(path.resolve(args[1]),{rootDirectory:root});console.log(`Profile ${p.id}@${p.version} is valid.`);return;}
 const profiles=discoverProfiles(path.join(root,'profiles'));if(new Set(profiles.map(p=>p.id)).size!==profiles.length)throw Error('Duplicate profile identifiers');
 const profile=adapter.load(root),results=adapter.validate(readCorpus(),profile),errors=results.filter(r=>!r.valid);
 if(errors.length)throw Error(JSON.stringify(errors));console.log(`${profiles.length} published profile configuration(s); ${results.length} existing records pass the configured rules.`);
}
if(require.main===module){try{run();}catch(e){console.error(e.code?`${e.code}: ${e.message}`:e.message);process.exitCode=1;}}
module.exports={run};
