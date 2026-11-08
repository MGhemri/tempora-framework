'use strict';
// Two independent user-supplied, validated TEMPORA v3 corpus snapshots.
// Coverage metrics measure documentation in these files, NOT historic completeness.
const {canonical}=require('tempora-framework');
const {refKey}=require('./contracts.cjs');
const COLLECTIONS=Object.freeze(['events','sources','claims','entities','spatial_assertions',
  'relations','reviews','assessments','releases']);
const MAX_RECORDS=100000;
function fail(code){const e=new Error(code);e.code=code;throw e;}
function count(c,name){return Array.isArray(c[name])?c[name].length:0;}
function inventory(c){
  const collections={};
  for(const name of COLLECTIONS)collections[name]=count(c,name);
  return collections;
}
function identifiers(c){
  const result=new Map();
  for(const collection of COLLECTIONS) {
    const ids=new Set();
    for(const record of c[collection]??[]){
      if(!record||typeof record!=='object')fail('INVALID_RECORD');
      const key=refKey({kind:record.kind,namespace:record.namespace,id:record.id});
      ids.add(key);
    }
    result.set(collection,ids);
  }
  return result;
}
function compare(previous,current){
  for(const c of [previous,current]){
    if(!c||typeof c!=='object'||Array.isArray(c))fail('INVALID_CORPUS');
    if(COLLECTIONS.reduce((n,k)=>n+count(c,k),0)>MAX_RECORDS)fail('SNAPSHOT_LIMIT');
    if(!canonical.validateCorpus(c).valid)fail('CORPUS_NOT_VALIDATED');
  }
  const leftHash=canonical.digest(previous),rightHash=canonical.digest(current);
  const left=inventory(previous),right=inventory(current);
  const leftIds=identifiers(previous),rightIds=identifiers(current);
  const summary=COLLECTIONS.map(collection=>{
    const a=leftIds.get(collection),b=rightIds.get(collection);
    let added=0,removed=0;
    for(const id of b)if(!a.has(id))added++;
    for(const id of a)if(!b.has(id))removed++;
    return {collection,previous:left[collection],current:right[collection],
      delta:right[collection]-left[collection],added_ids:added,removed_ids:removed,
      historical_completeness:'unknown'};
  });
  const stable={algorithm:{id:'tvrw.observatory.snapshot-diff',version:'1.0.0'},
    previous:{canonical_sha256:leftHash,profile_id:previous.profile.id},
    current:{canonical_sha256:rightHash,profile_id:current.profile.id},
    measurement:'declared_documentation_only',rows:summary};
  return {...stable,scientific_sha256:canonical.digest(stable)};
}
module.exports=Object.freeze({compare,COLLECTIONS,MAX_RECORDS});
