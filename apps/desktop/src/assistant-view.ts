// TEMPORA Assistant initial read-only Desktop view; no mapping approval or import.
export type AssistantRecoveryReport={
 schema_version:'1.0.0';mode:'read_only_assessment';safe_to_start_new_write:boolean;
 requires_manual_attention:boolean;lock_status:string;committed_count:number;
 invalid_transactions:string[];pending_verified_for_review:string[];
 pending_incomplete:string[];pending_unsafe:string[];
 recovery_performed:false;files_modified:false;scientific_approval:false;published:false;
};
export type AssistantHost={
 assistantAssessRecovery?:()=>Promise<AssistantRecoveryReport|null>;
 assistantOpen:()=>Promise<AssistantOpen|null>;
 assistantSelectSheet:(id:string,name:string)=>Promise<{source_sha256:string;table:AssistantTable}>;
 assistantClose:(id:string)=>Promise<boolean>;
 assistantSuggest:(id:string,profileId:string,choice:{sheet_name?:string;delimiter?:string})=>Promise<AssistantSuggestionResult>;
 assistantConfirm:(id:string,token:string,bindings:Array<{source_column:string;target_field:string;state:'confirmed_by_user'}>)=>Promise<AssistantConfirmed>;
 assistantDryRun:(id:string,rules:Array<{source_column:string;rule:{id:string;kind:string;format?:string;list_separator?:string}}>)=>Promise<{preview:AssistantDryRun}>;
 assistantCanonicalPreview:(id:string)=>Promise<AssistantCanonicalPreview|null>;
 assistantReviewStage:(id:string,token:string,review:{ids:string[];reviewer:string;reason:string;reviewed_at:string})=>Promise<AssistantReviewReceipt>;
};
export type AssistantOpen={
 handle_id:string;file_name:string;format:string;size_bytes:number;source_sha256:string;
 inspection:{sheets?:Array<{name:string;state:string}>;candidates?:Array<{header_values:string[]}>;
 suggested_delimiter?:string|null};
};
export type AssistantReviewReceipt={
  scope:'in_memory_staging_only';batch_id:string;source_sha256:string;
  snapshot_sha256:string;canonical_validated:true;scientific_approval:false;
  saved_to_disk:false;published:false;import_performed:false;persistence_required:true;
  journal:{selected_ids:string[];reviewer:string;reason:string;reviewed_at:string};
};
export type AssistantCanonicalPreview={
 scope:'canonical_technical_preview';preview_schema_version:'1.0.0';corpus_name:string;
 source_sha256:string;batch_id:string;base_sha256:string;
 review_token?:string|null;staging_review_enabled?:boolean;
 total_rows:number;rows_truncated:boolean;import_performed:false;acceptance_enabled:false;
 summary:{total:number;create:number;unchanged:number;conflict:number;quarantined:number};
 rows:Array<{source_path:string;id:string|null;status:string;diagnostic_codes:string[];changed_fields:string[]}>;
};
export type AssistantDryRun={
  scope:string;source_sha256:string;preview_complete:boolean;
  total_rows:number;displayed_rows:number;summary:{normalized:number;quarantined:number;unconfigured:number};
  rows:Array<{source_path:string;entries:Array<{source_column?:string;source_text?:string;status:string;normalized?:unknown;diagnostic_code?:string|null}>}>;
};
export type AssistantConfirmed={
 mapping_confirmed:true;confirmation_scope:string;confirmation_sha256:string;
 mapping:{mapping_schema_version:string;format:'csv';fields:Record<string,unknown>};
 source_sha256:string;import_performed:false;canonical_validated:false;source_modified:false;
};
export type AssistantSuggestionResult={
  handle_id:string;source_sha256:string;profile_id:string;profile_version:string;
  proposal_token:string;
  mapping:{mapping_confirmed:false;confirmed_bindings:[];suggestions:Array<{
   source_column:string;target_field:string;algorithm_id:string;algorithm_version:string;
   reason_codes:string[];confidence_kind:string;state:'suggested';
  }>};
};
export type AssistantTable={
 headers:string[];sample_rows:Array<{line_number:number;values:string[]}>;
 diagnostics:Array<{coordinate?:string;code:string}>;
};
type Language='fr'|'en';
const dictionary={
 fr:{open:'Sélectionner un fichier',close:'Fermer la session',choose:'Choisir explicitement une feuille',
 unsupported:'Disponible uniquement dans TEMPORA Electron (Tauri non qualifié).',
 empty:'Aucune source. Aucune association confirmée.',
 readonly:'Lecture seule : aucun import, aucune formule exécutée et aucune décision scientifique.',
 unconfirmed:'Colonnes sources détectées — non confirmées',
 target:'Champs canoniques possibles — aucune association active',
 intro:'Mapping, normalisation et import ne sont pas encore reliés à cette vue.',
 sample:'Aperçu des cellules brutes',invalid:'Inspection refusée',
 suggest:'Proposer (sans confirmer)',suggestEmpty:'Aucune suggestion : les colonnes restent non associées.',suggestTitle:'Suggestions heuristiques — aucune case précochée.',confirm:'Confirmer les choix (sans import)',confirmed:'Mapping compilé localement et confirmé par le chercheur. Aucun import.'},
 en:{open:'Select file',close:'Close session',choose:'Explicitly select worksheet',
 unsupported:'Available in TEMPORA Electron only (Tauri not qualified).',
 empty:'No source. No confirmed associations.',
 readonly:'Read-only: no import, no formula execution and no scientific decision.',
 unconfirmed:'Detected source columns — unconfirmed',
 target:'Possible canonical fields — none actively mapped',
 intro:'Mapping, normalization and import are not yet connected to this view.',
 sample:'Raw cell preview',invalid:'Inspection rejected',
 suggest:'Suggest (never confirm)',suggestEmpty:'No suggestions: fields remain unmapped.',suggestTitle:'Heuristic suggestions — nothing preselected.',confirm:'Confirm selections (no import)',confirmed:'Mapping compiled locally and confirmed by researcher. No import.'}
};
const fields=['id','title','description','start_date','end_date','event_type','source_ids',
 'territory_ids','longitude','latitude','location_label'];
