'use strict';

const ORIGINS = ['ams', 'delft', 'bansko', 'tw', 'nomad', 'other'];
const PARTS = ['colive', 'slope', 'spa'];
const STAY = ['The whole month', 'Two weeks', 'One week', 'Just the 12th', 'Still deciding'];
const WHERE = ['Valentina Heights', 'My own place in Bansko', 'A hotel in town', 'Still deciding'];
const JACKETS = ['#6C171E', '#4F74B3', '#1F5560', '#D9A23A', '#9E3F6E', '#1D1D1B', '#F1F5FA', '#C8D63A'];
const HATS = ['#1D1D1B', '#F1F5FA', '#6C171E', '#D9A23A', '#4F74B3'];

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// Returns { ok: true, value } or { ok: false, error }. Never trusts the client's shape.
function validateSkier(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Bad request.' };
  const name = clean(body.name, 40);
  if (!name) return { ok: false, error: 'Add your name first.' };

  const from = Array.isArray(body.from) ? [...new Set(body.from.filter((x) => ORIGINS.includes(x)))] : [];
  if (!from.length) return { ok: false, error: 'Tell us where you know Ting from.' };
  const fromOther = clean(body.fromOther, 40);
  if (from.includes('other') && !fromOther) return { ok: false, error: 'Fill in where you know Ting from.' };

  let parts = Array.isArray(body.parts) ? [...new Set(body.parts.filter((x) => PARTS.includes(x)))] : [];
  if (!parts.length) parts = ['slope'];

  const stay = STAY.includes(body.stay) ? body.stay : 'Still deciding';
  const where = WHERE.includes(body.where) ? body.where : 'Still deciding';
  const msg = clean(body.msg, 140) || 'See you on the slope!';
  const jacket = JACKETS.includes(body.jacket) ? body.jacket : JACKETS[0];

  const email = clean(body.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'That email does not look right.' };

  return { ok: true, value: { name, from, fromOther: from.includes('other') ? fromOther : '', parts, stay, where, msg, jacket, email } };
}

// Hat is cosmetic; derive it deterministically from the name so it is stable.
function hatFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HATS[h % HATS.length];
}

module.exports = { validateSkier, hatFor, ORIGINS, PARTS, STAY, WHERE, JACKETS };
