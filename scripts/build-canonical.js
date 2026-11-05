const fs = require('node:fs');
const path = require('node:path');
const {readCorpus,validateCorpus,stable,hash,root} = require('../src/canonical');
const {publishedLegacy,publicArtifacts,originalIntegrity,corpusFingerprint}=require('../src/publication');
const {publishedClaims,publicSources}=require('../src/claims');
const {publicEntities,allEntities,groups}=require('../src/entities');
function artifacts(corpus,{allowSynthetic=false}={}) {
  const report = validateCorpus(corpus);
  report.errors.push(...originalIntegrity(corpus));
  if(!allowSynthetic && corpus.operations.some(op=>/^(TEST_|SYNTHETIC_)/.test(op.id)))report.errors.push('Synthetic fixtures must never be present in the production corpus');
  if(!allowSynthetic && (corpus.claims||[]).some(c=>/^(CLM_TEST_|CLM_SYNTHETIC_)/.test(c.id)))report.errors.push('Synthetic assertions must never be present in the production corpus');
  if(!allowSynthetic && allEntities(corpus).some(e=>/^(PER|ORG|PLC)_(TEST|SYNTHETIC)_/.test(e.id)))report.errors.push('Synthetic entities must never be present in the production corpus');
  if(!allowSynthetic&&(corpus.duplicate_assessments||[]).some(a=>/^QA_(TEST|SYNTHETIC)_/.test(a.id)))report.errors.push('Synthetic assessments must stay in test fixtures');
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  const published=corpus.operations.filter(o=>o.editorial_status==='published').sort((a,b)=>a.id.localeCompare(b.id));
  const claims=publishedClaims(corpus),claimIds=new Set(claims.map(c=>c.id));
  const publicReport={errors:[],warnings:report.warnings.filter(w=>published.some(op=>op.id===w.id)&&(!w.claim_id||claimIds.has(w.claim_id)))};
  const geo = {type:'FeatureCollection',features:published.map(o=>{
    const points=o.locations.filter(l=>l.geometry?.type==='Point').map(l=>l.geometry.coordinates);
    const geometry=points.length>1?{type:'MultiPoint',coordinates:points}:points.length?{type:'Point',coordinates:points[0]}:null;
    return {type:'Feature',id:o.id,geometry,properties:{id:o.id,title:o.title,
      geometry_role:o.locations.length>1?'multi_site':o.locations[0].geometry_role,
      locations:o.locations,territorial_assignments:o.territorial_assignments,
      quality_flags:o.quality_flags,source_ids:o.source_ids,
      ...(claims.some(c=>c.subject===o.id)?{claim_ids:claims.filter(c=>c.subject===o.id).map(c=>c.id)}:{})}};
  })};
  const csvCell = v => '"'+String(v ?? '').replace(/"/g,'""')+'"';
  const csv = [['id','title_fr','date_earliest','date_latest','date_precision','geometry_role','source_ids'],
    ...published.map(o=>[o.id,o.title.fr,o.start_date.earliest,o.start_date.latest,o.start_date.precision,
      o.locations[0].geometry_role,o.source_ids.join(';')])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  const out={'operations.json':stable({schema_version:'2.0.0',corpus_is_incomplete:true,operations:published}),
    'legacy.json':stable(publishedLegacy(corpus)),'operations.geojson':stable(geo),'operations.csv':csv,
    'sources.json':stable(publicSources(corpus)),
    'claims.json':stable({schema_version:'2.0.0',corpus_is_incomplete:true,claims}),
    'quality-report.json':stable(publicReport),
    'quality-report.md':`# Qualité du corpus ALNOP\n\n${publicReport.errors.length} erreurs bloquantes ; ${publicReport.warnings.length} avertissements.\n\n`+
      publicReport.warnings.map(w=>`- ${w.id}: ${w.code}`).join('\n')+'\n'};
  const entities=publicEntities(corpus);
  for(const [group,kind]of Object.entries(groups))out[group+'.json']=stable({schema_version:'2.0.0',entities:entities.filter(e=>e.kind===kind)});
  out['territorial-units.json']=stable({schema_version:'2.0.0',territorial_units:[...corpus.territorial_units].sort((a,b)=>a.id.localeCompare(b.id))});
  out['dataset-manifest.json']=stable({schema_version:'2.0.0',publication_status:'validated_snapshot',
    import_source_commit:corpus.metadata.source_commit,canonical_sha256:corpusFingerprint(corpus),
    corpus_is_incomplete:true,total:published.length,
    checksums:Object.fromEntries(Object.entries(out).map(([name,content])=>[name,hash(content)]))});
  return out;
}
function run(check=process.argv.includes('--check')) {
  const corpus=readCorpus(),generated=artifacts(corpus);
  const files={...publicArtifacts(corpus)};
  for(const [name,content]of Object.entries(generated))files['generated/'+name]=content;
  for(const name of Object.keys(generated))
    files['docs/data/canonical/'+name]=generated[name];
  for (const [name,content] of Object.entries(files)) {
    const target=path.join(root,name);
    if (check) {
      const actual=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null;
      if(actual===null || (name.endsWith('.csv')?actual:actual.replace(/\r\n/g,'\n'))!==content)throw new Error(`Stale artifact: ${name}`);
    } else {
      fs.mkdirSync(path.dirname(target),{recursive:true});
      const actual=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null;
      if(actual===null || (name.endsWith('.csv')?actual:actual.replace(/\r\n/g,'\n'))!==content)fs.writeFileSync(target,content);
    }
  }
  console.log(check?'Canonical and public exports match.':'Canonical and public exports generated.');
}
if (require.main===module) run();
module.exports={artifacts,run};
