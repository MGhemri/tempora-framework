const fs=require('node:fs'),path=require('node:path');
const {root,stable}=require('../src/canonical');
const {duplicateReport}=require('../src/duplicates');
function records(c){return [c.a,c.b].map((title,i)=>({id:'TEST_'+i,title:{fr:title,ar:null},editorial_status:'proposed',
  start_date:{earliest:i&&!c.same_date?'1962-01-01':'1956-01-01',latest:i&&!c.same_date?'1962-01-01':'1956-01-01'},
  locations:c.same_site?[{geometry:{type:'Point',coordinates:[3,36]},geometry_role:'exact_site',review_status:'reviewed'}]:[],source_ids:[]}));}
function evaluate(){
  const cases=require('../tests/fixtures/duplicate-pairs.json').map(c=>({...c,predicted:duplicateReport(records(c)).candidates.length>0}));
  const tp=cases.filter(c=>c.label==='positive'&&c.predicted).length,fp=cases.filter(c=>c.label==='negative'&&c.predicted).length,
    fn=cases.filter(c=>c.label==='positive'&&!c.predicted).length;
  return {fixture_scope:'Synthetic engineering examples only; not historical calibration',true_positive:tp,false_positive:fp,false_negative:fn,
    precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,cases};
}
if(require.main===module){const report=evaluate();fs.mkdirSync(path.join(root,'work'),{recursive:true});fs.writeFileSync(path.join(root,'work/duplicate-evaluation.json'),stable(report));console.log(JSON.stringify(report));}
module.exports={evaluate,records};
