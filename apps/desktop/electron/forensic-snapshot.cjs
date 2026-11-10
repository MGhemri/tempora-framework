'use strict';
// M1.5 read-only forensic consistency guard. No authorization, repair or
// durability claim: these are two path-based observations, NOT an atomic
// handle-relative NTFS snapshot. Never follow a link while enumerating.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const ERR=code=>Object.assign(new Error(code),{code});
const MAX_IDENTITIES=100;
const MAX_CHILDREN=16;
function lstat(location){
 try{return fs.lstatSync(location,{bigint:true});}
 catch(error){if(error?.code==='ENOENT')return null;throw error;}
}
function fingerprint(root){
 const hash=createHash('sha256');
 const push=(relative,stat)=>{
  const kind=!stat?'absent':stat.isSymbolicLink()?'link':
    stat.isDirectory()?'directory':stat.isFile()?'file':'other';
  // Include object identity AND change time. A replacement with the same
  // name/type and valid JSON is not necessarily the same evidence.
  const fields=stat?[stat.dev,stat.ino,stat.mode,stat.nlink,stat.size,
    stat.ctimeNs,stat.mtimeNs].map(String):[];
  hash.update(JSON.stringify([relative,kind,...fields])+'\n');
 };
 const rootStat=lstat(root);
 if(!rootStat||!rootStat.isDirectory()||rootStat.isSymbolicLink())
  throw ERR('RECOVERY_SNAPSHOT_ROOT_UNSAFE');
 push('.',rootStat);
 for(const collection of ['transactions','.pending']){
  const parent=path.join(root,collection),parentStat=lstat(parent);
  push(collection,parentStat);
  if(!parentStat)continue;
  if(!parentStat.isDirectory()||parentStat.isSymbolicLink())continue;
  const identities=fs.readdirSync(parent).sort();
  if(identities.length>MAX_IDENTITIES)throw ERR('RECOVERY_REPORT_LIMIT');
  for(const id of identities){
   const candidate=path.join(parent,id),stat=lstat(candidate);
   push(collection+'/'+id,stat);
   if(!stat?.isDirectory()||stat.isSymbolicLink())continue;
   // Only one level inside an identity. Never traverse arbitrary trees.
   const names=fs.readdirSync(candidate).sort();
   if(names.length>MAX_CHILDREN)throw ERR('RECOVERY_REPORT_LIMIT');
   for(const name of names)
    push(collection+'/'+id+'/'+name,lstat(path.join(candidate,name)));
  }
 }
 return hash.digest('hex');
}
module.exports=Object.freeze({fingerprint});
