const fs=require('node:fs'),path=require('node:path');
const {readCorpus,validateCorpus,root,stable,hash}=require('../src/canonical');
const {conflicts}=require('../src/shared/assistance');
function run(){
  const corpus=readCorpus(),validation=validateCorpus(corpus);if(validation.errors.length)throw Error(validation.errors.join('\n'));
  const report={...conflicts(corpus.claims),claims_sha256:hash(stable(corpus.claims)),structured_claim_count:corpus.claims.length,
    notice:'Comparaisons internes d’assertions structurées, sans extraction automatique des récits ni arbitrage historique.'};
  fs.mkdirSync(path.join(root,'work'),{recursive:true});fs.writeFileSync(path.join(root,'work/conflict-candidates.json'),stable(report));
  fs.writeFileSync(path.join(root,'work/conflict-candidates.md'),'# Assertions à comparer\n\n'+report.notice+'\n\n'+report.comparisons.map(c=>`- ${c.claim_ids.join(' / ')} : ${c.reason}`).join('\n')+'\n');
  console.log(`${report.comparisons.length} structured-claim comparisons; no assertions changed.`);return report;
}
if(require.main===module){try{run();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={run};
