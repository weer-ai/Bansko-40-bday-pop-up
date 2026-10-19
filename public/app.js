/* FourTing's Birthday: the slope.
   Ported from the FourTing.dc.html prototype. The rider simulation (spawn / step) and the track
   geometry are lifted from it; rendering is plain DOM for riders and a <canvas> for tracks.
   Sim coordinates live on a 1440 x 900 virtual canvas and are drawn as percentages of the stage. */
(function () {
  'use strict';

  const SITE = window.SITE || {};
  const LINKS = SITE.links || {};
  const SIM = SITE.sim || {};
  const MAX_RIDERS = SIM.maxRiders || 9;
  const SPEED = SIM.speed || 1;

  const W = 1440, H = 900, HY = 300; // virtual canvas; HY is the skyline where riders enter

  /* ---------- content ---------- */
  const JACKETS = ['#E84A3B', '#F28C28', '#F2C200', '#2E8B57', '#2A62C9', '#7B4BE0', '#E0157F', '#1D1D1B'];
  const HELMETS = ['#F7F9FC', '#1D1D1B', '#D7263D', '#F2C200', '#2A62C9', '#9AA7B8', '#F28C28', '#2E8B57'];
  const COLOR_NAME = { '#E84A3B': 'red', '#F28C28': 'orange', '#F2C200': 'yellow', '#2E8B57': 'green', '#2A62C9': 'blue', '#7B4BE0': 'purple', '#E0157F': 'pink', '#1D1D1B': 'black', '#F7F9FC': 'white', '#D7263D': 'crimson', '#9AA7B8': 'grey' };
  const WHERES = ['Valentina Heights', 'My own place in Bansko', 'A hotel in town', 'Still deciding'];
  const CUES = ['From Amsterdam', 'From Delft', 'From Bansko', 'From Taiwan', 'Nomad friend', 'Bestie', 'Startup friend', 'Future neighbour', 'Colleague', 'Family'];
  const PASS = [{ id: 'yes', label: 'Yes, ski pass please' }, { id: 'self', label: 'I will take care of it myself' }, { id: 'no', label: 'Not skiing that day' }];
  const TYPES = [{ id: 'skier', label: 'Skier', sub: 'zigzag grooves' }, { id: 'board', label: 'Snowboarder', sub: 'big swoops' }, { id: 'walker', label: 'Walker', sub: 'footprints' }];
  const ORIGIN = { ams: 'Amsterdam', delft: 'Delft', bansko: 'Bansko', tw: 'Taiwan', nomad: 'Nomad communities', other: 'Somewhere else' };
  const DOW = ['S', 'S', 'M', 'T', 'W', 'T', 'F']; // 6 Feb 2027 is a Saturday
  const DOW3 = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  // Arrow signs: x/y are the post position as a share of the 1440 x 900 canvas; side is the side the arrow points to.
  const SIGNS = [
    { open: 'cost', text: 'COST & HOUSE', label: 'Cost and house', x: 22.917, y: 41.333, side: 'l', dur: 6.3, delay: 1.1, rot: -1.6, face: 'linear-gradient(180deg, #4C95EA, #1A55AE)', ink: '#fff' },
    { open: 'guide', text: 'BANSKO GUIDE', label: 'Bansko guide', x: 76.389, y: 39.556, side: 'r', dur: 7.7, delay: 3.4, rot: 1.4, face: 'linear-gradient(180deg, #FFFFFF, #DCE6F3)', ink: '#2B74D6' },
    { open: 'join', text: 'JOIN THE SLOPE', label: 'Join the slope', x: 16.667, y: 52, side: 'l', dur: 5.4, delay: 2.2, rot: 1.0, face: 'linear-gradient(180deg, #3A3A3A, #0E0E0E)', ink: '#fff' },
    { open: 'chat', text: 'WHATSAPP · ASK', label: 'WhatsApp, ask', x: 84.028, y: 50.222, side: 'r', dur: 8.6, delay: 0.4, rot: -1.2, face: 'linear-gradient(180deg, #FFFFFF, #F4DCD6)', ink: '#E84A3B' }
  ];

  // Ting is the host rider on every slope. Not stored: the page adds this one itself.
  const HOST = { id: 'host', host: true, name: 'Ting', type: 'skier', jacket: '#D7263D', helmet: '#1D1D1B', a: 6, b: 20, where: 'Valentina Heights', msg: 'Thank you for coming! 40 looks good on this slope', rel: 'The birthday host', from: [], fromOther: '', photo: '' };

  /* ---------- helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const hex = (c, fallback) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : fallback);
  const okPhoto = (p) => (typeof p === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p) ? p : '');

  // Builds an element. Text always goes in as text, never as markup.
  function h(tag, attrs, kids) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      const v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids || []).forEach((c) => { if (c != null && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  const svgEl = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

  const lum = (c) => { const n = parseInt(c.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
  const typeLabel = (t) => (t === 'board' ? 'Snowboarder' : t === 'walker' ? 'Walker' : 'Skier');
  const dateText = (a, b) => {
    const d = (n) => DOW3[((n - 6) % 7 + 7) % 7] + ' ' + n;
    if (!a) return 'Dates TBC';
    if (!b || a === b) return d(a) + ' Feb';
    return d(a) + ' – ' + d(b) + ' Feb';
  };
  // Entries from before the FourTing design have no dates; show their old stay length instead.
  const datesFor = (p) => (p.a ? dateText(p.a, p.b) : (p.stay && p.stay !== 'Still deciding' ? p.stay : 'Dates TBC'));
  const relText = (p) => {
    if (p.rel) return p.rel;
    return (p.from || []).map((k) => (k === 'other' ? (p.fromOther || 'Somewhere else') : 'From ' + (ORIGIN[k] || k))).join(' · ') || '—';
  };
  const nameOf = (p) => (p.host ? 'Ting' : p.name);

  // The API's skier -> the page's person. Older entries lack type, rel, dates and photo.
  function fromApi(s) {
    return {
      id: s.id, name: s.name || '?', type: ['skier', 'board', 'walker'].indexOf(s.type) >= 0 ? s.type : 'skier',
      jacket: hex(s.jacket, JACKETS[0]), helmet: hex(s.hat, HELMETS[0]), a: s.arrive | 0, b: s.leave | 0,
      where: s.where || 'Still deciding', msg: s.msg || '', rel: s.rel || '', from: s.from || [], fromOther: s.fromOther || '',
      stay: s.stay || '', photo: okPhoto(s.photo)
    };
  }

  function avatar(p, extra) {
    if (p.photo) return h('img', { class: 'av' + (extra || ''), src: p.photo, alt: '' });
    const ini = (p.name || '?').split(/[\s-]+/).filter(Boolean).map((w) => Array.from(w)[0]).join('').slice(0, 2).toUpperCase() || '?';
    return h('span', { class: 'av' + (extra || ''), 'aria-hidden': 'true', style: 'background:' + p.jacket + ';color:' + (lum(p.jacket) > 0.6 ? '#1A1A1A' : '#FFFFFF'), text: ini });
  }

  /* ---------- figures: top-down skier, snowboarder and walker; the shadow is the same shape in flat pale blue ---------- */
  const VB = 'viewBox="-24 -30 48 60" width="48" height="60" aria-hidden="true"';
  const HELM = 'stroke="rgba(20,35,59,0.35)" stroke-width="0.6"';
  function figureSVG(type, jacket, helmet, fa, fb) {
    if (type === 'board') {
      const board = jacket === '#1D1D1B' ? '#F2C200' : '#1D1D1B';
      return '<svg ' + VB + '><rect x="-5.5" y="-22" width="11" height="44" rx="5.5" fill="' + board + '"/><rect x="-5" y="-10" width="10" height="3" rx="1" fill="#58607A"/><rect x="-5" y="7" width="10" height="3" rx="1" fill="#58607A"/><path d="M-2 -7 L-9 -12 M-2 7 L-9 12" stroke="' + jacket + '" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="0" cy="0" rx="5" ry="8.4" fill="' + jacket + '"/><circle cx="1.6" cy="0" r="3.9" ' + HELM + ' fill="' + helmet + '"/></svg>';
    }
    if (type === 'walker') {
      return '<svg ' + VB + '><ellipse class="fa" cx="-3.4" cy="' + fa + '" rx="2.2" ry="3.4" fill="#2A2F3A"/><ellipse class="fb" cx="3.4" cy="' + fb + '" rx="2.2" ry="3.4" fill="#2A2F3A"/><ellipse cx="0" cy="-1" rx="6.8" ry="5.2" fill="' + jacket + '"/><circle cx="0" cy="1.2" r="3.9" ' + HELM + ' fill="' + helmet + '"/></svg>';
    }
    return '<svg ' + VB + '><rect x="-7.5" y="-24" width="3" height="46" rx="1.5" fill="#2A2F3A"/><rect x="4.5" y="-24" width="3" height="46" rx="1.5" fill="#2A2F3A"/><path d="M-8 -4 L-14 15 M8 -4 L14 15" stroke="#58607A" stroke-width="1.2" stroke-linecap="round"/><circle cx="-14" cy="15" r="1.7" fill="none" stroke="#58607A" stroke-width="1"/><circle cx="14" cy="15" r="1.7" fill="none" stroke="#58607A" stroke-width="1"/><ellipse cx="0" cy="-1" rx="7.4" ry="5.8" fill="' + jacket + '"/><circle cx="0" cy="1.8" r="4" ' + HELM + ' fill="' + helmet + '"/></svg>';
  }
  function shadowSVG(type, fa, fb) {
    const P = '#C9DCF5';
    if (type === 'board') {
      return '<svg ' + VB + '><rect x="-5.5" y="-22" width="11" height="44" rx="5.5" fill="' + P + '"/><rect x="-5" y="-10" width="10" height="3" rx="1" fill="' + P + '"/><rect x="-5" y="7" width="10" height="3" rx="1" fill="' + P + '"/><path d="M-2 -7 L-9 -12 M-2 7 L-9 12" stroke="' + P + '" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="0" cy="0" rx="5" ry="8.4" fill="' + P + '"/><circle cx="1.6" cy="0" r="3.9" fill="' + P + '"/></svg>';
    }
    if (type === 'walker') {
      return '<svg ' + VB + '><ellipse class="fa" cx="-3.4" cy="' + fa + '" rx="2.2" ry="3.4" fill="' + P + '"/><ellipse class="fb" cx="3.4" cy="' + fb + '" rx="2.2" ry="3.4" fill="' + P + '"/><ellipse cx="0" cy="-1" rx="6.8" ry="5.2" fill="' + P + '"/><circle cx="0" cy="1.2" r="3.9" fill="' + P + '"/></svg>';
    }
    return '<svg ' + VB + '><rect x="-7.5" y="-24" width="3" height="46" rx="1.5" fill="' + P + '"/><rect x="4.5" y="-24" width="3" height="46" rx="1.5" fill="' + P + '"/><path d="M-8 -4 L-14 15 M8 -4 L14 15" stroke="' + P + '" stroke-width="1.2" stroke-linecap="round"/><circle cx="-14" cy="15" r="1.7" fill="none" stroke="' + P + '" stroke-width="1"/><circle cx="14" cy="15" r="1.7" fill="none" stroke="' + P + '" stroke-width="1"/><ellipse cx="0" cy="-1" rx="7.4" ry="5.8" fill="' + P + '"/><circle cx="0" cy="1.8" r="4" fill="' + P + '"/></svg>';
  }
  const RING = '<svg ' + VB + '><circle class="ring" cx="0" cy="0" r="24" fill="none" stroke="#1A1A1A" stroke-width="1.6" stroke-dasharray="3 3"/></svg>';

  /* ---------- people and the simulation ---------- */
  const stage = $('#stage');
  const byId = {};          // id -> person
  const localAdded = {};    // people this browser just signed up, until the server list includes them
  const E = { t: 0, active: [], tracks: [], queue: [], next: 0, seed: 7 };
  byId[HOST.id] = HOST; E.queue.push(HOST.id);
  let sel = null, hov = null, ready = false;
  let stageW = stage.clientWidth, stageH = stage.clientHeight;
  const reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduce = !!(reduceQuery && reduceQuery.matches);

  const rnd = () => { E.seed = (E.seed * 16807) % 2147483647; return (E.seed - 1) / 2147483646; };
  const scaleAt = (y) => 0.3 + 1.0 * Math.max(0, y - HY) / (H - HY); // tiny at the skyline, full size at the bottom
  // Phones are narrow: shrink figures a little so the slope is not crowded. 1 on any desktop window.
  const sizeK = () => Math.max(0.62, Math.min(1, stageW / 1100));

  function spawn(p) {
    const R = rnd, t = p.type;
    const r = {
      id: p.id, type: t,
      speed: t === 'board' ? 70 + R() * 16 : t === 'walker' ? 20 + R() * 6 : 46 + R() * 14,
      A: t === 'board' ? 22 + R() * 22 : t === 'walker' ? 5 + R() * 4 : 30 + R() * 22,
      w: t === 'board' ? 0.55 + R() * 0.3 : t === 'walker' ? 0.7 + R() * 0.3 : 2.1 + R() * 0.8,
      drift: (R() - 0.5) * 70, cx: 220 + R() * 1000, ph: R() * 6.283, y: HY + 4, x: 0, rot: 0,
      pts: [], bubbleAt: 0.38 + R() * 0.3, bubbleShown: false, bubbleT: 0, stepT: 0, big: 0, bigTarget: 0, bigT: 0, ph2: 0, w2: 0.9 + R() * 0.3
    };
    r.x = r.cx + r.A * scaleAt(r.y) * Math.sin(r.ph);
    r.pts.push({ x: r.x, y: r.y, s: scaleAt(r.y) });
    E.active.push(r);
  }

  function step(dt, selId, warm) {
    dt = dt * (warm ? 1 : SPEED);
    E.t += dt;
    E.next -= dt;
    if (E.next <= 0 && E.queue.length && E.active.length < MAX_RIDERS) {
      const p = byId[E.queue.shift()];
      if (p) spawn(p);
      E.next = 1.3 + rnd() * 1.7;
    }
    const keep = [];
    E.active.forEach((r) => {
      if (r.id === selId) { keep.push(r); return; } // a clicked rider freezes
      const s = scaleAt(r.y);
      r.y += r.speed * s * dt;
      r.cx += r.drift * s * dt;
      if (r.cx < 90 || r.cx > 1350) { r.drift = -r.drift; r.cx = Math.max(90, Math.min(1350, r.cx)); }
      r.ph += r.w * dt;
      if (r.type === 'board') { // mostly straight, with a big carving turn now and then
        if (r.bigT > 0) { r.bigT -= dt; if (r.bigT <= 0) r.bigTarget = 0; }
        else if (r.big < 2 && rnd() < dt * 0.09) { r.bigTarget = 95 + rnd() * 55; r.bigT = 6.28 / r.w2; r.ph2 = 0; }
        r.big += (r.bigTarget - r.big) * Math.min(1, dt * 1.1);
        r.ph2 += r.w2 * dt;
      }
      const nx = r.cx + r.A * s * Math.sin(r.ph) + r.big * s * Math.sin(r.ph2);
      const vx = dt > 0 ? (nx - r.x) / dt : 0, vy = r.speed * s;
      r.x = nx;
      const target = -Math.atan2(vx, vy) * 57.2958;
      r.rot += (target - r.rot) * Math.min(1, dt * 8);
      r.stepT += dt * 7;
      const last = r.pts[r.pts.length - 1];
      const dx = r.x - last.x, dy = r.y - last.y;
      if (dx * dx + dy * dy > (r.type === 'walker' ? 30 : 42)) r.pts.push({ x: r.x, y: r.y, s: scaleAt(r.y) });
      const frac = (r.y - HY) / (H - HY);
      if (!r.bubbleShown && frac > r.bubbleAt) { r.bubbleShown = true; r.bubbleT = 3.6; } // one speech bubble per run
      if (r.bubbleT > 0) r.bubbleT -= dt;
      if (r.y > H + 60) {
        E.tracks.push({ pts: r.pts, type: r.type, fade: 1 });
        E.queue.push(r.id); // back to the end of the queue
      } else keep.push(r);
    });
    E.active = keep;
    E.tracks.forEach((t) => { t.fade -= dt / 22; }); // tracks fade over about 20 seconds
    E.tracks = E.tracks.filter((t) => t.fade > 0).slice(-12);
  }

  // Everyone on the list: Ting first, then the server's list, then anyone this browser just added that is not listed yet.
  function syncPeople(list) {
    const incoming = {};
    incoming[HOST.id] = HOST;
    list.forEach((p) => { incoming[p.id] = p; delete localAdded[p.id]; });
    Object.keys(localAdded).forEach((id) => { if (!incoming[id]) incoming[id] = localAdded[id]; });
    Object.keys(byId).forEach((id) => {
      if (incoming[id]) return;
      delete byId[id];
      E.queue = E.queue.filter((q) => q !== id);
      E.active = E.active.filter((r) => r.id !== id);
    });
    Object.keys(incoming).forEach((id) => {
      const known = !!byId[id];
      byId[id] = incoming[id];
      if (!known) E.queue.push(id);
    });
    setCount();
    if (ready && reduce) render();
  }
  const realCount = () => Object.keys(byId).filter((id) => id !== HOST.id).length;
  function setCount() {
    const n = realCount();
    $$('[data-count]').forEach((el) => { el.textContent = n ? n + ' ON THE LIST' : 'BE THE FIRST ON THE LIST'; });
  }

  // A newly signed-up person ski in next, even when the slope is full.
  function dropIn(id) {
    E.queue = E.queue.filter((q) => q !== id);
    if (E.active.some((r) => r.id === id)) return;
    spawn(byId[id]);
    if (reduce) { for (let i = 0; i < 90; i++) step(0.05, null, true); render(); }
  }

  /* ---------- drawing ---------- */
  const ridersEl = $('#riders'), shadowsEl = $('#shadows'), bubblesEl = $('#bubbles'), hoverEl = $('#hover');
  const canvas = $('#tracks'), ctx = canvas.getContext('2d');
  const els = {};      // id -> { btn, sprite, shadow, sig, feet, shFeet }
  const bubbleEls = {}; // id -> element
  let hoverTag = null, hoverFor = null, drawn = 0, animating = false;

  function sizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(stageW * dpr));
    canvas.height = Math.max(1, Math.round(stageH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Track geometry from the prototype: skiers leave two grooves, boarders a band with an edge line, walkers footprints.
  function strokeTrack(pts, type, op) {
    const n = pts.length;
    if (n < 2) return;
    const CH = 9, K = sizeK(), sx = stageW / W, sy = stageH / H;
    const nrm = (i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
      return [-dy / L, dx / L, dx / L, dy / L];
    };
    const line = (xs, ys, first) => (first ? ctx.moveTo(xs * sx, ys * sy) : ctx.lineTo(xs * sx, ys * sy));
    const stroke = (width, color, alpha) => { ctx.lineWidth = width * K; ctx.strokeStyle = color; ctx.globalAlpha = Math.max(0, alpha); ctx.stroke(); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let c = 0; c < n - 1; c += CH) {
      const end = Math.min(n - 1, c + CH);
      let sAvg = 0; for (let i = c; i <= end; i++) sAvg += pts[i].s; sAvg /= (end - c + 1);
      if (type === 'walker') {
        ctx.beginPath();
        for (let i = c; i < end; i++) {
          const q = nrm(i), side = (i % 2 ? 1 : -1) * 2.4 * pts[i].s, len = 2.2 * pts[i].s;
          const x = pts[i].x + q[0] * side, y = pts[i].y + q[1] * side;
          line(x - q[2] * len, y - q[3] * len, true); line(x + q[2] * len, y + q[3] * len, false);
        }
        stroke(2.3 * sAvg, '#9DBDEB', 0.9 * op);
      } else if (type === 'board') {
        ctx.beginPath();
        for (let i = c; i <= end; i++) line(pts[i].x, pts[i].y, i === c);
        stroke(6 * sAvg, '#D7E5F8', 0.95 * op);
        ctx.beginPath();
        for (let i = c; i <= end; i++) { const q = nrm(i), p = pts[i]; line(p.x + q[0] * 2.9 * p.s, p.y + q[1] * 2.9 * p.s, i === c); }
        stroke(0.9 * sAvg, '#9DBDEB', 0.9 * op);
      } else {
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          for (let i = c; i <= end; i++) { const q = nrm(i), p = pts[i], o = 1.9 * p.s * dir; line(p.x + q[0] * o, p.y + q[1] * o, i === c); }
          stroke(1.1 * sAvg, '#9DBDEB', op);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawTracks() {
    ctx.clearRect(0, 0, stageW, stageH);
    E.tracks.forEach((t) => strokeTrack(t.pts, t.type, Math.max(0, t.fade)));
    E.active.forEach((r) => strokeTrack(r.pts.concat([{ x: r.x, y: r.y, s: scaleAt(r.y) }]), r.type, 1));
  }

  const ariaFor = (p) => (p.host ? 'Ting, the birthday host' : p.name) + ', ' + typeLabel(p.type).toLowerCase() + ', ' + datesFor(p);

  function makeRider(r, p) {
    const btn = h('button', {
      type: 'button', class: 'rider', 'aria-label': ariaFor(p),
      onclick: () => pick(r.id),
      onmouseenter: () => { hov = r.id; if (reduce) render(); },
      onmouseleave: () => { if (hov === r.id) { hov = null; if (reduce) render(); } }
    });
    const sprite = h('span', { class: 'sprite' });
    btn.appendChild(sprite);
    const shadow = h('div', { class: 'shadow', 'aria-hidden': 'true' });
    ridersEl.appendChild(btn); shadowsEl.appendChild(shadow);
    return { btn: btn, sprite: sprite, shadow: shadow, sig: '', label: '', feet: null, shFeet: null };
  }
  function dressRider(o, r, p) {
    const sig = r.type + p.jacket + p.helmet;
    if (o.sig === sig) return;
    o.sig = sig;
    o.sprite.innerHTML = RING + figureSVG(r.type, p.jacket, p.helmet, 2.5, 2.5);
    o.shadow.innerHTML = shadowSVG(r.type, 2.5, 2.5);
    o.feet = r.type === 'walker' ? [$('.fa', o.sprite), $('.fb', o.sprite)] : null;
    o.shFeet = r.type === 'walker' ? [$('.fa', o.shadow), $('.fb', o.shadow)] : null;
  }

  function render() {
    const K = sizeK();
    const seen = {};
    E.active.forEach((r) => {
      const p = byId[r.id];
      if (!p) return;
      seen[r.id] = true;
      const o = els[r.id] || (els[r.id] = makeRider(r, p));
      dressRider(o, r, p);
      const lab = ariaFor(p);
      if (o.label !== lab) { o.label = lab; o.btn.setAttribute('aria-label', lab); }
      const sc = scaleAt(r.y) * K, rot = r.rot.toFixed(1), isSel = sel === r.id;
      const px = r.x / W * stageW, py = r.y / H * stageH;
      // 44px minimum hit area, even for the tiny riders near the skyline
      const bw = Math.max(44, 48 * sc), bh = Math.max(44, 60 * sc);
      const st = o.btn.style;
      st.width = bw.toFixed(1) + 'px'; st.height = bh.toFixed(1) + 'px';
      st.transform = 'translate(' + (px - bw / 2).toFixed(1) + 'px, ' + (py - bh / 2).toFixed(1) + 'px)';
      st.zIndex = r.y > 470 ? 5 : 3; // above the gate: behind it; below it: in front
      o.btn.classList.toggle('sel', isSel);
      o.sprite.style.transform = 'rotate(' + rot + 'deg) scale(' + sc.toFixed(3) + ')';
      // the shadow falls lower left of the rider, stretched a little
      o.shadow.style.transform = 'translate(' + (px - 9 * sc - 24).toFixed(1) + 'px, ' + (py + 6 * sc - 30).toFixed(1) + 'px) rotate(' + rot + 'deg) scale(' + (sc * 1.04).toFixed(3) + ', ' + (sc * 1.12).toFixed(3) + ')';
      if (o.feet) {
        const fa = (2.5 + 3 * Math.sin(r.stepT)).toFixed(1), fb = (2.5 - 3 * Math.sin(r.stepT)).toFixed(1);
        o.feet[0].setAttribute('cy', fa); o.feet[1].setAttribute('cy', fb);
        o.shFeet[0].setAttribute('cy', fa); o.shFeet[1].setAttribute('cy', fb);
      }
      // speech bubble: once per run, about 3.6 s
      if (r.bubbleT > 0 && !reduce && !isSel && hov !== r.id) {
        const b = bubbleEls[r.id] || (bubbleEls[r.id] = makeBubble(p));
        b.style.transform = 'translate(' + px.toFixed(1) + 'px, ' + (py - 34 * sc - 8).toFixed(1) + 'px) translate(-50%, -100%)';
        b.style.opacity = Math.max(0, Math.min(1, r.bubbleT * 2, (3.6 - r.bubbleT) * 3)).toFixed(2);
      } else dropBubble(r.id);
    });
    Object.keys(els).forEach((id) => {
      if (seen[id]) return;
      els[id].btn.remove(); els[id].shadow.remove(); delete els[id]; dropBubble(id);
    });

    const hr = hov && !sel ? E.active.find((r) => r.id === hov) : null;
    if (hr && byId[hr.id]) {
      const p = byId[hr.id];
      if (hoverFor !== hr.id) {
        hoverEl.textContent = '';
        hoverTag = h('div', { class: 'hovtag', 'aria-hidden': 'true' }, h('span', { class: 'hovtag-in' }, [avatar(p), (p.host ? 'Ting · the birthday host' : p.name) + ' · ' + typeLabel(hr.type).toLowerCase()]));
        hoverEl.appendChild(hoverTag); hoverFor = hr.id;
      }
      hoverTag.style.transform = 'translate(' + (hr.x / W * stageW).toFixed(1) + 'px, ' + (hr.y / H * stageH - 34 * scaleAt(hr.y) * K - 8).toFixed(1) + 'px) translate(-50%, -100%)';
    } else if (hoverFor) { hoverEl.textContent = ''; hoverTag = null; hoverFor = null; }

    if (sel && !E.active.some((r) => r.id === sel)) clearSel();
    // Tracks are the one big surface: redraw them every other frame while animating (the rider sprite covers the tip)
    if (!animating || (drawn++ & 1) === 0) drawTracks();
  }
  function makeBubble(p) {
    const b = h('div', { class: 'bubble', 'aria-hidden': 'true' }, h('div', { class: 'bubble-in' }, [avatar(p), h('span', { class: 'txt', text: p.msg }), h('span', { class: 'tail' })]));
    bubblesEl.appendChild(b);
    return b;
  }
  function dropBubble(id) { if (bubbleEls[id]) { bubbleEls[id].remove(); delete bubbleEls[id]; } }

  /* ---------- selecting a rider: freeze + card ---------- */
  const cardRoot = $('#card-root'), toastRoot = $('#toast-root');
  function pick(id) { if (sel === id) clearSel(); else { sel = id; hov = null; showCard(); } if (reduce) render(); }
  function clearSel() { sel = null; cardRoot.textContent = ''; }
  function showCard() {
    cardRoot.textContent = '';
    const r = E.active.find((x) => x.id === sel), p = r && byId[sel];
    if (!p) return;
    const row = (k, v) => h('div', null, [h('span', { class: 'k', text: k }), h('span', { text: v })]);
    const card = h('div', { class: 'card sheet', role: 'group', 'aria-label': nameOf(p) + ', details' }, [
      h('div', { class: 'card-top' }, [
        h('span', { class: 'card-who' }, [avatar(p), h('span', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0' }, [
          h('span', { class: 'card-name', text: nameOf(p) }),
          h('span', { class: 'card-type', text: p.host ? 'Birthday host · skier' : typeLabel(r.type) })])]),
        h('button', { type: 'button', class: 'card-close', 'aria-label': 'Close', onclick: () => { clearSel(); if (reduce) render(); } },
          svgEl('<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 1 L11 11 M11 1 L1 11" stroke="#1A1A1A" stroke-width="1.6"/></svg>'))
      ]),
      h('div', { class: 'card-dates' }, [
        svgEl('<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1.5" y="3" width="15" height="13" rx="2" stroke="#1A1A1A" stroke-width="1.4"/><path d="M1.5 7 H16.5 M5.5 1 V4.5 M12.5 1 V4.5" stroke="#1A1A1A" stroke-width="1.4"/></svg>'),
        h('span', { text: datesFor(p) })]),
      h('p', { class: 'card-msg', text: '“' + p.msg + '”' }),
      h('div', { class: 'card-rows' }, [row('Relationship', relText(p)), row('Staying at', p.where || 'Still deciding')])
    ]);
    cardRoot.appendChild(card);
    // beside the rider; on a phone above or below them, so the card does not sit on top of the rider
    const cw = Math.min(290, stageW - 32), sx = r.x / W * stageW, sy = r.y / H * stageH;
    let left, top = Math.max(12, Math.min(sy - 120, stageH - 330));
    if (stageW < 560) {
      left = (stageW - cw) / 2;
      const ch = card.offsetHeight;
      top = Math.max(12, Math.min(sy < stageH * 0.5 ? sy + 36 : sy - 36 - ch, stageH - ch - 12));
    } else if (sx + 34 + cw <= stageW - 12) left = sx + 34;
    else if (sx - 34 - cw >= 12) left = sx - 34 - cw;
    else left = (stageW - cw) / 2;
    card.style.left = left.toFixed(0) + 'px'; card.style.top = top.toFixed(0) + 'px';
  }

  let toastTimer = null;
  function toast(text) {
    toastRoot.textContent = '';
    toastRoot.appendChild(h('div', { class: 'toast sheet', role: 'status', text: text }));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastRoot.textContent = ''; }, 6000);
  }

  /* ---------- gate and arrow signs ---------- */
  (function buildSigns() {
    const root = $('#signs');
    SIGNS.forEach((s) => {
      const vars = '--x:' + s.x + '%;--y:' + s.y + '%;--rot:' + s.rot + 'deg;--dur:' + s.dur + 's;--delay:' + s.delay + 's;--face:' + s.face + ';--ink-on:' + s.ink;
      root.appendChild(h('div', { class: 'side sp-' + s.side, style: vars }, [
        h('div', { class: 'sp-shade', 'aria-hidden': 'true' }), h('div', { class: 'sp-foot', 'aria-hidden': 'true' }), h('div', { class: 'sp-pole', 'aria-hidden': 'true' }),
        h('div', { class: 'sp-board wig' }, [
          h('div', { class: 'sp-slab', 'aria-hidden': 'true' }),
          h('div', { class: 'sp-face', 'aria-hidden': 'true', text: s.text }),
          h('button', { type: 'button', class: 'sign sp-hit', 'data-open': s.open, 'aria-label': s.label })
        ])
      ]));
    });
  })();

  /* ---------- panels ---------- */
  const panelRoot = $('#panel-root');
  let overlay = null, lastFocus = null, toastAfterClose = '';

  function openPanel(id) {
    if (sel) { clearSel(); }
    if (overlay) overlay.remove(); else lastFocus = document.activeElement;
    const panel = h('div', { class: 'panel sheet', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' });
    const x = h('div', { class: 'panel-x' }, h('button', { type: 'button', 'aria-label': 'Close', onclick: closePanel },
      svgEl('<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 1 L13 13 M13 1 L1 13" stroke="#1A1A1A" stroke-width="1.6"/></svg>')));
    panel.appendChild(x);
    if (id === 'join') buildJoin(panel);
    else {
      panel.appendChild(document.getElementById('tpl-' + id).content.cloneNode(true));
      fillStatic(panel);
    }
    const title = $('.p-title', panel);
    if (title) { title.id = 'panel-title'; panel.setAttribute('aria-labelledby', 'panel-title'); }
    overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) closePanel(); }, onkeydown: trapTab }, panel);
    panelRoot.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    panel.focus();
  }
  function closePanel() {
    if (!overlay) return;
    overlay.remove(); overlay = null;
    document.body.style.overflow = '';
    if (lastFocus && document.contains(lastFocus) && lastFocus.focus) lastFocus.focus();
    if (toastAfterClose) { toast(toastAfterClose); toastAfterClose = ''; }
  }
  function trapTab(e) {
    if (e.key !== 'Tab' || !overlay) return;
    const f = $$('button, a[href], input, textarea, select, [tabindex="0"]', overlay).filter((n) => !n.disabled && n.offsetParent !== null && n.getAttribute('tabindex') !== '-1');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === overlay.firstChild)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // Links that are not set yet show a placeholder; the 15-day strip in the date panel.
  function fillStatic(root) {
    $$('a[data-link]', root).forEach((a) => {
      const url = LINKS[a.dataset.link];
      if (url) a.href = url;
      else if (a.hasAttribute('data-optional')) a.hidden = true;
      else a.setAttribute('aria-disabled', 'true');
    });
    $$('[data-todo]', root).forEach((n) => { n.hidden = !!LINKS[n.dataset.todo]; });
    const strip = $('[data-days]', root);
    if (strip) for (let n = 6; n <= 20; n++) strip.appendChild(h('span', { class: 'dcell' + (n === 12 ? ' hot' : '') }, [h('small', { text: DOW[(n - 6) % 7] }), h('b', { text: String(n) })]));
  }

  function downloadIcs() {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ev = (uid, from, to, summary, desc) => ['BEGIN:VEVENT', 'UID:' + uid + '@fourting-bansko', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + from, 'DTEND;VALUE=DATE:' + to, 'SUMMARY:' + summary, 'DESCRIPTION:' + desc, 'LOCATION:Bansko\\, Bulgaria', 'END:VEVENT'];
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FourTing//Bansko 2027//EN', 'CALSCALE:GREGORIAN']
      .concat(ev('trip', '20270206', '20270221', "FourTing's Birthday in Bansko", 'Two weeks in the mountains for Ting\\\'s 40th. Sat 6 to Sat 20 February 2027.'))
      .concat(ev('day', '20270212', '20270213', 'The 12th: skiing together, then the spa', 'Skiing together on the slope, then the spa at Pulse Therme (night to be confirmed). Ski pass on Ting.'))
      .concat(['END:VCALENDAR']);
    const a = h('a', { href: URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' })), download: 'fourting-bansko-2027.ics' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); openPanel(o.dataset.open); return; }
    const a = e.target.closest('[data-action]');
    if (a && a.dataset.action === 'ics') { downloadIcs(); return; }
    if (e.target.closest('a[aria-disabled="true"]')) { e.preventDefault(); return; }
    if (sel && stage.contains(e.target) && !e.target.closest('.card, .rider')) { clearSel(); if (reduce) render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (overlay) closePanel(); else if (sel) { clearSel(); if (reduce) render(); }
  });

  /* ---------- storage ---------- */
  let mine = null; // { id, token }: this browser's own entry, so it can be edited later
  try { mine = JSON.parse(localStorage.getItem('bansko-mine') || 'null'); } catch (e) { mine = null; }
  function saveMine(m) { mine = m; try { if (m) localStorage.setItem('bansko-mine', JSON.stringify(m)); else localStorage.removeItem('bansko-mine'); } catch (e) { /* private mode */ } }
  const editUrl = () => location.origin + '/#edit=' + mine.id + '.' + mine.token;

  function api(method, url, body, headers) {
    return fetch(url, { method: method, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: body ? JSON.stringify(body) : undefined })
      .then((r) => r.json().catch(() => ({})).then((j) => { if (!r.ok) throw new Error(j.error || 'Something went wrong (error ' + r.status + ').'); return j; }),
        () => { throw new Error('Could not reach the server. Check your connection and try again.'); });
  }
  const loadList = () => api('GET', '/api/skiers').then((list) => { syncPeople(list.map(fromApi)); });

  /* ---------- join the slope ---------- */
  const blank = () => ({ name: '', photo: '', type: 'skier', jacket: JACKETS[0], helmet: HELMETS[0], rel: '', a: 0, b: 0, where: '', pass: '', msg: '', bag: false, email: '', pin: '', hasPin: false, website: '', err: '' });
  const PIN_RE = /^\d{4,8}$/;
  const setTitle = (t) => { const el = overlay && $('.p-title', overlay); if (el) el.textContent = t; };
  const label = (text, forId) => h('label', { class: 'flabel', for: forId, text: text });

  function buildJoin(panel) {
    const head = h('div', { class: 'p-head ph-join' }, [h('span', { class: 'p-eyebrow', text: 'YOU’LL SKI DOWN THE PAGE ONCE YOU’RE IN' }), h('h2', { class: 'p-title', text: 'JOIN THE SLOPE' })]);
    const body = h('div', { class: 'p-body' });
    panel.appendChild(head); panel.appendChild(body);
    if (mine) loadEdit(body); else renderJoin(body, blank(), false);
  }

  // Opens this browser's own entry (from the stored edit token) in the form.
  function loadEdit(body) {
    setTitle('EDIT YOUR RIDER');
    body.textContent = '';
    body.appendChild(h('p', { class: 'lead', text: 'Loading your entry…' }));
    api('GET', '/api/skiers/' + encodeURIComponent(mine.id), null, { 'X-Edit-Token': mine.token }).then((r) => {
      const s = r.skier, d = blank();
      Object.assign(d, { name: s.name, photo: okPhoto(s.photo), type: ['skier', 'board', 'walker'].indexOf(s.type) >= 0 ? s.type : 'skier', jacket: hex(s.jacket, JACKETS[0]), helmet: hex(s.hat, HELMETS[0]),
        rel: s.rel || relText(fromApi(s)), a: s.arrive | 0, b: s.leave | 0, where: s.where === 'Still deciding' ? '' : s.where, pass: s.pass || '', msg: s.msg || '', bag: !!s.bag, email: s.email || '', hasPin: !!s.hasPin });
      if (d.a && !d.b) d.b = d.a;
      if (overlay) renderJoin(body, d, true);
    }).catch(() => {
      saveMine(null);
      const d = blank(); d.err = 'Your edit link is no longer valid. Sign up again below.';
      setTitle('JOIN THE SLOPE');
      if (overlay) renderJoin(body, d, false);
    });
  }

  // "Already signed up?": name + PIN on any device gives back the edit link.
  function renderFind(body) {
    setTitle('FIND YOUR ENTRY');
    body.textContent = '';
    const f = { name: '', pin: '' };
    const err = h('span', { class: 'err', role: 'alert', hidden: true });
    const enter = (e) => { if (e.key === 'Enter') submit(); };
    const nameIn = h('input', { class: 'input', id: 'f-name', type: 'text', maxlength: '40', autocomplete: 'given-name', placeholder: 'The name you signed up with', oninput: (e) => { f.name = e.target.value; }, onkeydown: enter });
    const pinIn = h('input', { class: 'input', id: 'f-pin', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '8', autocomplete: 'off', placeholder: 'Your PIN', oninput: (e) => { f.pin = e.target.value.replace(/\D/g, '').slice(0, 8); e.target.value = f.pin; }, onkeydown: enter });
    const go = h('button', { type: 'button', class: 'btn btn-go', text: 'FIND MY ENTRY', onclick: submit });
    body.appendChild(h('div', { class: 'jform' }, [
      h('p', { class: 'lead', text: 'Enter the name and PIN you signed up with.' }),
      h('div', { class: 'field' }, [label('Your name', 'f-name'), nameIn]),
      h('div', { class: 'field' }, [label('Your PIN', 'f-pin'), pinIn]),
      err, go,
      h('span', { class: 'note', text: 'Signed up before PINs existed? Open your private edit link instead, or ask Ting to remove your old entry so you can sign up again.' }),
      h('button', { type: 'button', class: 'linkbtn', text: 'Back to sign up', onclick: () => { setTitle('JOIN THE SLOPE'); renderJoin(body, blank(), false); } })
    ]));
    nameIn.focus();

    function submit() {
      err.hidden = true;
      if (!f.name.trim() || !f.pin) { err.textContent = 'Enter the name and PIN you signed up with.'; err.hidden = false; return; }
      go.disabled = true;
      api('POST', '/api/skiers/find', { name: f.name.trim(), pin: f.pin }).then((r) => {
        saveMine({ id: r.id, token: r.editToken });
        if (overlay) loadEdit(body);
      }).catch((e) => { err.textContent = e.message; err.hidden = false; go.disabled = false; });
    }
  }

  function renderJoin(body, d, editing) {
    body.textContent = '';
    const syncs = [];
    const bind = (fn) => { syncs.push(fn); fn(); };
    const sync = () => syncs.forEach((fn) => fn());
    const pressed = (el, on) => el.setAttribute('aria-pressed', on ? 'true' : 'false');
    const group = (items, cls, isOn, onPick, content) => h('div', { class: cls }, items.map((it) => {
      const b = h('button', { type: 'button', class: cls === 'types' ? 'tbtn' : 'chip', onclick: () => { onPick(it); d.err = ''; sync(); } }, content ? content(it) : it.label || it);
      bind(() => pressed(b, isOn(it)));
      return b;
    }));
    const head = (txt, id) => h('span', { class: 'flabel', id: id, text: txt });

    // who: live preview, name, photo
    const fig = h('div', { class: 'fig', 'aria-hidden': 'true' }), figSh = h('div', { class: 'fig sh', 'aria-hidden': 'true' });
    bind(() => { figSh.innerHTML = shadowSVG(d.type, 5.5, -0.5); fig.innerHTML = figureSVG(d.type, d.jacket, d.helmet, 5.5, -0.5); });
    const nameIn = h('input', { class: 'input', id: 'j-name', type: 'text', maxlength: '40', autocomplete: 'given-name', placeholder: 'How people call you', value: d.name, oninput: (e) => { d.name = e.target.value; d.err = ''; } });
    const photoBox = h('label', { class: 'photo-pick' });
    const photoIn = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Upload a profile photo', onchange: (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      squareJpeg(f).then((url) => { d.photo = url; d.err = ''; sync(); }).catch(() => { d.err = 'That photo did not work. Try a different one.'; sync(); });
    } });
    const removeBtn = h('button', { type: 'button', class: 'mini', text: 'Remove', onclick: () => { d.photo = ''; photoIn.value = ''; sync(); } });
    bind(() => {
      photoBox.textContent = '';
      photoBox.appendChild(d.photo ? h('img', { class: 'photo-ring', src: d.photo, alt: 'Your photo' })
        : h('span', { class: 'photo-ring', 'aria-hidden': 'true' }, svgEl('<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 8 H8 L10 5 H14 L16 8 H20 V19 H4 Z" stroke="#1A1A1A" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" stroke="#1A1A1A" stroke-width="1.5"/></svg>')));
      photoBox.appendChild(h('span', { class: 'photo-txt' }, [h('b', { text: d.photo ? 'Change photo' : 'Add a photo' }), h('span', { text: 'Shows next to your speech bubble' })]));
      photoBox.appendChild(photoIn);
      removeBtn.hidden = !d.photo;
    });

    const colorGroup = (title, list, key, word) => h('div', null, [head(title), h('div', { class: 'swatches' }, list.map((c) => {
      const b = h('button', { type: 'button', class: 'swatch', style: 'background:' + c, 'aria-label': word + ' ' + (COLOR_NAME[c] || c), onclick: () => { d[key] = c; sync(); } });
      bind(() => pressed(b, d[key] === c));
      return b;
    }))]);

    // relationship, with cues that fill the box
    const relIn = h('input', { class: 'input', id: 'j-rel', type: 'text', maxlength: '80', placeholder: 'In your own words, e.g. Bestie from Amsterdam', value: d.rel, oninput: (e) => { d.rel = e.target.value; d.err = ''; syncCues(); } });
    const cueBtns = CUES.map((c) => h('button', { type: 'button', class: 'cue', text: c, onclick: () => {
      if (d.rel.toLowerCase().indexOf(c.toLowerCase()) >= 0) return;
      d.rel = (d.rel.trim() ? d.rel.trim().replace(/[,·]\s*$/, '') + ', ' + c : c).slice(0, 80);
      relIn.value = d.rel; d.err = ''; syncCues();
    } }));
    const syncCues = () => cueBtns.forEach((b) => pressed(b, d.rel.toLowerCase().indexOf(b.textContent.toLowerCase()) >= 0));
    bind(syncCues);

    // dates: tap arrival, then last day
    const dayBtns = [];
    for (let n = 6; n <= 20; n++) {
      const b = h('button', { type: 'button', class: 'dbtn' + (n === 12 ? ' is12' : ''), 'aria-label': 'February ' + n, onclick: () => {
        if (!d.a || d.b) { d.a = n; d.b = 0; } else if (n >= d.a) d.b = n; else { d.a = n; d.b = 0; }
        d.err = ''; sync();
      } }, [h('small', { text: DOW[(n - 6) % 7] }), h('b', { text: String(n) })]);
      dayBtns.push([n, b]);
    }
    const datesTxt = h('span', { class: 'dates-txt' });
    bind(() => {
      dayBtns.forEach(([n, b]) => {
        const inR = d.a && (d.b ? n >= d.a && n <= d.b : n === d.a), edge = n === d.a || n === d.b;
        b.classList.toggle('edge', !!edge); b.classList.toggle('in', !!inR && !edge);
        pressed(b, !!inR);
      });
      datesTxt.textContent = (d.a ? dateText(d.a, d.b || 0) + (d.b ? '' : ' · now tap your last day') : 'Tap your arrival day, then your last day') + ' · the red line marks the 12th';
    });

    const msgIn = h('input', { class: 'input', id: 'j-msg', type: 'text', maxlength: '60', placeholder: 'e.g. Happy Birthday!', value: d.msg, oninput: (e) => { d.msg = e.target.value.slice(0, 60); } });
    const emailIn = h('input', { class: 'input', id: 'j-email', type: 'email', maxlength: '120', autocomplete: 'email', placeholder: 'you@example.com', value: d.email, oninput: (e) => { d.email = e.target.value; d.err = ''; } });
    const pinIn = h('input', { class: 'input', id: 'j-pin', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '8', autocomplete: 'off', placeholder: editing && d.hasPin ? 'Keep my current PIN' : 'e.g. 4 digits', oninput: (e) => { d.pin = e.target.value.replace(/\D/g, '').slice(0, 8); e.target.value = d.pin; d.err = ''; } });
    const bag = h('button', { type: 'button', class: 'bag', onclick: () => { d.bag = !d.bag; sync(); } }, [
      h('span', { class: 'box', 'aria-hidden': 'true' }),
      h('span', null, ['I’m flying from the Netherlands and happy to check an extra bag of Ting’s things for her winter home in Bansko. ', h('span', { class: 'sm', text: 'Ting will pay for the extra bag.' })])
    ]);
    bind(() => { pressed(bag, d.bag); bag.firstChild.textContent = d.bag ? '✓' : ''; });
    const err = h('span', { class: 'err', role: 'alert' });
    bind(() => { err.textContent = d.err; err.hidden = !d.err; });
    const go = h('button', { type: 'button', class: 'btn btn-go', text: editing ? 'SAVE CHANGES' : 'DROP IN AT THE TOP ↓', onclick: submit });

    const form = h('div', { class: 'jform' }, [
      editing ? null : h('div', { class: 'already' }, [h('span', { text: 'Already signed up?' }), h('button', { type: 'button', class: 'btn btn-line btn-sm', text: 'EDIT MY ENTRY', onclick: () => renderFind(body) })]),
      h('div', { class: 'who' }, [
        h('div', { class: 'preview' }, [figSh, fig]),
        h('div', { class: 'who-fields' }, [h('div', { class: 'field' }, [label('Your name', 'j-name'), nameIn]), h('div', { class: 'photo-row' }, [photoBox, removeBtn])])
      ]),
      head('I’m a'), h('div', { class: 'gap-up' }, group(TYPES, 'types', (t) => d.type === t.id, (t) => { d.type = t.id; }, (t) => [h('b', { text: t.label }), h('span', { text: t.sub })])),
      h('div', { class: 'colors' }, [colorGroup('Jacket colour', JACKETS, 'jacket', 'Jacket'), colorGroup('Helmet colour', HELMETS, 'helmet', 'Helmet')]),
      label('Who are you to Ting?', 'j-rel'),
      h('div', { class: 'field gap-up', style: 'gap:10px' }, [relIn, h('div', { class: 'cues' }, [h('span', { text: 'Need a cue?' })].concat(cueBtns))]),
      head('When are you here?'),
      h('div', { class: 'field gap-up', style: 'gap:8px' }, [h('div', { class: 'dstrip' }, dayBtns.map((x) => x[1])), datesTxt]),
      head('Staying at'),
      h('div', { class: 'gap-up' }, group(WHERES.map((w) => ({ id: w, label: w })), 'chips', (w) => d.where === w.id, (w) => { d.where = d.where === w.id ? '' : w.id; })),
      head('On the slope on the 12th? Your pass is on Ting'),
      h('div', { class: 'gap-up' }, group(PASS, 'chips', (t) => d.pass === t.id, (t) => { d.pass = d.pass === t.id ? '' : t.id; })),
      h('div', { class: 'field' }, [label('What will you shout (to Ting) as you ski past?', 'j-msg'), msgIn]),
      h('div', { class: 'field' }, [label('Email (optional, private)', 'j-email'), emailIn, h('span', { class: 'note', text: 'Only Ting sees it. It lets Ting reach you.' })]),
      h('div', { class: 'field' }, [label(editing ? (d.hasPin ? 'Change your PIN (optional)' : 'Set a PIN, so you can edit from any phone') : 'PIN to edit your entry later', 'j-pin'), pinIn,
        h('span', { class: 'note', text: editing && d.hasPin ? 'Leave it empty to keep your current PIN.' : '4 to 8 digits. On another phone, tap Join the slope, then “Already signed up?” and enter your name and this PIN.' })]),
      bag,
      h('input', { type: 'text', class: 'hp', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', oninput: (e) => { d.website = e.target.value; } }),
      err, go
    ]);
    if (editing && mine) {
      form.appendChild(h('div', { class: 'field' }, [
        head('Your private edit link'),
        h('div', { class: 'link-row' }, [h('input', { class: 'input', type: 'text', readonly: true, value: editUrl(), 'aria-label': 'Your private edit link', onfocus: (e) => e.target.select() }),
          h('button', { type: 'button', class: 'mini', text: 'Copy', onclick: (e) => copyText(editUrl(), e.target) })]),
        h('button', { type: 'button', class: 'linkbtn', text: 'Not you? Sign up someone new', onclick: () => { setTitle('JOIN THE SLOPE'); renderJoin(body, blank(), false); } })
      ]));
    }
    body.appendChild(form);

    async function submit() {
      const name = d.name.trim();
      d.err = '';
      if (!name) d.err = 'Add your name first.';
      else if (!d.rel.trim()) d.err = 'Tell us who you are to Ting, or tap a cue.';
      else if (!d.a) d.err = 'Tap your arrival day, then your last day.';
      else if (!editing && !PIN_RE.test(d.pin)) d.err = 'Pick a PIN of 4 to 8 digits, so you can edit your entry later.';
      else if (editing && d.pin && !PIN_RE.test(d.pin)) d.err = 'Your PIN needs 4 to 8 digits.';
      if (d.err) { sync(); return; }
      const payload = { name: name, rel: d.rel.trim(), type: d.type, jacket: d.jacket, hat: d.helmet, arrive: d.a, leave: d.b || d.a, where: d.where || 'Still deciding',
        msg: d.msg.trim() || 'Here I come!', pass: d.pass, bag: d.bag, email: d.email.trim(), photo: d.photo, website: d.website };
      if (d.pin) payload.pin = d.pin;
      go.disabled = true;
      try {
        const r = editing && mine ? await api('PUT', '/api/skiers/' + encodeURIComponent(mine.id), payload, { 'X-Edit-Token': mine.token }) : await api('POST', '/api/skiers', payload);
        if (!r.skier) { closePanel(); return; } // honeypot answered "ok"
        const p = fromApi(r.skier);
        if (editing) {
          byId[p.id] = Object.assign(p, { isNew: false });
          toastAfterClose = 'Saved. Looking good, ' + p.name + '.';
          closePanel();
          if (reduce) render();
        } else {
          saveMine({ id: p.id, token: r.editToken });
          localAdded[p.id] = p; byId[p.id] = p;
          setCount();
          dropIn(p.id);
          toastAfterClose = 'Here you come, ' + p.name + '! Watch the top of the slope.';
          showDone(body, p);
        }
      } catch (e) {
        d.err = e.message; go.disabled = false; sync();
      }
    }
  }

  // After a new sign-up: how to get back in (name + PIN, or the private edit link); no email is sent.
  function showDone(body, p) {
    body.textContent = '';
    body.appendChild(h('p', { class: 'lead', text: 'You’re on the slope, ' + p.name + '. You’ll drop in at the top.' }));
    body.appendChild(h('div', { class: 'field' }, [
      h('span', { class: 'flabel', text: 'Changing your mind later?' }),
      h('span', { text: 'Tap Join the slope, then “Already signed up?”, and enter your name and PIN. It works on any phone.' })
    ]));
    body.appendChild(h('div', { class: 'field' }, [
      h('span', { class: 'flabel', text: 'Or use your private edit link' }),
      h('div', { class: 'link-row' }, [h('input', { class: 'input', type: 'text', readonly: true, value: editUrl(), 'aria-label': 'Your private edit link', onfocus: (e) => e.target.select() }),
        h('button', { type: 'button', class: 'mini', text: 'Copy', onclick: (e) => copyText(editUrl(), e.target) })]),
      h('span', { class: 'note', text: 'Anyone with this link can edit your entry, so don’t post it.' })
    ]));
    body.appendChild(h('button', { type: 'button', class: 'btn btn-go self-start', text: 'WATCH ME DROP IN ↓', onclick: closePanel }));
  }
  function copyText(text, btn) {
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => { btn.previousSibling.select(); });
    else { btn.previousSibling.select(); try { document.execCommand('copy'); done(); } catch (e) { /* the link is selected for a manual copy */ } }
  }

  // A square 160px JPEG, small enough to store with the entry. Steps quality (then size) down until it fits.
  function squareJpeg(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject(new Error('not an image'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const m = Math.min(img.width, img.height);
        for (const S of [160, 128, 96]) {
          const c = document.createElement('canvas'); c.width = S; c.height = S;
          c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
          for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) { const out = c.toDataURL('image/jpeg', q); if (out.length <= 15000) return resolve(out); }
        }
        reject(new Error('too big'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  /* ---------- boot ---------- */
  function resize() {
    stageW = stage.clientWidth; stageH = stage.clientHeight;
    sizeCanvas();
    if (ready) { if (sel) showCard(); render(); }
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  if (reduceQuery && reduceQuery.addEventListener) reduceQuery.addEventListener('change', () => { reduce = reduceQuery.matches; if (!reduce) startLoop(); else render(); });

  let last = 0, looping = false;
  function loop(ts) {
    if (reduce) { looping = false; return; }
    requestAnimationFrame(loop);
    if (ts - last < 33) return; // about 30 fps, like the prototype
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.033;
    last = ts;
    step(dt, sel, false);
    animating = true;
    render();
    animating = false;
  }
  function startLoop() { if (!looping) { looping = true; last = 0; requestAnimationFrame(loop); } }

  function boot() {
    setCount();
    sizeCanvas();
    for (let i = 0; i < 520; i++) step(0.05, null, true); // pre-run about 25 s so the first view already has tracks
    ready = true;
    render();
    if (!reduce) startLoop();
    // Arriving via a private edit link: remember it and open the form.
    const m = /^#edit=([\w-]+)\.([\w-]+)$/.exec(location.hash);
    if (m) {
      saveMine({ id: m[1], token: m[2] });
      history.replaceState(null, '', location.pathname + location.search);
      openPanel('join');
    }
  }

  // Give the list a moment so the first view already shows everyone's tracks; keep loading if it is slow.
  const listing = loadList().catch(() => {});
  Promise.race([listing, new Promise((res) => setTimeout(res, 2500))]).then(boot);
  setInterval(() => { if (ready && !document.hidden && !overlay) loadList().catch(() => {}); }, 60000);
})();
