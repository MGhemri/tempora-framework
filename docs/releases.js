(()=>{
  let lang=localStorage.getItem('aln_lang')==='ar'?'ar':'fr',index=null,manifest=null,failed=false;
  const labels={fr:{title:'Versions des données',notice:'Corpus documentaire incomplet. Ces archives figent une publication technique et ne constituent pas une nouvelle validation historique.',guide:'Comprendre et reproduire une version',loading:'Chargement des versions…',empty:'Aucune version archivée pour le moment.',failure:'Impossible de charger les versions. Réessayez ultérieurement.',current:'Version correspondant aux données courantes du site',unarchived:'Les données courantes du site ne correspondent à aucune archive publiée.',records:'Fiches',date:'Publication UTC',commit:'Commit source',hash:'Empreinte SHA-256 de l’archive',zip:'Télécharger l’archive ZIP',metadata:'Manifeste',citation:'Citation CFF',changes:'Journal des changements',checksum:'Empreinte à télécharger',cite:'Citation académique recommandée',technical:'Publication technique du corpus existant ; réserves historiques conservées.'},
    ar:{title:'إصدارات البيانات',notice:'مجموعة وثائقية غير مكتملة. تحفظ هذه الأرشيفات إصداراً تقنياً ولا تمثل تحققاً تاريخياً جديداً.',guide:'فهم الإصدار وإعادة إنتاجه',loading:'جارٍ تحميل الإصدارات…',empty:'لا يوجد إصدار مؤرشف حالياً.',failure:'تعذر تحميل الإصدارات. يرجى المحاولة لاحقاً.',current:'الإصدار المطابق للبيانات الحالية للموقع',unarchived:'لا تطابق بيانات الموقع الحالية أي أرشيف منشور.',records:'البطاقات',date:'النشر بالتوقيت العالمي',commit:'معرّف التعديل المصدر',hash:'بصمة الأرشيف SHA-256',zip:'تنزيل أرشيف ZIP',metadata:'بيان الإصدار',citation:'الاستشهاد CFF',changes:'سجل التغييرات',checksum:'تنزيل البصمة',cite:'الاستشهاد الأكاديمي المقترح',technical:'نشر تقني للمجموعة الحالية مع الاحتفاظ بالتحفظات التاريخية.'}};
  const node=(tag,text,parent)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(parent)parent.append(el);return el;};
  function render(){
    const t=labels[lang];document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    document.getElementById('release-language').textContent=lang==='ar'?'Français':'العربية';
    for(const [id,key]of [['release-title','title'],['release-notice','notice'],['release-guide','guide']])document.getElementById(id).textContent=t[key];
    const list=document.getElementById('release-list'),status=document.getElementById('release-status');list.replaceChildren();
    if(failed){status.textContent=t.failure;return;}if(!index){status.textContent=t.loading;return;}
    if(!index.releases.length){status.textContent=t.empty;return;}
    const current=index.releases.find(r=>r.canonical_sha256===manifest?.canonical_sha256&&r.snapshot_manifest_sha256===manifest?._bytes_sha256);
    status.textContent=current?t.current+' : '+current.id:t.unarchived;
    for(const r of index.releases){
      const article=node('article',undefined,list);article.className='release-card';node('h2',r.id,article).dir='ltr';
      node('p',r.summary,article).dir='auto';node('p',t.technical,article);
      const dl=node('dl',undefined,article);
      for(const [label,value]of [[t.date,r.published_at],[t.records,String(r.total)],[t.commit,r.source_commit],[t.hash,r.archive_sha256]]){node('dt',label,dl);const dd=node('dd',value,dl);dd.dir='ltr';dd.style.overflowWrap='anywhere';}
      const links=node('p',undefined,article);
      for(const [key,file]of [['zip','alnop-'+r.id+'.zip'],['metadata','release.json'],['citation','CITATION.cff'],['changes','CHANGELOG.md'],['checksum','archive.sha256']]){
        if(links.childNodes.length)links.append(document.createTextNode(' · '));
        const a=node('a',t[key],links);a.href='data/releases/'+encodeURIComponent(r.id)+'/'+file;a.setAttribute('download','');
      }
      node('h3',t.cite,article);
      const citation=node('p',`ALNOP (${r.published_at.slice(0,4)}). ALN Historical Operations Dataset (1954–1962), ${r.id}. SHA-256: ${r.archive_sha256}. https://alnop.vercel.app/data/releases/${r.id}/release.json`,article);citation.dir='ltr';
    }
  }
  document.getElementById('release-language').addEventListener('click',()=>{lang=lang==='fr'?'ar':'fr';localStorage.setItem('aln_lang',lang);render();});
  render();
  Promise.all([fetch('data/releases/index.json').then(r=>{if(!r.ok)throw Error();return r.json();}),fetch('data/canonical/dataset-manifest.json').then(async r=>{
    if(!r.ok)throw Error();const bytes=await r.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);return {...JSON.parse(new TextDecoder().decode(bytes)),_bytes_sha256:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')};
  })]).then(([i,m])=>{if(!Array.isArray(i.releases)||i.releases.some(r=>!/^data-\d{4}\.(0[1-9]|1[0-2])\.[1-9]\d*$/.test(r.id)))throw Error();index=i;manifest=m;render();}).catch(()=>{failed=true;render();});
})();
