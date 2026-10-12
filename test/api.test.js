'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { createServer } = require('../server');
const { Store } = require('../lib/store');

async function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bansko-'));
  const server = createServer({ store: new Store(path.join(dir, 's.json')), adminToken: 'secret', seedSample: false });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { server, call, base };
}
const good = { name: 'Sanne', from: ['ams'], parts: ['slope'], stay: 'One week', where: 'Valentina Heights', msg: 'Hi!', jacket: '#4F74B3', email: 'sanne@example.com' };

test('signup, public list hides private fields, edit needs token', async () => {
  const { server, call } = await start();
  try {
    const c = await call('POST', '/api/skiers', good);
    assert.strictEqual(c.status, 201);
    assert.ok(c.body.editToken);
    const id = c.body.skier.id;

    const list = await call('GET', '/api/skiers');
    assert.strictEqual(list.body.length, 1);
    assert.strictEqual(list.body[0].email, undefined);
    assert.strictEqual(list.body[0].editToken, undefined);

    assert.strictEqual((await call('PUT', '/api/skiers/' + id, good, { 'X-Edit-Token': 'nope' })).status, 403);
    const up = await call('PUT', '/api/skiers/' + id, Object.assign({}, good, { msg: 'Updated' }), { 'X-Edit-Token': c.body.editToken });
    assert.strictEqual(up.status, 200);
    assert.strictEqual(up.body.skier.msg, 'Updated');
  } finally { server.close(); }
});

test('validation', async () => {
  const { server, call } = await start();
  try {
    assert.strictEqual((await call('POST', '/api/skiers', Object.assign({}, good, { name: ' ' }))).status, 400);
    assert.strictEqual((await call('POST', '/api/skiers', Object.assign({}, good, { from: [] }))).status, 400);
    assert.strictEqual((await call('POST', '/api/skiers', Object.assign({}, good, { from: ['other'] }))).status, 400);
    assert.strictEqual((await call('POST', '/api/skiers', Object.assign({}, good, { email: 'bad' }))).status, 400);
    // unknown enum values are coerced, not stored
    const r = await call('POST', '/api/skiers', Object.assign({}, good, { jacket: 'url(evil)', stay: 'x', where: 'y' }));
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.skier.jacket, '#6C171E');
    assert.strictEqual(r.body.skier.stay, 'Still deciding');
  } finally { server.close(); }
});

test('moderation: hide, unhide, delete need the admin token', async () => {
  const { server, call } = await start();
  try {
    const id = (await call('POST', '/api/skiers', good)).body.skier.id;
    assert.strictEqual((await call('POST', '/api/admin/skiers/' + id + '/hide')).status, 401);
    const auth = { Authorization: 'Bearer secret' };
    assert.strictEqual((await call('POST', '/api/admin/skiers/' + id + '/hide', null, auth)).status, 200);
    assert.strictEqual((await call('GET', '/api/skiers')).body.length, 0);
    assert.strictEqual((await call('GET', '/api/admin/skiers', null, auth)).body.length, 1);
    await call('POST', '/api/admin/skiers/' + id + '/unhide', null, auth);
    assert.strictEqual((await call('GET', '/api/skiers')).body.length, 1);
    assert.strictEqual((await call('DELETE', '/api/admin/skiers/' + id, null, auth)).status, 200);
    assert.strictEqual((await call('GET', '/api/skiers')).body.length, 0);
  } finally { server.close(); }
});

test('static files served, traversal blocked', async () => {
  const { server, base } = await start();
  try {
    const home = await fetch(base + '/');
    assert.strictEqual(home.status, 200);
    assert.match(await home.text(), /Ting is/);
    assert.strictEqual((await fetch(base + '/..%2fserver.js')).status === 200, false);
    assert.strictEqual((await fetch(base + '/nope.txt')).status, 404);
  } finally { server.close(); }
});
