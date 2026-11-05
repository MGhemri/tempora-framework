function releaseFixture(){
  const fs=require('node:fs'),path=require('node:path');
  const {readCorpus,root}=require('../../src/canonical'),{artifacts}=require('../../scripts/build-canonical');
  const {makeRelease}=require('../../src/data-releases'),{releaseArtifacts}=require('../../scripts/build-releases');
  const source={...artifacts(readCorpus()),LICENSE:fs.readFileSync(path.join(root,'LICENSE'))};
  const result=makeRelease(source,{id:'data-2026.11.99',source_commit:'a05ed618f30dbb5cae63ba6517b6dc433ac4a3db',published_at:'2026-11-05T00:00:00Z',summary:'TEST : publication technique, sans correction historique.',changes:['Fixture de test uniquement.']});
  return {result,files:releaseArtifacts([result])};
}
module.exports={releaseFixture};
