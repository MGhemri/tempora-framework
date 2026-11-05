const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire, isBuiltin} = require('node:module');

function checkBoundaries(root) {
  const core = path.join(root, 'src/framework');
  const graph = new Map();
  for (const name of fs.readdirSync(core, {recursive: true})) {
    if (!name.endsWith('.js')) continue;
    const file = path.join(core, name);
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\b(?:alnop|wilaya|FLN|ALN|1954|1962)\b|\bdata[\\/]|operations_fln/i, `${name}: historical data reference`);
    const dependencies = [];
    const resolve = createRequire(file).resolve;
    for (const [, argument] of source.matchAll(/\b(?:require|import)\s*\(\s*([^)]+)\)/g)) {
      const literal = /^(['"])([^'"\\]+)\1$/.exec(argument.trim());
      if (!literal) {
        assert.ok(name === 'canonical.js' && argument.trim() === '`../../schemas/tempora/v3/${name}.schema.json`',
          `${name}: unsupported dynamic import ${argument}`);
        continue;
      }
      const target = literal[2];
      if (isBuiltin(target) || /^(?:ajv(?:\/dist\/2020)?|ajv-formats)$/.test(target)) continue;
      assert.ok(target.startsWith('.'), `${name}: unexpected dependency ${target}`);
      const resolved = resolve(target);
      if (resolved.startsWith(core + path.sep) && resolved.endsWith('.js')) {
        dependencies.push(resolved);
      } else {
        const schema = path.relative(path.join(root, 'schemas'), resolved).split(path.sep).join('/');
        assert.match(schema, /^(?:tempora\.(?:profile|ingestion-mapping)\.schema\.json|tempora\/v3\/[a-z-]+\.schema\.json)$/,
          `${name}: forbidden dependency ${target}`);
      }
    }
    assert.doesNotMatch(source, /\b(?:import|export)\s+(?:[\w*{]|['"])/, `${name}: untracked module syntax`);
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

module.exports = {checkBoundaries};
