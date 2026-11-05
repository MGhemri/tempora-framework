const {nativeCorpus} = require('./tempora');
const {reviewPolicy,contentDigest,recordDecision} = require('../../src/framework/editorial-review');

const date = '2026-11-05T12:00:00Z';
const later = '2026-11-06T12:00:00Z';
const operator = {reviewer:'publisher',reason:'Verified fictional publication',at:later};
const ref = ({id,kind,namespace}) => ({id,kind,namespace});

function fixture({contested = 'deny', corpus = nativeCorpus()} = {}) {
  const event = corpus.events[0],source = corpus.sources[0];
  event.title.en = '=1+2';
  event.extensions.synthetic.private = 'PRIVATE_EXTENSION';
  event.provenance.evidence[0].quotation = 'PRIVATE_QUOTATION';
  const policy = reviewPolicy(corpus.profile,{reviewers:['reviewer','publisher'],
    minimum_approvals:1,review_max_age_days:30,contested});
  const request = {corpus,policy,journal:[],subjects:[ref(event)],asOf:date,
    release:{id:'fictional-1',source_commit:'a'.repeat(40),rights_notice:'Fictional data for tests',citation_author:'Fictional corpus team'}};
  function append(record,decision,from,to,reviewed_at=date) {
    request.journal = recordDecision({...request,decision:{
      subject:ref(record),decision,from,to,reviewer:'reviewer',reason:'PRIVATE_REASON',reviewed_at,
      basis:{kind:'documentary_review',rights:'cleared',sensitivity:'cleared'},
      content_sha256:contentDigest(record),reference:'https://example.org/private-review',
      evidence_ids:[source.id]
    }});
    request.expectedHead = request.journal.at(-1).entry_sha256;
  }
  for (const record of [event,source]) {
    append(record,'submitted','proposed','under_review');
    append(record,'approved','under_review','published');
  }
  return {request,event,source,append};
}

module.exports = {fixture,date,later,operator,ref};
