const {createHash} = require('node:crypto');
const {canonicalStringify, collections, digest, identity, validateCorpus, validateObject} = require('./canonical');
const {validatePublicationEligibility, validateWithdrawal} = require('./editorial-review');

const VERSION = '1.0.0';
const recordFields = {
  events: ['title', 'description', 'start_date', 'end_date', 'event_type', 'spatial_refs', 'territory_refs', 'participant_refs'],
  sources: ['title', 'url', 'classification'],
  claims: ['subject', 'predicate', 'value', 'assertion_status', 'contradicts', 'unit', 'context'],
  entities: ['entity_type', 'label', 'names', 'valid_from', 'valid_to', 'spatial_refs'],
  spatial_assertions: ['subject', 'label', 'geometry', 'crs', 'geometry_role', 'precision_meters', 'geocoding_method', 'reference_version', 'place'],
  relations: ['subject', 'predicate', 'object', 'valid_from', 'valid_to']
};
const types = {events:'event', sources:'source', claims:'claim', entities:'entity',
  spatial_assertions:'spatial-assertion', relations:'relation'};
const profileFields = ['id', 'namespace', 'version', 'display_name', 'default_locale', 'locales'];
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const select = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => canonicalStringify(value) + '\n';
const commitId = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const releaseId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)
  && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(value);
const records = snapshot => Object.values(snapshot.records).flat();
const evidence = items => items.map(({source, locator}) => ({source, locator, quotation:null}));

function publicValue(value, locales) {
  if (value === null || ['string','number','boolean'].includes(typeof value)) return value;
  if (value?.type === 'interval' && Object.keys(value).length === 3
      && Number.isFinite(value.lower) && Number.isFinite(value.upper) && value.lower <= value.upper) return value;
  if (value && !Array.isArray(value) && Object.keys(value).length && Object.entries(value)
    .every(([language,text]) => locales.includes(language) && (text === null || typeof text === 'string'))) return value;
  throw Error('Unsupported public claim value');
}

