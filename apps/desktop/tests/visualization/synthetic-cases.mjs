// J1B synthetic, nonhistorical corpus factory. Do not import real research data.
// All case names describe test conditions, never asserted historical facts.
const BASE_PROFILE = {
  profile_schema_version:'1.0.0',version:'1.0.0',id:'synthetic-history',
  display_name:'Synthetic history — testing only',namespace:'SYNTHETIC_HISTORY',
  framework:'>=3.0.0 <4.0.0',default_locale:'en',locales:['en','es'],
  time:{calendar:'gregorian',coverage:{earliest:'1600-01-01',latest:'1899-12-31'}},
  spatial:{crs:'EPSG:4326'},taxonomies:['event_types'],
  aliases:[{taxonomy:'event_types',language:'es',value:'reunión ficticia',canonical:'fictional assembly'}],
  parameters:{coverage:{from_year:1600,to_year:1899}},
  rules:[{id:'event-id',type:'required',field:'id',severity:'error'},
    {id:'date-window',type:'date_range',field:'start_date',severity:'error'},
    {id:'event-type',type:'vocabulary',field:'event_type',taxonomy:'event_types',severity:'warning'}],
  exports:['json','csv']
};
const DATE = {kind:'exact',calendar:'gregorian',original:'1784-06-12',
  earliest:'1784-06-12',latest:'1784-06-12',precision:'day',certainty:'documented'};
const PROVENANCE = {evidence:[],transformations:[]};
export function baseCorpus() {
  return {
    schema_version:'3.0.0',profile:structuredClone(BASE_PROFILE),
    events:[{schema_version:'3.0.0',id:'EVENT_001',namespace:'SYNTHETIC_HISTORY',
      editorial_status:'proposed',provenance:structuredClone(PROVENANCE),extensions:{},
      kind:'event',title:{en:'Fictional scientific assembly'},
      description:{en:'Invented historical event solely for tests'},
      start_date:structuredClone(DATE),end_date:structuredClone(DATE),
      event_type:['fictional assembly'],spatial_refs:[],territory_refs:[],
      participant_refs:[],review_refs:[]}],
    sources:[],claims:[],entities:[],spatial_assertions:[],relations:[],
    reviews:[],assessments:[],releases:[],extensions:{},
    taxonomies:{event_types:['fictional assembly']}
  };
}
const date = (original,earliest,latest,precision) => ({
  kind:'exact',calendar:'gregorian',original,earliest,latest,precision,certainty:'documented'
});
function spatial(c,geometry,role,precision=null){
  const ev=c.events[0], id='SPACE_001';
  c.spatial_assertions.push({
    schema_version:'3.0.0',kind:'spatial',namespace:ev.namespace,id,
    editorial_status:'proposed',provenance:structuredClone(PROVENANCE),extensions:{},
    subject:{kind:'event',namespace:ev.namespace,id:ev.id},
    label:null,geometry,crs:'EPSG:4326',geometry_role:role,
    precision_meters:precision,geocoding_method:null,reference_version:null,place:null
  });
  ev.spatial_refs=[{kind:'spatial',namespace:ev.namespace,id}];
}
export const SYNTHETIC_CASES=Object.freeze([
  {id:'SYN-01',purpose:'baseline valid nonmilitary corpus',expectedValid:true,make:()=>baseCorpus()},
  {id:'SYN-02',purpose:'year-only civil date retains interval precision',expectedValid:true,make:()=>{
    const c=baseCorpus();c.events[0].start_date=date('1784','1784-01-01','1784-12-31','year');
    c.events[0].end_date=date('1784','1784-01-01','1784-12-31','year');return c;
  }},
  {id:'SYN-03',purpose:'west longitude and approximate location',expectedValid:true,make:()=>{
    const c=baseCorpus();spatial(c,{type:'Point',coordinates:[-1.5,35.1]},'approximate_site',null);return c;
  }},
  {id:'SYN-04',purpose:'missing declared evidence is not a false claim',expectedValid:true,make:()=>{
    const c=baseCorpus();c.events[0].provenance.evidence=[];return c;
  }},
  {id:'SYN-05',purpose:'stable identity across record kinds',expectedValid:true,make:()=>baseCorpus()},
  {id:'SYN-06',purpose:'cross-namespace identity distinct from raw id',expectedValid:true,make:()=>baseCorpus()},
  {id:'SYN-07',purpose:'Spanish language labels, unchanged original',expectedValid:true,make:()=>{
    const c=baseCorpus();c.events[0].title.es='Reunión completamente ficticia';return c;
  }},
  {id:'SYN-08',purpose:'invalid duplicate canonical event',expectedValid:false,make:()=>{
    const c=baseCorpus();c.events.push(structuredClone(c.events[0]));return c;
  }},
  {id:'SYN-09',purpose:'invalid impossible latitude',expectedValid:false,make:()=>{
    const c=baseCorpus();spatial(c,{type:'Point',coordinates:[10,91]},'approximate_site',null);return c;
  }},
  {id:'SYN-10',purpose:'invalid canonical schema version',expectedValid:false,make:()=>{
    const c=baseCorpus();c.events[0].schema_version='2.0.0';return c;
  }},
  {id:'SYN-11',purpose:'invalid date outside profile coverage',expectedValid:false,make:()=>{
    const c=baseCorpus();c.events[0].start_date=date('1500-06-12','1500-06-12','1500-06-12','day');return c;
  }},
  {id:'SYN-12',purpose:'unknown time represented without invented precision',expectedValid:true,make:()=>{
    const c=baseCorpus();c.events[0].start_date={
      kind:'unknown',calendar:'gregorian',original:null,earliest:null,
      latest:null,precision:'unknown',certainty:'unknown'
    };c.events[0].end_date={...c.events[0].start_date};return c;
  }}
]);
