import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
test('Tauri foundation has an explicit Rust runtime command and secure embedded UI', () => {
  const config = JSON.parse(read('src-tauri/tauri.conf.json'));
  assert.equal(config.version, '0.1.0');
  assert.equal(config.build.frontendDist, '../ui');
  assert.equal(config.bundle.active, false);
  assert.ok(config.app.security.csp.includes("default-src 'self'"));
  assert.ok(!config.app.security.csp.includes("'unsafe-eval'"));
  assert.match(read('src-tauri/src/main.rs'), /fn runtime_info\(\)/);
  assert.doesNotMatch(read('src-tauri/src/main.rs'), /shell\(\)|Command::new|\.args\(/);
});
test('UI is local-only and preview does not claim historical validation', () => {
  const html = read('ui/index.html'), script = read('ui/app.js');
  assert.match(html, /sans validation canonique/);
  assert.match(script, /8 \* 1024 \* 1024/);
  assert.match(script, /JSON\.parse/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|localStorage|eval\(/);
  assert.ok(existsSync(new URL('ui/styles.css', root)));
});
test('Desktop remains isolated from published framework package', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.version, '0.1.0');
  assert.ok(!('tempora-framework' in (packageJson.dependencies || {})));
  const docs = read('README.md');
  assert.match(docs, /not wired to TEMPORA Engine yet/);
});
