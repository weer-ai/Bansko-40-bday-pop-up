'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Both stores share one async interface: list / get / create / update / remove.
// FileStore is for local dev and any host with a persistent disk.
// RedisStore talks to Upstash Redis over its REST API (what Vercel's Marketplace provisions).

const newSkier = (fields) => Object.assign({}, fields, {
  id: 's_' + crypto.randomBytes(6).toString('hex'),
  editToken: crypto.randomBytes(18).toString('base64url'),
  hidden: false,
  createdAt: new Date().toISOString()
});

class FileStore {
  constructor(file) {
    this.file = file;
    this.skiers = [];
    this.queue = Promise.resolve();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try { this.skiers = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { this.skiers = []; }
  }

  persist() {
    const data = JSON.stringify(this.skiers, null, 2);
    this.queue = this.queue.then(() => {
      const tmp = this.file + '.tmp';
      return fs.promises.writeFile(tmp, data).then(() => fs.promises.rename(tmp, this.file));
    });
    return this.queue;
  }

  async list() { return this.skiers; }
  async get(id) { return this.skiers.find((s) => s.id === id) || null; }

  async seedIfEmpty(items) {
    if (this.skiers.length) return;
    items.forEach((s, i) => this.skiers.push(Object.assign({}, s, { id: 'sample_' + i, editToken: crypto.randomBytes(12).toString('hex'), hidden: false, sample: true, createdAt: new Date().toISOString() })));
  }

  async create(fields) {
    const s = newSkier(fields);
    this.skiers.push(s);
    await this.persist();
    return s;
  }

  async update(id, fields) {
    const s = await this.get(id);
    if (!s) return null;
    Object.assign(s, fields, { updatedAt: new Date().toISOString() });
    await this.persist();
    return s;
  }

  async remove(id) {
    const i = this.skiers.findIndex((s) => s.id === id);
    if (i < 0) return false;
    this.skiers.splice(i, 1);
    await this.persist();
    return true;
  }
}

class RedisStore {
  constructor(url, token) { this.url = url; this.token = token; this.key = 'bansko:skiers'; }

  async cmd(args) {
    const r = await fetch(this.url, { method: 'POST', headers: { Authorization: 'Bearer ' + this.token }, body: JSON.stringify(args) });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error('Redis: ' + (j.error || r.status));
    return j.result;
  }

  async list() {
    const flat = (await this.cmd(['HGETALL', this.key])) || [];
    const out = [];
    for (let i = 1; i < flat.length; i += 2) { try { out.push(JSON.parse(flat[i])); } catch (e) { /* skip corrupt row */ } }
    return out.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  async get(id) {
    const v = await this.cmd(['HGET', this.key, id]);
    return v ? JSON.parse(v) : null;
  }

  async create(fields) {
    const s = newSkier(fields);
    await this.cmd(['HSET', this.key, s.id, JSON.stringify(s)]);
    return s;
  }

  async update(id, fields) {
    const s = await this.get(id);
    if (!s) return null;
    Object.assign(s, fields, { updatedAt: new Date().toISOString() });
    await this.cmd(['HSET', this.key, id, JSON.stringify(s)]);
    return s;
  }

  async remove(id) { return (await this.cmd(['HDEL', this.key, id])) > 0; }
}

// Picks the store from the environment. On Vercel there is no persistent disk,
// so a missing database is an error instead of a silent fallback that would lose sign-ups.
function makeStore(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (url && token) return new RedisStore(url, token);
  if (env.VERCEL) throw new Error('No database configured. Add Upstash Redis in the Vercel Storage tab.');
  return new FileStore(env.DATA_FILE || path.join(__dirname, '..', 'data', 'skiers.json'));
}

module.exports = { FileStore, RedisStore, makeStore, Store: FileStore };
