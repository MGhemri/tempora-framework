const fs=require('node:fs'),path=require('node:path');
const {resolveProfile,ProfileError}=require('./profile');
function loadProfile(file,options={}){
 if(typeof file!=='string'||!file.trim()||!options||typeof options!=='object'||Array.isArray(options))throw new ProfileError('PROFILE_ARGUMENT_INVALID','Profile loading requires a file path and an options object');
 const {rootDirectory=path.dirname(path.resolve(file)),parameters={},severities={}}=options;
 if(typeof rootDirectory!=='string'||!rootDirectory.trim())throw new ProfileError('PROFILE_ROOT_INVALID','Profile root must be a directory path');
 let root;try{root=fs.realpathSync(rootDirectory);}catch{throw new ProfileError('PROFILE_ROOT_INVALID','Profile root is unavailable');}
 const active=new Set();
 function read(candidate,depth=0){
  let real;try{real=fs.realpathSync(candidate);}catch{throw new ProfileError('PROFILE_READ_FAILED','Profile file is unavailable');}
  const relative=path.relative(root,real);if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))throw new ProfileError('PROFILE_PATH_DENIED','Profile path escapes its explicit root');
  if(active.has(real)||depth>16)throw new ProfileError('PROFILE_INHERITANCE_CYCLE','Cyclic or excessive profile inheritance');
  if(path.extname(real).toLowerCase()!=='.json'||!fs.statSync(real).isFile()||fs.statSync(real).size>131072)throw new ProfileError('PROFILE_FILE_INVALID','Profile must be a JSON file of at most 128 KiB');
  let manifest;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(real)).replace(/^\uFEFF/,''));}catch{throw new ProfileError('PROFILE_JSON_INVALID','Profile must contain valid UTF-8 JSON');}
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw new ProfileError('PROFILE_SCHEMA_INVALID','Profile must be an object');
  active.add(real);let parent={};if(Object.hasOwn(manifest,'extends')){if(typeof manifest.extends!=='string'||!manifest.extends.trim())throw new ProfileError('PROFILE_PARENT_INVALID','Parent must be a relative JSON path');if(path.isAbsolute(manifest.extends))throw new ProfileError('PROFILE_PATH_DENIED','Absolute parent paths are not accepted');parent=read(path.resolve(path.dirname(real),manifest.extends),depth+1);}
  active.delete(real);return resolveProfile(manifest,{parent});
 }
 return resolveProfile(read(path.resolve(file)),{parameters,severities});
}
function discoverProfiles(directory){
 let entries;try{entries=fs.readdirSync(directory,{withFileTypes:true});}catch{throw new ProfileError('PROFILE_ROOT_INVALID','Profile directory is unavailable');}
 const profiles=entries.filter(e=>e.isDirectory()).map(e=>path.join(directory,e.name,'profile.json')).filter(file=>fs.existsSync(file)).sort().map(file=>loadProfile(file,{rootDirectory:directory}));
 if(new Set(profiles.map(p=>p.id)).size!==profiles.length||new Set(profiles.map(p=>p.namespace)).size!==profiles.length)throw new ProfileError('PROFILE_REGISTRY_DUPLICATE','Profile identifiers and namespaces must be unique within a registry');
 return profiles;
}
module.exports={loadProfile,discoverProfiles};
