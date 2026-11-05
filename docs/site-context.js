/* Repository navigation is available only on GitHub Pages, never on Vercel/custom domains. */
(() => {
  const githubPages=location.hostname==='github.io'||location.hostname.endsWith('.github.io');
  window.ALNOP_SITE=Object.freeze({githubPages});
  document.documentElement.classList.toggle('standalone-site',!githubPages);
  function enforce(){
    if(githubPages){
      document.querySelectorAll('[data-github-href]').forEach(link=>{
        if(link.getAttribute('href')!==link.dataset.githubHref)link.href=link.dataset.githubHref;
        link.hidden=false;
      });
      return;
    }
    document.querySelectorAll('a[href]').forEach(link=>{
      let url;try{url=new URL(link.getAttribute('href'),location.href);}catch{return;}
      if(!['github.com','www.github.com','raw.githubusercontent.com'].includes(url.hostname))return;
      const file=url.pathname.split('/').pop();
      const local={'INGESTION.md':'ingestion.html','CANONICAL_MODEL.md':'model.html','ALNOP.md':'alnop.html','FRAMEWORK.md':'framework.html','METHODOLOGIE.md':'methodology.html','API.md':'api.html','CONTRIBUTING.md':'contributing.html',
        'EDITORIAL_POLICY.md':'editorial.html','CODE_OF_CONDUCT.md':'conduct.html',
        'PROVENANCE_POLICY.md':'provenance.html','DATA_DICTIONARY.md':'dictionary.html','ENTITY_REVIEW_GUIDE.md':'entities.html','API_V2.md':'api-v2.html','RELEASE_POLICY.md':'releases.html','OBSERVATORY.md':'observatory.html','ASSISTANCE.md':'assistance.html'}[file];
      if(local)link.href=new URL(`documentation/${local}`,document.querySelector('script[src*="site-context.js"]').src).href;
      else {link.hidden=true;link.removeAttribute('href');}
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('[data-framework-presentation]').forEach(node=>{node.hidden=!githubPages;});
    document.querySelectorAll('[data-profile-presentation]').forEach(node=>{node.hidden=githubPages;});
    if(githubPages)document.querySelectorAll('[data-atlas-link]').forEach(link=>{link.href=new URL('../atlas.html',location.href).href;});
    enforce();new MutationObserver(enforce).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
  });
})();
