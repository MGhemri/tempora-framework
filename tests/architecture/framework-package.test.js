const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {pack,npm} = require('../../scripts/pack-tempora');

test('The private tarball installs and executes a synthetic project outside the repository',t=>{
  const parent=fs.realpathSync(path.join(__dirname,'../../..'));
  const directory=fs.mkdtempSync(path.join(parent,'tempora-package-test-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const offline=process.env.TEMPORA_TEST_OFFLINE==='1';
  const preview=pack(directory,{offline});
  assert.ok(preview.files.some(file=>file.path==='src/sdk/index.d.ts'));
  assert.ok(!preview.files.some(file=>/alnop|atlas|(^|\/)data\/|\.zip$|\.env/i.test(file.path)));
  const {file}=pack(directory,{write:true,offline});
  const consumer=path.join(directory,'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer,'package.json'),JSON.stringify({name:'synthetic-consumer',version:'1.0.0',private:true}));
  npm(['install','--ignore-scripts','--no-audit','--no-fund',file],consumer,offline);
  const installed=path.join(consumer,'node_modules/tempora-framework');
  const manifest=JSON.parse(fs.readFileSync(path.join(installed,'package.json'),'utf8'));
  assert.deepEqual(Object.keys(manifest.dependencies).sort(),['ajv','ajv-formats']);
  assert.equal(manifest.private,true);
  const source=path.join(__dirname,'../fixtures/profiles/synthetic-history/profile.json');
  fs.copyFileSync(source,path.join(consumer,'profile.json'));
  const script=path.join(consumer,'index.cjs');
  fs.writeFileSync(script,`
    const assert=require('node:assert/strict');
    const sdk=require('tempora-framework');
    const profile=sdk.profiles.load('./profile.json');
    assert.match(require('tempora-framework/schemas/v3/corpus').$id,/corpus/);
    const corpus=sdk.ingestion.createCorpus(profile,{event_types:['fictional assembly'],territorial_units:[]});
    corpus.sources.push({schema_version:'3.0.0',kind:'source',id:'SOURCE_1',namespace:profile.namespace,
      editorial_status:'proposed',title:{en:'Fictional testimony'},url:null,classification:null,review_refs:[],
      provenance:{evidence:[],transformations:[]},extensions:{}});
    const mapping={mapping_schema_version:'1.0.0',id:'test-package',version:'1.0.0',
      profile_id:profile.id,profile_version:profile.version,format:'json',
      fields:{id:'/id',title:{en:'/title'},start_date:'/date',event_type:'/type',evidence:'/evidence'}};
    const bundle=sdk.ingestion.preview({corpus,mapping,sourceName:'synthetic.json',
      bytes:Buffer.from(JSON.stringify([{id:'EVENT_1',title:'A fictional event',date:'1700',type:'fictional assembly',evidence:[{source_id:'SOURCE_1',locator:'p. 1'}]}]))});
    const output=sdk.ingestion.accept({corpus,bundle,review:{ids:['EVENT_1'],reviewer:'test',reason:'Fictional',reviewed_at:'2026-11-01T00:00:00Z'}});
    assert.equal(sdk.canonical.validateCorpus(output.corpus).valid,true);
    assert.equal(sdk.analysis.analyze(output.corpus,{scope:'working'}).coverage.denominator,1);
    const policy=sdk.review.policy(profile,{reviewers:['reviewer','publisher'],minimum_approvals:1,
      review_max_age_days:30,contested:'deny'});
    const asOf='2026-11-01T00:00:00Z';
    const reference=({kind,id,namespace})=>({kind,id,namespace});
    let journal=[];
    for(const record of [output.corpus.sources[0],output.corpus.events[0]]) {
      for(const [decision,from,to] of [['submitted','proposed','under_review'],['approved','under_review','published']]) {
        journal=sdk.review.append({corpus:output.corpus,policy,journal,decision:{
          subject:reference(record),decision,from,to,reviewer:'reviewer',reason:'Fictional review',
          reviewed_at:asOf,basis:{kind:'documentary_review',rights:'cleared',sensitivity:'cleared'},
          content_sha256:sdk.review.digest(record),reference:'https://example.org/review',evidence_ids:['SOURCE_1']
        }});
      }
    }
    const request={corpus:output.corpus,policy,journal,subjects:[reference(output.corpus.events[0])],asOf,
      expectedHead:journal.at(-1).entry_sha256,
      release:{id:'fictional-1',source_commit:'a'.repeat(40),citation_author:'Synthetic test team',rights_notice:'Fictional test data'}};
    const release=sdk.publication.build(request),store=sdk.publication.createStore('./versions');
    store.promote(request,{snapshot_sha256:store.stage(release),operator:{reviewer:'publisher',at:asOf,reason:'Fictional approval'}});
    assert.equal(sdk.publication.verifyDirectory(store.export(release)).manifest.release_id,'fictional-1');
    const handler=sdk.api.createHandler(sdk.api.createCatalog([store.readPublished(profile.id)]));
    const response={setHeader(){},end(bytes){this.body=JSON.parse(bytes);}};
    handler({method:'GET',url:'/api/v3/profiles/'+profile.id+'/events'},response);
    assert.equal(response.statusCode,200);
    assert.equal(response.body.data[0].id,'EVENT_1');
  `);
  const env={...process.env};
  delete env.NODE_PATH;
  delete env.NODE_TEST_CONTEXT;
  for(const args of [[script],[path.join(installed,'src/cli/tempora.js'),'--version'],
    [path.join(installed,'src/cli/tempora.js'),'profile','validate','profile.json']]){
    const result=spawnSync(process.execPath,['--no-global-search-paths',...args],{cwd:consumer,env,encoding:'utf8',timeout:20000});
    assert.ifError(result.error);
    assert.equal(result.status,0,result.stdout+result.stderr);
  }
});
