const fs=require('node:fs');
const path=require('node:path');
const docs=path.join(__dirname,'../docs');
if(!fs.existsSync(path.join(docs,'atlas.html')))throw new Error('Build documentation before preparing Pages.');
fs.copyFileSync(path.join(docs,'tempora.html'),path.join(docs,'index.html'));
console.log('GitHub Pages: TEMPORA homepage and ALNOP atlas prepared.');
