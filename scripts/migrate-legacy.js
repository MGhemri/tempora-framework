const fs = require('node:fs');
const path = require('node:path');
const {migrate,validateCorpus,restoreLegacy,stable,hash,root} = require('../src/canonical');
const SOURCE_COMMIT = '97eef827834a7463e85eed8b5bd5c81e08069420';
function run() {
  const source = fs.readFileSync(path.join(root,'migrations/legacy-initial.json'));
  const corpus = migrate(JSON.parse(source), SOURCE_COMMIT);
  const report = validateCorpus(corpus);
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  if (JSON.stringify(restoreLegacy(corpus))!==JSON.stringify(JSON.parse(source))) throw new Error('Lossy migration');
  const files = new Map([['dataset.json',corpus.metadata],['vocabularies.json',corpus.vocabularies]]);
  for (const op of corpus.operations) files.set(`operations/${op.id}.json`,op);
  for (const s of corpus.sources) files.set(`sources/${s.source_id}.json`,s);
  for (const t of corpus.territorial_units) files.set(`territorial-units/${t.id}.json`,t);
  // Fail before writing if an existing canonical object was edited by a maintainer.
  for (const [name,value] of files) {
    const target=path.join(root,'data',name);
    if (fs.existsSync(target) && fs.readFileSync(target,'utf8')!==stable(value))
      throw new Error(`Refusing to overwrite edited canonical file: ${name}`);
  }
  for (const [name,value] of files) {
    const target=path.join(root,'data',name);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,stable(value));
  }
  const output = {source_commit:SOURCE_COMMIT,source_sha256:hash(source),operation_count:corpus.operations.length,
    source_count:corpus.sources.length,losses:[],mapping:{
      '*':'legacy (complete original record)',nom_operation:'title.fr',date_debut:'start_date',date_fin:'end_date',
      localisation:'locations (representative only)',sources:'source_ids + exact legacy source objects',
      wilaya_concernee:'legacy_territorial_label; no inferred canonical assignment'},...report};
  fs.writeFileSync(path.join(root,'migrations/migration-report.json'),stable(output));
  console.log(`Migrated ${corpus.operations.length} operations; no loss; ${report.warnings.length} review notices.`);
}
if (require.main===module) run();
module.exports={run};
