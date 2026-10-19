'use strict';

const ORIGINS = ['ams', 'delft', 'bansko', 'tw', 'nomad', 'other'];
const PARTS = ['colive', 'slope', 'spa'];
const STAY = ['The whole month', 'Two weeks', 'One week', 'Just the 12th', 'Still deciding'];
const WHERE = ['Valentina Heights', 'My own place in Bansko', 'A hotel in town', 'Still deciding'];
// Earlier colours first (entries already stored keep validating), then the FourTing palette.
const JACKETS = ['#6C171E', '#4F74B3', '#1F5560', '#D9A23A', '#9E3F6E', '#1D1D1B', '#F1F5FA', '#C8D63A',
  '#E84A3B', '#F28C28', '#F2C200', '#2E8B57', '#2A62C9', '#7B4BE0', '#E0157F'];
const DERIVED_HATS = ['#1D1D1B', '#F1F5FA', '#6C171E', '#D9A23A', '#4F74B3'];
const HATS = DERIVED_HATS.concat(['#F7F9FC', '#D7263D', '#F2C200', '#2A62C9', '#9AA7B8', '#F28C28', '#2E8B57']);
const TYPES = ['skier', 'board', 'walker'];
const PASS = ['yes', 'self', 'no']; // ski pass on the 12th: Ting pays / I will sort it / not skiing

const MAX_PHOTO = 16000; // characters of data URL; the page sends a ~160px JPEG, a few KB
const DAY_MIN = 6, DAY_MAX = 20; // 6-20 Feb 2027

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// "Who are you to Ting?" is free text; keywords map it to a crowd so people can still be grouped.
function crowdFor(rel) {
  const t = String(rel || '').toLowerCase(), out = [];
  [['ams', 'amsterdam'], ['delft', 'delft'], ['bansko', 'bansko'], ['bansko', 'neighbour'], ['bansko', 'neighbor'], ['tw', 'taiwan'], ['nomad', 'nomad']]
    .forEach(([id, word]) => { if (t.includes(word) && !out.includes(id)) out.push(id); });
  return out.length ? out : ['other'];
}

const day = (v) => { const n = Math.round(Number(v)); return n >= DAY_MIN && n <= DAY_MAX ? n : 0; };

// Older entries only had a coarse stay length; derive it from the days so both stay in step.
function stayFor(arrive, leave) {
  if (arrive === 12 && leave === 12) return 'Just the 12th';
  const days = leave - arrive + 1;
  return days >= 12 ? 'Two weeks' : days >= 6 ? 'One week' : 'Still deciding';
}

// Returns { ok: true, value } or { ok: false, error }. Never trusts the client's shape.
function validateSkier(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Bad request.' };
  const name = clean(body.name, 40);
  if (!name) return { ok: false, error: 'Add your name first.' };

  const rel = clean(body.rel, 80);
  let from = Array.isArray(body.from) ? [...new Set(body.from.filter((x) => ORIGINS.includes(x)))] : [];
  if (!from.length && rel) from = crowdFor(rel);
  if (!from.length) return { ok: false, error: 'Tell us where you know Ting from.' };
  let fromOther = clean(body.fromOther, 40);
  if (from.includes('other') && !fromOther && rel) fromOther = rel.slice(0, 40);
  if (from.includes('other') && !fromOther) return { ok: false, error: 'Fill in where you know Ting from.' };

  let parts = Array.isArray(body.parts) ? [...new Set(body.parts.filter((x) => PARTS.includes(x)))] : [];
  if (!parts.length) parts = ['slope'];

  let arrive = day(body.arrive), leave = day(body.leave);
  if (arrive && !leave) leave = arrive;
  if (!arrive) leave = 0;
  if (leave < arrive) [arrive, leave] = [leave, arrive];

  const stay = STAY.includes(body.stay) ? body.stay : (arrive ? stayFor(arrive, leave) : 'Still deciding');
  const where = WHERE.includes(body.where) ? body.where : 'Still deciding';
  const msg = clean(body.msg, 140) || 'See you on the slope!';
  const jacket = JACKETS.includes(body.jacket) ? body.jacket : JACKETS[0];
  const hat = HATS.includes(body.hat) ? body.hat : ''; // '' lets the server pick one from the name
  const type = TYPES.includes(body.type) ? body.type : 'skier';

  const email = clean(body.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'That email does not look right.' };

  // Only a small base64 JPEG is accepted, so whatever is stored is safe to drop into <img src>.
  let photo = '';
  if (body.photo) {
    const p = String(body.photo);
    if (p.length > MAX_PHOTO || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(p)) return { ok: false, error: 'That photo did not work. Try a different one.' };
    photo = p;
  }

  return {
    ok: true,
    value: {
      name, from, fromOther: from.includes('other') ? fromOther : '', parts, stay, where, msg, jacket, hat, email,
      type, rel, arrive, leave, photo,
      // Private, for Ting only: never part of the public view.
      pass: PASS.includes(body.pass) ? body.pass : '',
      bag: body.bag === true
    }
  };
}

// Hat is cosmetic; when the person did not pick one, derive it deterministically from the name so it is stable.
function hatFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return DERIVED_HATS[h % DERIVED_HATS.length];
}

module.exports = { validateSkier, hatFor, crowdFor, ORIGINS, PARTS, STAY, WHERE, JACKETS, HATS, TYPES, PASS };
