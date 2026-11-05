const http = require('node:http');
const {parseArgs} = require('node:util');
const {createPublicationStore} = require('../src/framework/publication-store');
const {createPublishedCatalog} = require('../src/framework/published-catalog');
const {createPublishedHandler} = require('../src/framework/published-api');

function start(args=process.argv.slice(2)) {
  const {values} = parseArgs({args,options:{store:{type:'string'},profile:{type:'string',multiple:true},port:{type:'string'},'cors-origin':{type:'string'}}});
  const profiles = values.profile ?? [];
  if ((profiles.length>0)!==Boolean(values.store) || profiles.length>20) throw Error('Supply --store with up to 20 explicit --profile IDs');
  const port = Number(values.port ?? '8787');
  if (!Number.isSafeInteger(port)||port<1||port>65535) throw Error('Invalid port');
  const store = values.store ? createPublicationStore(values.store) : null;
  const entries = profiles.map(profile => {
    const entry = store.readPublished(profile);
    if (!entry) throw Error('Selected profile has no activated release');
    return entry;
  });
  const server = http.createServer(createPublishedHandler(createPublishedCatalog(entries),{corsOrigin:values['cors-origin']}));
  server.listen(port,'127.0.0.1',()=>console.log('TEMPORA API on http://127.0.0.1:'+port+'/health'));
  return server;
}

if(require.main===module){
  try{start();}catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={start};
