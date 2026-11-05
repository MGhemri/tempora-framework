const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {zip,unzip,crc32}=require('../src/release-zip');
const {makeRelease,verifyRelease,readReleases,gitSource,hash,root}=require('../src/data-releases');
const {artifacts}=require('../scripts/build-canonical'),{readCorpus}=require('../src/canonical');
const {releaseArtifacts}=require('../scripts/build-releases');
const details={id:'data-2026.11.1',published_at:'2026-11-05T00:00:00Z',source_commit:'a05ed618f30dbb5cae63ba6517b6dc433ac4a3db',summary:'Synthetic technical publication test.',changes:['No historical corrections.']};
const source=()=>({...artifacts(readCorpus()),LICENSE:fs.readFileSync(path.join(root,'LICENSE'))});
function temp(prefix,run){const dir=fs.mkdtempSync(path.join(os.tmpdir(),prefix));try{return run(dir);}finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith(prefix));fs.rmSync(dir,{recursive:true});}}
test('Release ZIP is deterministic, standard CRC-32 and independent of input ordering',()=>{
  assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);
  const one=zip({'b.txt':'two','a.txt':'one'}),two=zip({'a.txt':'one','b.txt':'two'});assert.ok(one.equals(two));
  assert.equal(unzip(one)['a.txt'].toString(),'one');assert.throws(()=>zip({'../bad':'x'}));
  const corrupt=Buffer.from(one);corrupt[35]^=1;assert.throws(()=>unzip(corrupt));
});
test('Frozen release preserves all snapshot files, initial IDs, source commit, citation and checksums',()=>{
  const result=makeRelease(source(),details),files=verifyRelease(result.metadata,result.archive);
  assert.equal(result.metadata.total,263);assert.equal(JSON.parse(files['operations.json']).operations.length,263);
  assert.ok(JSON.parse(files['operations.json']).operations.some(o=>o.id==='OP_1954_001'));
  assert.equal(result.metadata.source_commit,details.source_commit);assert.equal(result.metadata.review_scope,'technical_publication_of_existing_corpus');
  assert.match(files['CITATION.cff'].toString(),/type: dataset/);assert.doesNotMatch(files['CITATION.cff'].toString(),/Ghemri|doi:/i);
  for(const [name,digest]of Object.entries(result.metadata.files))assert.equal(hash(files[name]),digest);
  assert.ok(makeRelease(source(),details).archive.equals(result.archive));
  assert.equal(makeRelease(source(),{...details,id:'data-2026.11.10'}).metadata.id,'data-2026.11.10');
});
test('Bad metadata, mismatched snapshot bytes and damaged archives cannot be published',()=>{
  const s=source(),r=makeRelease(s,details);s['operations.json']+=' ';
  assert.throws(()=>makeRelease(s,details),/checksum/);
  assert.throws(()=>makeRelease(source(),{...details,id:'../bad'}));assert.throws(()=>makeRelease(source(),{...details,published_at:'2026-12-05T00:00:00Z'}));
  assert.throws(()=>verifyRelease({...r.metadata,total:264},r.archive),/metadata mismatch|snapshot mismatch/);
  const bad=Buffer.from(r.archive);bad[50]^=1;assert.throws(()=>verifyRelease(r.metadata,bad),/SHA-256/);
});
test('Public release outputs keep permanent URLs and changing the current corpus cannot change old archive bytes',()=>{
  const r=makeRelease(source(),details),files=releaseArtifacts([r]);
  const key='docs/data/releases/'+details.id+'/alnop-'+details.id+'.zip';assert.ok(files[key].equals(r.archive));
  const index=JSON.parse(files['docs/data/releases/index.json']);assert.equal(index.releases[0].id,details.id);
  assert.match(index.releases[0].archive_url,/^\/data\/releases\//);assert.doesNotMatch(JSON.stringify(index),/github\.com/);
  assert.ok(releaseArtifacts([r])[key].equals(files[key]));
});
test('An independent Python ZIP reader verifies the complete archive and UTF-8 citations',()=>temp('alnop-zip-',dir=>{
  const r=makeRelease(source(),details),file=path.join(dir,'release.zip');fs.writeFileSync(file,r.archive);
  const code="import sys,zipfile,json; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert len(json.loads(z.read('operations.json'))['operations'])==263; assert 'ALNOP' in z.read('CITATION.cff').decode('utf-8'); print(len(z.namelist()))";
  const {spawnSync}=require('node:child_process'),result=spawnSync('python',['-c',code,file],{encoding:'utf8'});
  // Python is an independent release/CI check, not required by Vercel's Node build.
  if(result.error?.code==='ENOENT')return;assert.equal(result.status,0,result.stderr);assert.equal(Number(result.stdout),Object.keys(r.payload).length);
}));
test('Stored release records rebuild deterministically and release IDs cannot be overwritten',()=>temp('alnop-release-',dir=>{
  const r=makeRelease(source(),details),folder=path.join(dir,'data/releases');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,details.id+'.json'),JSON.stringify(r.metadata));fs.writeFileSync(path.join(folder,details.id+'.zip'),r.archive);
  assert.equal(readReleases(dir).length,1);const {run}=require('../scripts/build-releases');run([],dir);assert.doesNotThrow(()=>run(['--check'],dir));
  assert.throws(()=>require('../scripts/create-data-release').run(['--id',details.id],dir),/immutable/);
  fs.writeFileSync(path.join(folder,'data-2026.11.2.zip'),'bad');assert.throws(()=>readReleases(dir),/Orphan/);
}));

