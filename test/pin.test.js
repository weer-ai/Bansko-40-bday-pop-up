'use strict';
// Name + PIN: how a friend gets back into their entry from another phone.
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { createServer } = require('../server');
const { Store } = require('../lib/store');
const { hashPin, checkPin } = require('../lib/pin');

async function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bansko-pin-'));
  const store = new Store(path.join(dir, 's.json'));
  const server = createServer({ store, adminToken: 'secret', seedSample: false });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { server, store, call };
}
const person = { name: 'Sanne', rel: 'Bestie from Amsterdam', type: 'skier', arrive: 8, leave: 15, msg: 'Hi!', pin: '4821', email: 'sanne@example.com' };
const find = (call, name, pin) => call('POST', '/api/skiers/find', { name, pin });

test('hash and check', async () => {
  const h = await hashPin('4821');
  assert.ok(!h.includes('4821'));
  assert.strictEqual(await checkPin('4821', h), true);
  assert.strictEqual(await checkPin('4822', h), false);
  assert.strictEqual(await checkPin('4821', ''), false);
  assert.notStrictEqual(await hashPin('4821'), h); // salted
});

test('sign-up needs a well-formed PIN only when one is given; the PIN is never exposed', async () => {
  const { server, call } = await start();
  try {
    for (const pin of ['123', '123456789', 'abcd', '12 34']) assert.strictEqual((await call('POST', '/api/skiers', Object.assign({}, person, { pin }))).status, 400, pin);
    const c = await call('POST', '/api/skiers', person);
    assert.strictEqual(c.status, 201);
    assert.strictEqual((await call('POST', '/api/skiers', Object.assign({}, person, { name: 'No Pin', pin: undefined }))).status, 201); // the API itself does not insist; the page does
    const everything = JSON.stringify([
      c.body, (await call('GET', '/api/skiers')).body,
      (await call('GET', '/api/skiers/' + c.body.skier.id, null, { 'X-Edit-Token': c.body.editToken })).body,
      (await call('GET', '/api/admin/skiers', null, { Authorization: 'Bearer secret' })).body
    ]);
    assert.ok(!everything.includes('4821'));
    assert.ok(!/pinHash|s1\$/.test(everything));
    const adm = (await call('GET', '/api/admin/skiers', null, { Authorization: 'Bearer secret' })).body;
    assert.deepStrictEqual(adm.map((s) => s.hasPin), [true, false]); // Ting can see who has no way back in
  } finally { server.close(); }
});

test('name + PIN returns the edit token, any case, and the token edits the entry', async () => {
  const { server, call } = await start();
  try {
    const c = await call('POST', '/api/skiers', person);
    const r = await find(call, '  sANNE ', '4821');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual([r.body.id, r.body.editToken], [c.body.skier.id, c.body.editToken]);
    const up = await call('PUT', '/api/skiers/' + r.body.id, Object.assign({}, person, { msg: 'Edited from my new phone', pin: undefined }), { 'X-Edit-Token': r.body.editToken });
    assert.strictEqual(up.status, 200);
    assert.strictEqual((await find(call, 'Sanne', '4821')).status, 200); // omitting the PIN on edit keeps the old one
  } finally { server.close(); }
});

test('wrong name or PIN is a generic 403; five wrong PINs lock the entry, a lock expires', async () => {
  const { server, store, call } = await start();
  try {
    await call('POST', '/api/skiers', person);
    assert.strictEqual((await find(call, 'Nobody', '4821')).status, 403);
    assert.strictEqual((await find(call, 'Sanne', 'abc')).status, 403);
    for (let i = 0; i < 5; i++) {
      const r = await find(call, 'Sanne', '0000');
      assert.strictEqual(r.status, 403);
      assert.strictEqual(r.body.error, 'That name and PIN do not match.');
    }
    // locked now: even the right PIN is refused
    const locked = await find(call, 'Sanne', '4821');
    assert.strictEqual(locked.status, 429);
    // time passes
    const s = (await store.list())[0];
    await store.update(s.id, { pinLockUntil: new Date(Date.now() - 1000).toISOString() });
    assert.strictEqual((await find(call, 'Sanne', '4821')).status, 200);
    // and a good sign-in clears the failure count
    for (let i = 0; i < 4; i++) await find(call, 'Sanne', '0000');
    assert.strictEqual((await find(call, 'Sanne', '4821')).status, 200);
    assert.strictEqual((await find(call, 'Sanne', '0000')).status, 403);
  } finally { server.close(); }
});

test('same name twice: the PIN picks the right entry; hidden and PIN-less entries are not found', async () => {
  const { server, call } = await start();
  try {
    const a = await call('POST', '/api/skiers', person);
    const b = await call('POST', '/api/skiers', Object.assign({}, person, { pin: '9999' }));
    assert.strictEqual((await find(call, 'Sanne', '9999')).body.id, b.body.skier.id);
    assert.strictEqual((await find(call, 'Sanne', '4821')).body.id, a.body.skier.id);
    const auth = { Authorization: 'Bearer secret' };
    await call('POST', '/api/admin/skiers/' + a.body.skier.id + '/hide', null, auth);
    assert.strictEqual((await find(call, 'Sanne', '4821')).status, 403);
    const legacy = await call('POST', '/api/skiers', Object.assign({}, person, { name: 'Legacy', pin: undefined }));
    assert.strictEqual(legacy.status, 201);
    assert.strictEqual((await find(call, 'Legacy', '4821')).status, 403);
  } finally { server.close(); }
});

test('changing the PIN on edit replaces the old one', async () => {
  const { server, call } = await start();
  try {
    const c = await call('POST', '/api/skiers', person);
    const h = { 'X-Edit-Token': c.body.editToken };
    assert.strictEqual((await call('PUT', '/api/skiers/' + c.body.skier.id, Object.assign({}, person, { pin: '12' }), h)).status, 400);
    assert.strictEqual((await call('PUT', '/api/skiers/' + c.body.skier.id, Object.assign({}, person, { pin: '7777' }), h)).status, 200);
    assert.strictEqual((await find(call, 'Sanne', '4821')).status, 403);
    assert.strictEqual((await find(call, 'Sanne', '7777')).status, 200);
  } finally { server.close(); }
});
