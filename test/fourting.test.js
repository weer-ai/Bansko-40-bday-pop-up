'use strict';
// Sign-up fields added with the FourTing design: rider type, relationship, dates, helmet, photo,
// and the private ski-pass / extra-bag answers.
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { createServer } = require('../server');
const { Store } = require('../lib/store');
const { validateSkier, crowdFor } = require('../lib/validate');
const { sampleSkiers } = require('../lib/sample');

async function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bansko-ft-'));
  const server = createServer({ store: new Store(path.join(dir, 's.json')), adminToken: 'secret', seedSample: false });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { server, call };
}

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/';
const ft = { name: 'Wei', rel: 'Bestie from Amsterdam', type: 'board', jacket: '#2A62C9', hat: '#F2C200', arrive: 8, leave: 15, where: 'Valentina Heights', msg: 'Race you down!', pass: 'yes', bag: true, email: 'wei@example.com', photo: JPEG };

test('relationship text maps to crowds', () => {
  assert.deepStrictEqual(crowdFor('Bestie from Amsterdam'), ['ams']);
  assert.deepStrictEqual(crowdFor('Studied in Delft, now a nomad'), ['delft', 'nomad']);
  assert.deepStrictEqual(crowdFor('Future neighbour'), ['bansko']);
  assert.deepStrictEqual(crowdFor('Colleague'), ['other']);
});

test('a sign-up with only the new fields validates and derives the old ones', () => {
  const v = validateSkier(ft);
  assert.ok(v.ok);
  assert.deepStrictEqual(v.value.from, ['ams']);
  assert.strictEqual(v.value.type, 'board');
  assert.strictEqual(v.value.hat, '#F2C200');
  assert.strictEqual(v.value.jacket, '#2A62C9');
  assert.strictEqual(v.value.stay, 'One week');
  assert.strictEqual(v.value.pass, 'yes');
  assert.strictEqual(v.value.bag, true);
  // free text that matches no crowd is kept as the "other" label
  const o = validateSkier(Object.assign({}, ft, { rel: 'Colleague' }));
  assert.deepStrictEqual(o.value.from, ['other']);
  assert.strictEqual(o.value.fromOther, 'Colleague');
});

test('dates are clamped to 6-20 Feb and ordered; unknown values fall back', () => {
  assert.deepStrictEqual([validateSkier(Object.assign({}, ft, { arrive: 15, leave: 8 })).value].map((x) => [x.arrive, x.leave])[0], [8, 15]);
  const single = validateSkier(Object.assign({}, ft, { arrive: 12, leave: undefined })).value;
  assert.deepStrictEqual([single.arrive, single.leave, single.stay], [12, 12, 'Just the 12th']);
  const bad = validateSkier(Object.assign({}, ft, { arrive: 99, leave: 3, type: 'tank', pass: 'maybe', bag: 'yes', hat: 'url(x)' })).value;
  assert.deepStrictEqual([bad.arrive, bad.leave, bad.type, bad.pass, bad.bag, bad.hat], [0, 0, 'skier', '', false, '']);
});

test('only a small base64 JPEG is accepted as a photo', () => {
  assert.strictEqual(validateSkier(Object.assign({}, ft, { photo: '' })).value.photo, '');
  for (const photo of ['data:image/svg+xml;base64,PHN2Zz4=', 'javascript:alert(1)', 'data:image/jpeg;base64,/9j/<script>', JPEG + 'A'.repeat(20000)]) {
    assert.strictEqual(validateSkier(Object.assign({}, ft, { photo })).ok, false, photo.slice(0, 30));
  }
});

test('API: new fields are public, ski pass / extra bag / email stay private, admin sees all', async () => {
  const { server, call } = await start();
  try {
    const c = await call('POST', '/api/skiers', ft);
    assert.strictEqual(c.status, 201);
    const pub = (await call('GET', '/api/skiers')).body[0];
    assert.deepStrictEqual([pub.type, pub.rel, pub.arrive, pub.leave, pub.hat, pub.photo], ['board', 'Bestie from Amsterdam', 8, 15, '#F2C200', JPEG]);
    for (const k of ['pass', 'bag', 'email', 'editToken', 'hidden']) assert.strictEqual(pub[k], undefined, k);
    assert.strictEqual(c.body.skier.pass, undefined);

    const auth = { Authorization: 'Bearer secret' };
    const adm = (await call('GET', '/api/admin/skiers', null, auth)).body[0];
    assert.deepStrictEqual([adm.pass, adm.bag, adm.email], ['yes', true, 'wei@example.com']);

    // the owner gets their private answers back to edit, and can change them
    const own = await call('GET', '/api/skiers/' + c.body.skier.id, null, { 'X-Edit-Token': c.body.editToken });
    assert.deepStrictEqual([own.body.skier.pass, own.body.skier.bag], ['yes', true]);
    const up = await call('PUT', '/api/skiers/' + c.body.skier.id, Object.assign({}, ft, { pass: 'no', bag: false, photo: '' }), { 'X-Edit-Token': c.body.editToken });
    assert.strictEqual(up.status, 200);
    const adm2 = (await call('GET', '/api/admin/skiers', null, auth)).body[0];
    assert.deepStrictEqual([adm2.pass, adm2.bag, adm2.photo], ['no', false, '']);
  } finally { server.close(); }
});

test('entries saved before the FourTing design still list', async () => {
  const { server, call } = await start();
  try {
    const old = { name: 'Sanne', from: ['ams'], parts: ['slope'], stay: 'One week', where: 'Valentina Heights', msg: 'Hi!', jacket: '#4F74B3' };
    assert.strictEqual((await call('POST', '/api/skiers', old)).status, 201);
    const s = (await call('GET', '/api/skiers')).body[0];
    assert.strictEqual(s.jacket, '#4F74B3');
    assert.strictEqual(s.type, 'skier');
    assert.ok(s.hat);
  } finally { server.close(); }
});

test('sample skiers all pass validation', () => {
  const list = sampleSkiers();
  assert.ok(list.length > 10);
  for (const s of list) assert.ok(validateSkier(s).ok, s.name);
});
