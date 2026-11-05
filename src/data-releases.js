const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const Ajv=require('ajv/dist/2020'),formats=require('ajv-formats');
const {zip,unzip}=require('./release-zip');
const ajv=new Ajv({allErrors:true,strict:true});formats(ajv);const validate=ajv.compile(require('../schemas/release.schema.json'));
const stable=v=>JSON.stringify(v,null,2)+'\n',hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=path.join(__dirname,'..');
const releaseId=/^data-\d{4}\.(0[1-9]|1[0-2])\.[1-9]\d*$/;
function citation(record){return `cff-version: 1.2.0\nmessage: "Citez la version des données utilisée, avec son empreinte et son commit source."\ntype: dataset\ntitle: "ALNOP — ALN Historical Operations Dataset (1954–1962)"\nauthors:\n  - name: "ALNOP"\n    email: "contact@connect-gm.com"\nversion: "${record.id}"\ndate-released: "${record.published_at.slice(0,10)}"\nurl: "https://alnop.vercel.app/data/releases/${record.id}/release.json"\ncommit: "${record.source_commit}"\nabstract: "Corpus documentaire incomplet. Publication technique du corpus existant, sans nouvelle validation historique. Licences et droits existants conservés."\n`;}
function changelog(record){return `# ${record.id}\n\n${record.summary}\n\nDate UTC : ${record.published_at}\n\nCommit source : ${record.source_commit}\n\nFiches : ${record.total}\n\n`+record.changes.map(c=>'- '+c).join('\n')+'\n\nCorpus documentaire incomplet. Cette publication technique ne constitue pas une nouvelle validation historique.\n';}
function makeRelease(source,details){
  const manifest=JSON.parse(source['dataset-manifest.json']);
  if(!releaseId.test(details.id)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(details.published_at)||!Number.isFinite(Date.parse(details.published_at)))throw Error('Invalid release identity/date');
  if(details.id.slice(5,12)!==details.published_at.slice(0,7).replace('-','.'))throw Error('Release month disagrees with publication date');
  for(const [name,digest]of Object.entries(manifest.checksums))if(!source[name]||hash(source[name])!==digest)throw Error('Snapshot checksum mismatch: '+name);
  const operations=JSON.parse(source['operations.json']).operations;
  if(operations.length!==manifest.total||operations.some(o=>o.editorial_status!=='published'||/^(TEST_|SYNTHETIC_)/.test(o.id)))throw Error('Invalid published operation set');
  const record={id:details.id,published_at:details.published_at,source_commit:details.source_commit,schema_version:manifest.schema_version,
    total:manifest.total,canonical_sha256:manifest.canonical_sha256,snapshot_manifest_sha256:hash(source['dataset-manifest.json']),summary:details.summary,changes:details.changes,
    review_scope:'technical_publication_of_existing_corpus',corpus_is_incomplete:true,
    license_notice:'Licences et droits existants conservés. Aucun document tiers intégral ni nouvelle licence de données ne sont ajoutés.'};
  const payload={...source,'release.json':stable(record),'CITATION.cff':citation(record),'CHANGELOG.md':changelog(record)};
  const sums=Object.fromEntries(Object.entries(payload).sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>[name,hash(bytes)]));
  payload['SHA256SUMS.txt']=Object.entries(sums).map(([name,digest])=>`${digest}  ${name}`).join('\n')+'\n';
  const archive=zip(payload),metadata={...record,archive_sha256:hash(archive),files:Object.fromEntries(Object.entries(payload).map(([name,bytes])=>[name,hash(bytes)]))};
  if(!validate(metadata))throw Error(ajv.errorsText(validate.errors));
  return {metadata,archive,payload};
}
function gitSource(commit,directory=root){
  if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Use a complete source commit SHA');
  const read=file=>execFileSync('git',['show',commit+':'+file],{cwd:directory,maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
  const bytes=read('docs/data/canonical/dataset-manifest.json'),manifest=JSON.parse(bytes),source={'dataset-manifest.json':bytes};
  for(const name of Object.keys(manifest.checksums)){
    if(!/^[A-Za-z0-9_-]+\.(json|geojson|csv|md)$/.test(name))throw Error('Unsafe snapshot filename');
    source[name]=read('docs/data/canonical/'+name);
  }
  source['LICENSE']=read('LICENSE');return source;
}
function verifyRelease(metadata,archive){
  if(!validate(metadata))throw Error(ajv.errorsText(validate.errors));
  if(hash(archive)!==metadata.archive_sha256)throw Error('Archive SHA-256 mismatch');
  const files=unzip(archive);
  if(Object.keys(files).length!==Object.keys(metadata.files).length)throw Error('Release file count mismatch');
  for(const [name,digest]of Object.entries(metadata.files))if(!files[name]||hash(files[name])!==digest)throw Error('Release file checksum mismatch: '+name);
  const {archive_sha256,files:checksums,...base}=metadata;
  if(stable(JSON.parse(files['release.json']))!==stable(base)||hash(files['dataset-manifest.json'])!==metadata.snapshot_manifest_sha256)throw Error('Release metadata mismatch');
  const manifest=JSON.parse(files['dataset-manifest.json']);
  if(manifest.total!==metadata.total||manifest.canonical_sha256!==metadata.canonical_sha256)throw Error('Release snapshot mismatch');
  for(const [name,digest]of Object.entries(manifest.checksums))if(!files[name]||hash(files[name])!==digest)throw Error('Frozen snapshot checksum mismatch');
  return files;
}
function readReleases(directory=root,{sources=false}={}){
  const folder=path.join(directory,'data/releases');if(!fs.existsSync(folder))return [];
  for(const file of fs.readdirSync(folder).filter(f=>f.endsWith('.zip')))if(!fs.existsSync(path.join(folder,file.slice(0,-4)+'.json')))throw Error('Orphan release archive: '+file);
  return fs.readdirSync(folder).filter(n=>n.endsWith('.json')).sort().map(file=>{
    const metadata=JSON.parse(fs.readFileSync(path.join(folder,file),'utf8'));
    if(file!==metadata.id+'.json')throw Error('Release filename must equal ID');
    const archive=fs.readFileSync(path.join(folder,metadata.id+'.zip')),payload=verifyRelease(metadata,archive);
    if(sources){const rebuilt=makeRelease(gitSource(metadata.source_commit,directory),metadata);if(!rebuilt.archive.equals(archive))throw Error('Source commit reproduction differs: '+metadata.id);}
    return {metadata,archive,payload};
  });
}
module.exports={makeRelease,gitSource,verifyRelease,readReleases,citation,changelog,stable,hash,root};
