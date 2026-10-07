'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { SupabaseStore, makeStore, FileStore } = require('../lib/store');
const { createHandler } = require('../server');

// Minimal fake of the Supabase REST endpoint for a table of { id, data, created_at } rows.
function fakeSupabase() {
  const rows = [];
  const realFetch = global.fetch;
  const json = (code, body) => new Response(code === 204 || body === undefined ? null : JSON.stringify(body), { status: code });
  global.fetch = async (url, opts) => {
    if (!String(url).startsWith('https://fake.supabase.co/rest/v1/skiers')) return realFetch(url, opts);
    assert.strictEqual(opts.headers.apikey, 'sb_secret_x');
    assert.strictEqual(opts.headers.Authorization, undefined); // new-style keys are not JWTs
    const u = new URL(url);
    const idq = u.searchParams.get('id');
    const id = idq && idq.replace(/^eq\./, '');
    if (opts.method === 'GET') return json(200, rows.filter((r) => !id || r.id === id).map((r) => ({ data: r.data })));
    if (opts.method === 'POST') { const b = JSON.parse(opts.body); rows.push({ id: b.id, data: b.data }); return json(201); }
    if (opts.method === 'PATCH') { const r = rows.find((x) => x.id === id); if (r) r.data = JSON.parse(opts.body).data; return json(204); }
    if (opts.method === 'DELETE') { const i = rows.findIndex((x) => x.id === id); const gone = i >= 0 ? rows.splice(i, 1) : []; return json(200, gone.map((r) => ({ id: r.id }))); }
    return json(400, { message: 'unexpected' });
  };
  return () => { global.fetch = realFetch; };
}

test('SupabaseStore: create, get, update, list, remove', async () => {
  const restore = fakeSupabase();
  try {
    const s = new SupabaseStore('https://fake.supabase.co/', 'sb_secret_x');
    const a = await s.create({ name: 'Sanne' });
    assert.ok(a.id && a.editToken);
    assert.strictEqual((await s.get(a.id)).name, 'Sanne');
    await s.update(a.id, { name: 'Sanne B' });
    assert.strictEqual((await s.list())[0].name, 'Sanne B');
    assert.strictEqual(await s.remove(a.id), true);
    assert.strictEqual(await s.remove(a.id), false);
    assert.strictEqual((await s.list()).length, 0);
    assert.strictEqual(await s.get('nope'), null);
  } finally { restore(); }
});

test('SupabaseStore: legacy JWT keys also send Authorization', () => {
  const s = new SupabaseStore('https://x.supabase.co', 'eyJabc');
  assert.strictEqual(s.headers.Authorization, 'Bearer eyJabc');
});

test('makeStore: picks Supabase from env, fails loudly on Vercel without a database', () => {
  assert.ok(makeStore({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }) instanceof SupabaseStore);
  assert.throws(() => makeStore({ VERCEL: '1' }), /No database configured/);
  assert.ok(makeStore({ DATA_FILE: require('os').tmpdir() + '/bansko-x/s.json' }) instanceof FileStore);
});

test('handler answers 503 with a clear message when storage is missing', async () => {
  const saved = { V: process.env.VERCEL, U: process.env.SUPABASE_URL };
  process.env.VERCEL = '1'; delete process.env.SUPABASE_URL;
  const server = http.createServer(createHandler());
  await new Promise((r) => server.listen(0, r));
  try {
    const r = await fetch('http://127.0.0.1:' + server.address().port + '/api/skiers');
    assert.strictEqual(r.status, 503);
    assert.match((await r.json()).error, /SUPABASE_URL/);
  } finally {
    server.close();
    if (saved.V === undefined) delete process.env.VERCEL; else process.env.VERCEL = saved.V;
    if (saved.U !== undefined) process.env.SUPABASE_URL = saved.U;
  }
});
