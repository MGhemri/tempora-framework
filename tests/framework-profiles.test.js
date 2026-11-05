'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {resolveProfile,ProfileError}=require('../src/framework/profile');
const {loadProfile,discoverProfiles}=require('../src/framework/profile-loader');
const {createValidator,defineAdapter}=require('../src/framework/validation');
const adapter=require('../src/profiles/alnop'),{readCorpus,root}=require('../src/canonical');
const fixture=()=>structuredClone(require('./fixtures/profiles/synthetic-history/profile.json'));
const code=expected=>e=>e instanceof ProfileError&&e.code===expected;
const event=()=>({id:'SYN_EVENT_1',start_date:{earliest:'1750-01-01',latest:'1750-12-31'},event_type:['fictional assembly']});
const options=()=>({taxonomies:{event_types:['fictional assembly']}});
function temporary(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tempora-profile-'));try{return fn(dir);}finally{if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir())||!path.basename(dir).startsWith('tempora-profile-'))throw Error('Unsafe test directory');fs.rmSync(dir,{recursive:true,force:true});}}

test('ALNOP profile binds existing vocabularies and validates all current records without mutation',()=>{
 const corpus=readCorpus(),before=structuredClone(corpus),profile=adapter.load(root),result=adapter.validate(corpus,profile);
 assert.equal(result.length,263);assert.ok(result.every(r=>r.valid));assert.deepEqual(corpus,before);
 assert.equal(profile.time.coverage.earliest,'1954-01-01');assert.equal(profile.time.coverage.latest,'1962-12-31');
});
test('Two independent periods and vocabularies use the same generic validator',()=>{
 const synthetic=createValidator(fixture(),options()),alnop=adapter.load(root),corpus=readCorpus();
 assert.equal(synthetic.validate(event()).valid,true);
 const historical=createValidator(alnop,{taxonomies:{event_types:corpus.vocabularies.event_types,territorial_units:corpus.territorial_units.map(t=>t.id)}});
 assert.ok(historical.validate(event()).diagnostics.some(d=>d.code==='DATE_OUTSIDE_PROFILE'));
 assert.equal(synthetic.validate({...event(),event_type:['reunión ficticia']}).diagnostics.length,0);
});
test('Profile rules, severity overrides and taxonomy bindings cannot leak between contexts',()=>{
 const raw=fixture(),binding=options(),a=createValidator(resolveProfile(raw,{severities:{'event-type':'error'},parameters:{limits:{sample:4}}}),binding),b=createValidator(raw,binding);
 binding.taxonomies.event_types.push('foreign value');raw.parameters.coverage.from_year=0;
 const unknown={...event(),event_type:['foreign value']};assert.equal(a.validate(unknown).valid,false);assert.equal(b.validate(unknown).valid,true);assert.equal(b.validate(unknown).diagnostics[0].severity,'warning');
 assert.equal(a.profile.parameters.limits.sample,4);assert.equal(b.profile.parameters.coverage.from_year,1600);assert.throws(()=>{a.profile.locales.push('fr');});
});
test('Profile schema, versions, calendars, CRS, locale and override errors are explicit',()=>{
 for(const [change,expected]of [
  [p=>p.profile_schema_version='9.0.0','PROFILE_SCHEMA_INVALID'],[p=>p.framework='>=4.0.0 <5.0.0','PROFILE_VERSION_INCOMPATIBLE'],
  [p=>p.framework='>=4.0.0 <3.0.0','PROFILE_VERSION_INCOMPATIBLE'],[p=>p.time.calendar='julian','PROFILE_CALENDAR_UNSUPPORTED'],
  [p=>p.spatial.crs='EPSG:3857','PROFILE_CRS_UNSUPPORTED'],[p=>p.default_locale='fr','PROFILE_LOCALE_INVALID'],
  [p=>p.time.coverage.latest='1500-01-01','PROFILE_COVERAGE_INVALID'],[p=>p.time.coverage.latest='1800-02-30','PROFILE_SCHEMA_INVALID'],
  [p=>p.rules.push({...p.rules[0]}),'PROFILE_RULE_DUPLICATE'],[p=>p.rules[0].field='constructor.name','PROFILE_UNSAFE_FIELD']
 ]){const p=fixture();change(p);assert.throws(()=>resolveProfile(p),code(expected));}
 assert.throws(()=>resolveProfile(null),code('PROFILE_SCHEMA_INVALID'));
 assert.throws(()=>resolveProfile(fixture(),{severities:{absent:'warning'}}),code('PROFILE_OVERRIDE_INVALID'));
 assert.throws(()=>resolveProfile({...fixture(),extends:'missing.json'}),code('PROFILE_PARENT_UNRESOLVED'));
});
test('Aliases are declared, unambiguous and bound to actual controlled values',()=>{
 const p=fixture();p.aliases.push({...p.aliases[0],language:'en',canonical:'another target'});assert.throws(()=>resolveProfile(p),code('PROFILE_ALIAS_AMBIGUOUS'));
 assert.throws(()=>createValidator(fixture(),{taxonomies:{}}),code('PROFILE_BINDING_MISSING'));
 assert.throws(()=>createValidator(fixture(),{taxonomies:{event_types:['other']}}),code('PROFILE_ALIAS_TARGET_MISSING'));
 const unsafe=JSON.parse('{"__proto__":{"injected":true}}');assert.throws(()=>resolveProfile(fixture(),{parameters:unsafe}),code('PROFILE_UNSAFE_KEY'));assert.equal({}.injected,undefined);
 for(const value of [()=>{},new Date(),NaN])assert.throws(()=>resolveProfile(fixture(),{parameters:{value}}),code('PROFILE_VALUE_INVALID'));
});
test('Date rules retain unknown and open bounds and distinguish malformed from out-of-profile intervals',()=>{
 const v=createValidator(fixture(),options());assert.equal(v.validate({...event(),start_date:{earliest:null,latest:null}}).valid,true);
 assert.equal(v.validate({...event(),start_date:{earliest:null,latest:'1800-01-01'}}).valid,true);
 for(const date of [{earliest:'1750-02-30',latest:'1750-03-01'},{earliest:'1750-02-01',latest:'1750-01-01'},{}])assert.ok(v.validate({...event(),start_date:date}).diagnostics.some(d=>d.code==='DATE_INTERVAL_INVALID'));
 assert.ok(v.validate({...event(),start_date:{earliest:'1900-01-01',latest:'1900-01-01'}}).diagnostics.some(d=>d.code==='DATE_OUTSIDE_PROFILE'));
 assert.equal(v.validate(null).valid,false);assert.equal(v.validate({...event(),id:''}).valid,false);
});
test('Explicit loading supports bounded inheritance and replacement of arrays',()=>temporary(dir=>{
 const p=fixture();p.parameters={limits:{count:5,enabled:true}};fs.writeFileSync(path.join(dir,'parent.json'),JSON.stringify(p));
 fs.writeFileSync(path.join(dir,'child.json'),JSON.stringify({extends:'parent.json',id:'child-profile',namespace:'CHILD',parameters:{limits:{count:9}},locales:['en'],aliases:[]}));
 const child=loadProfile(path.join(dir,'child.json'),{rootDirectory:dir,parameters:{limits:{enabled:false}}});assert.deepEqual(child.parameters.limits,{count:9,enabled:false});assert.deepEqual(child.locales,['en']);assert.equal(p.parameters.limits.count,5);
}));
test('Profile loader rejects cycles, escaping paths, malformed JSON and oversized files',()=>temporary(dir=>{
 assert.throws(()=>loadProfile(null),code('PROFILE_ARGUMENT_INVALID'));assert.throws(()=>loadProfile('profile.json',null),code('PROFILE_ARGUMENT_INVALID'));assert.throws(()=>loadProfile('profile.json',{rootDirectory:null}),code('PROFILE_ROOT_INVALID'));
 const file=path.join(dir,'profile.json');fs.writeFileSync(file,JSON.stringify({extends:'profile.json'}));assert.throws(()=>loadProfile(file),code('PROFILE_INHERITANCE_CYCLE'));
 fs.writeFileSync(file,JSON.stringify({extends:'../outside.json'}));fs.writeFileSync(path.join(dir,'outside-target.txt'),'x');
 assert.throws(()=>loadProfile(path.join(dir,'outside-target.txt')),code('PROFILE_FILE_INVALID'));
 assert.throws(()=>loadProfile(path.join(root,'profiles/alnop/profile.json'),{rootDirectory:dir}),code('PROFILE_PATH_DENIED'));
 fs.mkdirSync(path.join(dir,'child'));fs.writeFileSync(path.join(dir,'outside.json'),JSON.stringify(fixture()));fs.writeFileSync(path.join(dir,'child','profile.json'),JSON.stringify({extends:'../outside.json'}));
 assert.throws(()=>loadProfile(path.join(dir,'child','profile.json')),code('PROFILE_PATH_DENIED'));
 fs.writeFileSync(file,'{');assert.throws(()=>loadProfile(file),code('PROFILE_JSON_INVALID'));
 fs.writeFileSync(file,Buffer.from([0xff,0xfe]));assert.throws(()=>loadProfile(file),code('PROFILE_JSON_INVALID'));
 fs.writeFileSync(file,' '.repeat(131073));assert.throws(()=>loadProfile(file),code('PROFILE_FILE_INVALID'));
}));
test('Discovery uses an explicit directory and rejects registry identity collisions',()=>temporary(dir=>{
 for(const name of ['one','two']){fs.mkdirSync(path.join(dir,name));fs.writeFileSync(path.join(dir,name,'profile.json'),JSON.stringify({...fixture(),id:name,namespace:name.toUpperCase()}));}
 assert.deepEqual(discoverProfiles(dir).map(p=>p.id),['one','two']);fs.writeFileSync(path.join(dir,'two','profile.json'),JSON.stringify({...fixture(),id:'one',namespace:'ONE'}));assert.throws(()=>discoverProfiles(dir),code('PROFILE_REGISTRY_DUPLICATE'));
}));
test('Adapter contract preserves caller functions and prohibits incomplete adapters',()=>{
 const a=defineAdapter({id:'json-fixture',formats:['json'],parse:JSON.parse,serialize:JSON.stringify});assert.deepEqual(a.parse(a.serialize(event())),event());assert.ok(Object.isFrozen(a.formats));assert.throws(()=>defineAdapter({id:'missing'}),code('ADAPTER_CONTRACT_INVALID'));
});
test('The generic framework has no imports or constants from the historical profile',()=>{
 for(const name of fs.readdirSync(path.join(root,'src/framework'))){const text=fs.readFileSync(path.join(root,'src/framework',name),'utf8');assert.doesNotMatch(text,/alnop|wilaya|1954|1962/i,name);}
});
test('The legacy validator reads its year window from the declared profile and preserves boundaries',t=>{
 const {spawnSync}=require('node:child_process');const result=spawnSync('python',['-c',"import validate_dataset as v; assert v.check_calendar_date('1954', '', '')[0]; assert v.check_calendar_date('1962-12-31', '', '')[0]; assert not v.check_calendar_date('1963', '', '')[0]; assert not v.check_calendar_date('1953', '', '')[0]; assert not v.check_calendar_date('1956-02-30', '', '')[0]"],{cwd:root,encoding:'utf8'});
 if(result.error?.code==='ENOENT'){t.skip('Independent Python check requires the Python-enabled CI job');return;}
 assert.equal(result.status,0,result.stderr||result.error?.message);
});
