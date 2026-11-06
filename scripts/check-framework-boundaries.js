const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const {parse} = require('acorn');

const layers = {
  ingestion: {files: /^ingestion(?:-|\.)/, imports: ['core'], modules: ['ajv/dist/2020', 'node:crypto', 'node:util']},
  analysis: {files: /^(?:analysis|claim-comparison|similarity)(?:-|\.)/, imports: ['core'], modules: []},
  editorial: {files: /^editorial-/, imports: ['core'], modules: []},
  publication: {files: /^publication(?:-|\.)/, imports: ['core', 'editorial'], modules: ['node:crypto', 'node:fs', 'node:path']},
  api: {files: /^published-/, imports: ['core', 'publication'], modules: ['node:crypto']},
  core: {files: /./, imports: [], modules: ['ajv/dist/2020', 'ajv-formats', 'node:crypto', 'node:fs', 'node:path']}
};
const layerOf = file => Object.keys(layers).find(layer => layers[layer].files.test(path.basename(file)));

function collectImports(source, name, entry = false) {
  const ast = parse(source, {ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true});
  const imports = [];
  function visit(node, parent) {
    if (node.type === 'Identifier' && node.name === 'module') {
      const mainGuard=entry&&parent?.type==='BinaryExpression'&&parent.operator==='==='&&
        parent.left?.type==='MemberExpression'&&parent.left.object.name==='require'&&parent.left.property.name==='main'&&!parent.left.computed;
      assert.ok(mainGuard || parent?.type === 'MemberExpression' && parent.object === node && !parent.computed &&
        parent.property.name === 'exports', `${name}: indirect module access`);
    }
    if (node.type === 'Identifier' && node.name === 'require') {
      if(entry&&parent?.type==='MemberExpression'&&parent.object===node&&!parent.computed&&parent.property.name==='main') return;
      assert.ok(parent?.type === 'CallExpression' && parent.callee === node && !parent.optional &&
        parent.arguments.length === 1, `${name}: indirect require`);
      const [argument] = parent.arguments;
      const canonicalSchema = name === 'canonical.js' && argument.type === 'TemplateLiteral' &&
        source.slice(argument.start, argument.end) === '`../../schemas/tempora/v3/${name}.schema.json`';
      if (!canonicalSchema) imports.push(argument);
    }
    if (node.type === 'ImportExpression' || /^(?:ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration)$/.test(node.type)) {
      if (node.source) imports.push(node.source);
    }
    if (node.type === 'Literal' || node.type === 'TemplateElement') {
      const value = node.type === 'TemplateElement' ? node.value.cooked : node.value;
      if (typeof value === 'string') {
        assert.doesNotMatch(value, /\b(?:alnop|wilaya|FLN|ALN|1954|1962)\b|(?:^|[\\/])data[\\/]|operations_fln/i,
          `${name}: historical data reference`);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.type) visit(child, node);
      } else if (value?.type) visit(value, node);
    }
  }
  visit(ast);
  return imports.map(node => {
    assert.ok(node.type === 'Literal' && typeof node.value === 'string', `${name}: unsupported dynamic import`);
    return node.value;
  });
}

function checkBoundaries(root) {
  const core = fs.realpathSync(path.join(root, 'src/framework'));
  const graph = new Map();
  for (const name of fs.readdirSync(core, {recursive: true})) {
    if (!/\.(?:js|cjs|mjs)$/.test(name)) continue;
    const file = path.join(core, name);
    const source = fs.readFileSync(file, 'utf8');
    const dependencies = [];
    const resolve = createRequire(file).resolve;
    const layer = layerOf(file);
    for (const target of collectImports(source, name)) {
      if (layers[layer].modules.includes(target)) continue;
      assert.ok(target.startsWith('.'), `${name}: unexpected dependency ${target}`);
      const resolved = fs.realpathSync(resolve(target));
      if (resolved.startsWith(core + path.sep) && /\.(?:js|cjs|mjs)$/.test(resolved)) {
        const dependencyLayer = layerOf(resolved);
        assert.ok(layer === dependencyLayer || layers[layer].imports.includes(dependencyLayer),
          `${name}: forbidden layer dependency ${target}`);
        dependencies.push(resolved);
      } else {
        const schema = path.relative(path.join(root, 'schemas'), resolved).split(path.sep).join('/');
        assert.match(schema, /^(?:tempora\.(?:profile|ingestion-mapping)\.schema\.json|tempora\/v3\/[a-z-]+\.schema\.json)$/,
          `${name}: forbidden dependency ${target}`);
      }
    }
    graph.set(file, dependencies);
  }
  const active = new Set();
  const visited = new Set();
  function visit(file) {
    assert.ok(!active.has(file), `Import cycle: ${[...active, file].map(item => path.basename(item)).join(' -> ')}`);
    if (visited.has(file)) return;
    assert.ok(graph.has(file), `Untracked module: ${file}`);
    active.add(file);
    for (const dependency of graph.get(file)) visit(dependency);
    active.delete(file);
    visited.add(file);
  }
  for (const file of graph.keys()) visit(file);
}

function checkPublicSurfaces(root) {
  const scripts=['ingest-tempora.js','analyze-tempora.js','publish-tempora.js','serve-tempora.js'];
  const entries=[...scripts.map(name=>'scripts/'+name),'src/sdk/index.js','src/cli/tempora.js'];
  for(const file of entries) {
    const full=path.join(root,file), resolve=createRequire(full).resolve;
    for(const target of collectImports(fs.readFileSync(full,'utf8'),file,true)) {
      if(target.startsWith('node:')) continue;
      const relative=path.relative(root,resolve(target)).split(path.sep).join('/');
      assert.ok(relative==='package.json'||relative.startsWith('src/framework/')||
        relative.startsWith('src/sdk/')||entries.includes(relative),file+': forbidden dependency '+target);
    }
  }
}
module.exports = {checkBoundaries,checkPublicSurfaces};
