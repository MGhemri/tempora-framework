const {test} = require('node:test');
const assert = require('node:assert/strict');
const {nativeCorpus} = require('./helpers/tempora');
const {reviewPolicy, contentDigest, recordDecision, verifyReviewJournal, validatePublicationEligibility} = require('../src/framework/editorial-review');

const date = '2026-11-05T12:00:00Z';
const ref = ({kind, id, namespace}) => ({kind, id, namespace});
const code = expected => error => error.code === expected;

function setup(corpus = nativeCorpus(), options = {}) {
  const policy = reviewPolicy(corpus.profile, {
    reviewers: ['review-a', 'review-b'], minimum_approvals: 1, review_max_age_days: 30,
    contested: 'deny', ...options
  });
  let journal = [];
  function append(record, decision, from, to, overrides = {}) {
    journal = recordDecision({corpus, policy, journal, decision: {
      subject: ref(record), decision, from, to, reviewer: 'review-a',
      reason: 'Synthetic review fixture', reviewed_at: date,
      basis: {kind: 'documentary_review', rights: 'cleared', sensitivity: 'cleared'},
      content_sha256: contentDigest(record), reference: 'https://example.org/test-review',
      evidence_ids: record.kind === 'source' ? [record.id] : record.provenance.evidence.map(item => item.source.id),
      ...overrides
    }});
    return journal;
  }
  function approve(record) {
    append(record, 'submitted', record.editorial_status, 'under_review');
    append(record, 'approved', 'under_review', 'published');
  }
  function validate(record, overrides = {}) {
    return validatePublicationEligibility({corpus, policy, journal, subjects: [ref(record)], asOf: date, ...overrides});
  }
  return {corpus, policy, append, approve, validate};
}

test('Publication requires an exact review for the selected record and each documentary dependency', () => {
  const {corpus, approve, validate} = setup();
  const [event] = corpus.events;
  const before = structuredClone(corpus);
  assert.equal(validate(event).eligible, false);
  approve(event);
  assert.deepEqual(validate(event).errors.map(error => error.subject.id), ['DOCUMENT_1']);
  approve(corpus.sources[0]);
  assert.equal(validate(event).eligible, true);
  assert.deepEqual(corpus, before);
  event.title.en += ' changed';
  assert.ok(validate(event).errors.some(error => error.code === 'PUBLICATION_REVIEW_STALE'));
});

test('Journal rejects fabricated evidence, future decisions, altered entries and unsafe references', () => {
  const {corpus, append, validate} = setup();
  const [event] = corpus.events;
  assert.throws(() => append(event, 'approved', 'proposed', 'published'), code('REVIEW_TRANSITION'));
  append(event, 'submitted', 'proposed', 'under_review');
  assert.throws(() => append(event, 'approved', 'under_review', 'published', {reviewer: 'outsider'}), code('REVIEW_DECISION'));
  assert.throws(() => append(event, 'approved', 'under_review', 'published', {evidence_ids: ['invented']}), code('REVIEW_EVIDENCE'));
  assert.throws(() => append(event, 'approved', 'under_review', 'published', {reference: 'file:///private'}), code('REVIEW_REFERENCE'));
  assert.throws(() => append(event, 'approved', 'under_review', 'published', {content_sha256: '0'.repeat(64)}), code('REVIEW_CONTENT_CHANGED'));
  assert.throws(() => append(event, 'approved', 'under_review', 'published', {basis: {kind: 'documentary_review', rights: 'restricted', sensitivity: 'cleared'}}), code('GOVERNANCE_DECISION_REQUIRED'));
  const journal = append(event, 'approved', 'under_review', 'published');
  assert.throws(() => validate(event, {asOf: '2026-11-04T12:00:00Z'}), code('REVIEW_TIME'));
  const altered = structuredClone(journal);
  altered[0].reason = 'altered';
  assert.throws(() => validate(event, {journal: altered}), code('REVIEW_JOURNAL'));
  assert.ok(validate(event, {asOf: '2027-01-01T12:00:00Z'}).errors.some(error => error.code === 'PUBLICATION_REVIEW_STALE'));
});

