const {assertCorpus, collections, digest, identity} = require('./canonical');

const {createValidator} = require('./validation');

const VERSION = '1.0.0';
const day = 24 * 60 * 60 * 1000;
const publishable = new Set(['event', 'source', 'claim', 'entity', 'spatial', 'relation']);
const transitions = {
  submitted: [['proposed', 'under_review'], ['unspecified', 'under_review']],
  needs_information: [['under_review', 'proposed']],
  rejected: [['under_review', 'proposed']],
  endorsed: [['under_review', 'under_review']],
  approved: [['under_review', 'published']],
  reopened: [['published', 'under_review'], ['withdrawn', 'under_review']],
  withdrawn: [['published', 'withdrawn']]
};

class ReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const fail = (code, message) => { throw new ReviewError(code, message); };
const text = value => typeof value === 'string' && value.trim().length > 0;
const unique = values => [...new Set(values)];
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    fail('REVIEW_TIME', 'Expected an explicit UTC timestamp');
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 19) !== value.slice(0, 19)) {
    fail('REVIEW_TIME', 'Invalid UTC timestamp');
  }
  return time;
}

function reviewPolicy(profile, options) {
  if (!options || !Array.isArray(options.reviewers) || !options.reviewers.length
      || options.reviewers.some(reviewer => !text(reviewer) || reviewer.length > 120)
      || unique(options.reviewers).length !== options.reviewers.length
      || !Number.isSafeInteger(options.minimum_approvals) || options.minimum_approvals < 1
      || options.minimum_approvals > options.reviewers.length
      || !Number.isSafeInteger(options.review_max_age_days) || options.review_max_age_days < 1
      || options.review_max_age_days > 365
      || !['allow', 'deny'].includes(options.contested)) {
    fail('GOVERNANCE_DECISION_REQUIRED', 'Supply reviewer IDs, quorum, approval validity and contested-claim policy');
  }
  return {
    version: VERSION, profile_sha256: digest(profile), reviewers: [...options.reviewers].sort(),
    minimum_approvals: options.minimum_approvals, review_max_age_days: options.review_max_age_days,
    contested: options.contested
  };
}

function contentDigest(record) {
  const {editorial_status, ...content} = record;
  return digest(content);
}

function indexCorpus(corpus) {
  return new Map(Object.keys(collections).flatMap(key => corpus[key].map(record => [identity(record), record])));
}

function subjectKey(subject) {
  if (!subject || Object.keys(subject).length !== 3
      || !text(subject.id) || !text(subject.namespace) || !text(subject.kind)) {
    fail('REVIEW_SUBJECT', 'Expected a typed reference containing kind, namespace and ID');
  }
  return identity(subject);
}

function checkReference(value) {
  if (!text(value)) fail('REVIEW_REFERENCE', 'A documentary HTTP(S) reference is required');
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return;
  } catch {}
  fail('REVIEW_REFERENCE', 'A documentary HTTP(S) reference is required');
}

function validateEntry(entry, record, state, policy) {
  const allowed = Object.hasOwn(transitions, entry.decision) && transitions[entry.decision]
    .some(([from, to]) => from === entry.from && to === entry.to);
  if (!record || !publishable.has(record.kind) || state !== entry.from || !allowed) {
    fail('REVIEW_TRANSITION', 'Invalid editorial transition for this subject');
  }
  if (!policy.reviewers.includes(entry.reviewer) || !text(entry.reason) || entry.reason.length > 2000
      || !isHash(entry.content_sha256) || !Array.isArray(entry.evidence_ids)
      || entry.evidence_ids.some(id => !text(id)) || unique(entry.evidence_ids).length !== entry.evidence_ids.length
      || entry.basis?.kind !== 'documentary_review') {
    fail('REVIEW_DECISION', 'Decision needs a policy reviewer, reason, evidence list and content digest');
  }
  checkReference(entry.reference);
  if (['endorsed', 'approved'].includes(entry.decision)
      && (entry.basis.rights !== 'cleared' || entry.basis.sensitivity !== 'cleared')) {
    fail('GOVERNANCE_DECISION_REQUIRED', 'Redistribution and sensitivity must be explicitly cleared');
  }
  timestamp(entry.reviewed_at);
}