function el(id:string):HTMLElement{
 const value=document.getElementById(id);if(!value)throw Error('ASSIST_UI_MISSING');return value;
}
export function initAssistantView(host:AssistantHost|undefined,lang:()=>Language):void{
 const openBtn=el('assistant-open') as HTMLButtonElement;
 const closeBtn=el('assistant-close') as HTMLButtonElement;
 const sheetSelect=el('assistant-sheet') as HTMLSelectElement;
 const delimiterSelect=el('assistant-delimiter') as HTMLSelectElement;
 const profileSelect=el('assistant-profile') as HTMLSelectElement;
 const suggestBtn=el('assistant-suggest') as HTMLButtonElement;
 const suggestionPanel=el('assistant-suggestions');
 const bindingsPanel=el('assistant-bindings');
 const confirmButton=el('assistant-confirm') as HTMLButtonElement;
 const confirmationResult=el('assistant-confirm-result');
 const normalizeControls=el('assistant-normalization-controls');
 const normalizeColumn=el('assistant-normalize-column') as HTMLSelectElement;
 const normalizeRule=el('assistant-normalize-rule') as HTMLSelectElement;
 const normalizeButton=el('assistant-normalize') as HTMLButtonElement;
 const normalizeOutput=el('assistant-normalization-preview');
 const canonicalButton=el('assistant-canonical-button') as HTMLButtonElement;
 const canonicalOutput=el('assistant-canonical-result');
 const reviewControls=el('assistant-review-controls');
 const reviewSelections=el('assistant-review-selections');
 const reviewerInput=el('assistant-reviewer') as HTMLInputElement;
 const reasonInput=el('assistant-review-reason') as HTMLTextAreaElement;
 const reviewedAtInput=el('assistant-reviewed-at') as HTMLInputElement;
 const reviewStageButton=el('assistant-review-stage') as HTMLButtonElement;
 const reviewReceiptOutput=el('assistant-review-receipt');
 // Diagnostic view is intentionally separate from the import approval flow:
 // it cannot arm a save operation or accept a renderer-controlled path.
 const recoveryButton=document.createElement('button');
 recoveryButton.type='button';
 recoveryButton.textContent='Examiner des transactions interrompues (lecture seule)';
 const recoveryReport=document.createElement('pre');
 recoveryReport.setAttribute('aria-live','polite');
 recoveryReport.style.whiteSpace='pre-wrap';
 recoveryReport.style.overflowWrap='anywhere';
 reviewReceiptOutput.parentElement?.append(recoveryButton,recoveryReport);
 recoveryButton.addEventListener('click',async()=>{
   if(!host?.assistantAssessRecovery||recoveryButton.disabled)return;
   recoveryButton.disabled=true;
   recoveryReport.textContent='Diagnostic en lecture seule…';
   try {
     const report=await host.assistantAssessRecovery();
     if(!report){recoveryReport.textContent='Diagnostic annulé.';return;}
     const lines=[
       'TEMPORA M1.5 — rapport en lecture seule',
       'Verrou : '+report.lock_status,
       'Transactions terminées : '+report.committed_count,
       'Transactions invalides : '+report.invalid_transactions.join(', '),
       'Dossiers à examiner : '+report.pending_verified_for_review.join(', '),
       'Dossiers incomplets : '+report.pending_incomplete.join(', '),
       'Dossiers suspects : '+report.pending_unsafe.join(', '),
       report.requires_manual_attention?
         'EXAMEN MANUEL REQUIS — aucune récupération automatique.':
         'Aucun blocage structurel détecté. Aucune validation scientifique.',
       'Aucun fichier modifié ni publié.'
     ];
     recoveryReport.textContent=lines.join('\\n');
   }catch(e){
     recoveryReport.textContent='Diagnostic refusé : '+String((e as Error)?.message??e);
   }finally{recoveryButton.disabled=!host?.assistantAssessRecovery;}
 });
 recoveryButton.disabled=!host?.assistantAssessRecovery;
 let source:AssistantOpen|null=null,table:AssistantTable|null=null,busy=false,serial=0;
 let suggestion:AssistantSuggestionResult|null=null;
 let compiled:AssistantConfirmed|null=null;
 let dryRun:AssistantDryRun|null=null;
 let canonical:AssistantCanonicalPreview|null=null;
 let receipt:AssistantReviewReceipt|null=null;
 const reviewIds=new Set<string>();
 const selections=new Set<string>();
 let uiError:string|null=null;
 const status=el('assistant-status'),details=el('assistant-details');
 const columns=el('assistant-columns'),targets=el('assistant-targets');
 const sample=el('assistant-preview');
 const safeText=(root:HTMLElement,values:string[])=>{
   root.replaceChildren();
   for(const value of values){const p=document.createElement('p');p.textContent=value;root.append(p);}
 };
 const render=()=>{
   const t=dictionary[lang()];
   openBtn.textContent=t.open;openBtn.disabled=!host||busy;
   closeBtn.textContent=t.close;closeBtn.disabled=!source||busy;
   sheetSelect.disabled=!source||source.format!=='xlsx'||busy;
   delimiterSelect.disabled=!source||source.format==='xlsx'||busy;
   profileSelect.disabled=!source||busy;
   suggestBtn.textContent=t.suggest;
   suggestBtn.disabled=!source||busy||!profileSelect.value||
     (source.format==='xlsx'?!sheetSelect.value:!delimiterSelect.value);
   status.textContent=uiError??(!host?t.unsupported:(source?source.file_name+' · '+source.format.toUpperCase():t.empty));
   safeText(details,source?[source.file_name,'SHA-256: '+source.source_sha256,t.readonly]:[t.readonly]);
   const headers=table?.headers??(source?.format==='xlsx'?[]:
     source?.inspection.candidates?.[0]?.header_values??[]);
   safeText(columns,[t.unconfirmed,...headers.slice(0,256)]);
   safeText(targets,[t.target,...fields,t.intro]);
   canonicalButton.disabled=busy||!compiled||!source||source.format==='xlsx';
   reviewControls.hidden=!canonical?.staging_review_enabled||Boolean(receipt);
   reviewStageButton.disabled=busy||!canonical?.review_token||!canonical?.staging_review_enabled||
     Boolean(receipt)||reviewIds.size===0||!reviewerInput.value.trim()||
     !reasonInput.value.trim()||!reviewedAtInput.value.trim();
   reviewReceiptOutput.textContent=receipt
     ?'SIMULATION SEULEMENT · '+receipt.scope+' · '+receipt.snapshot_sha256+
       ' · '+receipt.journal.selected_ids.join(', ')+' · NON ENREGISTRÉ':'';
   reviewSelections.replaceChildren();
   if(canonical?.staging_review_enabled&&!receipt){
     for(const row of canonical.rows.filter(r=>r.status==='create'&&r.id)){
       const label=document.createElement('label');
       const checkbox=document.createElement('input');checkbox.type='checkbox';
       checkbox.checked=reviewIds.has(row.id!);checkbox.disabled=busy;
       checkbox.addEventListener('change',()=>{
         if(checkbox.checked)reviewIds.add(row.id!);else reviewIds.delete(row.id!);
         reviewStageButton.disabled=busy||reviewIds.size===0||!reviewerInput.value.trim()||
           !reasonInput.value.trim()||!reviewedAtInput.value.trim();
       });
       label.append(checkbox,document.createTextNode(' '+row.id+' · '+row.source_path+' (création)'));
       reviewSelections.append(label,document.createElement('br'));
     }
   }
   canonicalOutput.replaceChildren();
   if(canonical){
     const summary=document.createElement('p');
     summary.textContent='Canonical preview · '+canonical.corpus_name+' · '+canonical.batch_id+
       ' · create='+canonical.summary.create+' · unchanged='+canonical.summary.unchanged+
       ' · conflict='+canonical.summary.conflict+' · quarantined='+canonical.summary.quarantined+
       ' · NO IMPORT';
     canonicalOutput.append(summary);
     for(const row of canonical.rows.slice(0,50)){
       const p=document.createElement('p');p.textContent=row.source_path+' · '+(row.id??'—')+
         ' · '+row.status+' · '+row.diagnostic_codes.join(', ');
       canonicalOutput.append(p);
     }
     if(canonical.rows_truncated){
       const note=document.createElement('p');note.textContent='Affichage partiel, aperçu non accepté';
       canonicalOutput.append(note);
     }
   }
   normalizeControls.hidden=!compiled;
   const previousColumn=normalizeColumn.value;
   normalizeColumn.replaceChildren();
   if(compiled){
     for(const sourceColumn of selections){
       const [column]=JSON.parse(sourceColumn) as [string,string];
       const item=document.createElement('option');item.value=column;item.textContent=column;
       normalizeColumn.append(item);
     }
     if(Array.from(normalizeColumn.options).some(o=>o.value===previousColumn))normalizeColumn.value=previousColumn;
   }
   normalizeButton.disabled=busy||!compiled||!normalizeRule.value;
   normalizeOutput.replaceChildren();
   if(dryRun){
     const summary=document.createElement('p');
     summary.textContent='Dry-run · '+dryRun.displayed_rows+'/'+dryRun.total_rows+
       ' · Normalized: '+dryRun.summary.normalized+' · Quarantined: '+dryRun.summary.quarantined+
       ' · Unconfigured: '+dryRun.summary.unconfigured+
       (dryRun.preview_complete?'':' · TRUNCATED');
     normalizeOutput.append(summary);
     for(const row of dryRun.rows.slice(0,12)){
       const p=document.createElement('p');
       p.textContent=row.source_path+' · '+row.entries.map(e=>e.source_column+': '+e.status+
         (e.diagnostic_code?' ('+e.diagnostic_code+')':'')).join(' | ');
       normalizeOutput.append(p);
     }
   }
   confirmButton.textContent=t.confirm;
   confirmButton.disabled=busy||!source||source.format==='xlsx'||!suggestion||compiled!==null||selections.size<2;
   confirmationResult.textContent=compiled
     ?t.confirmed+' SHA-256: '+compiled.confirmation_sha256+' · '+JSON.stringify(compiled.mapping):'';
   bindingsPanel.replaceChildren();
   if(suggestion&&!compiled&&source?.format!=='xlsx'){
     for(const entry of suggestion.mapping.suggestions){
       const key=JSON.stringify([entry.source_column,entry.target_field]);
       const label=document.createElement('label');
       const checkbox=document.createElement('input');checkbox.type='checkbox';
       checkbox.checked=selections.has(key);checkbox.disabled=busy;
       checkbox.addEventListener('change',()=>{
         if(checkbox.checked)selections.add(key);else selections.delete(key);
         confirmButton.disabled=busy||selections.size<2;
       });
       label.append(checkbox,document.createTextNode(' '+entry.source_column+' → '+entry.target_field+' (proposé)'));
       bindingsPanel.append(label,document.createElement('br'));
     }
   }
   suggestionPanel.replaceChildren();
   const suggestionHeading=document.createElement('p');suggestionHeading.textContent=t.suggestTitle;suggestionPanel.append(suggestionHeading);
   if(suggestion){
     if(suggestion.mapping.mapping_confirmed||suggestion.mapping.confirmed_bindings.length)
       throw Error('ASSIST_UI_CONFIRMED_SUGGESTIONS_UNEXPECTED');
     for(const s of suggestion.mapping.suggestions.slice(0,256)){
       const p=document.createElement('p');
       p.textContent=s.source_column+' → '+s.target_field+' · '+s.algorithm_id+'@'+s.algorithm_version+
         ' · '+s.reason_codes.join(', ')+' · '+s.state;
       suggestionPanel.append(p);
     }
     if(!suggestion.mapping.suggestions.length){const p=document.createElement('p');p.textContent=t.suggestEmpty;suggestionPanel.append(p);}
   }
   sample.replaceChildren();
   const heading=document.createElement('p');heading.textContent=t.sample;sample.append(heading);
   if(table){
     const grid=document.createElement('table');const body=document.createElement('tbody');
     for(const row of table.sample_rows.slice(0,12)){
       const tr=document.createElement('tr');
       const index=document.createElement('th');index.textContent=String(row.line_number);tr.append(index);
       for(const value of row.values.slice(0,32)){
         const cell=document.createElement('td');cell.textContent=value;tr.append(cell);
       }
       body.append(tr);
     }
     grid.append(body);sample.append(grid);
     for(const diagnostic of table.diagnostics.slice(0,100)){
       const p=document.createElement('p');
       p.textContent=diagnostic.code+(diagnostic.coordinate?' · '+diagnostic.coordinate:'');
       sample.append(p);
     }
   }
 };
 async function release():Promise<void>{
   const prior=source;serial++;source=null;table=null;suggestion=null;compiled=null;dryRun=null;canonical=null;receipt=null;reviewIds.clear();selections.clear();uiError=null;
   sheetSelect.replaceChildren();delimiterSelect.value='';profileSelect.value='';render();
   if(prior&&host){try{await host.assistantClose(prior.handle_id);}catch{/* expired */}}
 }
 openBtn.addEventListener('click',async()=>{
   if(!host||busy)return;
   busy=true;const ticket=++serial;const old=source;source=null;table=null;suggestion=null;compiled=null;dryRun=null;canonical=null;receipt=null;reviewIds.clear();selections.clear();uiError=null;
   delimiterSelect.value='';profileSelect.value='';
   sheetSelect.replaceChildren();render();
   try{
     if(old)await host.assistantClose(old.handle_id);
     const result=await host.assistantOpen();
     if(ticket!==serial){if(result)await host.assistantClose(result.handle_id);return;}
     source=result;
     if(result?.format==='xlsx'){
       const placeholder=document.createElement('option');
       placeholder.value='';placeholder.textContent=dictionary[lang()].choose;
       sheetSelect.append(placeholder);
       for(const sheet of result.inspection.sheets??[]){
         const option=document.createElement('option');
         option.value=sheet.name;option.textContent=sheet.name+(sheet.state==='visible'?'':' ('+sheet.state+')');
         sheetSelect.append(option);
       }
       sheetSelect.value='';
     }
   }catch(error){
     if(ticket===serial)uiError=dictionary[lang()].invalid+': '+String((error as Error)?.message??error);
   }finally{busy=false;render();}
 });
 sheetSelect.addEventListener('change',async()=>{
   if(!host||!source||source.format!=='xlsx'||busy)return;
   const name=sheetSelect.value;table=null;suggestion=null;compiled=null;dryRun=null;canonical=null;receipt=null;reviewIds.clear();selections.clear();uiError=null;if(!name){render();return;}
   busy=true;const ticket=++serial,active=source;render();
   try{
     const result=await host.assistantSelectSheet(active.handle_id,name);
     if(ticket===serial&&result.source_sha256===active.source_sha256)table=result.table;
   }catch(error){
     if(ticket===serial)uiError=dictionary[lang()].invalid+': '+String((error as Error)?.message??error);
   }finally{busy=false;render();}
 });
 profileSelect.addEventListener('change',()=>{suggestion=null;compiled=null;dryRun=null;canonical=null;receipt=null;reviewIds.clear();selections.clear();render();});
 delimiterSelect.addEventListener('change',()=>{suggestion=null;compiled=null;dryRun=null;canonical=null;receipt=null;reviewIds.clear();selections.clear();render();});
 suggestBtn.addEventListener('click',async()=>{
   if(!host||!source||busy||!profileSelect.value)return;
   const selected=source,choice=selected.format==='xlsx'
     ?{sheet_name:sheetSelect.value}:{delimiter:delimiterSelect.value==='tab'?'\t':delimiterSelect.value};
   if(!Object.values(choice)[0])return;
   busy=true;uiError=null;suggestion=null;compiled=null;dryRun=null;canonical=null;receipt=null;reviewIds.clear();selections.clear();const ticket=++serial;render();
   try{
     const result=await host.assistantSuggest(selected.handle_id,profileSelect.value,choice);
     if(ticket===serial&&result.handle_id===selected.handle_id&&
       result.source_sha256===selected.source_sha256&&!result.mapping.mapping_confirmed)
       suggestion=result;
   }catch(error){
     if(ticket===serial)uiError=dictionary[lang()].invalid+': '+String((error as Error)?.message??error);
   }finally{busy=false;render();}
 });
 confirmButton.addEventListener('click',async()=>{
   if(!host||!source||!suggestion||busy||source.format==='xlsx'||selections.size<2)return;
   const chosen=suggestion.mapping.suggestions.filter(x=>selections.has(JSON.stringify([x.source_column,x.target_field])))
     .map(x=>({source_column:x.source_column,target_field:x.target_field,state:'confirmed_by_user' as const}));
   busy=true;uiError=null;const ticket=++serial,active=source,token=suggestion.proposal_token;render();
   try{
     const response=await host.assistantConfirm(active.handle_id,token,chosen);
     if(ticket===serial&&response.source_sha256===active.source_sha256&&response.mapping_confirmed)
       compiled=response;
   }catch(error){
     if(ticket===serial)uiError=dictionary[lang()].invalid+': '+String((error as Error)?.message??error);
   }finally{busy=false;render();}
 });
 normalizeRule.addEventListener('change',()=>{dryRun=null;render();});
 normalizeButton.addEventListener('click',async()=>{
   if(!host||!compiled||!source||busy||!normalizeRule.value)return;
   const column=normalizeColumn.value;
   const ruleName=normalizeRule.value,rule=ruleName==='LIST_SEMICOLON'
     ?{id:'human-list-1',kind:'list',list_separator:';'}
     :{id:'human-date-1',kind:'date',format:ruleName};
   busy=true;uiError=null;dryRun=null;const ticket=++serial,active=source;render();
   try{
     const result=await host.assistantDryRun(active.handle_id,[{source_column:column,rule}]);
     if(ticket===serial&&result.preview.source_sha256===active.source_sha256)
       dryRun=result.preview;
   }catch(error){
     if(ticket===serial)uiError=dictionary[lang()].invalid+': '+String((error as Error)?.message??error);
   }finally{busy=false;render();}
 });
 canonicalButton.addEventListener('click',async()=>{
   if(!host||!compiled||!source||busy||source.format==='xlsx')return;
   busy=true;uiError=null;canonical=null;receipt=null;reviewIds.clear();const ticket=++serial,active=source;render();
   try{
     const result=await host.assistantCanonicalPreview(active.handle_id);
     if(ticket===serial&&result&&result.source_sha256===active.source_sha256&&
       !result.import_performed&&!result.acceptance_enabled)canonical=result;
   }catch(error){
     if(ticket===serial)uiError=dictionary[lang()].invalid+': '+String((error as Error)?.message??error);
   }finally{busy=false;render();}
 });
 for(const field of [reviewerInput,reasonInput,reviewedAtInput]){
   field.addEventListener('input',()=>{
     reviewStageButton.disabled=busy||!canonical?.review_token||reviewIds.size===0||
       !reviewerInput.value.trim()||!reasonInput.value.trim()||!reviewedAtInput.value.trim();
   });
 }
 reviewStageButton.addEventListener('click',async()=>{
   if(!host||!source||!canonical?.review_token||!canonical.staging_review_enabled||
      !reviewIds.size||busy)return;
   const active=source,token=canonical.review_token,ticket=++serial;
   const review={ids:Array.from(reviewIds),reviewer:reviewerInput.value,
     reason:reasonInput.value,reviewed_at:reviewedAtInput.value};
   busy=true;uiError=null;render();
   try{
     const response=await host.assistantReviewStage(active.handle_id,token,review);
     if(ticket===serial&&response.source_sha256===active.source_sha256&&
       response.scope==='in_memory_staging_only'&&response.saved_to_disk===false&&
       response.scientific_approval===false&&!response.published)
       receipt=response;
   }catch(error){
     if(ticket===serial)uiError=dictionary[lang()].invalid+': '+String((error as Error)?.message??error);
   }finally{busy=false;render();}
 });
 closeBtn.addEventListener('click',()=>{if(!busy)void release();});
 document.addEventListener('tempora-language-change',render);
 render();
}
