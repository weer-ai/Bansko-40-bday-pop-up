(function () {
  'use strict';
  var SITE = window.SITE || { links: {}, images: {} };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var NS = 'http://www.w3.org/2000/svg';
  var ARROW = '<svg width="22" height="12" viewBox="0 0 22 12" fill="none" aria-hidden="true"><path d="M1 6 H20 M15 1 L20 6 L15 11" stroke="currentColor" stroke-width="1.3"/></svg>';

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function goTo(id) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- data ---------- */
  var ORIGINS = [
    { id: 'ams', label: 'Amsterdam', color: '#6C171E' }, { id: 'delft', label: 'Delft', color: '#2D5BA8' },
    { id: 'bansko', label: 'Bansko', color: '#1F5560' }, { id: 'tw', label: 'Taiwan', color: '#A07A1F' },
    { id: 'nomad', label: 'Nomad communities', color: '#9E3F6E' }, { id: 'other', label: 'Somewhere else', color: '#6E7486' }
  ];
  var oById = {}; ORIGINS.forEach(function (o) { oById[o.id] = o; });
  var PARTS = [{ id: 'colive', label: 'Coliving month' }, { id: 'slope', label: 'Slope party · 12 Feb' }, { id: 'spa', label: 'Spa night · 12 Feb' }];
  var PART_SHORT = { colive: 'Coliving month', slope: 'Slope party', spa: 'Spa night' };
  var STAY = ['The whole month', 'Two weeks', 'One week', 'Just the 12th'];
  var WHERE = ['Valentina Heights', 'My own place in Bansko', 'A hotel in town', 'Still deciding'];
  var JACKETS = ['#6C171E', '#4F74B3', '#1F5560', '#D9A23A', '#9E3F6E', '#1D1D1B', '#F1F5FA', '#C8D63A'];
  var HOST = { id: 'host', name: 'Ting', host: true, from: ORIGINS.map(function (o) { return o.id; }), fromOther: '', parts: ['colive', 'slope', 'spa'], stay: 'The whole month', where: 'Valentina Heights', msg: 'Thank you for coming all this way. See you on the slope!', jacket: '#6C171E', hat: '#1D1D1B' };

  var state = { people: [HOST], sel: null, big: false, filter: null, tab: 'from', place: null, justAdded: null };
  var mine = null; // { id, token } for the visitor's own entry
  try { mine = JSON.parse(localStorage.getItem('bansko-mine') || 'null'); } catch (e) { mine = null; }
  function saveMine(m) { mine = m; try { localStorage.setItem('bansko-mine', JSON.stringify(m)); } catch (e) {} }

  function link(k) { return (SITE.links && SITE.links[k]) || ''; }

  /* ---------- static content wiring ---------- */
  function applyImage(el, url) {
    if (!el || !url) return;
    el.classList.add('has-img'); el.style.setProperty('--img', 'url("' + url.replace(/"/g, '%22') + '")');
    var tag = el.parentNode.querySelector('.tag'); if (tag) tag.classList.add('hidden-tag');
  }
  var IMG = SITE.images || {};
  applyImage($('#slope-photo'), IMG.slope); applyImage($('#bansko-photo'), IMG.bansko); applyImage($('#snow-photo'), IMG.snow);
  $$('[data-closing]').forEach(function (el) { applyImage(el, (IMG.closing || [])[+el.getAttribute('data-closing')]); });

  $$('[data-link]').forEach(function (a) {
    var u = link(a.getAttribute('data-link'));
    if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener'; }
    else { a.title = 'Link coming soon'; a.addEventListener('click', function (e) { e.preventDefault(); }); }
  });

  // hero carousel
  var heroLabels = ['[Photo — birthday crowd, confetti in the air]', '[Photo — friends toasting at a long table]', '[Photo — Ting mid-laugh, party lights]'];
  var heroN = (IMG.hero && IMG.hero.length) || heroLabels.length, heroI = 0;
  function renderHero() {
    var ph = $('#hero-photo');
    if (IMG.hero && IMG.hero.length) { applyImage(ph, IMG.hero[heroI]); $('#hero-label').hidden = true; }
    else $('#hero-label').textContent = heroLabels[heroI];
    $('#hero-count').textContent = (heroI + 1) + ' / ' + heroN;
  }
  $('#hero-prev').addEventListener('click', function () { heroI = (heroI + heroN - 1) % heroN; renderHero(); });
  $('#hero-next').addEventListener('click', function () { heroI = (heroI + 1) % heroN; renderHero(); });
  renderHero();

  // video
  $('#play').addEventListener('click', function () {
    if (!SITE.videoUrl) { $('#vlabel').textContent = '[Video coming soon]'; return; }
    var v = h('video', { src: SITE.videoUrl, controls: '', autoplay: '', playsinline: '' });
    $('#circle').appendChild(v); $('#spin').style.animationPlayState = 'paused';
    this.hidden = true; $('#vlabel').hidden = true;
  });

  // menu
  function setMenu(open) { $('#menu-open').hidden = !open; $('#menu-closed').hidden = open; }
  $$('[data-menu]').forEach(function (b) { b.addEventListener('click', function () { setMenu(b.getAttribute('data-menu') === 'open'); }); });
  $$('.m-item').forEach(function (b) {
    b.addEventListener('click', function () {
      setMenu(false);
      if (state.big) closeBig();
      if (b.hasAttribute('data-join')) openForm();
      goTo(b.getAttribute('data-go'));
    });
  });

  /* ---------- places ---------- */
  var ICONS = {
    home: '<path d="M22 100 V46 L60 20 L98 46 V100 Z"/><path d="M48 100 V72 H72 V100"/><rect x="34" y="52" width="14" height="12"/><rect x="72" y="52" width="14" height="12"/>',
    ski: '<rect x="40" y="8" width="12" height="104" rx="6" transform="rotate(-18 46 60)"/><rect x="68" y="8" width="12" height="104" rx="6" transform="rotate(18 74 60)"/>',
    spa: '<circle cx="60" cy="74" r="34"/><circle cx="60" cy="74" r="18"/><path d="M46 30 C 40 22, 52 16, 46 8 M60 30 C 54 22, 66 16, 60 8 M74 30 C 68 22, 80 16, 74 8"/>',
    gym: '<path d="M30 60 H90"/><rect x="16" y="40" width="14" height="40" rx="3"/><rect x="90" y="40" width="14" height="40" rx="3"/><rect x="6" y="48" width="10" height="24" rx="2"/><rect x="104" y="48" width="10" height="24" rx="2"/>',
    desk: '<rect x="22" y="28" width="76" height="50" rx="3"/><path d="M10 92 H110 L100 78 H20 Z"/>',
    plus: '<circle cx="60" cy="60" r="40" stroke-dasharray="6 6"/><path d="M60 42 V78 M42 60 H78"/>'
  };
  var PLACES = [
    { id: 'vh', name: 'Valentina Heights', cat: 'Coliving · where we stay', icon: 'home', link: 'valentinaBooking',
      about: 'We reserved the whole building for February: ten apartments and studios with a shared sauna, kitchen, patio and coworking space. Book directly and mention Ting’s birthday.',
      rows: [['Studio', '€350 / week · €850–950 / month'], ['One-bedroom', '€490 / week · €1,050–1,250 / month'], ['Second person', '+€250 / month']], cta: 'Book with Valentina Heights' },
    { id: 'ski', name: '[Ski rental partner]', cat: 'Skis, boards & boots', icon: 'ski',
      about: 'Our rental partner for the month or just the 12th. Show the pop-up code at the shop.', rows: [['Pop-up rate', '[DISCOUNT]'], ['Code', '[CODE]']], cta: 'See the shop' },
    { id: 'spa', name: 'Grand Hotel Therme', cat: 'Thermal spa · 12 Feb evening', icon: 'spa',
      about: 'Where the birthday winds down after the slope: thermal pools and sauna.', rows: [['When', 'Fri 12 Feb, evening'], ['Entry', '[PRICE]']], cta: 'Spa info' },
    { id: 'gym', name: '[Gym]', cat: 'Training between ski days', icon: 'gym',
      about: 'A gym nearby for mornings when your legs still work. [NAME, DAY PASS PRICE]', rows: [['Day pass', '[PRICE]']], cta: 'Gym info' },
    { id: 'cw', name: '[Coworking space]', cat: 'When the building desk is full', icon: 'desk',
      about: 'Valentina Heights has its own coworking space. For calls or a change of scene, this is our pick in town. [NAME, PRICE]', rows: [['Day pass', '[PRICE]']], cta: 'Coworking info' },
    { id: 'tip', name: 'Know a good spot?', cat: 'Tell us in WhatsApp', icon: 'plus', link: 'whatsapp',
      about: 'Bakeries, mehanas, the best après bar. Share it in the WhatsApp group and we will add it here.', rows: [], cta: 'Open WhatsApp' }
  ];
  function renderPlaces() {
    var grid = $('#places');
    $$('.pcell', grid).forEach(function (n) { n.remove(); });
    PLACES.forEach(function (p) {
      var on = state.place === p.id;
      var btn = h('button', { type: 'button', class: 'place' + (p.id === 'tip' ? ' tip' : ''), 'aria-pressed': String(on), 'aria-label': p.name + ', details',
        onclick: function () { state.place = on ? null : p.id; renderPlaces(); } });
      btn.innerHTML = '<span class="exp"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M11 2 H16 V7 M16 2 L10 8 M7 16 H2 V11 M2 16 L8 10" stroke="currentColor" stroke-width="1.2"/></svg></span>' +
        '<svg class="icon" viewBox="0 0 120 120" fill="none" stroke="#6C171E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[p.icon] + '</svg>';
      grid.appendChild(h('div', { class: 'pcell' }, [btn, h('span', { class: 'pname', text: p.name }), h('span', { class: 'pcat', text: p.cat })]));
    });
    var box = $('#place-detail'), p = PLACES.filter(function (x) { return x.id === state.place; })[0];
    box.hidden = !p; box.innerHTML = '';
    if (!p) return;
    var href = p.link ? link(p.link) : '';
    var cta = href ? h('a', { href: href, target: '_blank', rel: 'noopener' }) : h('a', { href: '#', 'aria-disabled': 'true', title: 'Link coming soon', style: 'opacity:.5', onclick: function (e) { e.preventDefault(); } });
    cta.appendChild(document.createTextNode(p.cta + ' ')); cta.appendChild(h('span', { class: 'circ', html: ARROW }));
    var right = h('div', {}, [
      h('div', {}, p.rows.map(function (r) { return h('div', { class: 'prow' }, [h('span', { text: r[0] }), h('span', { text: r[1] })]); })),
      h('div', { class: 'pact' }, [cta, h('button', { type: 'button', class: 'close', text: 'close', onclick: function () { state.place = null; renderPlaces(); } })])
    ]);
    box.appendChild(h('div', { class: 'pdetail pop' }, [
      h('div', {}, [h('span', { class: 'pt', text: p.name }), h('span', { class: 'pc', text: p.cat }), h('p', { class: 'pa', text: p.about })]), right]));
  }
  renderPlaces();

  /* ---------- skier simulation (ported from the prototype) ---------- */
  var sim = {}, simT = 0, simSeed = 97, gi = 0;
  function rnd() { simSeed = (simSeed * 16807) % 2147483647; return (simSeed - 1) / 2147483646; }
  function ensureSim() {
    state.people.forEach(function (p) {
      if (sim[p.id]) return;
      var hx, hy;
      if (p.isNew) { hx = 560 + rnd() * 320; hy = 120; }
      else if (p.host) { hx = 300; hy = 420; }
      else { var col = gi % 7, row = Math.floor(gi / 7); gi++; hx = 90 + col * 210 + (rnd() - 0.5) * 140; hy = -20 + row * 180 + (rnd() - 0.5) * 120; }
      sim[p.id] = { hx: hx, hy: hy, cx: hx, cy: hy, speed: p.host ? 4 : 5 + rnd() * 7, A: 14 + rnd() * 20, amp: 14 + rnd() * 20, w: 0.35 + rnd() * 0.4, ph: rnd() * 6.283, dx: hx, dy: hy, rot: 0, op: 1, isM: false };
    });
  }
  function matches(p, f) {
    if (!f) return false;
    if (f.cat === 'from') return p.from.indexOf(f.val) >= 0;
    if (f.cat === 'stay') return p.stay === f.val;
    if (f.cat === 'where') return p.where === f.val;
    return false;
  }
  function sm(x, a, b) { var u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); }
  function step(dt) {
    ensureSim();
    var f = state.big ? state.filter : null, sel = state.sel;
    simT += reduce ? 0 : dt;
    var k = 1 - Math.exp(-dt * 1.9), slot = {};
    state.people.filter(function (p) { return matches(p, f); }).forEach(function (p, i) {
      var a = i * 2.39996, rr = 30 * Math.sqrt(i + 0.5);
      slot[p.id] = [720 + Math.cos(a) * rr * 1.6, 470 + Math.sin(a) * rr];
    });
    state.people.forEach(function (p) {
      var e = sim[p.id], frozen = p.id === sel, isM = !!slot[p.id];
      if (!isM && !frozen && !reduce) { e.hy += e.speed * dt; if (e.hy > 960) { e.hy -= 1040; e.cy -= 1040; } }
      var tx = e.hx, ty = e.hy;
      if (isM) { tx = slot[p.id][0]; ty = slot[p.id][1]; }
      else if (f) { var d = e.hx - 720, ad = Math.abs(d); if (ad < 480) tx = 720 + (d < 0 ? -1 : 1) * (480 + ad * 0.45); tx = Math.max(24, Math.min(1416, tx)); }
      if (!frozen) { e.cx += (tx - e.cx) * k; e.cy += (ty - e.cy) * k; }
      e.amp += (((isM || frozen) ? 3 : e.A) - e.amp) * k;
      var ph = simT * e.w + e.ph;
      e.dx = e.cx + e.amp * Math.sin(ph);
      e.dy = e.cy + e.amp * 0.18 * Math.sin(2 * ph);
      var rot = Math.max(-48, Math.min(48, -Math.atan2(e.amp * e.w * Math.cos(ph), (isM || frozen) ? 6 : Math.max(e.speed, 6)) * 57.3));
      e.rot += (rot - e.rot) * Math.min(1, dt * 6);
      var op = (isM || frozen) ? 1 : sm(e.cy, -50, 20) * (1 - sm(e.cy, 860, 930));
      if (f && !isM && !frozen) op *= 0.28;
      e.op = op; e.isM = isM;
    });
  }

  /* ---------- threads ---------- */
  var edgeCache = { key: -1, list: [] };
  function edges() {
    var people = state.people;
    if (edgeCache.key === people.length) return edgeCache.list;
    var list = [];
    ORIGINS.forEach(function (o) {
      var g = people.filter(function (p) { return !p.host && p.from.indexOf(o.id) >= 0; });
      for (var i = 0; i + 1 < g.length; i++) list.push({ a: g[i].id, b: g[i + 1].id, c: o.id, bend: ((i * 37) % 70) - 35 });
      if (g.length) list.push({ a: 'host', b: g[0].id, c: 'host', bend: 30 });
    });
    edgeCache = { key: people.length, list: list };
    return list;
  }
  var THREAD_KEYS = ORIGINS.map(function (o) { return o.id; }).concat(['host', 'hot']);
  var THREAD_STYLE = { host: ['#2A0A0E', 1.1, 0.4], hot: ['#5A1219', 1.8, 0.9] };
  ORIGINS.forEach(function (o) { THREAD_STYLE[o.id] = [o.color, 1.1, 0.4]; });

  /* ---------- map views ---------- */
  function makeView(root, big) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'threads'); svg.setAttribute('viewBox', '0 0 1440 900'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    var paths = {};
    THREAD_KEYS.forEach(function (k) {
      var p = document.createElementNS(NS, 'path'); var s = THREAD_STYLE[k];
      p.setAttribute('stroke', s[0]); p.setAttribute('stroke-width', s[1]); p.setAttribute('opacity', s[2]);
      svg.appendChild(p); paths[k] = p;
    });
    root.appendChild(svg);
    var els = {}, card = null, cardFor = null;

    function sync() {
      state.people.forEach(function (p) {
        if (els[p.id]) return;
        var b = h('button', { type: 'button', class: 'skier', 'aria-label': (p.host ? 'Ting, your host' : p.name) + ', open their card',
          onclick: function () { state.sel = state.sel === p.id ? null : p.id; if (state.sel !== p.id) { state.justAdded = null; renderJust(); } } });
        b.innerHTML = '<svg width="20" height="36" viewBox="0 0 20 36" aria-hidden="true">' +
          '<circle class="ring" cx="10" cy="17" r="15" fill="none" stroke="#5A1219" stroke-width="1.3" opacity="0"/>' +
          '<ellipse cx="13" cy="20" rx="6" ry="13" fill="rgba(42,10,14,0.10)"/>' +
          '<rect x="5" y="2" width="2.4" height="32" rx="1.2" fill="#2B2D2B"/><rect x="12.6" y="2" width="2.4" height="32" rx="1.2" fill="#2B2D2B"/>' +
          '<path d="M4 15 L1 25 M16 15 L19 25" stroke="#6A6C68" stroke-width="0.9" stroke-linecap="round"/>' +
          '<ellipse cx="10" cy="15.5" rx="6.6" ry="5" stroke="rgba(0,0,0,0.15)" stroke-width="0.5" class="jk"/><circle cx="10" cy="14.5" r="3.4" class="hat"/></svg>';
        $('.jk', b).setAttribute('fill', p.jacket); $('.hat', b).setAttribute('fill', p.hat || '#1D1D1B');
        root.appendChild(b); els[p.id] = b;
      });
    }
    function X(x) { return (x / 14.4).toFixed(2) + '%'; }
    function Y(y) { return (y / 9).toFixed(2) + '%'; }

    function buildCard(p) {
      var from = p.host ? [{ label: 'Everyone here', color: '#1D1D1B' }] : p.from.map(function (k) { return { label: k === 'other' ? (p.fromOther || 'Somewhere else') : oById[k].label, color: oById[k].color }; });
      var wa = link('whatsapp');
      var c = h('div', { class: 'skcard pop', role: 'dialog', 'aria-label': p.name }, [
        h('div', { class: 'head' }, [
          h('span', { class: 'nm' }, [h('span', { class: 'dot', style: 'background:' + p.jacket }), h('span', { text: p.host ? 'Ting · host' : p.name })]),
          h('button', { type: 'button', class: 'x', 'aria-label': 'Close', onclick: function () { state.sel = null; state.justAdded = null; renderJust(); }, html: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 1 L13 13 M13 1 L1 13" stroke="currentColor" stroke-width="1.4"/></svg>' })
        ]),
        h('p', { class: 'msg', text: '“' + (p.msg || '—') + '”' }),
        h('div', { class: 'tbl' }, [
          h('div', { class: 'tr' }, [h('span', { text: 'Knows Ting' }), h('span', { class: 'fr' }, from.map(function (f) { return h('span', { class: 'fi' }, [h('i', { style: 'background:' + f.color }), f.label]); }))]),
          h('div', { class: 'tr' }, [h('span', { text: 'Staying' }), h('span', { text: p.stay || '—' })]),
          h('div', { class: 'tr' }, [h('span', { text: 'Sleeping at' }), h('span', { text: p.where || '—' })]),
          h('div', { class: 'tr' }, [h('span', { text: 'Joining' }), h('span', { text: p.parts.map(function (k) { return PART_SHORT[k]; }).join(', ') })])
        ]),
        h('a', Object.assign({ class: 'hi', html: 'Say hi in WhatsApp <span class="circ">' + ARROW + '</span>' }, wa ? { href: wa, target: '_blank', rel: 'noopener' } : { href: '#', title: 'Link coming soon', onclick: function (e) { e.preventDefault(); } }))
      ]);
      if (mine && mine.id === p.id) c.appendChild(h('button', { type: 'button', class: 'edit', text: 'Edit my skier', onclick: function () { closeBig(); openForm(true); goTo('join'); } }));
      return c;
    }

    function update() {
      sync();
      var f = state.big ? state.filter : null;
      state.people.forEach(function (p) {
        var e = sim[p.id], b = els[p.id];
        b.style.left = X(e.dx); b.style.top = Y(e.dy);
        b.style.transform = 'rotate(' + e.rot.toFixed(1) + 'deg)'; b.style.opacity = e.op.toFixed(2);
        b.querySelector('.ring').setAttribute('opacity', state.sel === p.id ? 1 : 0);
      });
      var d = {}; THREAD_KEYS.forEach(function (k) { d[k] = []; });
      edges().forEach(function (ed) {
        var a = sim[ed.a], b = sim[ed.b];
        if (!a || !b) return;
        if (Math.min(a.op, b.op) < 0.35) return;
        var mx = (a.dx + b.dx) / 2, my = (a.dy + b.dy) / 2, ddx = b.dx - a.dx, ddy = b.dy - a.dy, len = Math.max(1, Math.sqrt(ddx * ddx + ddy * ddy));
        var s = 'M' + a.dx.toFixed(1) + ' ' + (a.dy + 6).toFixed(1) + 'Q' + (mx - ddy / len * ed.bend).toFixed(1) + ' ' + (my + ddx / len * ed.bend).toFixed(1) + ' ' + b.dx.toFixed(1) + ' ' + (b.dy + 6).toFixed(1);
        (f && a.isM && b.isM ? d.hot : d[ed.c]).push(s);
      });
      THREAD_KEYS.forEach(function (k) { paths[k].setAttribute('d', d[k].join(' ') || 'M0 0'); });

      var sp = state.sel && state.people.filter(function (p) { return p.id === state.sel; })[0];
      if (!sp) { if (card) { card.remove(); card = null; cardFor = null; } return; }
      if (cardFor !== sp.id) { if (card) card.remove(); card = buildCard(sp); cardFor = sp.id; root.appendChild(card); }
      var e2 = sim[sp.id], right = e2.dx > 960;
      card.style.left = right ? 'auto' : 'calc(' + X(e2.dx) + ' + 26px)';
      card.style.right = right ? 'calc(' + (100 - e2.dx / 14.4).toFixed(2) + '% + 26px)' : 'auto';
      card.style.top = 'clamp(12px, calc(' + Y(e2.dy) + ' - 110px), calc(100% - 330px))';
    }
    function reset() { if (card) { card.remove(); card = null; cardFor = null; } }
    return { update: update, reset: reset };
  }

  var viewInline = makeView($('#map-inline'), false);
  var viewBig = makeView($('#map-big'), true);

  var inViewport = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { inViewport = en[0].isIntersecting; }, { threshold: 0 }).observe($('#map'));

  var last = 0;
  function loop(ts) {
    if (ts - last > 32) {
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.033; last = ts;
      if (!document.hidden && (state.big || inViewport)) { step(dt); (state.big ? viewBig : viewInline).update(); }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- enlarged map + filters ---------- */
  function openBig() { state.big = true; viewInline.reset(); $('#big').hidden = false; renderFilters(); $('#close-big').focus(); }
  function closeBig() { if (!state.big) return; state.big = false; state.filter = null; $('#big').hidden = true; viewBig.reset(); renderFilters(); }
  $('#open-big').addEventListener('click', openBig);
  $('#close-big').addEventListener('click', closeBig);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (state.big) closeBig(); else { state.sel = null; setMenu(false); } } });

  function renderFilters() {
    var tabsDef = [{ id: 'from', label: 'Knows Ting from' }, { id: 'stay', label: 'Staying' }, { id: 'where', label: 'Sleeping at' }];
    var tabs = $('#tabs'); tabs.innerHTML = '';
    tabsDef.forEach(function (t) { tabs.appendChild(h('button', { type: 'button', text: t.label, 'aria-pressed': String(state.tab === t.id), onclick: function () { state.tab = t.id; renderFilters(); } })); });
    tabs.appendChild(h('span', { class: 'sp' }));
    if (state.filter) tabs.appendChild(h('button', { type: 'button', class: 'all', text: 'everyone', onclick: function () { state.filter = null; renderFilters(); } }));
    var defs = state.tab === 'from' ? ORIGINS.map(function (o) { return { val: o.id, label: o.label, color: o.color }; })
      : (state.tab === 'stay' ? STAY : WHERE).map(function (v) { return { val: v, label: v }; });
    var chips = $('#chips'); chips.innerHTML = '';
    defs.forEach(function (c) {
      var on = !!(state.filter && state.filter.cat === state.tab && state.filter.val === c.val);
      var n = state.people.filter(function (p) { return matches(p, { cat: state.tab, val: c.val }); }).length;
      chips.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), onclick: function () { state.filter = on ? null : { cat: state.tab, val: c.val }; state.sel = null; renderFilters(); } },
        [c.color ? h('i', { style: 'background:' + c.color }) : null, c.label, h('b', { text: String(n) })]));
    });
    var ct = $('#big-center'), f = state.filter;
    if (f) {
      var n2 = state.people.filter(function (p) { return matches(p, f); }).length;
      ct.textContent = f.cat === 'from' ? n2 + ' from ' + (f.val === 'other' ? 'somewhere else' : oById[f.val].label)
        : f.cat === 'stay' ? n2 + ' staying ' + f.val.toLowerCase() : n2 + ' at ' + f.val.replace('My own', 'their own');
    }
    ct.hidden = !f;
  }

  function renderJust() {
    var j = $('#just');
    j.hidden = !(state.justAdded && !state.big);
    j.textContent = state.justAdded ? 'Welcome to the slope, ' + state.justAdded + '.' : '';
  }
  function renderCount() {
    var real = state.people.length - 1;
    $('#count').textContent = real + (real === 1 ? ' skier' : ' skiers') + ' on the slope';
  }

  /* ---------- loading skiers ---------- */
  function api(method, url, body, headers) {
    return fetch(url, { method: method, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j; }); });
  }
  function loadSkiers() {
    return api('GET', '/api/skiers').then(function (list) {
      var fresh = state.people.filter(function (p) { return p.isNew && !list.some(function (q) { return q.id === p.id; }); });
      state.people = [HOST].concat(list, fresh); edgeCache.key = -1; renderCount();
      if (state.big) renderFilters();
    }).catch(function () { renderCount(); });
  }
  loadSkiers();
  setInterval(function () { if (!document.hidden && !formOpen) loadSkiers(); }, 60000);

  /* ---------- sign-up / edit form ---------- */
  var form = $('#signup-form'), formOpen = false, editing = false, draft = blank();
  function blank() { return { name: '', from: [], fromOther: '', parts: [], stay: '', where: '', msg: '', jacket: JACKETS[0], email: '', website: '', err: '' }; }
  $('#ld-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') openForm(); });
  $('#open-form').addEventListener('click', function () { openForm(); });

  function openForm(edit) {
    if (edit && mine) {
      editing = true; draft = blank();
      api('GET', '/api/skiers/' + encodeURIComponent(mine.id), null, { 'X-Edit-Token': mine.token }).then(function (r) {
        var s = r.skier; draft = { name: s.name, from: s.from.slice(), fromOther: s.fromOther || '', parts: s.parts.slice(), stay: s.stay, where: s.where, msg: s.msg, jacket: s.jacket, email: s.email || '', website: '', err: '' };
        renderForm();
      }).catch(function () { editing = false; saveMine(null); draft.err = 'Your edit link is no longer valid. Sign up again below.'; renderForm(); });
    } else { editing = false; draft = blank(); draft.name = $('#ld-name').value.trim(); }
    formOpen = true; renderForm();
  }
  function closeForm() { formOpen = false; $('#signup-closed').hidden = false; form.hidden = true; $('#signup-eyebrow').textContent = 'Join the slope'; }

  function toggle(list, v) { var i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v); }
  function opts(items, isOn, onPick, dot) {
    return h('div', { class: 'opts' }, items.map(function (it) {
      return h('button', { type: 'button', class: 'opt', 'aria-pressed': String(isOn(it)), onclick: function () { onPick(it); renderForm(); } }, [dot && dot(it) ? h('i', { style: 'background:' + dot(it) }) : null, it.label || it]);
    }));
  }
  function field(label, type, key, ph, max) {
    return h('label', { class: 'f' }, [label, h('input', { type: type, value: draft[key], placeholder: ph, maxlength: max, oninput: function (e) { draft[key] = e.target.value; } })]);
  }
  function renderForm() {
    $('#signup-closed').hidden = true; form.hidden = false;
    $('#signup-eyebrow').textContent = editing ? 'Edit your skier' : 'Join the slope';
    form.innerHTML = '';
    form.appendChild(field('Your name', 'text', 'name', 'How people call you', 40));
    form.appendChild(h('span', { class: 'lbl', text: 'Where do you know Ting from?' }));
    form.appendChild(opts(ORIGINS, function (o) { return draft.from.indexOf(o.id) >= 0; }, function (o) { toggle(draft.from, o.id); draft.err = ''; },
      function (o) { return o.color === '#6C171E' ? '#E8A0A6' : o.color; }));
    if (draft.from.indexOf('other') >= 0) form.appendChild(field('From…', 'text', 'fromOther', 'e.g. Singapore', 40));
    form.appendChild(h('span', { class: 'lbl', text: 'Joining' }));
    form.appendChild(opts(PARTS, function (p) { return draft.parts.indexOf(p.id) >= 0; }, function (p) { toggle(draft.parts, p.id); }));
    form.appendChild(h('span', { class: 'lbl', text: 'How long are you staying?' }));
    form.appendChild(opts(STAY, function (v) { return draft.stay === v; }, function (v) { draft.stay = draft.stay === v ? '' : v; }));
    form.appendChild(h('span', { class: 'lbl', text: 'Where are you planning to stay?' }));
    form.appendChild(opts(WHERE, function (v) { return draft.where === v; }, function (v) { draft.where = draft.where === v ? '' : v; }));
    form.appendChild(field('A message for everyone', 'text', 'msg', 'e.g. Who wants to share a ride from Sofia?', 140));
    form.appendChild(h('span', { class: 'lbl', text: 'Your ski jacket' }));
    form.appendChild(h('div', { class: 'jackets' }, JACKETS.map(function (c) {
      return h('button', { type: 'button', class: 'jk', style: 'background:' + c, 'aria-label': 'Jacket colour ' + c, 'aria-pressed': String(draft.jacket === c), onclick: function () { draft.jacket = c; renderForm(); } });
    })));
    form.appendChild(field('Email (optional, private: only used to send you your edit link)', 'email', 'email', 'you@example.com', 120));
    form.appendChild(h('input', { type: 'text', class: 'hp', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', oninput: function (e) { draft.website = e.target.value; } }));
    if (draft.err) form.appendChild(h('span', { class: 'err', role: 'alert', text: draft.err }));
    form.appendChild(h('div', { class: 'actions' }, [
      h('button', { type: 'button', class: 'later', text: editing ? 'cancel' : 'later', onclick: function () { draft.err = ''; closeForm(); } }),
      h('button', { type: 'submit', class: 'arrow-btn light go', html: (editing ? 'Save changes' : 'Drop me on the map') + ' <span class="circ">' + ARROW + '</span>' })
    ]));
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!draft.name.trim()) { draft.err = 'Add your name first.'; return renderForm(); }
    if (!draft.from.length) { draft.err = 'Tell us where you know Ting from.'; return renderForm(); }
    if (draft.from.indexOf('other') >= 0 && !draft.fromOther.trim()) { draft.err = 'Fill in where you know Ting from.'; return renderForm(); }
    var payload = { name: draft.name, from: draft.from, fromOther: draft.fromOther, parts: draft.parts, stay: draft.stay, where: draft.where, msg: draft.msg, jacket: draft.jacket, email: draft.email, website: draft.website };
    var btn = $('.go', form); if (btn) btn.disabled = true;
    var req = editing && mine ? api('PUT', '/api/skiers/' + encodeURIComponent(mine.id), payload, { 'X-Edit-Token': mine.token }) : api('POST', '/api/skiers', payload);
    req.then(function (r) {
      if (!r.skier) { closeForm(); return; } // honeypot
      var s = r.skier, wasEditing = editing;
      if (r.editToken) saveMine({ id: s.id, token: r.editToken });
      var i = state.people.findIndex(function (p) { return p.id === s.id; });
      if (i >= 0) { Object.assign(state.people[i], s); } else { s.isNew = true; state.people.push(s); }
      edgeCache.key = -1; renderCount();
      closeForm(); $('#ld-name').value = '';
      showDone(wasEditing);
      state.sel = s.id; state.justAdded = wasEditing ? null : s.name; renderJust(); goTo('map');
    }).catch(function (err) { draft.err = err.message; renderForm(); });
  });

  function showDone(wasEditing) {
    var old = $('#signup-done'); if (old) old.remove();
    if (!mine) return;
    var url = location.origin + '/#edit=' + mine.id + '.' + mine.token;
    var box = h('div', { id: 'signup-done', class: 'pop' }, [
      h('span', { class: 'nl-h', text: wasEditing ? 'Saved. Your skier is updated.' : 'You’re on the slope.' }),
      h('p', { class: 'editlink', text: 'Keep this link to change your entry later: ' + url }),
      h('button', { type: 'button', class: 'later', style: 'margin-top:12px;height:44px;padding:0 14px;border:1px solid rgba(241,245,250,.4);border-radius:3px;background:transparent;color:#F1F5FA;cursor:pointer;font-size:14px', text: 'Edit my skier', onclick: function () { box.remove(); openForm(true); } })
    ]);
    $('#signup').appendChild(box);
  }

  // Arriving via an edit link: remember it and open the form once skiers are loaded.
  var m = /^#edit=([\w-]+)\.([\w-]+)$/.exec(location.hash);
  if (m) {
    saveMine({ id: m[1], token: m[2] });
    history.replaceState(null, '', location.pathname);
    window.addEventListener('load', function () { openForm(true); goTo('join'); });
  } else if (mine) {
    showDone(true); var dn = $('#signup-done .nl-h'); if (dn) dn.textContent = 'Welcome back.';
  }
})();