test('API reports a release ID only while every current snapshot manifest byte still matches',()=>temp('alnop-release-api-',dir=>{
  const sourceFiles=source(),r=makeRelease(sourceFiles,details),out=releaseArtifacts([r]);
  const canonical=path.join(dir,'docs/data/canonical');fs.mkdirSync(canonical,{recursive:true});
  for(const [name,bytes]of Object.entries(sourceFiles))fs.writeFileSync(path.join(canonical,name),bytes);
  const index=path.join(dir,'docs/data/releases/index.json');fs.mkdirSync(path.dirname(index),{recursive:true});fs.writeFileSync(index,out['docs/data/releases/index.json']);
  const {FileRepository}=require('../src/api-v2/repository'),{createHandler}=require('../src/api-v2/service');
  const repo=new FileRepository(canonical);assert.equal(repo.load().current_release.id,details.id);
  const res={setHeader(){},status(c){this.statusCode=c;return this;},json(b){this.body=b;return this;}};
  createHandler(repo)({method:'GET',url:'/api/v2/releases/'+details.id},res);assert.equal(res.statusCode,200);assert.equal(res.body.meta.dataset_release,details.id);
  const manifest=JSON.parse(sourceFiles['dataset-manifest.json']);manifest.checksums['quality-report.md']='f'.repeat(64);
  fs.writeFileSync(path.join(canonical,'dataset-manifest.json'),JSON.stringify(manifest));assert.equal(new FileRepository(canonical).load().current_release,null);
}));

test('Git change guard rejects changes or deletion of an already recorded release',()=>temp('alnop-release-git-',dir=>{
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q');fs.mkdirSync(path.join(dir,'data/releases'),{recursive:true});const file=path.join(dir,'data/releases/data-2026.11.1.zip');fs.writeFileSync(file,'baseline');git('add','.');
  git('-c','user.name=TEST_FIXTURE','-c','user.email=test@example.org','commit','-qm','Synthetic archive');const base=git('rev-parse','HEAD');
  fs.writeFileSync(file,'changed');assert.throws(()=>require('../scripts/check-review-changes').run(['--base',base],dir),/immutable/);
  fs.unlinkSync(file);assert.throws(()=>require('../scripts/check-review-changes').run(['--base',base],dir),/immutable/);
}));