function replay(index, journal, policy) {
  if (!Array.isArray(journal)) fail('REVIEW_JOURNAL', 'Expected an ordered review journal');
  const states = new Map();
  const policyDigest = digest(policy);
  let head = null;
  let lastTime = -Infinity;
  for (const entry of journal) {
    const {entry_sha256, ...body} = entry;
    if (entry.previous_sha256 !== head || entry.policy_sha256 !== policyDigest || entry_sha256 !== digest(body)) {
      fail('REVIEW_JOURNAL', 'Review chain or policy digest does not match');
    }
    const key = subjectKey(entry.subject);
    const record = index.get(key);
    const current = states.get(key) ?? {state: record?.editorial_status, approvals: new Map()};
    validateEntry(entry, record, current.state, policy);
    const time = timestamp(entry.reviewed_at);
    if (time < lastTime) fail('REVIEW_JOURNAL', 'Decisions must be appended in chronological order');
    if (['approved', 'endorsed'].includes(entry.decision)) current.approvals.set(entry.reviewer, entry);
    else current.approvals.clear();
    current.state = entry.to;
    current.latest = entry;
    states.set(key, current);
    head = entry_sha256;
    lastTime = time;
  }
  return {states, head, lastTime};
}

function assertJournalHead(head, expectedHead) {
  if (!isHash(expectedHead) || head !== expectedHead) {
    fail('REVIEW_ANCHOR_MISMATCH', 'Journal head does not match the independently supplied SHA-256');
  }
}

function verifyReviewJournal({corpus, policy, journal, expectedHead}) {
  assertCorpus(corpus);
  assertPolicy(corpus.profile, policy);
  const {head} = replay(indexCorpus(corpus), journal, policy);
  assertJournalHead(head, expectedHead);
  return {journal_head: head, policy_sha256: digest(policy), entries: journal.length};
}

function assertPolicy(profile, policy) {
  const expected = reviewPolicy(profile, policy);
  if (digest(expected) !== digest(policy)) fail('REVIEW_POLICY', 'Policy must match the exact profile and version');
}

function documentaryEvidence(record, entry) {
  if (record.kind === 'source') {
    return Object.values(record.title).some(text) && entry.evidence_ids.length === 1 && entry.evidence_ids[0] === record.id;
  }
  const evidence = record.provenance.evidence;
  return entry.evidence_ids.every(id => evidence.some(item => item.source.id === id))
    && evidence.some(item => text(item.locator) && entry.evidence_ids.includes(item.source.id));
}

function recordDecision({corpus, policy, journal = [], decision}) {
  assertCorpus(corpus);
  assertPolicy(corpus.profile, policy);
  const index = indexCorpus(corpus);
  const {states, head, lastTime} = replay(index, journal, policy);
  const key = subjectKey(decision.subject);
  const record = index.get(key);
  const state = states.get(key)?.state ?? record?.editorial_status;
  validateEntry(decision, record, state, policy);
  if (timestamp(decision.reviewed_at) < lastTime) fail('REVIEW_JOURNAL', 'Decision precedes the last journal entry');
  if (decision.content_sha256 !== contentDigest(record)) fail('REVIEW_CONTENT_CHANGED', 'Decision does not match the exact subject content');
  if (['approved', 'endorsed'].includes(decision.decision) && !documentaryEvidence(record, decision)) {
    fail('REVIEW_EVIDENCE', 'Approval needs evidence linked to this subject and a precise locator for derived records');
  }
  if (decision.decision === 'approved') {
    const votes = new Map(states.get(key)?.approvals);
    votes.set(decision.reviewer, decision);
    const approvalTime = timestamp(decision.reviewed_at);
    const valid = [...votes.values()].filter(vote => vote.content_sha256 === decision.content_sha256
      && documentaryEvidence(record, vote)
      && approvalTime - timestamp(vote.reviewed_at) <= policy.review_max_age_days * day);
    if (valid.length < policy.minimum_approvals) fail('PUBLICATION_QUORUM', 'Approval quorum is incomplete');
  }
  const {subject, from, to, decision: action, reviewer, reason, reviewed_at, basis, content_sha256, reference, evidence_ids} = decision;
  const entry = {subject, from, to, decision: action, reviewer, reason, reviewed_at, basis, content_sha256,
    reference, evidence_ids, policy_sha256: digest(policy), previous_sha256: head};
  return structuredClone([...journal, {...entry, entry_sha256: digest(entry)}]);
}

