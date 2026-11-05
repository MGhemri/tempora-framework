/* Public proposals only: no token, no write API, no submission claim. */
(() => {
  const $=id=>document.getElementById(id);
  let lang;
  try {lang=localStorage.getItem('aln_lang')==='ar'?'ar':'fr';} catch {lang='fr';}
  const githubPages=window.ALNOP_SITE?.githubPages===true;
  const t=key=>I18N_CONTRIBUTE[lang][!githubPages && key==='privacy'?'privacyLocal':!githubPages && key==='notSubmitted'?'notSubmittedLocal':key];
  let markdown='';
  let prepared=null,signature='',submissionId='',deliveredReference='',sending=false;
  let operations=new Map();
  let loadFailed=false;
  let loaded=false;
  const normalize=text=>String(text || '').normalize('NFD').replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g,'')
    .replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
  function operationName(op){
    return lang==='ar' && typeof I18N_TITLES_AR!=='undefined' && I18N_TITLES_AR[op.id]
      ? I18N_TITLES_AR[op.id] : op.nom_operation;
  }
  function renderPicker(id){
    const select=$(id), selected=select.value, query=normalize($(id+'-search').value.trim());
    const tokens=query.split(/\s+/).filter(Boolean);
    const matches=[...operations.values()].sort((a,b)=>a.id.localeCompare(b.id)).filter(op=>{
      const arabic=typeof I18N_TITLES_AR!=='undefined'?I18N_TITLES_AR[op.id]:'';
      const text=normalize([op.id,op.nom_operation,arabic,op.date_debut,op.localisation?.region_ou_ville].join(' '));
      return tokens.every(token=>text.includes(token));
    });
    select.replaceChildren(new Option(t('chooseOperation'),''));
    if(selected && operations.has(selected) && !matches.some(op=>op.id===selected)){
      const op=operations.get(selected);
      select.add(new Option(`${t('pickerCurrent')} ${op.id} — ${operationName(op)}`,selected));
    }
    for(const op of matches)select.add(new Option(`${op.id} — ${operationName(op)}`,op.id));
    select.value=selected;
    $(id+'-count').textContent=loadFailed?t('loadError'):!loaded?t('pickerLoading'):
      t('pickerCount').replace('{shown}',matches.length).replace('{total}',operations.size)+
      (matches.length?'':' '+t('pickerNone'));
    $(id+'-selected').textContent=selected && operations.has(selected)
      ?`${t('pickerSelected')} ${selected} — ${operationName(operations.get(selected))}`:'';
  }
  const types={
    'new-operation':{help:'newHelp',description:'description',event:true},
    correction:{help:'correctionHelp',description:'correctionDescription',operation:true},
    'new-source':{help:'sourceHelp',description:'sourceDescription',operation:true,source:true},
    duplicate:{help:'duplicateHelp',description:'duplicateDescription',operation:true,second:true},
    'historical-dispute':{help:'disputeHelp',description:'disputeDescription',operation:true},
    'place-name':{help:'placeHelp',description:'placeDescription',optional:true,place:true}
  };
  function adapt(){
    const config=types[$('kind').value];
    const show=(group,fields,visible,required=false)=>{
      $(group).hidden=!visible;
      for(const id of fields){$(id).disabled=!visible;$(id).required=visible && required;}
    };
    show('operation-group',['operation'],!!(config.operation||config.optional),!!config.operation);
    show('second-operation-group',['second-operation'],!!config.second,!!config.second);
    $('operation-search').disabled=!(config.operation||config.optional);
    $('second-operation-search').disabled=!config.second;
    show('event-group',['event-date','event-place'],!!config.event);
    show('place-group',['place-name'],!!config.place,!!config.place);
    $('citation').required=!!config.source;
    $('missing').disabled=!!config.source;$('missing').hidden=!!config.source;
    document.querySelector('label[for="missing"]').hidden=!!config.source;
    $('operation-label').textContent=t(config.optional?'optionalOperation':'relatedOperation');
    $('kind-help').textContent=t(config.help);
    document.querySelector('label[for="description"]').textContent=t(config.description);
    for(const id of ['operation','second-operation'])renderPicker(id);
    $('error').textContent=loadFailed && (config.operation||config.optional)?t('loadError'):'';
    $('review').hidden=true;markdown='';prepared=null;
  }
  function translate(){
    document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    document.title=t('heading')+' · ALNOP';
    document.querySelectorAll('[data-t]').forEach(el=>el.textContent=t(el.dataset.t));
    $('language').textContent=lang==='fr'?'العربية':'Français';
    adapt();
  }
  $('language').addEventListener('click',()=>{lang=lang==='fr'?'ar':'fr';try{localStorage.setItem('aln_lang',lang);}catch{}translate();});
  $('proposal').addEventListener('input',()=>{$('review').hidden=true;prepared=null;});
  $('kind').addEventListener('change',()=>{
    $('operation-search').value='';$('second-operation-search').value='';adapt();
  });
  for(const id of ['operation','second-operation']){
    $(id+'-search').addEventListener('input',()=>renderPicker(id));
    $(id).addEventListener('change',()=>{
      const op=operations.get($(id).value);
      $(id+'-selected').textContent=op?`${t('pickerSelected')} ${op.id} — ${operationName(op)}`:'';
      $('review').hidden=true;
    });
  }
  const value=id=>$(id).value.trim();
  $('proposal').addEventListener('submit',event=>{
    event.preventDefault();
    const config=types[value('kind')];
    const fail=key=>{$('error').textContent=t(key);$('error').focus();};
    if((config.operation||config.optional) && (loadFailed ||
      (value('operation') && !operations.has(value('operation'))) || (config.operation && !value('operation'))))
      return fail(loadFailed?'loadError':'invalidOperation');
    if(config.second && !operations.has(value('second-operation')))return fail('invalidOperation');
    if(config.second && value('operation')===value('second-operation'))return fail('sameOperation');
    if(config.source && !value('citation'))return fail('sourceOnlyRequired');
    if (!value('citation') && !value('missing')) {
      $('error').textContent=t('sourceRequired');$('error').focus();return;
    }
    $('error').textContent='';
    const labels=I18N_CONTRIBUTE[lang];
    const fields=[];
    if((config.operation||config.optional) && value('operation'))fields.push(`${labels.relatedOperation}: ${value('operation')}`);
    if(config.second)fields.push(`${labels.secondOperation}: ${value('second-operation')}`);
    if(config.event){
      fields.push(labels.newHelp);
      if(value('event-date'))fields.push(`${labels.eventDate}: ${value('event-date')}`);
      if(value('event-place'))fields.push(`${labels.eventPlace}: ${value('event-place')}`);
    }
    if(config.place)fields.push(`${labels.placeName}: ${value('place-name')}`);
    markdown=`# ${value('title')}\n\n`+
      `${labels.kind}: ${$('kind').selectedOptions[0].textContent}\n\n${fields.join('\n\n')}\n\n`+
      `${labels[config.description]}\n${value('description')}\n\n${labels.citation}\n${value('citation')}\n\n`+
      (config.source?'':`${labels.missing}\n${value('missing')}\n\n`)+
      (value('reply-email')?`${labels.replyEmail}: ${value('reply-email')}\n\n`:'')+
      `${labels.proposedStatus}\n${value('citation')?labels.reviewRequired:labels.sourcesRequired}\n\n${labels.consent}\n`;
    const payload={kind:value('kind'),title:value('title'),description:value('description'),citation:value('citation'),
      missing:config.source?'':value('missing'),consent:$('consent').checked,replyTo:value('reply-email'),locale:lang,
      website:value('proposal-website'),
      ...((config.operation||config.optional)?{operation:value('operation')}:{}),
      ...(config.second?{secondOperation:value('second-operation')}:{}),
      ...(config.event?{eventDate:value('event-date'),eventPlace:value('event-place')}:{}),
      ...(config.place?{placeName:value('place-name')}: {})};
    const current=JSON.stringify(payload);
    if(current!==signature){signature=current;submissionId=crypto.randomUUID();deliveredReference='';}
    prepared={...payload,submissionId};
    $('send-proposal').disabled=!!deliveredReference;
    $('delivery-status').textContent=deliveredReference?t('deliverySuccess').replace('{reference}',deliveredReference):'';
    $('delivery-error').textContent='';
    $('summary').textContent=markdown;
    const url=new URL('https://github.com/MGhemri/aln-historical-operations-dataset/issues/new');
    url.searchParams.set('title',value('title'));url.searchParams.set('body',markdown);
    // Generic issue: structured issue templates are available separately on GitHub.
    const tooLong=url.href.length>7500;
    $('github').hidden=!githubPages||tooLong;$('long-note').hidden=!githubPages||!tooLong;
    if(!githubPages||tooLong)$('github').removeAttribute('href');else $('github').href=url.href;
    $('review').hidden=false;$('review-heading').tabIndex=-1;$('review-heading').focus();
  });
  $('download').addEventListener('click',()=>{
    const objectURL=URL.createObjectURL(new Blob([markdown],{type:'text/markdown;charset=utf-8'}));
    const link=document.createElement('a');link.href=objectURL;link.download='alnop-proposition.md';link.click();
    setTimeout(()=>URL.revokeObjectURL(objectURL),1000);
  });
  $('send-proposal').addEventListener('click',async()=>{
    if(!prepared||sending||deliveredReference)return;
    sending=true;$('send-proposal').disabled=true;$('send-proposal').textContent=t('sendingProposal');
    $('delivery-error').textContent='';$('delivery-status').textContent=t('sendingProposal');
    const controls=[...$('proposal').querySelectorAll('input,select,textarea,button'),$('language')]
      .map(el=>({el,disabled:el.disabled}));controls.forEach(({el})=>el.disabled=true);
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch(githubPages?'https://alnop.vercel.app/api/contributions':'/api/contributions',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(prepared),signal:controller.signal});
      const result=await response.json();
      if(!response.ok||result.success!==true||!result.reference)throw new Error(response.status===429?'RATE_LIMITED':'DELIVERY_FAILED');
      deliveredReference=result.reference;$('delivery-status').textContent=t('deliverySuccess').replace('{reference}',result.reference);
    }catch(error){
      $('delivery-status').textContent='';
      $('delivery-error').textContent=t(error.message==='RATE_LIMITED'?'deliveryRateLimit':error.name==='AbortError'?'deliveryUncertain':'deliveryFailed');
    }finally{
      clearTimeout(timeout);sending=false;controls.forEach(({el,disabled})=>el.disabled=disabled);
      $('send-proposal').disabled=!!deliveredReference;$('send-proposal').textContent=t('sendProposal');
    }
  });
  const parameters=new URLSearchParams(location.search);
  const id=parameters.get('id');
  translate();
  fetch('data/operations_fln_1954_1962.json').then(response=>{
    if(!response.ok)throw new Error('Dataset unavailable');return response.json();
  }).then(dataset=>{
    if(!Array.isArray(dataset.operations))throw new Error('Invalid dataset');
    operations=new Map(dataset.operations.map(op=>[op.id,op]));
    loaded=true;
    for(const op of dataset.operations)for(const select of [$('operation'),$('second-operation')]){
      const option=document.createElement('option');option.value=op.id;
      option.textContent=`${op.id} — ${op.nom_operation}`;select.append(option);
    }
    if(id && operations.has(id)){$('operation').value=id;$('kind').value='correction';}
    adapt();
  }).catch(()=>{loadFailed=true;adapt();});
})();
