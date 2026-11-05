// Assertions supplement the record; they never select a winning historical value.
const {publicEntities}=require('./entities');
function publishedClaims(corpus) {
  const published=new Set(corpus.operations.filter(o=>o.editorial_status==='published').map(o=>o.id));
  return (corpus.claims||[]).filter(c=>c.editorial_status==='published' && published.has(c.subject))
    .sort((a,b)=>a.id.localeCompare(b.id));
}
function publicSources(corpus) {
  const used=new Set(corpus.operations.filter(o=>o.editorial_status==='published').flatMap(o=>o.source_ids));
  for(const claim of publishedClaims(corpus))for(const evidence of claim.evidence)used.add(evidence.source_id);
  for(const entity of publicEntities(corpus))for(const id of entity.source_ids)used.add(id);
  return corpus.sources.filter(s=>used.has(s.source_id)).sort((a,b)=>a.source_id.localeCompare(b.source_id));
}
function claimsForOperation(id,corpus) {
  const claims=publishedClaims(corpus),sources=new Map(corpus.sources.map(s=>[s.source_id,s]));
  return claims.filter(c=>c.subject===id).map(c=>({...c,
    // Include incoming links so a one-way recorded relation remains visible on both assertions.
    contradicts:[...new Set([...c.contradicts,...claims.filter(other=>other.contradicts.includes(c.id)).map(other=>other.id)])].sort(),
    evidence:c.evidence.map(e=>{const s=sources.get(e.source_id);return {...e,
      source:{title:s.title,author:s.author||s.legacy?.auteur||null,url:s.url||s.legacy?.url||null}};})}));
}
module.exports={publishedClaims,publicSources,claimsForOperation};
