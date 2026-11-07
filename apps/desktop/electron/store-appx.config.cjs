'use strict';
// Store identity values are *public* Partner Center package identifiers.
// They are not credentials, publisher private keys, or signing certificates.
// Fail closed if an environment override conflicts with the reserved product.
const pkg = require('./package.json');
const STORE_IDENTITY = Object.freeze({
  identityName: 'GhemriM.TEMPORADesktop',
  publisher: 'CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455',
  publisherDisplayName: 'Ghemri M'
});
for (const [key, envKey] of [
  ['identityName', 'TEMPORA_STORE_IDENTITY_NAME'],
  ['publisher', 'TEMPORA_STORE_PUBLISHER'],
  ['publisherDisplayName', 'TEMPORA_STORE_PUBLISHER_DISPLAY_NAME']
]) {
  const supplied = process.env[envKey];
  if (supplied !== undefined && supplied !== STORE_IDENTITY[key]) {
    throw Error('MICROSOFT_STORE_PARTNER_CENTER_IDENTITY_MISMATCH: ' + envKey);
  }
}
if (pkg.build.productName !== 'TEMPORA Desktop') {
  throw Error('MICROSOFT_STORE_PRODUCT_NAME_MISMATCH');
}
// Do not inherit NSIS-specific filename "*SETUP.exe" into the AppX target.
const {artifactName: _nsisArtifact, ...winWithoutNsisName} = pkg.build.win;
module.exports = {
  ...pkg.build,
  directories: {...pkg.build.directories, output: 'store-candidate'},
  win: {
    ...winWithoutNsisName,
    target: ['appx'],
    artifactName: 'TEMPORA-Desktop-${version}-${arch}.${ext}'
  },
  appx: {
    ...STORE_IDENTITY,
    applicationId: 'TEMPORA',
    artifactName: 'TEMPORA-Desktop-${version}-${arch}.${ext}',
    displayName: 'TEMPORA Desktop',
    backgroundColor: '#ffffff',
    languages: ['fr-FR', 'en-US'],
    capabilities: ['runFullTrust']
  }
};
