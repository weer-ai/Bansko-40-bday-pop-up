'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Tiny JSON-file store. Writes are serialised and atomic (write temp + rename).
// To move to a hosted DB later, keep this same interface: list / get / create / update / remove.
class Store {
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

  list() { return this.skiers; }
  get(id) { return this.skiers.find((s) => s.id === id) || null; }

  async create(fields) {
    const s = Object.assign({}, fields, {
      id: 's_' + crypto.randomBytes(6).toString('hex'),
      editToken: crypto.randomBytes(18).toString('base64url'),
      hidden: false,
      createdAt: new Date().toISOString()
    });
    this.skiers.push(s);
    await this.persist();
    return s;
  }

  async update(id, fields) {
    const s = this.get(id);
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

module.exports = { Store };
