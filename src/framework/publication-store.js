const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {digest} = require('./canonical');
const {reviewPolicy, validatePublicationEligibility} = require('./editorial-review');
const {buildPublicationArtifacts, verifyPublicationArtifacts, releaseId} = require('./publication');

function safeDirectory(directory, create = false) {
  if (create) fs.mkdirSync(directory,{recursive:true});
  if (path.relative(directory,fs.realpathSync(directory))) throw Error('Publication directories must not be redirected');
  return directory;
}

function read(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > 128 * 1024 * 1024) throw Error('Invalid publication file');
  return JSON.parse(fs.readFileSync(file,'utf8'));
}

function verifyPublicationDirectory(directory) {
  const folder = safeDirectory(path.resolve(directory));
  const manifest = read(path.join(folder,'manifest.json'));
  const names = Object.keys(manifest.files ?? {});
  if (names.some(name => !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(name))
      || fs.readdirSync(folder).sort().join() !== [...names,'manifest.json'].sort().join()) {
    throw Error('Unexpected publication directory entries');
  }
  const files = {};
  const decoder = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
  let bytes = 0;
  for (const name of names) {
    const file = path.join(folder,name), stat = fs.lstatSync(file);
    bytes += stat.size;
    if (!stat.isFile() || bytes > 128 * 1024 * 1024) throw Error('Invalid publication artifact');
    files[name] = decoder.decode(fs.readFileSync(file));
  }
  const bundle = {manifest,files};
  verifyPublicationArtifacts(bundle);
  return bundle;
}

