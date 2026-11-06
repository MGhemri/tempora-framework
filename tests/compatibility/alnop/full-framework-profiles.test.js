'use strict';
const {root:externalRoot}=require('../../../compatibility/alnop/verify').verifyExternal(process.env.ALNOP_REFERENCE);
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {resolveProfile,ProfileError}=require('../../../src/framework/profile');
const {loadProfile,discoverProfiles}=require('../../../src/framework/profile-loader');
const {createValidator,defineAdapter}=require('../../../src/framework/validation');
const adapter=require('../../../compatibility/alnop/adapters/alnop'),{readCorpus,root}=require(path.join(externalRoot,'src/canonical'));
const fixture=()=>structuredClone(require('../../fixtures/profiles/synthetic-history/profile.json'));
const code=expected=>e=>e instanceof ProfileError&&e.code===expected;
const event=()=>({id:'SYN_EVENT_1',start_date:{earliest:'1750-01-01',latest:'1750-12-31'},event_type:['fictional assembly']});
const options=()=>({taxonomies:{event_types:['fictional assembly']}});
function temporary(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-profile-'));try{return fn(dir);}finally{if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir())||!path.basename(dir).startsWith('tempora-profile-'))throw Error('Unsafe test directory');fs.rmSync(dir,{recursive:true,force:true});}}

test('ALNOP profile binds existing vocabularies and validates all current records without mutation',()=>{
 const corpus=readCorpus(),before=structuredClone(corpus),profile=require('../../../compatibility/alnop/profile/profile.json'),result=adapter.validate(corpus,profile);
 assert.equal(result.length,263);assert.ok(result.every(r=>r.valid));assert.deepEqual(corpus,before);
 assert.equal(profile.time.coverage.earliest,'1954-01-01');assert.equal(profile.time.coverage.latest,'1962-12-31');
});

test('Two independent periods and vocabularies use the same generic validator',()=>{
 const synthetic=createValidator(fixture(),options()),alnop=require('../../../compatibility/alnop/profile/profile.json'),corpus=readCorpus();
 assert.equal(synthetic.validate(event()).valid,true);
 const historical=createValidator(alnop,{taxonomies:{event_types:corpus.vocabularies.event_types,territorial_units:corpus.territorial_units.map(t=>t.id)}});
 assert.ok(historical.validate(event()).diagnostics.some(d=>d.code==='DATE_OUTSIDE_PROFILE'));
 assert.equal(synthetic.validate({...event(),event_type:['reunión ficticia']}).diagnostics.length,0);
});

test('The legacy validator reads its year window from the declared profile and preserves boundaries',t=>{
 const {spawnSync}=require('node:child_process');const result=spawnSync('python',['-c',"import validate_dataset as v; assert v.check_calendar_date('1954', '', '')[0]; assert v.check_calendar_date('1962-12-31', '', '')[0]; assert not v.check_calendar_date('1963', '', '')[0]; assert not v.check_calendar_date('1953', '', '')[0]; assert not v.check_calendar_date('1956-02-30', '', '')[0]"],{cwd:root,encoding:'utf8'});
 if(result.error?.code==='ENOENT'){t.skip('Independent Python check requires the Python-enabled CI job');return;}
 assert.equal(result.status,0,result.stderr||result.error?.message);
});