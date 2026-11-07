'use strict';
// Electron-only native authority for TEMPORA's ephemeral scientific workspace.
// The renderer NEVER gets the corpus, filesystem paths, Node process, or project ID.
const {spawn}=require('node:child_process');
const {StringDecoder}=require('node:string_decoder');
const MODULES=Object.freeze(['geo','graph','chronos','evidence','pattern','observatory']);
const MAX_FRAME=256*1024;
const MAX_REQUEST=4*1024*1024;
class VisualService {
  constructor(getRuntime) {this.getRuntime=getRuntime;this.child=null;this.pending=new Map();this.serial=0;this.buffer='';this.decoder=new StringDecoder('utf8');this.projectId=null;}
  start(){
    if(this.child)return;
    const runtime=this.getRuntime();
    const child=spawn(runtime.node,[runtime.worker],{
      cwd:runtime.base,windowsHide:true,shell:false,
      env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!['NODE_OPTIONS','NODE_PATH'].includes(k))),
      stdio:['pipe','pipe','ignore']
    });
    this.child=child;this.buffer='';this.decoder=new StringDecoder('utf8');
    const die=(code)=>{
      for(const [,pending] of this.pending){clearTimeout(pending.timer);pending.reject(Error(code));}
      this.pending.clear();this.child=null;this.projectId=null;this.buffer='';
    };
    child.on('error',()=>die('VISUAL_WORKER_START_FAILED'));
    child.on('close',()=>die('VISUAL_WORKER_EXITED'));
    child.stdout.on('data',bytes=>{
      if(!this.child)return;
      this.buffer+=this.decoder.write(bytes);
      if(Buffer.byteLength(this.buffer,'utf8')>MAX_FRAME*2){this.stop();return;}
      let idx;
      while((idx=this.buffer.indexOf('\n'))!==-1){
        const line=this.buffer.slice(0,idx);this.buffer=this.buffer.slice(idx+1);
        if(Buffer.byteLength(line,'utf8')>MAX_FRAME){this.stop();return;}
        let response;
        try{response=JSON.parse(line);}catch{this.stop();return;}
        const pending=this.pending.get(response.request_id);
        if(!pending)continue;
        clearTimeout(pending.timer);
        this.pending.delete(response.request_id);
        if(response.protocol_version!=='2.0.0' || response.ok!==true){
          pending.reject(Error(response.error?.code??'VISUAL_PROTOCOL_ERROR'));
        } else pending.resolve(response.result);
      }
    });
  }
  request(operation,payload){
    this.start();
    if(this.pending.size) return Promise.reject(Error('VISUAL_WORKER_BUSY'));
    const request_id='tvrw_'+(++this.serial);
    const bytes=Buffer.from(JSON.stringify({protocol_version:'2.0.0',request_id,operation,payload})+'\n');
    if(bytes.length>MAX_REQUEST)return Promise.reject(Error('VISUAL_REQUEST_LIMIT'));
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.stop();reject(Error('VISUAL_WORKER_TIMEOUT'));},15000);
      this.pending.set(request_id,{resolve,reject,timer});
      this.child.stdin.write(bytes,err=>{
        if(err){clearTimeout(timer);this.pending.delete(request_id);reject(Error('VISUAL_WORKER_WRITE_FAILED'));}
      });
    });
  }
  async create(corpus){
    // A new selected corpus revokes the old workspace.
    if(this.projectId)await this.release();
    const result=await this.request('visualization.project.create',{corpus});
    this.projectId=result.project_id;
    const {project_id,...safe}=result;
    return safe;
  }
  query(module,offset=0,limit=50){
    if(!this.projectId)throw Error('VISUAL_PROJECT_NOT_OPEN');
    if(!MODULES.includes(module))throw Error('VISUAL_MODULE_INVALID');
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)
      throw Error('VISUAL_PAGE_INVALID');
    return this.request('visualization.project.query',{project_id:this.projectId,module,offset,limit});
  }
  analyze(module,limit=50,threshold=0.6){
    if(!this.projectId)throw Error('VISUAL_PROJECT_NOT_OPEN');
    if(!MODULES.includes(module))throw Error('VISUAL_MODULE_INVALID');
    if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw Error('VISUAL_ANALYSIS_LIMIT');
    if(typeof threshold!=='number'||threshold<0||threshold>1)throw Error('VISUAL_THRESHOLD_INVALID');
    return this.request('visualization.analysis.run',{project_id:this.projectId,module,limit,threshold});
  }
  prepareExport(module,format,offset=0,limit=50){
    if(!this.projectId)throw Error('VISUAL_PROJECT_NOT_OPEN');
    if(!MODULES.includes(module))throw Error('VISUAL_MODULE_INVALID');
    if(!['json','geojson','csv','graphml'].includes(format))throw Error('VISUAL_EXPORT_FORMAT');
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>50)
      throw Error('VISUAL_EXPORT_PAGE');
    return this.request('visualization.export.prepare',
      {project_id:this.projectId,module,format,offset,limit});
  }
  async release(){
    const id=this.projectId;this.projectId=null;
    if(id&&this.child)await this.request('visualization.project.release',{project_id:id});
    return true;
  }
  stop(){
    const child=this.child;this.child=null;this.projectId=null;
    if(child)child.kill();
    for(const [,pending] of this.pending){clearTimeout(pending.timer);pending.reject(Error('VISUAL_WORKER_CLOSED'));}
    this.pending.clear();this.buffer='';
  }
}
module.exports={VisualService,MODULES};
