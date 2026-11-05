const path = require('node:path');
const {parseArgs} = require('node:util');
const {json} = require('./ingest-tempora');
const {buildPublicationArtifacts,verifyPublicationArtifacts} = require('../src/framework/publication');
const {createPublicationStore,verifyPublicationDirectory} = require('../src/framework/publication-store');

function run(args = process.argv.slice(2), root = path.join(__dirname,'../work/tempora-v3/publication')) {
  const {positionals,values} = parseArgs({args,allowPositionals:true,options:{
    request:{type:'string'}, bundle:{type:'string'}, directory:{type:'string'}, sha256:{type:'string'}, target:{type:'string'},
    'journal-head':{type:'string'}, reviewer:{type:'string'}, at:{type:'string'}, reason:{type:'string'}, write:{type:'boolean'}
  }});
  const [command] = positionals;
  const allowed = {prepare:['request','journal-head','write'],verify:['bundle','directory'], export:['bundle','write'],
    promote:['request','journal-head','sha256','reviewer','at','reason','write'],
    rollback:['request','sha256','target','reviewer','at','reason','write']};
  if (positionals.length !== 1 || !Object.hasOwn(allowed,command)
      || Object.keys(values).some(key => !allowed[command].includes(key))) throw Error('Use prepare, verify, export, promote or rollback');
  const load = file => json(file,128*1024*1024);
  if (command === 'verify') {
    if (Boolean(values.bundle) === Boolean(values.directory)) throw Error('Choose exactly one of --bundle or --directory');
    const bundle = values.directory ? verifyPublicationDirectory(values.directory) : load(values.bundle);
    verifyPublicationArtifacts(bundle);
    return {valid:true,manifest:bundle.manifest};
  }
  const store = createPublicationStore(root);
  if (command === 'export') {
    if (!values.write) throw Error('Export requires explicit --write');
    return {directory:store.export(load(values.bundle))};
  }
  const request = {...load(values.request),expectedHead:values['journal-head']};
  if (command === 'prepare') {
    const bundle = buildPublicationArtifacts(request);
    if (values.write) store.stage(bundle);
    return {mode:values.write?'staged':'dry_run',manifest:bundle.manifest};
  }
  if (!values.write) throw Error('Promotion and rollback require explicit --write');
  const operator = {reviewer:values.reviewer,at:values.at,reason:values.reason};
  return command === 'promote' ? store.promote(request,{snapshot_sha256:values.sha256,operator})
    : store.rollback({profile:request.corpus.profile,policy:request.policy,expected_sha256:values.sha256,
      target_release_id:values.target,operator});
}

if (require.main === module) {
  try { console.log(JSON.stringify(run(),null,2)); }
  catch(error) {
    console.error(error.message);
    if (error.details) console.error(JSON.stringify(error.details));
    process.exitCode = 1;
  }
}
module.exports = {run};
