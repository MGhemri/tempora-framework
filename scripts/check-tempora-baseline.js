const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {readCorpus, root} = require('../src/canonical');
const {snapshot} = require('./capture-v1-baseline');
const v2 = require('../api/v2/handler');

const sha256 = value => createHash('sha256').update(value).digest('hex');
const fixture = path.join(root, 'tests/baselines/alnop-compatibility.json');

function filesIn(directory) {
  return fs.readdirSync(path.join(root, directory), {withFileTypes: true}).flatMap(entry => {
    const file = directory + '/' + entry.name;
    return entry.isDirectory() ? filesIn(file) : [file];
  }).sort();
}

function requestV2(url, method = 'GET') {
  const response = {
    statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() {}
  };
  v2({url, method, headers: {}}, response);
  const {date, ...headers} = response.headers;
  return {url, method, status: response.statusCode, headers, body_sha256: sha256(JSON.stringify(response.body))};
}

function capture() {
  const corpus = readCorpus();
  const collections = Object.fromEntries(Object.entries(corpus)
    .filter(([, records]) => Array.isArray(records))
    .map(([name, records]) => [name, {count: records.length, ids_sha256: sha256(JSON.stringify(records.map(r => r.id ?? r.source_id).sort()))}]));
  const files = [...filesIn('data'), ...filesIn('docs/data'), ...filesIn('openapi')];
  const archives = Object.fromEntries(files.filter(file => file.endsWith('.zip'))
    .map(file => [file, sha256(fs.readFileSync(path.join(root, file)))]));
  return {
    collections,
    files: Object.fromEntries(files.filter(file => !file.endsWith('.zip'))
      .map(file => [file, sha256(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'))])),
    archives, v1: snapshot(),
    v2: [
      requestV2('/api/v2/operations?limit=2&page=2'),
      requestV2('/api/v2/operations/OP_1954_001'),
      requestV2('/api/v2/operations?format=geojson&limit=2'),
      requestV2('/api/v2/operations?limit=0'),
      requestV2('/api/v2/releases/current'),
      requestV2('/api/v2/operations', 'OPTIONS'),
      requestV2('/api/v2/operations', 'POST')
    ]
  };
}

function differences(expected, actual, location = '') {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return [];
  if (expected && actual && typeof expected === 'object' && typeof actual === 'object') {
    return [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
      .flatMap(key => differences(expected[key], actual[key], location + '/' + key));
  }
  return [location];
}

if (require.main === module) {
  const reference = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  const actual = capture();
  const changed = differences(reference.baseline, actual);
  console.log(JSON.stringify({reference_sha: reference.git_sha, valid: !changed.length, changed,
    collections: actual.collections, archives: actual.archives}, null, 2));
  process.exitCode = changed.length ? 1 : 0;
}

module.exports = {capture, differences};
