const {loadProfile}=require('../../src/framework/profile-loader');
const path=require('node:path');
const {temporal}=require('../../src/framework/temporal');
function nativeCorpus(){
 const profile=loadProfile(path.join(__dirname,'../fixtures/profiles/synthetic-history/profile.json'),{rootDirectory:path.join(__dirname,'..')});
 const namespace=profile.namespace;
 const ref=(kind,id)=>({kind,namespace,id});
 const base=(kind,id)=>({schema_version:'3.0.0',kind,id,namespace,editorial_status:'proposed',provenance:{evidence:[],transformations:[]},extensions:{synthetic:{notice:'Fictional validation data'}}});
 const event={...base('event','EXAMPLE_1'),title:{en:'Fictional assembly',es:'Asamblea ficticia'},description:{en:null},start_date:temporal('1700'),end_date:temporal(null),event_type:['reunión ficticia'],spatial_refs:[],territory_refs:[],participant_refs:[],review_refs:[]};
 const source={...base('source','DOCUMENT_1'),title:{en:'Fictional document'},url:'https://example.org/synthetic',classification:null,review_refs:[]};
 event.provenance.evidence=[{source:ref('source',source.id),locator:'p. 1, fictional',quotation:null}];
 const claim={...base('claim','ASSERTION_1'),subject:ref('event',event.id),predicate:'attendance',value:0,unit:null,context:null,assertion_status:'unverified',contradicts:[],review_refs:[]};claim.provenance.evidence=structuredClone(event.provenance.evidence);
 return {schema_version:'3.0.0',profile,taxonomies:{event_types:['fictional assembly'],territorial_units:[]},events:[event],sources:[source],claims:[claim],entities:[],spatial_assertions:[],relations:[],reviews:[],assessments:[],releases:[],extensions:{synthetic:{historical:false}}};
}
module.exports={nativeCorpus};
