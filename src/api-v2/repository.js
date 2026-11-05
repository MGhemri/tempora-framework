const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const files={operations:'operations.json',sources:'sources.json',places:'places.json',persons:'persons.json',organizations:'organizations.json',claims:'claims.json',territories:'territorial-units.json'};
// The HTTP service depends on this read interface, not on Git or a writable database.
class FileRepository {
  constructor(directory=path.join(process.cwd(),'docs/data/canonical'),releaseIndex=path.join(path.dirname(directory),'releases/index.json')){this.directory=directory;this.releaseIndex=releaseIndex;this.snapshot=null;}
  load(){
    if(this.snapshot)return this.snapshot;
    const read=name=>fs.readFileSync(path.join(this.directory,name));
    const manifest=JSON.parse(read('dataset-manifest.json'));
    const snapshot={manifest};
    for(const [resource,name]of Object.entries(files)){
      const bytes=read(name);
      if(crypto.createHash('sha256').update(bytes).digest('hex')!==manifest.checksums[name])throw Error('Invalid published snapshot');
      const json=JSON.parse(bytes);
      snapshot[resource]=Array.isArray(json)?json:json.operations||json.entities||json.claims||json.territorial_units;
      if(!Array.isArray(snapshot[resource]))throw Error('Invalid collection');
    }
    snapshot.releases=this.releaseIndex&&fs.existsSync(this.releaseIndex)?JSON.parse(fs.readFileSync(this.releaseIndex,'utf8')).releases:[];
    if(!Array.isArray(snapshot.releases)||snapshot.releases.some(r=>!/^data-\d{4}\.(0[1-9]|1[0-2])\.[1-9]\d*$/.test(r.id)||! /^(?:[a-f0-9]){64}$/.test(r.snapshot_manifest_sha256)))throw Error('Invalid releases index');
    const manifestHash=crypto.createHash('sha256').update(read('dataset-manifest.json')).digest('hex');
    snapshot.current_release=snapshot.releases.find(r=>r.snapshot_manifest_sha256===manifestHash&&r.canonical_sha256===manifest.canonical_sha256)||null;
    const coverageFile=path.join(path.dirname(this.directory),'coverage/engine.json');snapshot.coverage_engine=null;
    if(fs.existsSync(coverageFile)){
      const engine=JSON.parse(fs.readFileSync(coverageFile,'utf8'));
      if(engine.calculation_version!=='coverage-v1'||! /^(?:[a-f0-9]){64}$/.test(engine.model_sha256)||! /^(?:[a-f0-9]){64}$/.test(engine.query_sha256))throw Error('Invalid coverage engine metadata');
      snapshot.coverage_engine={calculation_version:engine.calculation_version,model_sha256:engine.model_sha256,query_sha256:engine.query_sha256};
    }
    this.snapshot=snapshot;return snapshot;
  }
}
module.exports={FileRepository};
