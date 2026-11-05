(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory();else globalThis.ALNOPEntitySearch=factory();})(function(){
'use strict';
function normalize(s){return String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ـ/g,'').replace(/[أإآ]/g,'ا').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function buildIndex(operations){return {version:'entity-mentions-v1',operations:operations.filter(o=>o.editorial_status==='published').map(o=>({id:o.id,title:o.title,
 commanders:[...new Set(o.commanders||o.legacy?.commandement_aln||[])],locations:o.locations.map(l=>l.label).filter(Boolean),
 narratives:[...Object.values(o.description||{}),o.legacy?.description].filter((s,i,a)=>typeof s==='string'&&s&&a.indexOf(s)===i)})).sort((a,b)=>a.id.localeCompare(b.id))};}
function search(index,q,kind='all'){
 const words=normalize(q).split(' ').filter(Boolean),ranks=new Set(['akid','colonel','العقيد']);
 const tokens=['person','all'].includes(kind)&&words.some(w=>!ranks.has(w))?words.filter(w=>!ranks.has(w)):words;
 if(!tokens.length)return [];
 const fields=kind==='person'?['commanders','narratives']:kind==='place'?['locations','narratives']:kind==='organization'?['narratives']:['commanders','locations','narratives'];
 return index.operations.flatMap(o=>{const matches=fields.flatMap(field=>(o[field]||[]).filter(text=>{const parts=new Set(normalize(text).split(' '));return tokens.every(w=>parts.has(w));}).map(text=>({field,text})));return matches.length?[{operation_id:o.id,title:o.title,matches}]:[];});
}
return {normalize,buildIndex,search};
});
