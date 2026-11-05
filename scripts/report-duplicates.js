const fs=require('node:fs'),path=require('node:path');
const {readCorpus,validateCorpus,root,stable,hash}=require('../src/canonical');
const {duplicateReport}=require('../src/duplicates');
const {evaluate}=require('../src/duplicate-assessments');
function run(){
  const corpus=readCorpus(),validation=validateCorpus(corpus);
  if(validation.errors.length)throw Error(validation.errors.join('\n'));
  const report=duplicateReport(corpus.operations);
  report.records_sha256=hash(stable(corpus.operations));report.calibration=evaluate(corpus,report);
  const directory=path.join(root,'work');fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'duplicate-candidates.json'),stable(report));
  fs.writeFileSync(path.join(directory,'duplicate-human-evaluation.json'),stable(report.calibration));
  fs.writeFileSync(path.join(directory,'duplicate-candidates.md'),'# Correspondances possibles à examiner\n\n'+report.notice+'\n\n'+
    report.candidates.map(c=>{
      const link=c.ids.every(id=>corpus.operations.find(o=>o.id===id)?.editorial_status==='published')?` · [Comparer](https://alnop.vercel.app/compare.html?left=${encodeURIComponent(c.ids[0])}&right=${encodeURIComponent(c.ids[1])})`:'';
      return `- ${c.ids.join(' / ')} : similarité du nom ${c.factors.title_trigram_similarity} ; chevauchement des dates ${c.factors.start_intervals_overlap??'inconnu'} ; sites revus ${c.factors.reviewed_site_distance_km??'non comparables'} km ; réserves ${c.review_cautions.join(', ')||'revue nécessaire'}${link}`;
    }).join('\n')+`\n\nPaires historiques annotées et utilisables : ${report.calibration.annotated_pairs}. Précision : ${report.calibration.precision??'non mesurée'} ; rappel : ${report.calibration.recall??'non mesuré'}.\n`);
  console.log(`${report.candidates.length} candidate pairs; no records changed. Reports: work/duplicate-candidates.{json,md}`);
  return report;
}
if(require.main===module){try{run();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={run};
