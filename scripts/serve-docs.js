// Local documentation preview: only the explicit Pages artifact is served.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = fs.realpathSync(path.resolve(__dirname, '../work/pages'));
const types = {'.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json'};
http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!target.startsWith(root + path.sep)) throw Error();
    const real = fs.realpathSync(target);
    if (!real.startsWith(root + path.sep) || !fs.statSync(real).isFile()) throw Error();
    res.setHeader('Content-Type', types[path.extname(real)] || 'application/octet-stream');
    res.end(fs.readFileSync(real));
  } catch {res.writeHead(404); res.end('Not found');}
}).listen(8765, '127.0.0.1');
