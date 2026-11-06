import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
const root = resolve(new URL('../ui/', import.meta.url).pathname);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
createServer(async (request, response) => {
  const uri = new URL(request.url || '/', 'http://127.0.0.1');
  const path = resolve(root, '.' + decodeURIComponent(uri.pathname === '/' ? '/index.html' : uri.pathname));
  if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
  if (!Object.hasOwn(types, extname(path))) { response.writeHead(404); response.end(); return; }
  try { const data = await readFile(path); response.writeHead(200,{'content-type':types[extname(path)],'cache-control':'no-store'});response.end(data); }
  catch { response.writeHead(404);response.end(); }
}).listen(4176, '127.0.0.1', () => console.log('TEMPORA Studio web-only preview: http://127.0.0.1:4176'));
