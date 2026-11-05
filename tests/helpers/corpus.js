const {readCorpus}=require('../../src/canonical');
function withProposal(){
  const corpus=readCorpus();
  const operation=structuredClone(require('../fixtures/canonical-proposal.json'));
  corpus.operations.push(operation);
  corpus.sources.push({source_id:operation.source_ids[0],title:'Source synthétique de test',
    author:'TEST FIXTURE',url:'https://example.org/synthetic-test-only',review_status:'reviewed'});
  return {corpus,operation};
}
function approve(operation){
  operation.editorial_status='published';operation.provenance.human_review_recorded=true;
  operation.review_history.push({reviewer:'TEST_SYNTHETIC_REVIEWER',decision:'approved',
    reference:'https://example.org/synthetic-review-only',reason:'Fixture de test non historique.',reviewed_at:'2026-11-05T00:00:00Z'});
}
module.exports={withProposal,approve};
