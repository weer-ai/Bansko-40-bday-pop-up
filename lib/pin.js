'use strict';
const crypto = require('crypto');

// A PIN lets someone find their own entry again from any phone: name + PIN.
// Stored only as a salted scrypt hash; it never appears in any API response.

const PIN_RE = /^\d{4,8}$/;
const MAX_TRIES = 5;          // wrong guesses before the entry locks
const LOCK_MS = 15 * 60000;   // how long it stays locked

const hashPin = (pin) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16);
  crypto.scrypt(String(pin), salt, 32, (err, key) => (err ? reject(err) : resolve('s1$' + salt.toString('base64url') + '$' + key.toString('base64url'))));
});

const checkPin = (pin, stored) => new Promise((resolve) => {
  const m = /^s1\$([\w-]+)\$([\w-]+)$/.exec(stored || '');
  if (!m) return resolve(false);
  crypto.scrypt(String(pin), Buffer.from(m[1], 'base64url'), 32, (err, key) => {
    const want = Buffer.from(m[2], 'base64url');
    resolve(!err && key.length === want.length && crypto.timingSafeEqual(key, want));
  });
});

// Names are compared without case or extra spaces: "sanne " finds "Sanne".
const normName = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();

module.exports = { PIN_RE, MAX_TRIES, LOCK_MS, hashPin, checkPin, normName };
