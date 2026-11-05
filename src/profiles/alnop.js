const path=require('node:path');
const {loadProfile}=require('../framework/profile-loader');
const {createValidator}=require('../framework/validation');
function load(root){return loadProfile(path.join(root,'profiles/alnop/profile.json'),{rootDirectory:root});}
function validate(corpus,profile){
 const validator=createValidator(profile,{taxonomies:{event_types:corpus.vocabularies.event_types,territorial_units:corpus.territorial_units.map(t=>t.id)}});
 return corpus.operations.map(op=>({id:op.id,...validator.validate({id:op.id,start_date:op.start_date,end_date:op.end_date,event_type:op.event_type||[op.legacy?.type_action].filter(Boolean),territory_ids:op.territorial_assignments.map(t=>t.territory_id)})}));
}
module.exports={load,validate};
