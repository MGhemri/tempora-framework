const {nativeCorpus}=require('./tempora');
const {temporal}=require('../../src/framework/temporal');

function referenceCorpus(){
  const corpus=nativeCorpus(),seed=corpus.events[0],claim=corpus.claims[0],namespace=corpus.profile.namespace;
  const event=(id,title,start='1700')=>({...structuredClone(seed),id,title,start_date:temporal(start)});
  corpus.events=[
    event('EVENT_A',{en:'Harbour assembly'}),
    event('EVENT_B',{en:'Harbor assembly'}),
    event('EVENT_C',{es:'Reunión portuaria'}),
    event('EVENT_D',{en:'Harbour assembly'},'1750'),
    event('EVENT_E',{en:'Harvest ledger'})
  ];
  const entity=(id,label,names=[])=>({
    schema_version:'3.0.0',id,namespace,kind:'entity',editorial_status:'proposed',entity_type:'person',
    label,names,valid_from:temporal(null),valid_to:temporal(null),spatial_refs:[],review_refs:[],
    provenance:structuredClone(seed.provenance),extensions:{}
  });
  const variant={language:'es',value:'Ana Ríos',role:'variant',valid_from:temporal('1690'),valid_to:temporal('1720'),
    evidence:structuredClone(seed.provenance.evidence)};
  corpus.entities=[
    entity('PERSON_A',{en:'Anne Rivers'},[variant]),
    entity('PERSON_B',{es:'Ana Ríos'}),
    entity('PERSON_C',{es:'Ana Rios'}),
    entity('PERSON_D',{en:'Charles Stone'})
  ];
  const assertion=(id,value,unit='persons')=>({...structuredClone(claim),id,subject:{kind:'event',namespace,id:'EVENT_A'},
    value,unit,context:{scope:'attendance',population:'attendees',time_scope:'entire_event',start_date:temporal(null),end_date:temporal(null)}});
  corpus.claims=[
    assertion('COUNT_A',10),assertion('COUNT_B',20),assertion('COUNT_C',{type:'interval',lower:8,upper:12}),
    assertion('COUNT_D',20,'households'),assertion('COUNT_E',null)
  ];
  return corpus;
}
module.exports={referenceCorpus};
