const {readCorpus}=require('../../src/canonical');
function entity(kind='place',suffix='A'){
  const id={place:'PLC_',person:'PER_',organization:'ORG_'}[kind]+'TEST_'+suffix;
  return {id,kind,label:{fr:'Nom de test '+suffix,ar:null},names:[{value:'Nom de test '+suffix,language:'fr',script:'Latn',role:'preferred',
    valid_from:null,valid_to:null,source_ids:['SRC_aaaaaaaaaaaaaaaaaaaaaaaa']}],source_ids:['SRC_aaaaaaaaaaaaaaaaaaaaaaaa'],
    editorial_status:'proposed',review_history:[],relations:[],created_at:'2026-11-05T00:00:00Z',updated_at:'2026-11-05T01:00:00Z'};
}
function approve(e){e.editorial_status='published';e.review_history.push({reviewer:'TEST_REVIEWER',decision:'approved',reference:'https://example.org/review',reason:'Synthetic only.',reviewed_at:'2026-11-05T00:30:00Z'});return e;}
function withEntities(){const corpus=readCorpus();corpus.sources.push({source_id:'SRC_aaaaaaaaaaaaaaaaaaaaaaaa',title:'TEST evidence',review_status:'needs_review'});return corpus;}
module.exports={entity,approve,withEntities};
