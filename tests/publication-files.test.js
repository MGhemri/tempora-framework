const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {forbidden,inspect,run}=require('../scripts/check-publication-files');
test('Private specifications and implementation reports cannot enter public documentation',()=>{
 for(const name of ['CDC_TEMPORA_Framework_v3.md','cdc.md','audit_tempora_v3.md','docs/work/review-journal.json','docs/fictional-1.bundle.json','docs/CDC_STATUS.md','docs/PHASE_0_AUDIT.md','docs/PHASE_2_PROGRESS.md','docs/architecture/v3-baseline.md','docs/documentation/progress.html','docs/correction-report.md','docs/corpus-v3.json','docs/restored-alnop.json',`docs/data/batch-${'a'.repeat(64)}-${'b'.repeat(16)}.json`,`docs/data/working-${'c'.repeat(64)}.json`])assert.equal(forbidden(name),true,name);
 for(const name of ['tests/baseline.test.js','tests/baselines/v1.json','schemas/coverage-report.schema.json','docs/data/canonical/quality-report.json','docs/data/coverage/report.json','.github/ISSUE_TEMPLATE/correction.yml','CONTRIBUTING.md'])assert.equal(forbidden(name),false,name);
});
test('Publication check finds nested private documents regardless of Git ignore configuration',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'publication-policy-'));
 try{fs.mkdirSync(path.join(root,'docs','architecture'),{recursive:true});fs.writeFileSync(path.join(root,'docs','architecture','v3-baseline.md'),'Private example');assert.deepEqual(inspect(root),['docs/architecture/v3-baseline.md']);assert.throws(()=>run(root),/Private documents/);fs.unlinkSync(path.join(root,'docs','architecture','v3-baseline.md'));assert.deepEqual(inspect(root),[]);}finally{
  if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('publication-policy-'))throw Error('Unsafe temporary test directory');
  fs.rmSync(root,{recursive:true,force:true});
 }
});