function publicRecord(record, collection, locales) {
  const clean = {...select(record, ['kind','namespace','id','schema_version']), editorial_status:'published',
    ...select(record, recordFields[collection]), provenance:{evidence:evidence(record.provenance.evidence), transformations:[]}, extensions:{}};
  if (collection !== 'spatial_assertions') clean.review_refs = [];
  if (collection === 'claims') clean.value = publicValue(clean.value, locales);
  if (collection === 'entities') clean.names = clean.names.map(name => ({...name, evidence:evidence(name.evidence)}));
  if (collection === 'sources' && clean.url !== null) {
    const url = new URL(clean.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('Unsafe public source URL');
  }
  return clean;
}

function publicReferences(record) {
  const sourceEvidence = [...record.provenance.evidence, ...(record.names ?? []).flatMap(name => name.evidence)];
  return [...sourceEvidence.map(item => item.source), ...(record.spatial_refs ?? []), ...(record.territory_refs ?? []),
    ...(record.participant_refs ?? []), ...(record.contradicts ?? []), ...[record.subject, record.object, record.place].filter(Boolean)];
}

function exportsFor(snapshot) {
  const spatial = new Map(snapshot.records.spatial_assertions.map(record => [record.id, record]));
  const events = snapshot.records.events;
  const features = events.flatMap(event => {
    const locations = event.spatial_refs.length ? event.spatial_refs.map(ref => spatial.get(ref.id)) : [null];
    return locations.map(site => ({
      type:'Feature', id:site?.id ?? event.id, geometry:site?.geometry ?? null,
      properties:{event_id:event.id, spatial_id:site?.id ?? null, geometry_role:site?.geometry_role ?? 'unknown',
        precision_meters:site?.precision_meters ?? null, start_date:event.start_date, end_date:event.end_date}
    }));
  });
  const cell = value => {
    let text = String(value ?? '');
    if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const rows = [['id','title','start_kind','start_earliest','start_latest','start_precision','start_certainty',
    'end_kind','end_earliest','end_latest','end_precision','end_certainty']];
  const dates = date => [date.kind,date.earliest,date.latest,date.precision,date.certainty];
  for (const event of events) rows.push([event.id, event.title[snapshot.profile.default_locale],
    ...dates(event.start_date), ...dates(event.end_date)]);
  return {'snapshot.json':json(snapshot), 'events.geojson':json({type:'FeatureCollection',features}),
    'events.csv':rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'};
}

function publicCorpus(snapshot) {
  const {profile, records} = snapshot;
  return {schema_version:snapshot.schema_version,
    profile:{...profile,profile_schema_version:'1.0.0',framework:'>=3.0.0 <4.0.0',
      time:{calendar:'gregorian',coverage:{earliest:null,latest:null}},spatial:{crs:'EPSG:4326'},
      taxonomies:['event_types','territorial_units'],rules:[],exports:['json','geojson','csv']},
    taxonomies:{event_types:[...new Set(records.events.flatMap(event => event.event_type))].sort(),
      territorial_units:records.entities.filter(entity => entity.entity_type === 'territory').map(entity => entity.id).sort()},
    ...records,reviews:[],assessments:[],releases:[],extensions:{}};
}

function artifactFiles(snapshot, release) {
  const corpus=publicCorpus(snapshot);
  const validation=validateCorpus(corpus);
  if (!validation.valid) throw Error('Invalid public canonical corpus');
  const counts=Object.fromEntries(Object.entries(snapshot.records).map(([collection,list]) => [collection,list.length]));
  const files={...exportsFor(snapshot),'corpus.json':json(corpus),
    'validation-report.json':json({valid:true,scope:'technical_validation',counts,warnings:validation.warnings,
      exclusions:['Unselected records','Private extensions and original input','Review journal and quotations']}),
    'CITATION.cff':json({'cff-version':'1.2.0',message:'Cite the dataset version and its SHA-256 manifest.',
      type:'dataset',title:snapshot.profile.display_name,authors:[{name:release.citation_author}],
      version:release.release_id,'date-released':release.published_at.slice(0,10)}),
    'RIGHTS.txt':release.rights_notice+'\n'};
  files['SHA256SUMS.txt']=Object.keys(files).sort().map(name => sha(files[name])+'  '+name+'\n').join('');
  return files;
}

function planPublication(request) {
  const {corpus,policy,journal,subjects,asOf,release,expectedHead,previous=null} = request;
  if (release?.id === 'latest' || !releaseId(release?.id) || !commitId(release?.source_commit)
      || typeof release?.citation_author !== 'string' || !release.citation_author.trim() || release.citation_author.length > 200
      || typeof release?.rights_notice !== 'string' || !release.rights_notice.trim()) {
    throw Error('Release requires a safe ID, a source commit, citation author and explicit rights notice');
  }
  if (!hash(expectedHead)) throw Error('Publication requires an independently supplied review journal SHA-256');
  const eligibility = validatePublicationEligibility({corpus,policy,journal,subjects,asOf,expectedHead});
  if (!eligibility.eligible) {
    const error = Error('Publication eligibility failed');
    error.details = eligibility.errors;
    throw error;
  }
  const prior = previous ? verifyPublicationArtifacts(previous) : null;
  const profile = select(corpus.profile, profileFields);
  if (prior && (prior.profile.id !== profile.id || prior.profile.namespace !== profile.namespace
      || previous.manifest.release_id === release.id || Date.parse(asOf) < Date.parse(previous.manifest.published_at))) {
    throw Error('Previous snapshot must belong to the same profile and precede this release');
  }
  const chosen = new Set(eligibility.subjects.map(identity));
  const snapshot = {schema_version:'3.0.0', profile, records:{}, tombstones:prior?.tombstones ?? []};
  for (const collection of Object.keys(recordFields)) {
    snapshot.records[collection] = corpus[collection].filter(record => chosen.has(identity(record)))
      .sort((a,b) => compare(a.id,b.id)).map(record => publicRecord(record,collection,profile.locales));
  }
  const current = new Map(records(snapshot).map(record => [identity(record),record]));
  const old = new Map(prior ? records(prior).map(record => [identity(record),record]) : []);
  const retiredIds = new Set(snapshot.tombstones.map(record => record.id));
  if ([...current.values()].some(record => retiredIds.has(record.id))) throw Error('A withdrawn ID cannot be reused');
  const oldKinds = new Map([...old.values()].map(record => [record.id,record.kind]));
  if ([...current.values()].some(record => oldKinds.has(record.id) && oldKinds.get(record.id) !== record.kind)) {
    throw Error('A published ID cannot change collection');
  }
  const changes = {added:[], modified:[], evidence_changed:[], withdrawn:[],
    profile_changed:prior ? previous.manifest.profile_sha256 !== digest(corpus.profile) : false};
  for (const [key,record] of current) {
    const before = old.get(key);
    if (!before) changes.added.push(record.id);
    else if (digest(before) !== digest(record)) {
      changes.modified.push(record.id);
      if (digest(before.provenance.evidence) !== digest(record.provenance.evidence)) changes.evidence_changed.push(record.id);
    }
  }
  for (const [key,record] of old) {
    if (current.has(key)) continue;
    const subject = select(record,['kind','id','namespace']);
    const decision = validateWithdrawal({corpus,policy,journal,subject,asOf});
    snapshot.tombstones.push({...subject, editorial_status:'withdrawn', withdrawn_at:decision.reviewed_at,
      previous_release_id:previous.manifest.release_id});
    changes.withdrawn.push(record.id);
  }
  snapshot.tombstones.sort((a,b) => compare(a.id,b.id));
  return structuredClone({snapshot, changes, eligibility, release,
    previous_snapshot_sha256:previous?.manifest.snapshot_sha256 ?? null,
    profile_sha256:digest(corpus.profile)});
}

function buildPublicationArtifacts(request) {
  const plan = planPublication(request);
  const {snapshot,changes,eligibility,release} = plan;
  const files = artifactFiles(snapshot,{release_id:release.id,published_at:eligibility.as_of,rights_notice:release.rights_notice,citation_author:release.citation_author});
  const metadata = {
    version:VERSION, release_id:release.id, profile_id:snapshot.profile.id, profile_version:snapshot.profile.version,
    schema_version:snapshot.schema_version, counts:Object.fromEntries(Object.entries(snapshot.records).map(([name,list]) => [name,list.length])),
    profile_sha256:plan.profile_sha256, corpus_sha256:eligibility.corpus_sha256,
    review_policy_sha256:eligibility.policy_sha256, review_head_sha256:eligibility.journal_head,
    source_commit:release.source_commit, published_at:eligibility.as_of, rights_notice:release.rights_notice, citation_author:release.citation_author,
    previous_snapshot_sha256:plan.previous_snapshot_sha256, changes,
    sources:snapshot.records.sources.map(record => record.id),
    limits:['CSV is a summary. JSON preserves typed records and temporal bounds.',
      'GeoJSON uses one feature per spatial assertion, with explicit role and precision.',
      'Private extensions, review history and quotations are omitted.'],
    files:Object.fromEntries(Object.entries(files).map(([name,bytes]) => [name,sha(bytes)]))
  };
  const bundle = {manifest:{...metadata,snapshot_sha256:digest(metadata)},files};
  verifyPublicationArtifacts(bundle);
  return bundle;
}

function verifyPublicationArtifacts(bundle) {
  const {manifest,files} = bundle ?? {};
  const manifestKeys = ['version','release_id','profile_id','profile_version','profile_sha256','corpus_sha256',
    'schema_version','counts','review_policy_sha256','review_head_sha256','source_commit','published_at','rights_notice','citation_author','previous_snapshot_sha256',
    'changes','sources','limits','files','snapshot_sha256'];
  if (!manifest || !files || Object.keys(bundle).sort().join() !== 'files,manifest'
      || Object.keys(manifest).sort().join() !== manifestKeys.sort().join()
      || manifest.version !== VERSION || manifest.release_id === 'latest' || !releaseId(manifest.release_id) || !releaseId(manifest.profile_id)
      || !commitId(manifest.source_commit)
      || !Number.isFinite(Date.parse(manifest.published_at))
      || typeof manifest.citation_author !== 'string' || !manifest.citation_author.trim() || manifest.citation_author.length > 200
      || typeof manifest.rights_notice !== 'string' || !manifest.rights_notice.trim()
      || !['profile_sha256','corpus_sha256','review_policy_sha256','review_head_sha256'].every(key => hash(manifest[key]))
      || (manifest.previous_snapshot_sha256 !== null && !hash(manifest.previous_snapshot_sha256))) {
    throw Error('Invalid publication bundle');
  }
  const {snapshot_sha256,...metadata} = manifest;
  if (!hash(snapshot_sha256) || digest(metadata) !== snapshot_sha256) throw Error('Invalid manifest digest');
  const names = ['CITATION.cff','RIGHTS.txt','SHA256SUMS.txt','corpus.json','events.csv','events.geojson','snapshot.json','validation-report.json'];
  if (Object.keys(files).sort().join() !== names.join() || Object.keys(manifest.files ?? {}).sort().join() !== names.join()) {
    throw Error('Unexpected publication files');
  }
  for (const name of names) if (typeof files[name] !== 'string' || sha(files[name]) !== manifest.files[name]) {
    throw Error('Publication checksum mismatch: ' + name);
  }
  const snapshot = JSON.parse(files['snapshot.json']);
  if (Object.keys(snapshot).sort().join() !== 'profile,records,schema_version,tombstones'
      || snapshot.schema_version !== '3.0.0' || snapshot.schema_version !== manifest.schema_version || snapshot.profile?.id !== manifest.profile_id
      || snapshot.profile.version !== manifest.profile_version || !Array.isArray(snapshot.profile.locales)
      || !snapshot.profile.locales.includes(snapshot.profile.default_locale)
      || !snapshot.profile.locales.every(locale => typeof locale === 'string')
      || Object.keys(snapshot.profile).sort().join() !== [...profileFields].sort().join()
      || Object.keys(snapshot.records ?? {}).sort().join() !== Object.keys(recordFields).sort().join()
      || !Array.isArray(snapshot.tombstones)) throw Error('Invalid snapshot contract');
  const ids = new Set(), references = new Set();
  for (const [collection,list] of Object.entries(snapshot.records)) {
    if (!Array.isArray(list)) throw Error('Invalid snapshot collection');
    for (const record of list) {
      if (ids.has(record.id) || record.kind !== collections[collection] || record.namespace !== snapshot.profile.namespace
          || !validateObject(types[collection],record).valid
          || digest(record) !== digest(publicRecord(record,collection,snapshot.profile.locales))) throw Error('Invalid public record');
      ids.add(record.id);
      references.add(identity(record));
    }
  }
  const sites = new Map(snapshot.records.spatial_assertions.map(site => [site.id,site]));
  const entities = new Map(snapshot.records.entities.map(entity => [entity.id,entity]));
  for (const record of records(snapshot)) {
    if (publicReferences(record).some(ref => !references.has(identity(ref)))) throw Error('Unresolved public reference');
    const evidence = [...record.provenance.evidence, ...(record.names ?? []).flatMap(name => name.evidence)];
    if (evidence.some(item => item.source.kind !== 'source')) throw Error('Invalid public evidence');
    for (const ref of record.spatial_refs ?? []) {
      const site = sites.get(ref.id);
      if (ref.kind !== 'spatial' || !site || identity(site.subject) !== identity(record)) throw Error('Invalid public spatial relation');
    }
    if ((record.territory_refs ?? []).some(ref => ref.kind !== 'entity' || entities.get(ref.id)?.entity_type !== 'territory')
        || (record.participant_refs ?? []).some(ref => ref.kind !== 'entity')) throw Error('Invalid public entity reference');
    if (record.kind === 'spatial' && ((record.geometry === null) !== (record.geometry_role === 'unknown')
        || (record.place && (record.place.kind !== 'entity' || entities.get(record.place.id)?.entity_type !== 'place')))) {
      throw Error('Invalid public spatial assertion');
    }
  }
  for (const tombstone of snapshot.tombstones) {
    const keys = ['editorial_status','id','kind','namespace','previous_release_id','withdrawn_at'];
    if (Object.keys(tombstone).sort().join() !== keys.join() || ids.has(tombstone.id)
        || tombstone.editorial_status !== 'withdrawn' || tombstone.namespace !== snapshot.profile.namespace
        || !Object.values(collections).includes(tombstone.kind) || !releaseId(tombstone.previous_release_id)
        || !Number.isFinite(Date.parse(tombstone.withdrawn_at))) throw Error('Invalid tombstone');
    ids.add(tombstone.id);
  }
  if (digest(manifest.sources) !== digest(snapshot.records.sources.map(record => record.id))
      || digest(manifest.counts) !== digest(Object.fromEntries(Object.entries(snapshot.records).map(([name,list]) => [name,list.length])))
      || digest(artifactFiles(snapshot,manifest)) !== digest(files)) throw Error('Publication exports disagree with snapshot');
  return snapshot;
}

module.exports = {planPublication, buildPublicationArtifacts, verifyPublicationArtifacts, releaseId};
