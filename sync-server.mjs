// Vel Groups shared data server. No dependencies: `node server/sync-server.mjs`.
// Stores every shared "table" (products, orders, ...) as JSON in server/data.json and serves dist/ if built.
// Env: PORT (default 8787), OWNER_KEY (required to READ vendor documents and payment screenshots).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DB = process.env.DB_FILE || path.join(here, 'data.json');
const DIST = process.env.DIST_DIR || path.join(here, '..', 'dist');
const PORT = Number(process.env.PORT || 8787);
const OWNER_KEY = process.env.OWNER_KEY || '';
const SHARED = new Set(['products', 'services', 'company', 'settings', 'orders', 'enquiries', 'categories', 'proofs', 'vendors', 'vendorDocs', 'users']);
const SENSITIVE = new Set(['proofs', 'vendorDocs']); // merged per id on write, readable only with the owner key
const MAX_BODY = 60 * 1024 * 1024;

const clients = new Set();
const broadcast = (key) => { for (const c of clients) c.write(`data: ${JSON.stringify({ key })}\n\n`); };
setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 25000);

let db = {};
try { db = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { db = {}; }
let timer = null;
const persist = () => {
  clearTimeout(timer);
  timer = setTimeout(() => { const tmp = DB + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB); }, 150);
};
const isOwner = (req) => !!OWNER_KEY && req.headers['x-owner-key'] === OWNER_KEY;
const send = (res, code, body) => {
  res.writeHead(code, {
    'content-type': 'application/json', 'cache-control': 'no-store',
    'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-owner-key', 'access-control-allow-methods': 'GET,PUT,OPTIONS',
  });
  res.end(JSON.stringify(body));
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (url.pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'access-control-allow-origin': '*' });
    res.write('retry: 2000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/api/state' && req.method === 'GET') {
    const out = {};
    for (const [k, v] of Object.entries(db)) {
      if (SENSITIVE.has(k) && !isOwner(req)) continue;
      out[k] = { rev: v.rev, value: v.value };
    }
    return send(res, 200, { data: out });
  }
  const m = url.pathname.match(/^\/api\/state\/([A-Za-z]+)$/);
  if (m && req.method === 'PUT') {
    const key = m[1];
    if (!SHARED.has(key)) return send(res, 400, { error: 'Unknown key' });
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) req.destroy(); else chunks.push(c); });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(res, 400, { error: 'Bad JSON' }); }
      const cur = db[key];
      if (SENSITIVE.has(key)) {
        const merged = { ...(cur?.value || {}), ...(body.value || {}) };
        db[key] = { rev: (cur?.rev || 0) + 1, value: merged }; persist(); broadcast(key);
        return send(res, 200, { rev: db[key].rev });
      }
      if (cur && Number(body.baseRev || 0) !== cur.rev) return send(res, 409, { rev: cur.rev, value: cur.value });
      db[key] = { rev: (cur?.rev || 0) + 1, value: body.value }; persist(); broadcast(key);
      send(res, 200, { rev: db[key].rev });
    });
    return;
  }
  if (req.method === 'GET' && fs.existsSync(DIST)) {
    let f = path.normalize(path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': f.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable' });
    return fs.createReadStream(f).pipe(res);
  }
  send(res, 404, { error: 'Not found' });
}).listen(PORT, () => console.log(`Vel Groups server on http://localhost:${PORT}  (owner key ${OWNER_KEY ? 'set' : 'NOT set: documents will not sync'})`));