function dependencies(record) {
  const evidence = [...record.provenance.evidence, ...(record.names ?? []).flatMap(name => name.evidence)];
  return [
    ...evidence.map(item => item.source),
    ...(record.spatial_refs ?? []), ...(record.territory_refs ?? []), ...(record.participant_refs ?? []),
    ...(record.contradicts ?? []), ...[record.subject, record.object, record.place].filter(Boolean)
  ];
}

function validatePublicationEligibility({corpus, policy, journal = [], subjects, asOf, expectedHead}) {
  assertCorpus(corpus);
  assertPolicy(corpus.profile, policy);
  const time = timestamp(asOf);
  const index = indexCorpus(corpus);
  const {states, head, lastTime} = replay(index, journal, policy);
  if (expectedHead !== undefined) assertJournalHead(head, expectedHead);
  if (lastTime > time) fail('REVIEW_TIME', 'Journal contains a decision after the eligibility date');
  if (!Array.isArray(subjects) || !subjects.length) fail('PUBLICATION_SELECTION', 'Select publication subjects explicitly');

  const rules = createValidator(corpus.profile, {taxonomies: corpus.taxonomies});
  const errors = [];
  const selected = new Map();
  const pending = [...subjects];
  while (pending.length) {
    const subject = pending.pop();
    const key = subjectKey(subject);
    if (selected.has(key)) continue;
    const record = index.get(key);
    selected.set(key, subject);
    if (!record || !publishable.has(record.kind)) {
      errors.push({subject, code: 'PUBLICATION_REFERENCE'});
      continue;
    }
    const state = states.get(key);
    if (state?.state !== 'published' || state.latest.decision !== 'approved') {
      errors.push({subject, code: 'PUBLICATION_REVIEW_REQUIRED'});
    } else {
      const sha = contentDigest(record);
      const fresh = entry => time - timestamp(entry.reviewed_at) <= policy.review_max_age_days * day;
      const valid = entry => entry.content_sha256 === sha && fresh(entry) && documentaryEvidence(record, entry);
      if (!valid(state.latest)) errors.push({subject, code: 'PUBLICATION_REVIEW_STALE'});
      if ([...state.approvals.values()].filter(valid).length < policy.minimum_approvals) {
        errors.push({subject, code: 'PUBLICATION_QUORUM'});
      }
    }
    if (record.kind === 'claim' && (record.assertion_status === 'withdrawn'
        || (record.assertion_status === 'contested' && policy.contested !== 'allow'))) {
      errors.push({subject, code: 'PUBLICATION_CLAIM_POLICY'});
    }
    if (record.kind === 'event') {
      const validation = rules.validate({...record, territory_ids: record.territory_refs.map(ref => ref.id)});
      if (validation.diagnostics.some(diagnostic => ['VOCABULARY_UNKNOWN', 'DATE_OUTSIDE_PROFILE', 'DATE_INTERVAL_INVALID'].includes(diagnostic.code))) {
        errors.push({subject, code: 'PUBLICATION_PROFILE_RULE'});
      }
    }
    pending.push(...dependencies(record));
  }
  return {eligible: errors.length === 0, errors, subjects: structuredClone([...selected.values()]),
    corpus_sha256: digest(corpus), policy_sha256: digest(policy), journal_head: head, as_of: asOf};
}

module.exports = {reviewPolicy, contentDigest, recordDecision, verifyReviewJournal, validatePublicationEligibility};
