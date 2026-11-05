const {test}=require('node:test'),assert=require('node:assert/strict');
const {checkChanges,contentDigest}=require('../src/review');
function record(){return {id:'OP_TEST',editorial_status:'published',title:{fr:'Original'},review_history:[]};}
function approve(r){r.review_history??=[];r.review_history.push({reviewer:'TEST_REVIEWER',decision:'approved',reference:'https://example.org/review',reason:'Test review.',reviewed_at:'2026-11-05T00:30:00Z',content_sha256:contentDigest(r)});return r;}
const changes=(before,after,file='data/operations/OP_TEST.json')=>[{file,before,after}];
test('A published edit requires a fresh approval bound to the changed content',()=>{
  const before=approve(record()),after=structuredClone(before);after.title.fr='Changed';
  assert.ok(checkChanges(changes(before,after)).length);
  approve(after);assert.deepEqual(checkChanges(changes(before,after)),[]);
  after.title.fr='Changed after review';assert.match(checkChanges(changes(before,after)).join('\n'),/content_sha256/);
});
test('Decisions cannot be replaced, reused or published with unsafe reference',()=>{
  const before=approve(record());
  for(const mutate of [r=>r.review_history.shift(),r=>r.review_history.at(-1).reference='javascript:alert(1)',r=>r.id='OTHER']){
    const after=structuredClone(before);after.title.fr='new';approve(after);mutate(after);assert.ok(checkChanges(changes(before,after)).length);
  }
});
test('Draft editing is allowed while deletions and unreviewed withdrawal are blocked',()=>{
  const before=record();before.editorial_status='proposed';const after={...before,title:{fr:'Draft edit'}};
  assert.deepEqual(checkChanges(changes(before,after)),[]);
  assert.ok(checkChanges(changes(before,null)).length);
  const old=approve(record()),withdrawn={...old,editorial_status:'withdrawn'};assert.ok(checkChanges(changes(old,withdrawn)).length);
});
test('Published evidence changes and new records also require a matching review',()=>{
  const s={source_id:'SRC_aaaaaaaaaaaaaaaaaaaaaaaa',title:'Changed'};
  assert.ok(checkChanges(changes(null,s,'data/sources/'+s.source_id+'.json'),{publicSourceIds:new Set([s.source_id])}).length);
  assert.deepEqual(checkChanges(changes(null,approve(s),'data/sources/'+s.source_id+'.json'),{publicSourceIds:new Set([s.source_id])}),[]);
  assert.ok(checkChanges(changes(null,record())).length);
});
test('Digest is independent of object key order and binds nested content',()=>{
  assert.equal(contentDigest({b:2,a:1}),contentDigest({a:1,b:2,review_history:[]}));
  assert.notEqual(contentDigest({names:['a']}),contentDigest({names:['b']}));
});

test('The Git comparison catches untracked additions and verifies a real content-bound approval',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
  const {run}=require('../scripts/check-review-changes');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alnop-review-'));
  const write=(file,value)=>{const p=path.join(dir,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(value));};
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  try{
    git('init','-q');for(const name of ['operations','sources','territorial-units'])fs.mkdirSync(path.join(dir,'data',name),{recursive:true});
    write('data/dataset.json',{});write('data/vocabularies.json',{});git('add','.');
    git('-c','user.name=TEST_FIXTURE','-c','user.email=test@example.org','commit','-qm','Synthetic baseline');const base=git('rev-parse','HEAD');
    const file='data/operations/OP_TEST.json',op={...record(),source_ids:[]};write(file,op);
    assert.throws(()=>run(['--base',base],dir),/content_sha256/);
    approve(op);write(file,op);assert.doesNotThrow(()=>run(['--base',base],dir));
    op.title.fr='after approval';write(file,op);assert.throws(()=>run(['--base',base],dir),/content_sha256/);
  }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('alnop-review-'));fs.rmSync(dir,{recursive:true});}
});
