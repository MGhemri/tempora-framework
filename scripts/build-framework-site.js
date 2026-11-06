const fs = require('node:fs');
const path = require('node:path');
const {parseArgs} = require('node:util');
const md = require('markdown-it')({html:false});
const {openapi} = require('../src/framework/published-openapi');
const {version} = require('../distribution/package.json');

const root = path.join(__dirname,'..');
const repo = 'https://github.com/MGhemri/tempora-framework';
const read = file => fs.readFileSync(path.resolve(root,file),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const sections = read('FRAMEWORK.md').split(/(?=^## )/m);
function section(heading, end) {
  const start=sections.findIndex(part=>part.startsWith('## '+heading+'\n')||part.startsWith('## '+heading+' :'));
  if(start<1)throw Error('Missing framework heading: '+heading);
  const stop=end?sections.findIndex(part=>part.startsWith('## '+end+'\n')):start+1;
  if(stop<=start)throw Error('Invalid framework heading order');
  return sections.slice(start,stop).join('');
}
const local = name => read('docs/site-src/'+name+'.md');
const guides = {
  'getting-started':['Démarrage',local('getting-started')],
  architecture:['Architecture',section('Architecture')],
  profiles:['Profils',section('Valider un profil','Modèle canonique et migration')],
  canonical:['Modèle canonique',read('CANONICAL_MODEL.md')],
  ingestion:['Ingestion',read('INGESTION.md')],
  analysis:['Analyses',read('ANALYSIS.md')],
  review:['Revue',section('Vérifier l’éligibilité d’une proposition v3')],
  publication:['Publication',section('Préparer et activer un snapshot local')],
  api:['API REST v3',section('Consulter des versions publiées par l’API locale')+'\n[Consulter le contrat OpenAPI](../openapi/v3.json)\n'],
  'sdk-cli':['SDK et CLI',section('Installer le SDK et la CLI hors du dépôt')],
  science:['Méthodologie',local('science')],
  alnop:['Compatibilité ALNOP',local('alnop')],
  security:['Sécurité',read('SECURITY.md')]
};
const aliases = {'FRAMEWORK.md':'architecture','CANONICAL_MODEL.md':'canonical','INGESTION.md':'ingestion',
  'ANALYSIS.md':'analysis','SECURITY.md':'security','ALNOP.md':'alnop'};
const frameworkSections = {'valider-un-profil':'profiles','vérifier-léligibilité-dune-proposition-v3':'review',
  'préparer-et-activer-un-snapshot-local':'publication','consulter-des-versions-publiées-par-lapi-locale':'api',
  'installer-le-sdk-et-la-cli-hors-du-dépôt':'sdk-cli'};
const slug = value => value.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu,'').trim().replace(/ +/g,'-');
md.renderer.rules.heading_open = (tokens,index,options,env,self) => {
  tokens[index].attrSet('id',slug(tokens[index+1].content));
  return self.renderToken(tokens,index,options);
};
md.renderer.rules.link_open = (tokens,index,options,env,self) => {
  const link=tokens[index], href=link.attrGet('href');
  const [raw,encoded] = href.split('#',2);
  const file=raw.replace(/^\.\//,'');
  const fragment=encoded&&decodeURIComponent(encoded);
  if (Object.hasOwn(aliases,file)) {
    const guide=(file==='FRAMEWORK.md'&&frameworkSections[fragment])||aliases[file];
    link.attrSet('href',guide+'.html'+(fragment?'#'+fragment:''));
  } else if (file.startsWith('schemas/')) link.attrSet('href','../'+file+(encoded?'#'+encoded:''));
  else if (/^(?:profiles\/|docs\/|[A-Z][A-Z_0-9-]*\.md$)/.test(file)) link.attrSet('href',repo+'/blob/main/'+href);
  return self.renderToken(tokens,index,options);
};
const fence=md.renderer.rules.fence;
md.renderer.rules.fence=(...args)=>'<div class="codebar"><span>Exemple</span><button class="copy" type="button">Copier</button></div>'+fence(...args);

function page(title,body,active) {
  const prefix=active?'../':'';
  const nav=Object.entries(guides).map(([key,[label]])=>`<a class="sidelink${active===key?' active':''}" href="${prefix}guides/${key}.html"${active===key?' aria-current="page"':''}>${label}</a>`).join('\n');
  return `<!doctype html>
<html lang="fr" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · TEMPORA</title><link rel="stylesheet" href="${prefix}assets/site.css"></head><body>
<a class="skip-link" href="#contenu">Aller au contenu</a>
<header class="topbar"><div class="topinner"><a class="brand" href="${prefix}index.html"><span class="brandmark" aria-hidden="true">T</span><span>TEMPORA<span class="brandtail">/ FRAMEWORK</span></span></a>
<nav class="toplinks" aria-label="Navigation principale"><a href="${prefix}index.html">Accueil</a><a href="${prefix}guides/getting-started.html">Documentation</a><a href="${repo}">GitHub</a></nav>
<button class="mobilemenu" id="menu" type="button" aria-controls="sidebar" aria-expanded="false">Menu</button></div></header>
<div class="app"><nav class="sidebar" id="sidebar" aria-label="Guides TEMPORA"><div class="sidecaption">DOCUMENTATION / V3</div>
${nav}
<div class="sidenote">TEMPORA ${version}<br>Préversion locale · MIT</div></nav>
<main class="main" id="contenu"><h1>${title}</h1><div class="article">${body}</div>
<footer><a href="${repo}">Code source TEMPORA</a><a href="mailto:contact@connect-gm.com">Contact</a></footer></main>
</div><script src="${prefix}assets/site.js" defer></script></body></html>
`;
}

function build({check=false,output}={}) {
  const generated = new Map([
    ['index.html',page('TEMPORA — Framework pour les corpus historiques',read('docs/site-src/home.html'))],
    ...Object.entries(guides).map(([key,[title,content]])=>['guides/'+key+'.html',page(title,md.render(content.replace(/^# [^\n]*\n/,'')),key)]),
    ['openapi/v3.json',JSON.stringify(openapi,null,2)+'\n']
  ]);
  const schemas=['tempora.profile.schema.json','tempora.ingestion-mapping.schema.json',
    ...fs.readdirSync(path.join(root,'schemas/tempora/v3')).filter(name=>name.endsWith('.schema.json')).sort().map(name=>'tempora/v3/'+name)];
  if(output){
    for(const file of ['.nojekyll','assets/site.css','assets/site.js']) generated.set(file,read('docs/'+file));
    for(const file of schemas) generated.set('schemas/'+file,read('schemas/'+file));
  }
  const target=output?path.resolve(output):path.join(root,'docs');
  if(output&&fs.existsSync(target)) {
    for(const file of fs.readdirSync(target,{recursive:true})) {
      const full=path.join(target,file), stat=fs.lstatSync(full);
      if(stat.isSymbolicLink() || (stat.isFile()&&!generated.has(file.split(path.sep).join('/'))))
        throw Error('Unexpected file in Pages output: '+file);
    }
  }
  for(const [file,content] of generated){
    const destination=path.join(target,file);
    if(check){if(read(destination)!==content)throw Error('Stale TEMPORA site file: '+file);}
    else{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,content);}
  }
}

if(require.main===module){
  const {values}=parseArgs({options:{check:{type:'boolean'},output:{type:'string'}}});
  if(values.check&&values.output)throw Error('Choose --check or --output');
  build(values);
}
module.exports={build};
