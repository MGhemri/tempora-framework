'use strict';
// Internal J2 local session store; zero filesystem, zero network,
// no cross-project access and no persistence. Canonical data never returned.
const {canonical}=require('tempora-framework');
const {randomBytes}=require('node:crypto');
const {build}=require('./projections.cjs');
const {analyze}=require('./algorithms.cjs');
const MAX_CORPUS_BYTES=3*1024*1024;
const TTL_MS=10*60*1000;
function fail(code){const e=new Error(code);e.code=code;throw e;}
class ProjectManager {
  #session=null;
  constructor(clock=()=>Date.now()) {this.clock=clock;}
  create(corpus){
    if(!corpus||typeof corpus!=='object'||Array.isArray(corpus))fail('INVALID_CORPUS');
    let json;
    try {json=canonical.stringify(corpus);} catch {fail('INVALID_CORPUS');}
    if(Buffer.byteLength(json,'utf8')>MAX_CORPUS_BYTES)fail('LIMIT_EXCEEDED');
    const checked=canonical.validateCorpus(corpus);
    if(!checked.valid)fail('CORPUS_NOT_VALIDATED');
    this.release();
    // Isolate caller-owned JSON; the source is never modified.
    const clone=JSON.parse(json);
    const project_id=randomBytes(24).toString('hex');
    this.#session={project_id,corpus:clone,expiry:this.clock()+TTL_MS};
    return {project_id,canonical_sha256:canonical.digest(clone),expires_in_ms:TTL_MS,
      profile_id:clone.profile.id,engine_version:'3.0.0'};
  }
  #get(id){
    if(!/^[a-f0-9]{48}$/.test(id??''))fail('INVALID_PROJECT');
    const session=this.#session;
    if(!session || session.project_id!==id)fail('PROJECT_NOT_FOUND');
    if(this.clock()>=session.expiry){this.release();fail('PROJECT_EXPIRED');}
    return session;
  }
  query(id,{module,offset=0,limit=50}={}){
    const session=this.#get(id);
    const result=build(session.corpus,{module,offset,limit,
      generatedAt:new Date(this.clock()).toISOString()});
    // Renew only after a successful query.
    session.expiry=this.clock()+TTL_MS;
    return result;
  }
  analyze(id,{module,limit=50,threshold=0.6}={}){
    const session=this.#get(id);
    const result=analyze(session.corpus,{module,limit,threshold,
      generatedAt:new Date(this.clock()).toISOString()});
    session.expiry=this.clock()+TTL_MS;
    return result;
  }
  release(id){
    if(id!==undefined&&this.#session && this.#session.project_id!==id)fail('PROJECT_NOT_FOUND');
    this.#session=null;
    return {released:true};
  }
}
module.exports=Object.freeze({ProjectManager,TTL_MS,MAX_CORPUS_BYTES});
