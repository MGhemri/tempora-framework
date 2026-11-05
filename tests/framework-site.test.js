const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {test}=require('node:test');
const {build}=require('../scripts/build-framework-site');
const {openapi}=require('../src/framework/published-openapi');

test('The Pages artifact contains only the TEMPORA site and all local resources resolve',t=>{
  const parent=fs.realpathSync(os.tmpdir());
  const output=fs.mkdtempSync(path.join(parent,'tempora-pages-'));
  t.after(()=>fs.rmSync(output,{recursive:true,force:true}));
  build({output});
  const files=fs.readdirSync(output,{recursive:true}).map(file=>file.split(path.sep).join('/'));
  assert.equal(files.filter(file=>file.endsWith('.html')).length,14);
  assert.ok(!files.some(file=>/^(?:data\/|documentation\/|alnop-compat|atlas|contribute|api\/|site-src)/.test(file)));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output,'openapi/v3.json'),'utf8')),openapi);
  for(const file of files.filter(name=>name.endsWith('.html'))){
    const html=fs.readFileSync(path.join(output,file),'utf8');
    assert.equal([...html.matchAll(/<h1[ >]/g)].length,1,file);
    const from=new URL(file,'https://example.org/tempora-framework/');
    for(const [,href] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
      const target=new URL(href,from);
      if(target.origin!==from.origin)continue;
      assert.ok(target.pathname.startsWith('/tempora-framework/'),href);
      const relative=decodeURIComponent(target.pathname.slice('/tempora-framework/'.length));
      const destination=path.join(output,relative);
      assert.ok(fs.existsSync(destination),file+': '+href);
      if(target.hash&&relative.endsWith('.html')){
        const contents=fs.readFileSync(destination,'utf8');
        assert.ok(contents.includes('id="'+decodeURIComponent(target.hash.slice(1))+'"'),file+': '+href);
      }
    }
  }
});
