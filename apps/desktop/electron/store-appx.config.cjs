'use strict';
// Microsoft Store packaging for the currently pinned electron-builder 26.18.
// AppX is an MSIX-family Store package. The Store signs it AFTER certification.
// Never invent the Store identity. Never label this candidate "signed".
const pkg=require('./package.json');
const required=(name)=>{
  const value=process.env[name];
  if(typeof value!=='string' || value.length<3 || value.length>200) {
    throw Error('MICROSOFT_STORE_PARTNER_CENTER_IDENTITY_REQUIRED: '+name);
  }
  return value;
};
const identityName=required('TEMPORA_STORE_IDENTITY_NAME');
const publisher=required('TEMPORA_STORE_PUBLISHER');
const publisherDisplayName=required('TEMPORA_STORE_PUBLISHER_DISPLAY_NAME');
if(!/^[A-Za-z0-9][A-Za-z0-9.-]{2,49}$/.test(identityName) ||
  !/^CN=/.test(publisher) || /[\r\n\0]/.test(publisher) ||
  /[\r\n\0]/.test(publisherDisplayName)) {
  throw Error('MICROSOFT_STORE_IDENTITY_INVALID');
}
module.exports={
  ...pkg.build,
  directories:{...pkg.build.directories,output:'store-candidate'},
  win:{...pkg.build.win,target:['appx']},
  appx:{
    identityName,publisher,publisherDisplayName,
    applicationId:'TEMPORA',
    displayName:'TEMPORA Desktop',
    backgroundColor:'#ffffff',
    languages:['en-US','fr-FR'],
    capabilities:['runFullTrust']
  }
};
