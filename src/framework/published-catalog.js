const {verifyPublicationArtifacts, releaseId} = require('./publication');

function createPublishedCatalog(entries = []) {
  if (!Array.isArray(entries) || entries.length > 20) throw Error('Invalid published profile catalog');
  const profiles = new Map();
  let bytes = 0;
  for (const {latest,releases} of entries) {
    if (!Array.isArray(releases) || !releases.length || releases.length > 100) throw Error('Invalid release catalog');
    const versions = new Map();
    let id, namespace;
    for (const bundle of releases) {
      bytes += Object.values(bundle.files ?? {}).reduce((sum,content)=>sum+(typeof content==='string'?Buffer.byteLength(content):0),0);
      if (bytes > 32*1024*1024) throw Error('Published catalog exceeds memory limit');
      const snapshot = verifyPublicationArtifacts(bundle);
      id ??= snapshot.profile.id;
      namespace ??= snapshot.profile.namespace;
      if (snapshot.profile.id !== id || snapshot.profile.namespace !== namespace || versions.has(bundle.manifest.release_id)) {
        throw Error('Mixed namespaces or duplicate releases in published catalog');
      }
      versions.set(bundle.manifest.release_id,{manifest:structuredClone(bundle.manifest),snapshot});
    }
    if (!releaseId(latest) || !versions.has(latest) || profiles.has(id)) throw Error('Invalid catalog activation');
    profiles.set(id,{latest,versions});
  }
  return {
    list:()=>[...profiles.keys()].sort().map(id=>({id,latest:profiles.get(id).latest})),
    releases:id=>[...(profiles.get(id)?.versions.values() ?? [])]
      .map(entry=>structuredClone(entry.manifest)).sort((a,b)=>a.release_id < b.release_id ? -1 : 1),
    resolve(id,release='latest') {
      const profile = profiles.get(id);
      const entry = profile?.versions.get(release==='latest'?profile.latest:release);
      return entry ? structuredClone(entry) : null;
    }
  };
}

module.exports = {createPublishedCatalog};
