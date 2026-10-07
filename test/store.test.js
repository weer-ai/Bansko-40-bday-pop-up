'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { RedisStore, makeStore, FileStore } = require('../lib/store');
const { createHandler } = require('../server');
const http = require('http');

// Minimal fake of Upstash's REST API: POST a command array, get { result }.
function fakeUpstash() {
  const hash = new Map();
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (url !== 'https://fake.upstash.io') return realFetch(url, opts);
    assert.strictEqual(opts.headers.Authorization, 'Bearer tok');
    const [cmd, , ...rest] = JSON.parse(opts.body);
    let result;
    if (cmd === 'HGETALL') result = [...hash].flat();
    else if (cmd === 'HGET') result = hash.get(rest[0]) ?? null;
    else if (cmd === 'HSET') { hash.set(rest[0], rest[1]); result = 1; }
    else if (cmd === 'HDEL') result = hash.delete(rest[0]) ? 1 : 0;
    else return new Response(JSON.stringify({ error: 'unknown ' + cmd }), { status: 400 });
    return new Response(JSON.stringify({ result }), { status: 200 });
  };
  return () => { global.fetch = realFetch; };
}

test('RedisStore: create, get, update, list, remove', async () => {
  const restore = fakeUpstash();
  try {
    const s = new RedisStore('https://fake.upstash.io', 'tok');
    const a = await s.create({ name: 'Sanne' });
    assert.ok(a.id && a.editToken);
    assert.strictEqual((await s.get(a.id)).name, 'Sanne');
    await s.update(a.id, { name: 'Sanne B' });
    assert.strictEqual((await s.list())[0].name, 'Sanne B');
    assert.strictEqual(await s.remove(a.id), true);
    assert.strictEqual((await s.list()).length, 0);
    assert.strictEqual(await s.get('nope'), null);
  } finally { restore(); }
});

test('makeStore: picks Redis from env, fails loudly on Vercel without a database', () => {
  assert.ok(makeStore({ UPSTASH_REDIS_REST_URL: 'u', UPSTASH_REDIS_REST_TOKEN: 't' }) instanceof RedisStore);
  assert.ok(makeStore({ KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't' }) instanceof RedisStore);
  assert.throws(() => makeStore({ VERCEL: '1' }), /No database configured/);
  assert.ok(makeStore({ DATA_FILE: require('os').tmpdir() + '/bansko-x/s.json' }) instanceof FileStore);
});

test('handler answers 503 with a clear message when storage is missing', async () => {
  const saved = { V: process.env.VERCEL, U: process.env.UPSTASH_REDIS_REST_URL, K: process.env.KV_REST_API_URL };
  process.env.VERCEL = '1'; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL;
  const server = http.createServer(createHandler());
  await new Promise((r) => server.listen(0, r));
  try {
    const r = await fetch('http://127.0.0.1:' + server.address().port + '/api/skiers');
    assert.strictEqual(r.status, 503);
    assert.match((await r.json()).error, /Upstash Redis/);
  } finally {
    server.close();
    if (saved.V === undefined) delete process.env.VERCEL; else process.env.VERCEL = saved.V;
    if (saved.U !== undefined) process.env.UPSTASH_REDIS_REST_URL = saved.U;
    if (saved.K !== undefined) process.env.KV_REST_API_URL = saved.K;
  }
});
