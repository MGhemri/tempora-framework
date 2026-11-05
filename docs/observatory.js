(()=>{
'use strict';
const model=globalThis.ALNOPCoverage,query=globalThis.ALNOPQuery;
const fields={q:'obs-q',from:'obs-from',to:'obs-to',territory:'obs-territory',type:'obs-type',date_precision:'obs-precision',has_geometry:'obs-geometry'};
const text={fr:{title:'Observatoire documentaire',notice:'Ces indicateurs décrivent les fiches recensées dans ALNOP, pas l’intensité réelle des opérations ni la couverture historique de la guerre.',classificationNotice:'Un classement primaire absent ne signifie pas qu’aucune source primaire n’existe. Les catégories territoriales héritées ne sont pas des attributions structurées validées.',guide:'Méthode et définitions',filters:'Sélection documentaire',search:'Titre ou description',from:'À partir de',to:'Jusqu’à',territory:'Territoire structuré',eventType:'Type documenté',precision:'Précision du début',geometry:'Géométrie enregistrée',group:'Regrouper le tableau',apply:'Appliquer',reset:'Réinitialiser',summary:'État de la sélection',uncertaintyNotice:'Les incertitudes et l’absence de trace de revue ne sont pas des scores de vérité. Une fiche peut cumuler plusieurs réserves.',tableTitle:'Répartition documentaire',domainNotice:'Pour cette plage supérieure à 200 ans, seules les années enregistrées sont affichées.',json:'Exporter la sélection JSON',csv:'Exporter le tableau CSV',reproduce:'Reproduire cette sélection',loading:'Chargement et vérification du corpus…',loadError:'Impossible de vérifier les données publiées. Rechargez la page pour réessayer.',filterError:'Filtres invalides. Vérifiez les dates et les valeurs de sélection ; aucun résultat n’est affiché.',empty:'Aucune fiche actuellement recensée pour cette sélection.',selection:'Fiches dans la sélection :',all:'Toutes les valeurs',day:'Jour',month:'Mois',year:'Année',range:'Intervalle',unknown:'Début inconnu',true:'Avec une géométrie',false:'Sans géométrie',unassigned:'Sans attribution structurée',not_recorded:'Type non renseigné',notMeasured:'Non mesuré',pending:'Contributions en attente',sourceRelease:'Version des données :',unarchived:'Snapshot non associé à une version archivée',yearNote:'Chaque fiche compte une fois, selon son année de début enregistrée. Une date partielle garde sa précision.',overlapNote:'Une fiche peut apparaître dans plusieurs territoires ou types. Les lignes et les sources partagées ne doivent pas être additionnées.',zero:'Aucune fiche actuellement recensée',
total_operations:'Fiches recensées',unique_sources:'Références distinctes',without_sources:'Sans référence de fiche',without_identified_primary_source:'Sans source primaire identifiée',uncertain_start_dates:'Début partiel ou incertain',uncertain_locations:'Localisation à préciser',without_structured_territory:'Sans attribution structurée',operations_with_contested_claims:'Avec assertions contestées',without_recorded_review:'Sans trace de revue enregistrée'},
ar:{title:'مرصد التوثيق',notice:'تصف هذه المؤشرات البطاقات المسجلة في ALNOP، ولا تقيس الشدة الفعلية للعمليات أو التغطية التاريخية للحرب.',classificationNotice:'غياب التصنيف الأولي لا يعني عدم وجود مصدر أولي. التصنيفات الإقليمية الموروثة ليست إسنادات منظمة معتمدة.',guide:'المنهج والتعريفات',filters:'اختيار البطاقات',search:'العنوان أو الوصف',from:'ابتداءً من',to:'إلى غاية',territory:'الإسناد الإقليمي المنظم',eventType:'النوع الموثق',precision:'دقة تاريخ البداية',geometry:'هندسة مكانية مسجلة',group:'تجميع الجدول',apply:'تطبيق',reset:'إعادة الضبط',summary:'حالة المجموعة المختارة',uncertaintyNotice:'عدم اليقين وغياب سجل المراجعة ليسا درجتين للحقيقة. قد تجمع البطاقة عدة نقاط تحتاج إلى المراجعة.',tableTitle:'التوزيع الوثائقي',domainNotice:'لهذه الفترة التي تتجاوز 200 سنة، تظهر السنوات المسجلة فقط.',json:'تصدير الاختيار JSON',csv:'تصدير الجدول CSV',reproduce:'إعادة إنتاج هذا الاختيار',loading:'جارٍ تحميل المجموعة والتحقق منها…',loadError:'تعذر التحقق من البيانات المنشورة. أعد تحميل الصفحة للمحاولة مجدداً.',filterError:'عوامل التصفية غير صالحة. تحقق من التواريخ والقيم؛ لم تُعرض أي نتيجة.',empty:'لا توجد بطاقة مسجلة حالياً لهذا الاختيار.',selection:'البطاقات المختارة:',all:'كل القيم',day:'يوم',month:'شهر',year:'سنة',range:'فترة',unknown:'بداية غير معروفة',true:'مع هندسة مكانية',false:'دون هندسة مكانية',unassigned:'دون إسناد إقليمي منظم',not_recorded:'نوع غير مسجل',notMeasured:'غير مقاس',pending:'المساهمات قيد الانتظار',sourceRelease:'إصدار البيانات:',unarchived:'مجموعة حالية غير مرتبطة بإصدار مؤرشف',yearNote:'تُحسب كل بطاقة مرة واحدة حسب سنة البداية المسجلة، مع الحفاظ على دقة التاريخ.',overlapNote:'قد تظهر البطاقة في عدة أقاليم أو أنواع. لا يجوز جمع الصفوف أو المراجع المشتركة.',zero:'لا توجد بطاقة مسجلة حالياً',
total_operations:'البطاقات المسجلة',unique_sources:'المراجع المختلفة',without_sources:'دون مرجع للبطاقة',without_identified_primary_source:'دون مصدر أولي محدد',uncertain_start_dates:'بداية جزئية أو غير مؤكدة',uncertain_locations:'موقع يحتاج إلى التدقيق',without_structured_territory:'دون إسناد إقليمي منظم',operations_with_contested_claims:'مع إفادات متنازع عليها',without_recorded_review:'دون سجل مراجعة مسجل'}};
let lang=localStorage.getItem('aln_lang')==='ar'?'ar':'fr',snapshot=null,raw={},group='year',current=null;
const byId=id=>document.getElementById(id),node=(tag,value,parent)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(parent)parent.append(el);return el;};
const t=key=>text[lang][key]||key;
function localize(){document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.title=t('title')+' · ALNOP';byId('obs-language').textContent=lang==='ar'?'Français':'العربية';document.querySelectorAll('[data-msg]').forEach(el=>el.textContent=t(el.dataset.msg));}
function options(id,values,value){const select=byId(id);select.replaceChildren();for(const [key,label]of values){const o=node('option',label,select);o.value=key;}if(value&&!values.some(([v])=>v===value)){const o=node('option',value,select);o.value=value;}select.value=value||'';}
function controls(){
  if(!snapshot)return;
  options('obs-territory',[['',t('all')],...snapshot.territories.map(r=>[r.id,r.names[lang]||r.names.fr||r.id])],raw.territory);
  const types=[...new Set(snapshot.operations.flatMap(o=>o.event_type||[o.legacy?.type_action].filter(Boolean)))].sort();options('obs-type',[['',t('all')],...types.map(v=>[v,v])],raw.type);
  options('obs-precision',[['',t('all')],...['day','month','year','range','unknown'].map(v=>[v,t(v)])],raw.date_precision);
  options('obs-geometry',[['',t('all')],['true',t('true')],['false',t('false')]],raw.has_geometry);
  options('obs-group',[['year',t('year')],['territory',t('territory')],['type',t('eventType')]],group);
  for(const key of ['q','from','to'])byId(fields[key]).value=raw[key]||'';
}
function error(key){byId('obs-error').hidden=false;byId('obs-error').textContent=t(key);byId('obs-results').hidden=true;byId('obs-status').textContent='';current=null;}
function draw(){
  if(!snapshot)return;byId('obs-error').hidden=true;
  try{
    const parsed=query.parseQuery(raw,'operations');if(!['year','territory','type'].includes(group))throw Error();
    const selected=query.select(snapshot.operations,{...parsed,page:1,limit:Math.max(1,snapshot.operations.length)},'operations').data;
    current=model.report(selected,snapshot.sources,snapshot.claims,snapshot.territories,parsed);
    byId('obs-results').hidden=false;byId('obs-status').textContent=current.summary.total_operations?t('selection')+' '+current.summary.total_operations:t('empty');
    const cards=byId('obs-cards');cards.replaceChildren();
    for(const key of model.keys){const card=node('div',undefined,cards);card.className='obs-card';node('dt',t(key),card);const dd=node('dd',String(current.summary[key]),card);dd.id='metric-'+key;}
    const pending=node('div',undefined,cards);pending.className='obs-card';node('dt',t('pending'),pending);node('dd',t('notMeasured'),pending).id='metric-pending';
    byId('obs-group-notice').textContent=t(group==='year'?'yearNote':'overlapNote');byId('obs-domain-notice').hidden=current.methodology.year_domain!=='observed_years_only';
    byId('obs-table-caption').textContent=t(group==='type'?'eventType':group);
    const head=byId('obs-head');head.replaceChildren();for(const label of [t(group==='type'?'eventType':group),...model.keys.map(t)])node('th',label,head).scope='col';
    const rows=byId('obs-rows');rows.replaceChildren();
    for(const row of current.groups[group]){
      const tr=node('tr',undefined,rows);tr.dataset.key=row.key;
      const label=row.label[lang]||row.label.fr||t(row.key),th=node('th',label,tr);th.scope='row';
      if(row.note){const note=node('small',t('zero'),th);note.className='obs-empty-note';}
      for(const key of model.keys)node('td',String(row[key]),tr);
    }
    byId('obs-version').textContent=t('sourceRelease')+' '+(snapshot.meta.dataset_release||t('unarchived'));
    byId('obs-snapshot').textContent='SHA-256: '+snapshot.meta.snapshot_sha256;byId('obs-parameters').textContent=JSON.stringify({filters:raw,group_by:group,calculation_version:snapshot.meta.calculation_version,model_sha256:snapshot.meta.model_sha256,query_sha256:snapshot.meta.query_sha256},null,2);
  }catch{error('filterError');}
}
function readUrl(){raw={};group='year';const seen=new Set();for(const [key,value]of new URLSearchParams(location.search)){if(seen.has(key)||(!Object.hasOwn(fields,key)&&key!=='group'))throw Error();seen.add(key);if(key==='group')group=value;else raw[key]=value;}}
function url(){const params=new URLSearchParams(raw);if(group!=='year')params.set('group',group);const value=params.toString();history.pushState(null,'',location.pathname+(value?'?'+value:''));}
byId('obs-filters').addEventListener('submit',event=>{event.preventDefault();raw={};for(const [key,id]of Object.entries(fields)){const value=byId(id).value.trim();if(value)raw[key]=value;}group=byId('obs-group').value;url();draw();});
byId('obs-reset').addEventListener('click',()=>{raw={};group='year';url();controls();draw();});
byId('obs-language').addEventListener('click',()=>{lang=lang==='fr'?'ar':'fr';localStorage.setItem('aln_lang',lang);const wasError=!byId('obs-error').hidden;localize();controls();if(snapshot)draw();else if(wasError)error('loadError');else byId('obs-status').textContent=t('loading');});
addEventListener('popstate',()=>{try{readUrl();controls();draw();}catch{error('filterError');}});
function download(format){if(!current)return;const metadata={...snapshot.meta,filters:{...raw},group_by:group};
  const content=format==='json'?JSON.stringify({data:current,meta:metadata},null,2)+'\n':model.csv(current,snapshot.meta,raw,group);
  const object=URL.createObjectURL(new Blob([content],{type:format==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'})),a=node('a');a.href=object;a.download='alnop-coverage-'+group+'-'+snapshot.meta.snapshot_sha256.slice(0,12)+'.'+format;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(object),1000);
}
byId('obs-export-json').addEventListener('click',()=>download('json'));byId('obs-export-csv').addEventListener('click',()=>download('csv'));
async function load(){
  const response=await fetch('data/canonical/dataset-manifest.json');if(!response.ok)throw Error();const manifestBytes=await response.arrayBuffer(),manifest=JSON.parse(new TextDecoder().decode(manifestBytes));
  const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const resources=await Promise.all(['operations.json','sources.json','claims.json','territorial-units.json'].map(async name=>{
    const r=await fetch('data/canonical/'+name);if(!r.ok)throw Error();const bytes=await r.arrayBuffer();if(await hash(bytes)!==manifest.checksums[name])throw Error();return JSON.parse(new TextDecoder().decode(bytes));
  }));
  const releasesResponse=await fetch('data/releases/index.json');if(!releasesResponse.ok)throw Error();const releases=await releasesResponse.json();
  const engineResponse=await fetch('data/coverage/engine.json');if(!engineResponse.ok)throw Error();const engine=await engineResponse.json();
  if(engine.calculation_version!=='coverage-v1')throw Error();
  for(const [file,key]of [['coverage-model.js?v=1','model_sha256'],['coverage-query.js?v=1','query_sha256']]){const r=await fetch(file);if(!r.ok||await hash(await r.arrayBuffer())!==engine[key])throw Error();}
  if(!Array.isArray(releases.releases))throw Error();const manifestHash=await hash(manifestBytes),release=releases.releases.find(r=>r.snapshot_manifest_sha256===manifestHash&&r.canonical_sha256===manifest.canonical_sha256);
  snapshot={operations:resources[0].operations,sources:resources[1],claims:resources[2].claims,territories:resources[3].territorial_units,meta:{snapshot_sha256:manifest.canonical_sha256,dataset_release:release?.id||null,calculation_version:engine.calculation_version,model_sha256:engine.model_sha256,query_sha256:engine.query_sha256}};
  if(![snapshot.operations,snapshot.sources,snapshot.claims,snapshot.territories].every(Array.isArray))throw Error();
  byId('obs-apply').disabled=false;try{readUrl();controls();draw();}catch{controls();error('filterError');}
}
localize();byId('obs-status').textContent=t('loading');load().catch(()=>{snapshot=null;error('loadError');});
})();
