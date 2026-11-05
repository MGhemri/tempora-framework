function normalize(text){return String(text||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ـ/g,'')
  .replace(/[أإآ]/g,'ا').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
function grams(text){const s=Array.from('  '+normalize(text)+'  ');return new Set(Array.from({length:Math.max(0,s.length-2)},(_,i)=>s.slice(i,i+3).join('')));}
function lexical(a,b){if(!normalize(a)||!normalize(b))return 0;const x=grams(a),y=grams(b);return 2*[...x].filter(g=>y.has(g)).length/(x.size+y.size);}
function distance(a,b){const rad=x=>x*Math.PI/180;const [x,y]=a,[u,v]=b;
  const h=Math.sin(rad(v-y)/2)**2+Math.cos(rad(y))*Math.cos(rad(v))*Math.sin(rad(u-x)/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));}
module.exports={normalize,lexical,distance};
