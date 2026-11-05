#!/usr/bin/env node
const path = require('node:path');
const {parseArgs} = require('node:util');
const sdk = require('../sdk');
const importer = require('../../scripts/ingest-tempora');
const {run:analyze} = require('../../scripts/analyze-tempora');
const {run:publish} = require('../../scripts/publish-tempora');
const {start:serve} = require('../../scripts/serve-tempora');
const {version} = require('../../package.json');

const help = `TEMPORA — independent historical corpora
tempora --version
tempora profile validate <manifest>
tempora corpus validate <file>
tempora ingest preview --base <corpus> --input <file> --mapping <file>
tempora ingest accept --base <corpus> --batch <file> --id <id> --reviewer <id> --reason <text>
tempora analyze --base <file> --scope working|published
tempora review validate --corpus <file> --policy <file> --journal <file> --journal-head <sha256>
tempora publish build --request <file> --journal-head <sha256>
tempora publish verify --directory <dir>
tempora publish export|promote|rollback [options]
tempora api serve --store <dir> --profile <id> [--port <port>]
Ingestion and publication write only with --write --output-root <dir>.
Preview and build run in simulation by default.
`;

function outputOptions(args) {
  const index=args.indexOf('--output-root');
  const directory=index===-1?null:args[index+1];
  const forwarded=index===-1?args:args.filter((_,position)=>position!==index&&position!==index+1);
  if ((index!==-1&&(!directory||directory.startsWith('--')||forwarded.includes('--output-root')))
      || (forwarded.includes('--write')&&!directory)) throw Error('Writes require an explicit --output-root directory');
  return {forwarded,directory:directory?path.resolve(directory):undefined};
}

function run(args) {
  if (!args.length||(args.length===1&&args[0]==='--help')) return help;
  if (args.length===1&&args[0]==='--version') return version;
  const [group,action,...rest]=args;
  if (group==='profile'&&action==='validate'&&rest.length===1) {
    const {id,namespace,version}=sdk.profiles.load(rest[0]);
    return {valid:true,id,namespace,version};
  }
  if (group==='corpus'&&action==='validate'&&rest.length===1) {
    const result=sdk.canonical.validateCorpus(importer.getBase({base:rest[0]}));
    if (!result.valid) process.exitCode=1;
    return result;
  }
  if (group==='ingest'&&['preview','accept'].includes(action)) {
    const {forwarded,directory}=outputOptions(rest);
    let result;
    importer.run([action==='preview'?'import':action,...forwarded],
      {rootDirectory:directory,writeLine:line=>{result=line;}});
    return result;
  }
  if (group==='analyze') return analyze(args.slice(1));
  if (group==='review'&&action==='validate') {
    const {values}=parseArgs({args:rest,options:Object.fromEntries(
      ['corpus','policy','journal','journal-head'].map(name=>[name,{type:'string'}]))});
    return sdk.review.verify({corpus:importer.getBase({base:values.corpus}),policy:importer.json(values.policy,128*1024),
      journal:importer.json(values.journal,16*1024*1024),expectedHead:values['journal-head']});
  }
  if (group==='publish'&&['build','verify','export','promote','rollback'].includes(action)) {
    const {forwarded,directory}=outputOptions(rest);
    return publish([action==='build'?'prepare':action,...forwarded],directory);
  }
  if (group==='api'&&action==='serve') {
    const server=serve(rest);
    server.on('error',()=>{console.error(JSON.stringify({error:{code:'TEMPORA_LISTEN_FAILED'}}));process.exitCode=1;});
    return undefined;
  }
  throw Error('Unknown command; use --help');
}

try {
  const result=run(process.argv.slice(2));
  if(result!==undefined)console.log(typeof result==='string'?result:JSON.stringify(result,null,2));
} catch(error) {
  const systemError=typeof error.syscall==='string';
  console.error(JSON.stringify({error:{code:error.code??'TEMPORA_COMMAND_FAILED',
    message:systemError?'Local file or network operation failed':error.message}}));
  process.exitCode=1;
}
