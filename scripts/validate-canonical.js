const fs=require('node:fs');
const path=require('node:path');
const {readCorpus,validateCorpus,stable,root}=require('../src/canonical');
const {originalIntegrity}=require('../src/publication');
const {allEntities}=require('../src/entities');
function run(){
  let report;
  try{
    const corpus=readCorpus();report=validateCorpus(corpus);report.errors.push(...originalIntegrity(corpus));
    if(corpus.operations.some(op=>/^(TEST_|SYNTHETIC_)/.test(op.id)))report.errors.push('Synthetic fixture in production corpus');
    if((corpus.claims||[]).some(c=>/^(CLM_TEST_|CLM_SYNTHETIC_)/.test(c.id))||allEntities(corpus).some(e=>/^(PER|ORG|PLC)_(TEST|SYNTHETIC)_/.test(e.id)))report.errors.push('Synthetic assertion/entity in production corpus');
    if((corpus.duplicate_assessments||[]).some(a=>/^QA_(TEST|SYNTHETIC)_/.test(a.id)))report.errors.push('Synthetic assessment in production corpus');
    report.summary={total:corpus.operations.length,published:corpus.operations.filter(op=>op.editorial_status==='published').length};
  }catch(error){report={errors:[error.message],warnings:[]};}
  const directory=path.join(root,'work');fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'canonical-quality.json'),stable(report));
  fs.writeFileSync(path.join(directory,'canonical-quality.md'),`# Contrôle du corpus canonique\n\n${report.errors.length} erreurs ; ${report.warnings.length} avertissements.\n\n`+
    report.errors.map(error=>`- Erreur : ${error}`).join('\n')+'\n'+report.warnings.map(w=>`- ${w.id} : ${w.code}`).join('\n')+'\n');
  console.log(`${report.errors.length} blocking errors; ${report.warnings.length} review notices. Reports: work/canonical-quality.{json,md}`);
  if(report.errors.length)process.exitCode=1;
  return report;
}
if(require.main===module)run();module.exports={run};
