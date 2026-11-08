// TEMPORA Assistant initial read-only Desktop view; no mapping approval or import.
export type AssistantHost={
 assistantOpen:()=>Promise<AssistantOpen|null>;
 assistantSelectSheet:(id:string,name:string)=>Promise<{source_sha256:string;table:AssistantTable}>;
 assistantClose:(id:string)=>Promise<boolean>;
};
export type AssistantOpen={
 handle_id:string;file_name:string;format:string;size_bytes:number;source_sha256:string;
 inspection:{sheets?:Array<{name:string;state:string}>;candidates?:Array<{header_values:string[]}>;
 suggested_delimiter?:string|null};
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
 sample:'Aperçu des cellules brutes',invalid:'Inspection refusée'},
 en:{open:'Select file',close:'Close session',choose:'Explicitly select worksheet',
 unsupported:'Available in TEMPORA Electron only (Tauri not qualified).',
 empty:'No source. No confirmed associations.',
 readonly:'Read-only: no import, no formula execution and no scientific decision.',
 unconfirmed:'Detected source columns — unconfirmed',
 target:'Possible canonical fields — none actively mapped',
 intro:'Mapping, normalization and import are not yet connected to this view.',
 sample:'Raw cell preview',invalid:'Inspection rejected'}
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
 let source:AssistantOpen|null=null,table:AssistantTable|null=null,busy=false,serial=0;
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
   status.textContent=uiError??(!host?t.unsupported:(source?source.file_name+' · '+source.format.toUpperCase():t.empty));
   safeText(details,source?[source.file_name,'SHA-256: '+source.source_sha256,t.readonly]:[t.readonly]);
   const headers=table?.headers??(source?.format==='xlsx'?[]:
     source?.inspection.candidates?.[0]?.header_values??[]);
   safeText(columns,[t.unconfirmed,...headers.slice(0,256)]);
   safeText(targets,[t.target,...fields,t.intro]);
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
   const prior=source;serial++;source=null;table=null;uiError=null;sheetSelect.replaceChildren();render();
   if(prior&&host){try{await host.assistantClose(prior.handle_id);}catch{/* expired */}}
 }
 openBtn.addEventListener('click',async()=>{
   if(!host||busy)return;
   busy=true;const ticket=++serial;const old=source;source=null;table=null;uiError=null;
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
   const name=sheetSelect.value;table=null;uiError=null;if(!name){render();return;}
   busy=true;const ticket=++serial,active=source;render();
   try{
     const result=await host.assistantSelectSheet(active.handle_id,name);
     if(ticket===serial&&result.source_sha256===active.source_sha256)table=result.table;
   }catch(error){
     if(ticket===serial)uiError=dictionary[lang()].invalid+': '+String((error as Error)?.message??error);
   }finally{busy=false;render();}
 });
 closeBtn.addEventListener('click',()=>{if(!busy)void release();});
 document.addEventListener('tempora-language-change',render);
 render();
}
