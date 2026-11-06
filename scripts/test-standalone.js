const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
// Explicit generic inputs: this also defines the independently reproducible checkout.
const inputs = [
  'package.json','package-lock.json','distribution','LICENSE','README.md','CITATION.cff','CHANGELOG.md',
  'docs/reference','SECURITY.md',
  'src/framework','src/sdk','src/cli','schemas/tempora',
  'schemas/tempora.profile.schema.json','schemas/tempora.ingestion-mapping.schema.json',
  'docs/.nojekyll','docs/index.html','docs/guides','docs/site-src','docs/openapi',
  'docs/assets/site.css','docs/assets/site.js',
  'scripts/ingest-tempora.js','scripts/analyze-tempora.js','scripts/evaluate-tempora.js',
  'scripts/publish-tempora.js','scripts/serve-tempora.js','scripts/pack-tempora.js',
  'scripts/check-framework-boundaries.js','scripts/build-framework-site.js',
  'scripts/check-publication-files.js','scripts/check-release-metadata.js','scripts/benchmark-tempora.js','scripts/validate-profiles.js',
  'profiles/synthetic-history','tests/publication-files.test.js',
  'tests/architecture','tests/helpers/tempora.js','tests/helpers/analysis-reference.js',
  'tests/helpers/publication-request.js','tests/vendor','tests/fixtures/profiles/synthetic-history',
  'tests/fixtures/profiles/synthetic-maritime','tests/fixtures/analysis-reference.json',
  'tests/fixtures/canonical-v3.utf8',
  ...fs.readdirSync(path.join(root,'tests')).filter(f=>/^framework-.*\.test\.js$/.test(f)).map(f=>'tests/'+f)
];
function run() {
  if (!process.env.npm_execpath) throw Error('Run through npm run test:standalone');
  const parent = fs.realpathSync(path.dirname(root));
  const dir = fs.mkdtempSync(path.join(parent, 'tempora-standalone-'));
  try {
    for (const file of inputs) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive:true});
      fs.cpSync(path.join(root,file),path.join(dir,file),{recursive:true});
    }
    for (const forbidden of ['data','api','compatibility','src/profiles','src/canonical.js','docs/data']) {
      if (fs.existsSync(path.join(dir,forbidden))) throw Error('Unexpected historical input: '+forbidden);
    }
    const env = {...process.env}; delete env.NODE_PATH; delete env.NODE_TEST_CONTEXT;
    for (const args of [['ci'], ['run','test:core'], ['run','test:package'], ['run','check:site'], ['run','check:release'], ['run','validate:profiles'], ['run','build']]) {
      const result = spawnSync(process.execPath,[process.env.npm_execpath,...args],
        {cwd:dir,env,stdio:'inherit',timeout:180000});
      if (result.error) throw result.error;
      if (result.status!==0) throw Error('Independent checkout failed: npm '+args.join(' '));
    }
    console.log('Standalone core, SDK, CLI, package and Pages passed without ALNOP.');
  } finally {
    if (path.dirname(dir)!==parent || !path.basename(dir).startsWith('tempora-standalone-')) throw Error('Unsafe cleanup');
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
if(require.main===module)run();
module.exports={inputs};