function atomicWrite(file, value, replace) {
  const temporary = path.join(path.dirname(file),'.pending-' + randomUUID());
  try {
    const bytes = Buffer.from(JSON.stringify(value) + '\n');
    if (bytes.length > 128 * 1024 * 1024) throw Error('Publication file exceeds local store size limit');
    fs.writeFileSync(temporary,bytes,{flag:'wx'});
    if (replace) fs.renameSync(temporary,file);
    else fs.linkSync(temporary,file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function requireOperator(profile, policy, operator) {
  if (digest(reviewPolicy(profile,policy)) !== digest(policy)
      || !policy.reviewers.includes(operator?.reviewer)
      || typeof operator.reason !== 'string' || !operator.reason.trim() || operator.reason.length > 2000
      || typeof operator.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(operator.at)
      || !Number.isFinite(Date.parse(operator.at))
      || new Date(operator.at).toISOString().slice(0,19) !== operator.at.slice(0,19)) {
    throw Error('An authorized operator, explicit UTC timestamp and reason are required');
  }
}

function createPublicationStore(root,{replacePointer=atomicWrite}={}) {
  root = path.resolve(root);
  function directory(profile,create=false) {
    if (!releaseId(profile)) throw Error('Unsafe profile ID');
    safeDirectory(root,create);
    return safeDirectory(path.join(root,profile),create);
  }
  function bundleAt(dir,release) {
    if (!releaseId(release)) throw Error('Unsafe release ID');
    const bundle = read(path.join(dir,release+'.bundle.json'));
    verifyPublicationArtifacts(bundle);
    if (bundle.manifest.release_id !== release || bundle.manifest.profile_id !== path.basename(dir)) {
      throw Error('Snapshot location and identity disagree');
    }
    return bundle;
  }
  function active(dir) {
    const file = path.join(dir,'current.json');
    if (!fs.existsSync(file)) return null;
    const pointer = read(file);
    const bundle = bundleAt(dir,pointer.release_id);
    if (pointer.snapshot_sha256 !== bundle.manifest.snapshot_sha256) throw Error('Active pointer digest mismatch');
    return {pointer,bundle};
  }
  function locked(dir, action) {
    const lock = path.join(dir,'.promotion-lock');
    let fd;
    try { fd = fs.openSync(lock,'wx'); }
    catch (error) {
      // Never break or unlink a lock based on age or process ID. Both are
      // insufficient ownership evidence and can race with a live publisher.
      if (error.code === 'EEXIST') {
        const conflict = Error('Publication store is locked; verify the owner before explicit recovery');
        conflict.code = 'STORE_LOCKED';
        throw conflict;
      }
      throw error;
    }
    try { return action(); }
    finally {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    }
  }
  function activate(dir,bundle,current,operator,action) {
    const pointer = {release_id:bundle.manifest.release_id,snapshot_sha256:bundle.manifest.snapshot_sha256,
      history:[...(current?.pointer.history ?? []),{action,previous:current?.pointer.snapshot_sha256 ?? null,
        selected:bundle.manifest.snapshot_sha256,release_id:bundle.manifest.release_id,reviewer:operator.reviewer,reason:operator.reason,at:operator.at}]};
    replacePointer(path.join(dir,'current.json'),pointer,true);
    return pointer;
  }
  return {
    stage(bundle) {
      const snapshot = verifyPublicationArtifacts(bundle);
      const dir = directory(snapshot.profile.id,true);
      const file = path.join(dir,bundle.manifest.release_id+'.bundle.json');
      try { atomicWrite(file,bundle,false); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (digest(bundleAt(dir,bundle.manifest.release_id)) !== digest(bundle)) throw Error('Immutable release ID already exists');
      }
      return bundle.manifest.snapshot_sha256;
    },
    export(bundle) {
      const snapshot = verifyPublicationArtifacts(bundle);
      const dir = directory(snapshot.profile.id,true);
      const destination = path.join(dir,bundle.manifest.release_id+'.files');
      return locked(dir,() => {
        if (fs.existsSync(destination)) {
          if (digest(verifyPublicationDirectory(destination)) !== digest(bundle)) throw Error('Immutable export already exists');
          return destination;
        }
        const temporary = fs.mkdtempSync(path.join(dir,'.export-'));
        try {
          for (const [name,bytes] of Object.entries(bundle.files)) fs.writeFileSync(path.join(temporary,name),bytes,{flag:'wx'});
          fs.writeFileSync(path.join(temporary,'manifest.json'),JSON.stringify(bundle.manifest)+'\n',{flag:'wx'});
          verifyPublicationDirectory(temporary);
          fs.renameSync(temporary,destination);
        } finally {
          fs.rmSync(temporary,{recursive:true,force:true});
        }
        return destination;
      });
    },
    readCurrent(profile) {
      if (!releaseId(profile)) throw Error('Unsafe profile ID');
      if (!fs.existsSync(path.join(root,profile))) return null;
      return active(directory(profile))?.bundle ?? null;
    },
    readPublished(profile) {
      if (!releaseId(profile)) throw Error('Unsafe profile ID');
      if (!fs.existsSync(path.join(root,profile))) return null;
      const dir = directory(profile);
      const current = active(dir);
      if (!current) return null;
      const promoted = new Map(current.pointer.history.filter(entry => entry.action === 'promote')
        .map(entry => [entry.release_id,entry.selected]));
      if (promoted.get(current.pointer.release_id) !== current.pointer.snapshot_sha256 || promoted.size > 100) {
        throw Error('Invalid promoted snapshot catalog');
      }
      const releases = [];
      let bytes = 0;
      for (const [id,sha] of promoted) {
        if (!releaseId(id)) throw Error('Invalid promoted release ID');
        bytes += fs.lstatSync(path.join(dir,id+'.bundle.json')).size;
        if (bytes > 32 * 1024 * 1024) throw Error('Published catalog exceeds local limits');
        const bundle = bundleAt(dir,id);
        if (bundle.manifest.snapshot_sha256 !== sha) throw Error('Promoted snapshot digest mismatch');
        releases.push(bundle);
      }
      return {latest:current.pointer.release_id,releases};
    },
    promote(request,{snapshot_sha256,operator}) {
      const expected = buildPublicationArtifacts(request);
      if (snapshot_sha256 !== expected.manifest.snapshot_sha256) throw Error('Promotion must name the reviewed snapshot digest');
      requireOperator(request.corpus.profile,request.policy,operator);
      if (Date.parse(operator.at) < Date.parse(request.asOf)) throw Error('Promotion precedes the publication date');
      const gate = validatePublicationEligibility({...request,asOf:operator.at});
      if (!gate.eligible) throw Error('Publication eligibility expired or changed before promotion');
      const withdrawals = new Set(expected.manifest.changes.withdrawn);
      const reviewedWithdrawal = request.journal.some(entry =>
        entry.decision === 'withdrawn' && withdrawals.has(entry.subject.id) && entry.reviewer === operator.reviewer);
      if (gate.approval_reviewers.includes(operator.reviewer) || reviewedWithdrawal) {
        throw Error('Promotion requires an independent operator');
      }
      const dir = directory(expected.manifest.profile_id);
      return locked(dir,() => {
        const bundle = bundleAt(dir,expected.manifest.release_id);
        if (digest(bundle) !== digest(expected)) throw Error('Staged bytes differ from the reviewed snapshot');
        const current = active(dir);
        if (current?.pointer.snapshot_sha256 === snapshot_sha256) return current.pointer;
        if ((current?.pointer.snapshot_sha256 ?? null) !== expected.manifest.previous_snapshot_sha256) {
          throw Error('Active snapshot changed; prepare a new publication plan');
        }
        if (current && Date.parse(operator.at) < Date.parse(current.pointer.history.at(-1).at)) {
          throw Error('Promotion precedes current activation');
        }
        return activate(dir,bundle,current,operator,'promote');
      });
    },
    rollback({profile,policy,expected_sha256,target_release_id,operator}) {
      requireOperator(profile,policy,operator);
      const dir = directory(profile.id);
      return locked(dir,() => {
        const current = active(dir);
        if (!current || current.pointer.snapshot_sha256 !== expected_sha256
            || current.bundle.manifest.profile_sha256 !== digest(profile)
            || current.bundle.manifest.review_policy_sha256 !== digest(policy)) throw Error('Active snapshot, profile or policy changed');
        const target = bundleAt(dir,target_release_id);
        if (current.bundle.manifest.previous_snapshot_sha256 !== target.manifest.snapshot_sha256
            || !current.pointer.history.some(entry => entry.action === 'promote' && entry.selected === target.manifest.snapshot_sha256)) {
          throw Error('Rollback target must be the preceding promoted snapshot');
        }
        if (Date.parse(operator.at) < Date.parse(current.pointer.history.at(-1).at)) throw Error('Rollback precedes current activation');
        return activate(dir,target,current,operator,'rollback');
      });
    }
  };
}

module.exports = {createPublicationStore,verifyPublicationDirectory};