test('Quorum counts distinct reviewers and a new withdrawal remains append-only', () => {
  const {corpus, append, validate} = setup(nativeCorpus(), {minimum_approvals: 2});
  const [source] = corpus.sources;
  append(source, 'submitted', 'proposed', 'under_review');
  append(source, 'endorsed', 'under_review', 'under_review');
  assert.throws(() => append(source, 'approved', 'under_review', 'published'), code('PUBLICATION_QUORUM'));
  const approved = append(source, 'approved', 'under_review', 'published', {reviewer: 'review-b'});
  assert.equal(validate(source).eligible, true);
  const withdrawn = append(source, 'withdrawn', 'published', 'withdrawn');
  assert.deepEqual(withdrawn.slice(0, -1), approved);
  assert.equal(validate(source).eligible, false);
});

test('A technically valid 264th event cannot pass the publication gate on its published label', () => {
  const corpus = nativeCorpus();
  corpus.sources[0].editorial_status = 'published';
  const first = structuredClone(corpus.events[0]);
  corpus.events = Array.from({length:263},(_,i)=>({...structuredClone(first),id:i===0?first.id:'SYN_'+i}));
  const additional = {...structuredClone(corpus.events[0]), id: 'PROPOSED_TEST_264', editorial_status: 'published', spatial_refs: [], review_refs: []};
  corpus.events.push(additional);
  const {validate} = setup(corpus);
  assert.equal(corpus.events.length, 264);
  assert.ok(validate(additional).errors.some(error => error.subject.id === additional.id && error.code === 'PUBLICATION_REVIEW_REQUIRED'));
  assert.equal(validate(corpus.events[0]).eligible, false);
});


test('An independent journal head rejects a valid prefix and a rewritten chain', () => {
  const {corpus, policy, append, validate} = setup();
  const [source] = corpus.sources;
  const submitted = append(source, 'submitted', 'proposed', 'under_review');
  const journal = append(source, 'approved', 'under_review', 'published');
  const expectedHead = journal.at(-1).entry_sha256;
  const verify = (entries, head = expectedHead) => verifyReviewJournal({corpus, policy, journal: entries, expectedHead: head});
  assert.equal(verify(journal).entries, 2);
  assert.equal(validate(source, {expectedHead}).eligible, true);
  assert.throws(() => verify(submitted), code('REVIEW_ANCHOR_MISMATCH'));
  assert.throws(() => validate(source, {journal: submitted, expectedHead}), code('REVIEW_ANCHOR_MISMATCH'));
  const altered = structuredClone(journal);
  altered[1].reason = 'Rewritten with valid internal hashes';
  const {entry_sha256, ...body} = altered[1];
  altered[1].entry_sha256 = require('../src/framework/canonical').digest(body);
  assert.equal(verify(altered, altered[1].entry_sha256).entries, 2);
  assert.throws(() => verify(altered), code('REVIEW_ANCHOR_MISMATCH'));
});

test('Missing locators, changed policy and contested assertions block eligibility', () => {
  const fixture = nativeCorpus();
  const claim = fixture.claims[0];
  claim.assertion_status = 'contested';
  const {append, approve, validate, policy} = setup(fixture);
  const event = fixture.events[0];
  event.provenance.evidence[0].locator = null;
  append(event, 'submitted', 'proposed', 'under_review');
  assert.throws(() => append(event, 'approved', 'under_review', 'published'), code('REVIEW_EVIDENCE'));
  approve(fixture.sources[0]);
  approve(claim);
  assert.ok(validate(claim).errors.some(error => error.code === 'PUBLICATION_CLAIM_POLICY'));
  assert.throws(() => validate(claim, {policy: {...policy, contested: 'allow'}}), code('REVIEW_JOURNAL'));
});
