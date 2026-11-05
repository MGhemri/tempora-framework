const {analyze}=require('../src/framework/analysis');
const {evaluate}=require('../src/framework/analysis-evaluation');
const {referenceCorpus}=require('../tests/helpers/analysis-reference');
const cases=require('../tests/fixtures/analysis-reference.json');

function run(){
  const report=analyze(referenceCorpus(),{scope:'working'});
  return evaluate(report,{
    version:'1.0.0',scope:'synthetic',corpus_sha256:report.corpus_sha256,
    protocol:'Fixed fictional scenarios outside the ALNOP corpus. Labels follow the scenario descriptions. Default thresholds are held fixed.',
    cases
  });
}

if(require.main===module)console.log(JSON.stringify(run(),null,2));
module.exports={run};
