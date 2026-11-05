// Maintainer-only preparation. Never approves or publishes historical facts.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {dateBounds,hash,stable,root}=require('../src/canonical');
function prepare(submission,{id,sourceCommit,createdAt}){
  if(submission.kind!=='new-operation')throw new Error('Only new-operation proposals can be scaffolded; corrections require a reviewed patch of the existing record.');
  if(!/^[A-Za-z0-9_-]+$/.test(id||''))throw new Error('Maintainer must supply a safe permanent --id.');
  if(!submission.title?.trim()||!submission.description?.trim())throw new Error('Title and description are required.');
  if(submission.locale && !['fr','ar'].includes(submission.locale))throw new Error('Unsupported proposal language.');
  const arabic=submission.locale==='ar';
  const unknown=()=>dateBounds(null);
  let start=unknown();const notes=[];
  if(submission.eventDate){
    try{start=dateBounds(submission.eventDate);}
    catch{notes.push(`Date proposée à vérifier : ${submission.eventDate}`);}
  }
  const source=submission.citation?.trim()?{source_id:'SRC_'+hash(submission.citation).slice(0,24),
    title:null,notes:submission.citation,review_status:'needs_review'}:null;
  if(submission.missing)notes.push(`Absence de source signalée : ${submission.missing}`);
  const operation={id,schema_version:'2.0.0',title:{fr:arabic?null:submission.title,ar:arabic?submission.title:null},start_date:start,end_date:unknown(),
    locations:[{label:submission.eventPlace||null,geometry:null,geometry_role:'unknown',review_status:'needs_review'}],
    legacy_territorial_label:null,territorial_assignments:[],source_ids:source?[source.source_id]:[],
    editorial_status:'proposed',quality_flags:['contribution_needs_review','uncertain_location',...(source?[]:['missing_source'])],
    description:{fr:arabic?null:submission.description,ar:arabic?submission.description:null},event_type:[],editorial_notes:notes,
    provenance:{source_commit:sourceCommit,publication_basis:'human_review',human_review_recorded:false},
    review_history:[],created_at:createdAt,updated_at:createdAt};
  return {operation,source};
}
function run(){
  const args=process.argv.slice(2);const option=name=>args[args.indexOf(name)+1];
  if(!args.includes('--input')||!args.includes('--id'))throw new Error('Usage: node scripts/prepare-contribution.js --input proposal.json --id MAINTAINER_ASSIGNED_ID');
  const id=option('--id');
  const submission=JSON.parse(fs.readFileSync(path.resolve(option('--input')),'utf8').replace(/^\uFEFF/,''));
  const result=prepare(submission,{id,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),createdAt:new Date().toISOString()});
  if(fs.existsSync(path.join(root,'data/operations',id+'.json')))throw new Error(`Existing operation ID: ${id}`);
  const directory=path.join(root,'work/prepared',id);
  if(fs.existsSync(directory))throw new Error(`Prepared proposal already exists: ${id}`);
  fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,id+'.json'),stable(result.operation));
  if(result.source)fs.writeFileSync(path.join(directory,result.source.source_id+'.json'),stable(result.source));
  console.log('Draft prepared under work/prepared/. Review sources, dates, event type and territories before moving it into data/. No publication performed.');
}
if(require.main===module)run();module.exports={prepare};
