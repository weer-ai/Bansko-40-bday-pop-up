'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Store } = require('./lib/store');
const { validateSkier, hatFor } = require('./lib/validate');
const { sampleSkiers } = require('./lib/sample');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

// What visitors may see. Email, edit token and hidden flag never leave the server here.
const publicView = (s) => ({
  id: s.id, name: s.name, from: s.from, fromOther: s.fromOther, parts: s.parts,
  stay: s.stay, where: s.where, msg: s.msg, jacket: s.jacket, hat: s.hat
});

const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function createServer(opts = {}) {
  const store = opts.store || new Store(process.env.DATA_FILE || path.join(__dirname, 'data', 'skiers.json'));
  const adminToken = opts.adminToken !== undefined ? opts.adminToken : (process.env.ADMIN_TOKEN || '');
  const maxSkiers = opts.maxSkiers || 500;

  if ((opts.seedSample ?? process.env.SEED_SAMPLE === '1') && store.list().length === 0) {
    sampleSkiers().forEach((s, i) => store.skiers.push(Object.assign({}, s, { id: 'sample_' + i, editToken: crypto.randomBytes(12).toString('hex'), hidden: false, sample: true, createdAt: new Date().toISOString() })));
  }

  // Naive per-IP limiter for writes: 10 per 10 minutes.
  const hits = new Map();
  const limited = (ip) => {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter((t) => now - t < 600000);
    arr.push(now); hits.set(ip, arr);
    return arr.length > 10;
  };

  const send = (res, code, body, headers = {}) => {
    const isStr = typeof body === 'string' || Buffer.isBuffer(body);
    res.writeHead(code, Object.assign({
      'Content-Type': isStr ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin'
    }, headers));
    res.end(isStr ? body : JSON.stringify(body));
  };

  const readJson = (req) => new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > 20000) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });

  const isAdmin = (req) => {
    const h = req.headers.authorization || '';
    return !!adminToken && h.startsWith('Bearer ') && safeEq(h.slice(7), adminToken);
  };

  async function api(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
    const ip = req.socket.remoteAddress || '?';
    const m = req.method;

    if (parts[1] === 'skiers' && parts.length === 2) {
      if (m === 'GET') return send(res, 200, store.list().filter((s) => !s.hidden).map(publicView), { 'Cache-Control': 'no-cache' });
      if (m === 'POST') {
        if (limited(ip)) return send(res, 429, { error: 'Easy there. Try again in a few minutes.' });
        let body; try { body = await readJson(req); } catch (e) { return send(res, 400, { error: 'Bad request.' }); }
        if (body.website) return send(res, 200, { ok: true }); // honeypot: pretend success
        if (store.list().length >= maxSkiers) return send(res, 503, { error: 'The slope is full.' });
        const v = validateSkier(body);
        if (!v.ok) return send(res, 400, { error: v.error });
        const s = await store.create(Object.assign({}, v.value, { hat: hatFor(v.value.name) }));
        return send(res, 201, { skier: publicView(s), editToken: s.editToken });
      }
    }

    if (parts[1] === 'skiers' && parts.length === 3 && m === 'PUT') {
      const s = store.get(parts[2]);
      const tok = req.headers['x-edit-token'] || '';
      if (!s || !tok || !safeEq(tok, s.editToken)) return send(res, 403, { error: 'This edit link is not valid.' });
      let body; try { body = await readJson(req); } catch (e) { return send(res, 400, { error: 'Bad request.' }); }
      const v = validateSkier(body);
      if (!v.ok) return send(res, 400, { error: v.error });
      const u = await store.update(s.id, Object.assign({}, v.value, { hat: hatFor(v.value.name) }));
      return send(res, 200, { skier: publicView(u) });
    }

    if (parts[1] === 'skiers' && parts.length === 3 && m === 'GET') {
      // Lets the page check that a stored edit token still points at a live entry.
      const s = store.get(parts[2]);
      const tok = req.headers['x-edit-token'] || '';
      if (!s || !tok || !safeEq(tok, s.editToken)) return send(res, 403, { error: 'Not found.' });
      return send(res, 200, { skier: Object.assign(publicView(s), { email: s.email || '' }) });
    }

    if (parts[1] === 'admin') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Unauthorized.' });
      if (parts[2] === 'skiers' && parts.length === 3 && m === 'GET')
        return send(res, 200, store.list().map((s) => Object.assign(publicView(s), { email: s.email || '', hidden: !!s.hidden, createdAt: s.createdAt, sample: !!s.sample })));
      const id = parts[3];
      if (parts[2] === 'skiers' && id && parts[4] === 'hide' && m === 'POST') return send(res, (await store.update(id, { hidden: true })) ? 200 : 404, { ok: true });
      if (parts[2] === 'skiers' && id && parts[4] === 'unhide' && m === 'POST') return send(res, (await store.update(id, { hidden: false })) ? 200 : 404, { ok: true });
      if (parts[2] === 'skiers' && id && parts.length === 4 && m === 'DELETE') return send(res, (await store.remove(id)) ? 200 : 404, { ok: true });
    }
    return send(res, 404, { error: 'Not found.' });
  }

  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    let rel; try { rel = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'Bad request'); }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'Not found');
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff'
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) {
      api(req, res, url).catch((e) => { console.error(e); if (!res.headersSent) send(res, 500, { error: 'Something broke.' }); });
    } else serveStatic(req, res, url);
  });
  server.store = store;
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  if (!process.env.ADMIN_TOKEN) console.warn('ADMIN_TOKEN is not set: moderation endpoints are disabled.');
  createServer().listen(port, () => console.log('Bansko pop-up on http://localhost:' + port));
}

module.exports = { createServer };
