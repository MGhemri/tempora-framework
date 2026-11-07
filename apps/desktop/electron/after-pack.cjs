'use strict';
// Explicitly preserve the bundled canonical TEMPORA Engine dependencies in
// Electron NSIS. Electron Builder can exclude nested node_modules from generic
// extraResources file matchers. Copy from the existing SHA-audited Windows
// staging directory and fail instead of publishing a broken installer.
const {cpSync, existsSync, readFileSync, mkdirSync} = require('node:fs');
const {resolve, join} = require('node:path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const source = resolve(__dirname, '..', 'src-tauri', 'resources', 'engine', 'node_modules');
  const enginePkg = join(source, 'tempora-framework', 'package.json');
  if (!existsSync(enginePkg)) throw Error('TEMPORA_ELECTRON_STAGED_SDK_MISSING');
  const sdk = JSON.parse(readFileSync(enginePkg, 'utf8'));
  if (sdk.version !== '3.0.0') throw Error('TEMPORA_ELECTRON_SDK_VERSION_MISMATCH');
  const dest = join(context.appOutDir, 'resources', 'engine', 'node_modules');
  mkdirSync(dest, {recursive: true});
  cpSync(source, dest, {recursive: true, force: true, errorOnExist: false});
  if (!existsSync(join(dest, 'tempora-framework', 'package.json'))) {
    throw Error('TEMPORA_ELECTRON_PACKAGED_SDK_MISSING');
  }
};
