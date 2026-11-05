const {readCorpus}=require('../../src/canonical');
function withClaims({reviewed=false}={}){
  const corpus=readCorpus();
  corpus.claims.push(...structuredClone(require('../fixtures/claims.json')));
  for(const [index,c]of corpus.claims.entries()){
    corpus.sources.push({source_id:c.evidence[0].source_id,title:`TEST Source contradictoire ${index+1}`,
      url:'https://example.org/test-only',review_status:'needs_review'});
    if(reviewed){c.editorial_status='published';c.review_history.push({reviewer:'TEST_REVIEWER',decision:'approved',
      reference:'https://example.org/test-review',reason:'Exemple synthétique, aucune valeur historique.',reviewed_at:'2026-11-05T00:30:00Z'});}
  }
  return corpus;
}
module.exports={withClaims};
