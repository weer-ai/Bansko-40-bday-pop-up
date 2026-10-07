'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Both stores share one async interface: list / get / create / update / remove.
// FileStore is for local dev and any host with a persistent disk.
// SupabaseStore is for Vercel and other serverless hosts.

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

// Supabase over its REST API (PostgREST), no SDK needed. Uses the server-side secret key,
// so the table must have row level security on with no policies: the public key can then read nothing.
class SupabaseStore {
  constructor(url, key) {
    this.base = url.replace(/\/+$/, '') + '/rest/v1/skiers';
    this.headers = { apikey: key, 'Content-Type': 'application/json' };
    if (key.startsWith('eyJ')) this.headers.Authorization = 'Bearer ' + key; // legacy JWT keys only
  }

  async req(method, query, body, extra) {
    const r = await fetch(this.base + query, { method, headers: Object.assign({}, this.headers, extra), body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + text.slice(0, 200));
    return text ? JSON.parse(text) : [];
  }

  async list() { return (await this.req('GET', '?select=data&order=created_at.asc')).map((r) => r.data); }

  async get(id) {
    const rows = await this.req('GET', '?select=data&id=eq.' + encodeURIComponent(id));
    return rows.length ? rows[0].data : null;
  }

  async create(fields) {
    const s = newSkier(fields);
    await this.req('POST', '', { id: s.id, data: s }, { Prefer: 'return=minimal' });
    return s;
  }

  async update(id, fields) {
    const s = await this.get(id);
    if (!s) return null;
    Object.assign(s, fields, { updatedAt: new Date().toISOString() });
    await this.req('PATCH', '?id=eq.' + encodeURIComponent(id), { data: s }, { Prefer: 'return=minimal' });
    return s;
  }

  async remove(id) {
    const rows = await this.req('DELETE', '?select=id&id=eq.' + encodeURIComponent(id), null, { Prefer: 'return=representation' });
    return rows.length > 0;
  }
}

// Picks the store from the environment. On Vercel there is no persistent disk,
// so a missing database is an error instead of a silent fallback that would lose sign-ups.
function makeStore(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (url && key) return new SupabaseStore(url, key);
  if (env.VERCEL) throw new Error('No database configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  return new FileStore(env.DATA_FILE || path.join(__dirname, '..', 'data', 'skiers.json'));
}

module.exports = { FileStore, SupabaseStore, makeStore, Store: FileStore };
