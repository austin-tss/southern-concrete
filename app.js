/* Southern Concrete Coatings — one Owner login. */
let API = new URLSearchParams(location.search).get('api') || localStorage.sccApi || API_URL || '';
if (API) localStorage.sccApi = API;

let blocks = [], role = sessionStorage.sccRole || '', jobs = [], root = '', cur = null, pin = '', photos = [], CALLS = [];
let serverTest = null, view = '', SET = {}, EXP = [], EXPL = false, EXPLOAD = false, PAYING = '', PAYM = 'check', CK = '', CQ = '', CL = [], SQ = '', tab = 'est';
let RC = null, RCT = 0, RQ = [];
let jtab = 'job', jtabFor = null, editId = '';
let GALS = [], GQ = '', GVIEW = [], GI = 0, GPIC = '', GX = 0, GEDIT = false;
const $ = (s) => document.querySelector(s);
const A = $('#app');
let SKIPNAV = false;
let CEDIT = false;
let FORM = null;
function themeName() {
  if (localStorage.sccTheme === 'classic' || localStorage.sccTheme === 'dark') return localStorage.sccTheme;
  if (SET && SET.theme === 'classic') return 'classic';
  return 'dark';
}
function applyTheme(name) {
  const dark = name !== 'classic';
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#1e2126' : '#3a415c');
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute('content', dark ? 'dark' : 'light');
}
function syncTheme() { applyTheme(themeName()); }
syncTheme();
function navBar(on) {
  const bar = $('#navbar');
  if (bar) bar.hidden = !on;
}
function closeOverlays() {
  const gv = $('#gv');
  if (gv) gv.hidden = true;
  const lb = $('#lb');
  if (lb) lb.style.display = 'none';
}
function overlayOpen() {
  const gv = $('#gv');
  const lb = $('#lb');
  return !!((gv && !gv.hidden) || (lb && lb.style.display === 'flex'));
}
function syncChrome() {
  navBar(!!(role && (cur || view || editId)));
}
function place() {
  return { home: !view && !cur && !editId, view: view || '', cur: cur || null, CK: CK || '', tab: tab, edit: editId || '' };
}
function markNav() {
  if (SKIPNAV) return;
  try { history.pushState(place(), ''); } catch (e) {}
}
function navBack() {
  if (overlayOpen()) { closeOverlays(); return; }
  try { history.back(); } catch (e) { navHome(); }
}
function navHome() {
  closeOverlays();
  editId = ''; cur = null; view = ''; CK = ''; CEDIT = false; RC = null; PAYING = '';
  render();
  window.scrollTo(0, 0);
  try { history.pushState({ home: true, view: '', cur: null }, ''); } catch (e) {}
}
window.addEventListener('popstate', (ev) => {
  const st = ev.state || { home: true };
  SKIPNAV = true;
  editId = st.edit || '';
  cur = st.cur || null;
  view = st.home ? '' : (st.view || '');
  CK = st.CK || '';
  CEDIT = false;
  RC = null;
  if (st.tab) tab = st.tab;
  if (st.edit) {
    const j = jobs.find((x) => x.id === st.edit);
    if (j) { navBar(true); newq(j); SKIPNAV = false; return; }
  }
  render();
  SKIPNAV = false;
});
try { history.replaceState({ home: true, view: '', cur: null }, ''); } catch (e) {}
function formCfg() {
  try { return SCCQuote.normalizeForm(SET && SET.form); } catch (e) { return SCCQuote.defaultForm(); }
}
function formMeta(id) {
  try { return SCCQuote.formField(formCfg(), id); } catch (e) { return null; }
}
function formOn(id) {
  const f = formMeta(id);
  return !f || f.show !== false;
}
function fieldLabel(id, fallback) {
  const f = formMeta(id);
  return (f && f.label) || fallback;
}
function systemList() {
  const names = formCfg().systems.map((s) => s.name).filter(Boolean);
  return names.length ? names : SYSTEMS;
}
function prepNames() {
  const names = formCfg().addons.map((a) => a.name).filter(Boolean);
  return names.length ? names : PREP_OPTS;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SYSTEMS = [
  'Garage floor flake system', 'Metallic epoxy', 'Solid color epoxy', 'Polyaspartic system',
  'Polyurea garage system', 'Quartz broadcast', 'Pool deck coating', 'Patio and porch coating',
  'Commercial kitchen floor', 'Warehouse / industrial floor', 'Concrete sealing',
  'Grind and prep only', 'Crack and spall repair'
];
const CURES = ['Same-day return', '24 hours', '48 hours', '72 hours', '5–7 days'];
const PREP_OPTS = ['Diamond grinding', 'Crack repair', 'Spall / patch repair', 'Moisture mitigation', 'Oil stain treatment', 'Joint fill', 'Coating removal'];

function toast(t) {
  const e = $('#toast');
  e.textContent = t;
  e.style.display = 'block';
  clearTimeout(e._t);
  e._t = setTimeout(() => { e.style.display = 'none'; }, 4000);
}
function sentMsg(kind) {
  return TEST_MODE ? ('Test mode: ' + kind + ' sent only to ' + TEST_TO) : (kind + ' sent to the customer');
}
async function api(body) {
  if (!API) throw Error('Backend not connected yet. Paste the Apps Script URL.');
  const r = body
    ? await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
    : await fetch(API);
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch (e) { throw Error('Backend did not return JSON.'); }
  if (j.ok === false) throw Error(j.err || 'Request failed');
  return j;
}
async function refresh() {
  try {
    const d = await api();
    jobs = d.jobs || [];
    root = d.root || '';
    blocks = d.blocks || [];
    serverTest = typeof d.test === 'boolean' ? d.test : d.testMode;
    if (d.settings) SET = d.settings;
    syncTheme();
    if (Array.isArray(d.gallery)) GALS = d.gallery;
    if (Array.isArray(d.callLog)) CALLS = d.callLog;
    const bar = $('#testbar');
    if (bar) bar.hidden = !TEST_MODE && serverTest !== true;
  } catch (e) { toast(e.message); }
}
function logout() { sessionStorage.sccRole = ''; role = ''; cur = null; view = ''; CK = ''; PAYING = ''; SQ = ''; render(); }
function shrink(f) {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => {
      const m = 1400, s = Math.min(1, m / Math.max(i.width, i.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(i.width * s));
      c.height = Math.max(1, Math.round(i.height * s));
      c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.75));
    };
    i.src = URL.createObjectURL(f);
  });
}
async function pick(inp, cb) {
  for (const f of inp.files) photos.push(await shrink(f));
  inp.value = '';
  cb();
}
function bindSpeech(btnId, fieldId, hintId) {
  const b = document.getElementById(btnId);
  const q = document.getElementById(fieldId);
  if (!b || !q) return;
  const showHint = (t) => {
    const hint = hintId && document.getElementById(hintId);
    if (hint) { hint.hidden = false; hint.textContent = t; }
    else toast(t);
  };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    b.onclick = () => { q.focus(); showHint('Use the microphone on the keyboard to dictate.'); };
    return;
  }
  let rec = null;
  let base = '';
  b.onclick = () => {
    if (rec) { try { rec.stop(); } catch (e) { rec = null; b.classList.remove('on'); } return; }
    rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    base = q.value || '';
    rec.onresult = (e) => {
      let spoken = '';
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      spoken = spoken.replace(/\s+/g, ' ').trim();
      const prior = base.replace(/\s+$/, '');
      q.value = prior ? (spoken ? prior + ' ' + spoken : prior) : spoken;
    };
    const stop = () => { rec = null; b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); };
    rec.onend = stop;
    rec.onerror = () => { stop(); q.focus(); showHint('Use the microphone on the keyboard to dictate.'); };
    try {
      rec.start();
      b.classList.add('on');
      b.setAttribute('aria-pressed', 'true');
    } catch (e) {
      stop();
      q.focus();
      showHint('Use the microphone on the keyboard to dictate.');
    }
  };
}
function mic(btnId, fieldId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const b = $('#' + btnId), q = $('#' + fieldId);
  if (!b) return;
  if (!SR) { b.onclick = () => toast('Voice is not supported in this browser. Type the quote, or use the keyboard mic.'); return; }
  let r = null;
  b.onclick = () => {
    if (r) { r.stop(); return; }
    r = new SR();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) q.value += (q.value ? ' ' : '') + e.results[i][0].transcript.trim();
      }
    };
    r.onend = () => { r = null; b.classList.remove('on'); b.textContent = '🎤 Talk'; };
    r.onerror = () => { r = null; b.classList.remove('on'); b.textContent = '🎤 Talk'; toast('Mic did not start. You can still type.'); };
    r.start();
    b.classList.add('on');
    b.textContent = '⏹ Stop';
  };
}
let GAL = [];
function src(p) {
  if (typeof p === 'string') return p;
  if (p && p.id) return 'https://lh3.googleusercontent.com/d/' + p.id + '=w1000';
  return (p && p.url) || '';
}
function imgs(list) {
  list = list || [];
  const s = GAL.length;
  GAL.push(...list);
  return '<div class="ph">' + list.map((p, i) => `<img loading="lazy" alt="" src="${esc(src(p))}" data-id="${esc(p.id || '')}" onerror="fb(this)" onclick="big(${s + i})">`).join('') + '</div>';
}
async function fb(im) {
  if (im.dataset.tried || !im.dataset.id || !API) return;
  im.dataset.tried = '1';
  try {
    const r = await fetch(API + (API.indexOf('?') >= 0 ? '&' : '?') + 'a=img&id=' + encodeURIComponent(im.dataset.id));
    const j = await r.json();
    if (j.data) im.src = j.data;
  } catch (e) {}
}
let gi = 0;
let ACC = {};
function acc(k, t, sum, body) {
  const o = ACC[k];
  return `<div class="acc${o ? ' open' : ''}" id="acc-${k}"><button type="button" class="acch" onclick="tg('${k}')"><span><b>${t}</b><small id="sum-${k}">${sum}</small></span><i>▾</i></button><div class="accb">${body}</div></div>`;
}
function tg(k) {
  const e = $('#acc-' + k);
  if (!e) return;
  e.classList.toggle('open');
  ACC[k] = e.classList.contains('open');
}
function sm(k, s) {
  const e = $('#sum-' + k);
  if (e) e.textContent = s;
}
function big(i) {
  gi = i;
  $('#lbi').src = src(GAL[i]);
  $('#lb').style.display = 'flex';
}
function nav(d) { if (GAL.length) big((gi + d + GAL.length) % GAL.length); }
function setupCard() {
  if (API) return '';
  return `<div class="card"><h2>Connect backend</h2><p class="muted">Paste the Apps Script web app URL (the one that ends in /exec). Drive folders and mail run there.</p><input id="apiu" placeholder="https://script.google.com/macros/s/.../exec"><button class="btn n" onclick="saveApi()">Save</button></div>`;
}
function saveApi() {
  API = $('#apiu').value.trim();
  localStorage.sccApi = API;
  render();
}
function render() {
  paint();
  try { renderQ(); } catch (e) {}
}
function paint() {
  GAL = [];
  $('#out').hidden = !role;
  const bar = $('#testbar');
  if (bar) bar.hidden = !TEST_MODE;
  if (role && !Object.values(ROLES).includes(role)) {
    sessionStorage.sccRole = '';
    role = '';
  }
  if (view === 'mile') view = '';
  syncChrome();
  if (!role) {
    pin = '';
    A.innerHTML = setupCard() + `<div class="card" style="text-align:center"><img src="logo.png" alt="" style="width:170px;max-width:60%"><h2 style="margin-top:6px">Enter PIN</h2><div id="dots"></div><div class="pin">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map((k) => `<button type="button" onclick="key('${k}')">${k}</button>`).join('')}</div></div><p class="muted" style="text-align:center">Free estimates · Garage floors and commercial coatings<br>${esc(CO.phone)}</p>`;
    return;
  }
  if (cur) return jview(cur);
  if (view === 'cust') return custScreen();
  if (view === 'books') return bookScreen();
  if (view === 'set') return setScreen();
  if (view === 'gal') return galScreen();
  if (view === 'fb') return feedbackScreen();
  if (view === 'sched') return sched();
  home();
}
function key(k) {
  if (k === '⌫') pin = pin.slice(0, -1);
  else if (k === '✓' || pin.length < 4) { if (k !== '✓') pin += k; }
  const dots = $('#dots');
  if (dots) dots.textContent = '•'.repeat(pin.length);
  if (pin.length === 4) {
    if (ROLES[pin]) {
      role = sessionStorage.sccRole = ROLES[pin];
      try { api({ a: 'signin', role: role, ua: navigator.userAgent }).catch(function(){}); } catch (e) {}
      A.innerHTML = '<div class="card">Loading…</div>';
      refresh().then(render);
    } else {
      toast('Wrong PIN');
      pin = '';
      if ($('#dots')) $('#dots').textContent = '';
    }
  }
}
function stat(j) {
  if (j.status === 'invoiced') return j.invoice && j.invoice.paid ? 'paid' : 'invoiced';
  if (j.status === 'approved') return j.crew && j.crew.length ? 'inprogress' : 'approved';
  return j.status;
}
const SC = { sent: '#3a415c', reply: '#5b4b8a', approved: '#2f6b4f', inprogress: '#b86e00', complete: '#2a3148', invoiced: '#9a3412', paid: '#2f6b4f', declined: '#8a8f98' };
const ST = { paid: 'Paid', inprogress: 'In progress', sent: 'Quote sent', approved: 'Approved', declined: 'Declined', reply: 'Customer replied', complete: 'Job done - invoice', invoiced: 'Invoice OPEN' };
function list(title, arr, go, extra) {
  A.innerHTML = `${setupCard()}${extra || ''}<div class="card"><h2>${title}</h2>${arr.length ? '' : '<p class="muted">Nothing here right now.</p>'}${arr.map((j) => `<button class="btn n" style="text-align:left" onclick="${go}('${j.id}')">${esc(j.name)}<br><small style="font-weight:400">${esc(j.address)} <span class="badge" style="background:${SC[stat(j)] || '#8a8f98'}">${ST[stat(j)] || esc(j.status)}</span>${j.response ? ' · ' + esc(j.response.label) : ''}${av(j) ? '<br>🕒 ' + esc(av(j)) : ''} ${cfBadge(j)}</small></button>`).join('')}<button class="btn gr" onclick="refresh().then(render)">↻ Refresh</button></div>` + (root ? `<p class="muted"><a href="${esc(root)}" target="_blank" rel="noopener">Drive folder</a></p>` : '');
}
function av(j) { const r = j.response || {}; return [r.avail, r.when].filter(Boolean).join(' - '); }
function specHtml(j) {
  const rows = [
    ['Square footage', j.sqft ? SCCQuote.formatSq(j.sqft) + ' sq ft' : ''],
    ['Coating system', j.system || ''],
    ['Color / flake', j.color || ''],
    ['Prep', j.prep || ''],
    ['Return to service', j.cure || ''],
    ['Price per sq ft', j.rate ? SCCQuote.money(j.rate) + ' / sq ft' : '']
  ].filter((r) => r[1]);
  if (!rows.length) return '';
  return '<div class="spec">' + rows.map((r) => `<p><b>${esc(r[0])}</b><br>${esc(r[1])}</p>`).join('') + '</div>';
}
function items(j) {
  const lines = (!j.items || !j.items.length)
    ? `<p style="white-space:pre-wrap">${esc(j.quote || '')}</p>`
    : j.items.map((i) => `<p style="margin:6px 0;font-size:17px"><b>${esc(i.title)}</b>${i.price != null && i.price !== '' ? ' — ' + SCCQuote.money(Number(i.price)) : ''}<br><span class="muted">${esc(i.detail || '')}</span></p>`).join('') + `<p style="font-size:19px"><b>Total: ${SCCQuote.money(j.total)}</b></p>`;
  return lines + `<button class="btn n" id="editq" type="button" onclick="editQuote('${j.id}')">Edit quote</button>`;
}

const DAYN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function hm(s) { const [a, b] = String(s).split(':'); return +a + (+b || 0) / 60; }
function hrs(t) {
  t = t.toLowerCase();
  if (/morning|\bam\b/.test(t) && !/\d/.test(t)) return [8, 12];
  if (/afternoon/.test(t)) return [12, 17];
  const m = t.match(/\b(\d{1,2})(?::(\d\d))?\s*(am|pm)?\b(?!\s*\/)/);
  if (m && (m[3] || /\bat\b/.test(t))) {
    let h = +m[1] + (+m[2] || 0) / 60;
    if (m[3] === 'pm' && h < 12) h += 12;
    if (!m[3] && h < 7) h += 12;
    return [h, Math.min(h + 3, 17)];
  }
  if (/morning/.test(t)) return [8, 12];
  return [8, 17];
}
function windows(j, days) {
  days = days || 21;
  const r = j.response || {}, a = r.avail || '', w = (r.when || '').trim(), out = [], t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  if (w) {
    const t = w.toLowerCase();
    let ds = [];
    const md = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    const mn = MON.findIndex((m) => new RegExp('\\b' + m + '[a-z]*\\.?\\s+(\\d{1,2})\\b').test(t));
    if (md) {
      const d = new Date(t0.getFullYear(), +md[1] - 1, +md[2]);
      if (d < t0) d.setFullYear(d.getFullYear() + 1);
      ds = [d];
    } else if (mn >= 0) {
      const dn = +t.match(new RegExp('\\b' + MON[mn] + '[a-z]*\\.?\\s+(\\d{1,2})\\b'))[1];
      const d = new Date(t0.getFullYear(), mn, dn);
      if (d < t0) d.setFullYear(d.getFullYear() + 1);
      ds = [d];
    } else if (/tomorrow/.test(t)) {
      const d = new Date(t0); d.setDate(d.getDate() + 1); ds = [d];
    } else {
      const wd = DAYN.map((n, i) => new RegExp('\\b' + n.slice(0, 3)).test(t) ? i : -1).filter((i) => i >= 0);
      for (let i = 1; i <= days; i++) {
        const d = new Date(t0); d.setDate(d.getDate() + i);
        if (wd.includes(d.getDay())) ds.push(d);
      }
    }
    const span = hrs(t);
    ds.forEach((d) => out.push({ d: ymd(d), s: span[0], e: span[1] }));
    if (out.length) return out;
  }
  const rule = /8-12/.test(a) ? [1, 8, 12] : /12-5/.test(a) ? [1, 12, 17] : /weekend/i.test(a) ? [2, 8, 17] : a ? [0, 8, 17] : null;
  if (!rule) return [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(t0); d.setDate(d.getDate() + i);
    const we = d.getDay() === 0 || d.getDay() === 6;
    if ((rule[0] === 1 && we) || (rule[0] === 2 && !we)) continue;
    out.push({ d: ymd(d), s: rule[1], e: rule[2] });
  }
  return out;
}
function conflicts(j) {
  const W = windows(j);
  if (!W.length) return null;
  const hit = [], open = [];
  W.forEach((w) => {
    const ov = blocks.filter((b) => b.date === w.d && b.job !== j.id && hm(b.start) < w.e && hm(b.end) > w.s);
    (ov.length ? hit : open).push({ w, ov });
  });
  return { W, hit, open };
}
function fmtD(s) { return new Date(s + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
function fmtT(s) {
  const h0 = hm(s), h = Math.floor(h0), m = Math.round((h0 - h) * 60);
  return ((h % 12) || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'a' : 'p');
}
function cfBadge(j) {
  if (['complete', 'invoiced', 'declined'].includes(j.status)) return '';
  const c = conflicts(j);
  if (!c || !c.hit.length) return c ? '<span class="badge" style="background:#2f6b4f">Schedule open</span>' : '';
  return `<span class="badge" style="background:${c.open.length ? '#b86e00' : '#b91c1c'}">Schedule conflict${c.open.length ? '' : ' — fully booked'}</span>`;
}
function cfDetail(j) {
  const c = conflicts(j);
  if (!c) return '';
  const bn = (b) => `${fmtD(b.date)} ${fmtT(b.start)}-${fmtT(b.end)} ${esc(b.note || ((jobs.find((x) => x.id === b.job) || {}).name || ''))}`;
  const uniq = [...new Map(c.hit.flatMap((h) => h.ov).map((b) => [b.id, b])).values()];
  const sum = (c.hit.length ? 'Conflict · ' + uniq.length + ' block' + (uniq.length === 1 ? '' : 's') + ' · ' : 'Open · ') + c.open.length + ' open day' + (c.open.length === 1 ? '' : 's');
  return acc('cf', 'Schedule check', sum, `<p class="muted">Checked the next 3 weeks against their pick: <b>${esc(av(j))}</b></p>${uniq.length ? '<label>Overlapping blocks</label>' + uniq.map((b) => `<p style="margin:4px 0;color:#b91c1c">• ${bn(b)}</p>`).join('') : ''}<label>Open days that fit</label>${c.open.length ? c.open.slice(0, 6).map((o) => `<p style="margin:4px 0;color:#2f6b4f">• ${fmtD(o.w.d)} ${fmtT(String(o.w.s))}-${fmtT(String(o.w.e))}</p>`).join('') : '<p style="color:#b91c1c">None in the next 3 weeks</p>'}`);
}
let SV = { mode: 'week', start: null };
function sched() {
  if (!SV.start) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); SV.start = d; }
  const s = new Date(SV.start);
  const n = SV.mode === 'week' ? 7 : 42;
  if (SV.mode === 'month') { s.setDate(1); s.setDate(1 - s.getDay()); }
  let cells = '';
  for (let i = 0; i < n; i++) {
    const d = new Date(s); d.setDate(s.getDate() + i);
    const k = ymd(d);
    const bs = blocks.filter((b) => b.date === k).sort((a, b) => hm(a.start) - hm(b.start));
    const td = k === ymd(new Date());
    if (SV.mode === 'week') {
      const label = fmtD(k) + (td ? ' (today)' : '');
      const sum = bs.length ? bs.length + ' block' + (bs.length > 1 ? 's' : '') + ' · tap to view' : 'Open · tap to view';
      cells += acc('d' + k, label, sum, `${bs.map((b) => `<button class="btn d" style="font-size:16px;padding:12px;margin:6px 0;text-align:left" onclick="blk('${b.id}')">${fmtT(b.start)}–${fmtT(b.end)} · ${esc(b.note || ((jobs.find((x) => x.id === b.job) || {}).name || 'Blocked'))}</button>`).join('') || '<div class="muted">Open</div>'}<button class="btn gr" style="font-size:15px;padding:10px;margin:4px 0 0" onclick="blk('','${k}')">+ Block this day</button>`);
    } else {
      cells += `<div onclick="SV.mode='week';SV.start=new Date('${k}T00:00');SV.start.setDate(SV.start.getDate()-SV.start.getDay());sched()" style="background:${bs.length ? '#fde7d7' : '#fff'};border:${td ? '3px solid var(--g)' : '1px solid var(--line)'};border-radius:8px;min-height:58px;padding:4px;font-size:13px;opacity:${d.getMonth() === new Date(SV.start).getMonth() ? 1 : 0.5}"><b>${d.getDate()}</b>${bs.length ? `<div style="color:#9a3412;font-weight:700">${bs.length} block${bs.length > 1 ? 's' : ''}</div>` : ''}</div>`;
    }
  }
  const title = SV.mode === 'week' ? 'Week of ' + fmtD(ymd(SV.start)) : new Date(SV.start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  view = 'sched';
  cur = null;
  navBar(true);
  A.innerHTML = `<div class="card"><h2>Crew schedule</h2><div class="row"><button class="btn ${SV.mode === 'week' ? '' : 'gr'}" onclick="SV.mode='week';sched()">Week</button><button class="btn ${SV.mode === 'month' ? '' : 'gr'}" onclick="SV.mode='month';sched()">Month</button></div><button class="btn huge" onclick="blk('')">+ Block time</button><div class="row"><button class="btn n" onclick="mv(-1)">◀</button><button class="btn n" onclick="mv(1)">▶</button></div><h2 style="text-align:center">${title}</h2></div>${SV.mode === 'month' ? '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px">' + 'SMTWTFS'.split('').map((x) => `<b style="text-align:center">${x}</b>`).join('') + cells + '</div>' : cells}`;
}
function mv(k) {
  const d = new Date(SV.start);
  if (SV.mode === 'week') d.setDate(d.getDate() + 7 * k);
  else { d.setDate(15); d.setMonth(d.getMonth() + k); d.setDate(1); }
  SV.start = d;
  sched();
}
function blk(id, day) {
  const b = blocks.find((x) => x.id === id) || { date: day || ymd(new Date()), start: '08:00', end: '17:00', job: '', note: '' };
  A.innerHTML = `<div class="card"><h2>${id ? 'Edit block' : 'Block time'}</h2><label>Date</label><input type="date" id="bd" value="${esc(b.date)}"><div class="row"><div style="flex:1"><label>Start</label><input type="time" id="bs" value="${esc(b.start)}"></div><div style="flex:1"><label>End</label><input type="time" id="be" value="${esc(b.end)}"></div></div>
${acc('bo', 'Job &amp; note (optional)', (b.job || b.note) ? 'Has details · tap to view' : 'Tap to add', `<label>Job (optional)</label><select id="bj"><option value="">— none —</option>${jobs.map((j) => `<option value="${esc(j.id)}" ${j.id === b.job ? 'selected' : ''}>${esc(j.name)} · ${esc(j.address)}</option>`).join('')}</select><label>Note (optional)</label><input id="bn" value="${esc(b.note)}" placeholder="Moisture test, crew off">`)}
<button class="btn huge" id="bsv" onclick="saveBlk('${id || ''}')">Save</button>${id ? `<button class="btn" style="background:#b91c1c" onclick="delBlk('${id}')">Delete block</button>` : ''}<button class="btn gr" onclick="sched()">Cancel</button></div>`;
}
async function saveBlk(id) {
  const b = { id, date: $('#bd').value, start: $('#bs').value, end: $('#be').value, job: $('#bj').value, note: $('#bn').value.trim() };
  if (!b.date || !b.start || !b.end) return toast('Pick a date and times');
  if (hm(b.end) <= hm(b.start)) return toast('End must be after start');
  $('#bsv').disabled = true;
  try { const r = await api({ a: 'block', block: b }); blocks = r.blocks; toast('Saved'); sched(); }
  catch (e) { toast(e.message); $('#bsv').disabled = false; }
}
async function delBlk(id) {
  if (!confirm('Delete this block?')) return;
  try { const r = await api({ a: 'unblock', block: { id } }); blocks = r.blocks; toast('Deleted'); sched(); }
  catch (e) { toast(e.message); }
}

function sect(j) {
  const s = j.status;
  if (s === 'sent' || s === 'reply') return 'est';
  if (s === 'declined') return 'done';
  if (s === 'invoiced' && j.invoice && j.invoice.paid) return 'done';
  return 'jobs';
}
const SECT = { est: 'Estimates', jobs: 'Jobs', done: 'Done' };
const SEMPTY = {
  est: 'No open estimates. Tap + New quote to start one.',
  jobs: 'No jobs right now. Approved estimates show up here automatically.',
  done: 'Nothing filed yet. Paid jobs land here.'
};
let G = { est: [], jobs: [], done: [] };
const nq = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function hit(j, q) {
  const l = q.trim().toLowerCase(), n = nq(q);
  if (!l) return true;
  return String(j.name || '').toLowerCase().includes(l) || String(j.address || '').toLowerCase().includes(l) || (n && (nq(j.est).includes(n) || nq(j.name).includes(n) || nq(j.address).includes(n)));
}
function hl() {
  const q = SQ.trim(), el = $('#hl');
  if (!el) return;
  let arr, note = '';
  if (q) {
    arr = jobs.filter((j) => hit(j, q)).sort((a, b) => ((b.created || '') < (a.created || '') ? -1 : 1));
    note = `<p class="muted" style="margin:0 0 8px">${arr.length} result${arr.length === 1 ? '' : 's'} for "${esc(q)}" across Estimates, Jobs and Done</p>`;
  } else {
    arr = G[tab] || [];
    const due = G.jobs.filter((j) => j.status === 'complete').length;
    note = (tab === 'jobs' && due ? `<p class="muted" style="margin:0 0 8px;color:#9a3412"><b>${due} job${due > 1 ? 's' : ''} finished, ready to invoice</b></p>` : '') + (tab === 'done' ? '<p class="muted" style="margin:0 0 8px">Filed away. Tap any one to view it.</p>' : '');
  }
  el.innerHTML = note + (arr.length ? '' : `<p class="muted" style="text-align:center;padding:20px">${q ? 'No matches. Try a name, address or estimate number.' : SEMPTY[tab]}</p>`) + arr.map((j) => `<button class="job" ${sect(j) === 'done' ? 'style="opacity:.85"' : ''} onclick="jview('${j.id}')"><span class="t">${j.total != null ? SCCQuote.money(j.total) : ''}</span><b>${esc(j.name)}</b><div class="a">${esc(j.address)}${j.est ? ' · ' + esc(j.est) : ''}</div><span class="badge" style="background:${SC[stat(j)] || '#8a8f98'}">${ST[stat(j)] || esc(j.status)}</span>${callFlag(j)}${q ? ` <span class="muted">${SECT[sect(j)]}</span>` : ''}${j.response && j.status === 'reply' ? ' <span class="muted">' + esc(j.response.text || '').slice(0, 40) + '</span>' : ''}</button>`).join('');
}
function home() {
  cur = null;
  jtabFor = null;
  view = '';
  CK = '';
  G = { est: [], jobs: [], done: [] };
  jobs.forEach((j) => G[sect(j)].push(j));
  const ts = (j) => j.created || '';
  G.est.sort((a, b) => (ts(b) < ts(a) ? -1 : 1));
  G.done.sort((a, b) => (ts(b) < ts(a) ? -1 : 1));
  G.jobs.sort((a, b) => {
    const r = (j) => (j.status === 'complete' ? 0 : j.status === 'approved' ? 1 : 2);
    return r(a) - r(b) || (ts(b) < ts(a) ? -1 : 1);
  });
  if (!G[tab]) tab = 'est';
  const list = `<input id="find" type="search" placeholder="Search name, address or estimate #" value="${esc(SQ)}" autocomplete="off" oninput="SQ=this.value;hl()" style="margin-top:12px;font-size:16px">
<div class="tabs" style="margin-top:12px">${['est', 'jobs', 'done'].map((k) => `<button type="button" class="${tab === k && !SQ.trim() ? 'on' : ''}" onclick="tab='${k}';SQ='';home()">${SECT[k]}<span class="cnt">${G[k].length}</span></button>`).join('')}</div>
<div id="hl"></div>`;
  if (themeName() === 'dark') {
    const tiles = [
      ['tile-quote', 'newq()', '✎', 'Quote'],
      ['tile-jobs', "document.getElementById('hl')&&document.getElementById('hl').scrollIntoView({behavior:'smooth'})", '▣', 'Jobs'],
      ['tile-cust', "go('cust')", '☺', 'Customers'],
      ['tile-gal', "go('gal')", '▦', 'Gallery'],
      ['tile-rc', "go('books')", '▤', 'Receipts'],
      ['tile-sched', "go('sched')", '◷', 'Schedule'],
      ['tile-set', "go('set')", '⚙', 'Settings']
    ];
    A.innerHTML = `<div class="hbrand"><img src="logo.png" alt=""><div><b>Southern Concrete Coatings</b><small>Garage floors and commercial coatings</small></div></div>
<div class="tiles">${tiles.map((t) => `<button class="tile" id="${t[0]}" type="button" onclick="${t[1]}"><i>${t[2]}</i><span>${t[3]}</span></button>`).join('')}</div>
${list}
<div class="row"><button class="btn gr" type="button" onclick="refresh().then(render)">↻ Refresh</button></div>
<button class="btn n" id="fbhome" type="button" onclick="go('fb')">Feedback</button>`;
  } else {
    A.innerHTML = `<button class="btn huge" type="button" onclick="newq()">+ New quote</button>
<div class="row"><button class="btn n nav" type="button" onclick="go('cust')">👥 Customers</button><button class="btn n nav" type="button" onclick="go('books')">📒 Bookkeeping</button></div>
<button class="btn huge" type="button" onclick="go('gal')">Gallery</button>
${list}
<div class="row"><button class="btn gr" type="button" onclick="refresh().then(render)">↻ Refresh</button><button class="btn gr" type="button" onclick="go('set')">⚙️ Settings</button></div>
<button class="btn gr" type="button" onclick="go('sched')">Schedule</button>
<button class="btn n" id="fbhome" type="button" onclick="go('fb')">Feedback</button>`;
  }
  hl();
}
function homeBtn() { RC = null; view = ''; CK = ''; render(); window.scrollTo(0, 0); }
function feedbackScreen() {
  A.innerHTML = `<div class="card"><h2>Feedback</h2>
<p class="muted">Tell us what to change.</p>
<div class="talkbox"><textarea id="fbtext" rows="6" placeholder="What should we change?"></textarea><button class="talkmic" id="fbmic" type="button" aria-label="Microphone" aria-pressed="false">🎤</button></div>
<p id="fbhint" class="muted">Tap the mic, or use the microphone on the keyboard.</p>
<button class="btn huge" id="fbsend" type="button" onclick="sendFeedback()">Send feedback</button>
<p id="fbthanks" class="muted" hidden></p></div>`;
  bindSpeech('fbmic', 'fbtext', 'fbhint');
}
async function sendFeedback() {
  const text = ($('#fbtext') && $('#fbtext').value || '').trim();
  const thanks = $('#fbthanks');
  const show = (t) => { if (thanks) { thanks.hidden = false; thanks.textContent = t; } };
  if (!text) { show('Write a note first.'); return; }
  const b = $('#fbsend');
  if (b) { b.disabled = true; b.textContent = 'Sending…'; }
  try {
    await api({ a: 'feedback', pin: ownerPin(), role, text });
    if ($('#fbtext')) $('#fbtext').value = '';
    show('Thank you. Your note was saved.');
  } catch (e) {
    show(e.message || 'Could not save that note.');
  } finally {
    if (b) { b.disabled = false; b.textContent = 'Send feedback'; }
  }
}
function go(v) {
  if (v === 'mile') return navHome();
  RC = null; view = v; cur = null; PAYING = '';
  if (v !== 'cust') CK = '';
  try { api({ a: 'log', what: 'opened ' + ({ cust: 'Customers', books: 'Bookkeeping', set: 'Settings', gal: 'Gallery', fb: 'Feedback', sched: 'Schedule' }[v] || v), role: role, ua: '' }).catch(function () {}); } catch (e) {}
  render();
  markNav();
  window.scrollTo(0, 0);
}

function galleryHideList() {
  let local = [];
  try { local = JSON.parse(localStorage.sccGalleryHide || '[]'); } catch (e) { local = []; }
  if (!Array.isArray(local)) local = [];
  const remote = (SET && Array.isArray(SET.galleryHide)) ? SET.galleryHide : [];
  const seen = {}, out = [];
  local.concat(remote).forEach((id) => {
    id = String(id || '');
    if (!id || seen[id]) return;
    seen[id] = 1;
    out.push(id);
  });
  return out;
}
function rememberHide(ids) {
  const list = ids.filter((id) => String(id || '').indexOf('sim-') === 0);
  localStorage.sccGalleryHide = JSON.stringify(list);
  if (!SET || typeof SET !== 'object') SET = {};
  SET.galleryHide = list.slice();
  return list;
}
function gHits() {
  const hide = new Set(galleryHideList());
  return SCCGallery.match(GQ, (GALS || []).map(SCCGallery.ownPhoto)).filter((it) => !hide.has(it.id));
}
function gqSet(v) { GQ = v; glist(); }
function gEdit(on) {
  GEDIT = !!on;
  const b = $('#gedit');
  if (b) {
    b.textContent = GEDIT ? 'Done' : 'Edit';
    b.className = 'btn ' + (GEDIT ? 'gr' : 'n');
  }
  glist();
}
function galScreen() {
  GEDIT = false;
  A.innerHTML = `<div class="card" style="margin-bottom:10px"><h2 style="margin-bottom:8px">Gallery</h2>
<input id="gq" type="search" enterkeyhint="search" placeholder="Try gray flake garage floor" value="${esc(GQ)}" autocomplete="off" oninput="gqSet(this.value)" style="font-size:20px;padding:18px">
<button class="btn n" id="gedit" type="button" onclick="gEdit(!GEDIT)">Edit</button>
<p class="muted" style="margin:10px 0 0">Photos: <a href="${esc(SCCGallery.simiron)}" target="_blank" rel="noopener">Simiron</a></p></div>
<button class="btn huge" id="gshow" type="button" onclick="gshow()">Show photos</button>
<button class="btn n" type="button" onclick="$('#gfile').click()">Upload a photo</button>
<input id="gfile" type="file" accept="image/*" hidden onchange="gpick(this)">
<div id="gform"></div>
<div id="glist"></div>`;
  glist();
  const q = $('#gq');
  if (q && GQ) { const n = q.value.length; try { q.focus(); q.setSelectionRange(n, n); } catch (e) {} }
}
function glist() {
  const el = $('#glist');
  if (!el) return;
  const hits = gHits();
  const show = $('#gshow');
  if (show) {
    show.disabled = !hits.length;
    show.textContent = hits.length ? 'Show ' + hits.length + ' photo' + (hits.length === 1 ? '' : 's') : 'No matching photos';
  }
  const cells = hits.map((it, i) => {
    const x = GEDIT ? `<button class="gx" type="button" aria-label="Delete ${esc(it.name)}" onclick="gxDel('${esc(it.id)}')">✕</button>` : '';
    const open = GEDIT ? '' : ` onclick="gopen(${i})"`;
    return `<div class="gitem">${x}<button class="gpic" type="button"${open}><img src="${esc(it.src)}" alt="${esc(it.name)}"><span>${esc(it.name)}</span></button></div>`;
  }).join('');
  el.innerHTML = (GEDIT ? '<p class="muted" style="margin:8px 0 0">Tap the X on a photo to delete it.</p>' : '') +
    (hits.length ? '' : '<p class="muted" style="text-align:center;padding:18px">Nothing matches that. Try flake, quartz, or a color.</p>') +
    '<div class="ggrid">' + cells + '</div>';
}
async function persistHide(ids) {
  const list = rememberHide(ids);
  try {
    const r = await api(Object.assign(setPayload(), { galleryHide: list }));
    if (r.settings) {
      const kept = list.slice();
      SET = r.settings;
      if (!Array.isArray(SET.galleryHide)) SET.galleryHide = kept;
    }
    rememberHide(galleryHideList());
  } catch (e) { toast(e.message); }
}
async function gxDel(id) {
  if (!confirm('Delete this photo?')) return;
  const it = SCCGallery.match('', (GALS || []).map(SCCGallery.ownPhoto)).find((x) => x.id === id);
  if (it && it.ours) {
    try {
      const r = await api({ a: 'gdel', id: id });
      if (Array.isArray(r.gallery)) GALS = r.gallery;
      toast('Photo removed');
      if ($('#gv') && !$('#gv').hidden) gclose();
      glist();
    } catch (e) { toast(e.message); }
    return;
  }
  const ids = galleryHideList();
  if (ids.indexOf(id) < 0) ids.push(id);
  await persistHide(ids);
  toast('Photo removed');
  glist();
}
async function restoreGallery() {
  if (!galleryHideList().length) { toast('No hidden photos'); return; }
  if (!confirm('Restore deleted gallery photos?')) return;
  await persistHide([]);
  toast('Gallery photos restored');
  if (view === 'set') setScreen();
  if (view === 'gal') glist();
}
function gshow() { if (gHits().length) gopen(0); }
function gopen(i) {
  GVIEW = gHits();
  GI = Math.max(0, Math.min(i, GVIEW.length - 1));
  gdraw();
}
function gnav(d) {
  if (!GVIEW.length) return;
  GI = (GI + d + GVIEW.length) % GVIEW.length;
  gdraw();
}
function gclose() {
  const v = $('#gv');
  if (v) v.hidden = true;
}
function gdraw() {
  const v = $('#gv');
  const it = GVIEW[GI];
  if (!v || !it) return;
  gbind();
  const credit = it.ours ? 'Our photo' : 'Photos: <a href="' + esc(it.page || SCCGallery.simiron) + '" target="_blank" rel="noopener">Simiron</a>';
  v.hidden = false;
  v.innerHTML = `<div class="gvbar"><button type="button" onclick="gclose()">← Back</button><button type="button" onclick="navHome()">Home</button></div><img id="gimg" src="${esc(it.src)}" alt="${esc(it.name)}">
<h2>${esc(it.name)}</h2>
<p class="muted" style="margin:2px 0 8px">${esc(it.system)}${it.colors ? ' · ' + esc(it.colors) : ''} · ${GI + 1} of ${GVIEW.length}<br>${credit}</p>
<div class="row"><button class="btn huge" type="button" onclick="gnav(-1)">◀</button><button class="btn huge" type="button" onclick="gnav(1)">▶</button></div>
<button class="btn gr" type="button" onclick="gclose()">Close</button>
${it.ours ? `<button class="btn red" type="button" onclick="gdel('${esc(it.id)}')">Remove this photo</button>` : ''}`;
}
function gbind() {
  const v = $('#gv');
  if (!v || v._b) return;
  v._b = 1;
  v.addEventListener('touchstart', (e) => { if (e.changedTouches && e.changedTouches[0]) GX = e.changedTouches[0].clientX; }, { passive: true });
  v.addEventListener('touchend', (e) => {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const dx = e.changedTouches[0].clientX - GX;
    if (Math.abs(dx) > 50) gnav(dx < 0 ? 1 : -1);
  });
}
async function gpick(inp) {
  const f = inp.files && inp.files[0];
  inp.value = '';
  if (!f) return;
  GPIC = await shrink(f);
  const box = $('#gform');
  if (!box) return;
  box.innerHTML = `<div class="card"><img src="${GPIC}" alt="" style="width:100%;max-height:240px;object-fit:contain;border-radius:12px;background:#eef0f4">
<label>Caption</label><input id="gcap" autocomplete="off" placeholder="Blue metallic in a garage">
<label>Tags</label><input id="gtags" autocomplete="off" placeholder="metallic, blue, garage">
<button class="btn huge" id="gsave" type="button" onclick="gsave()">Save photo</button></div>`;
}
async function gsave() {
  if (!GPIC) return toast('Choose a photo first');
  const b = $('#gsave');
  if (b) { b.disabled = true; b.textContent = 'Saving…'; }
  try {
    const r = await api({ a: 'gadd', image: GPIC, caption: ($('#gcap') && $('#gcap').value) || '', tags: ($('#gtags') && $('#gtags').value) || '' });
    if (Array.isArray(r.gallery)) GALS = r.gallery;
    GPIC = '';
    toast('Photo saved');
    const box = $('#gform');
    if (box) box.innerHTML = '';
    glist();
  } catch (e) {
    toast(e.message);
    if (b) { b.disabled = false; b.textContent = 'Save photo'; }
  }
}
async function gdel(id) {
  if (!confirm('Remove this photo from the gallery?')) return;
  try {
    const r = await api({ a: 'gdel', id: id });
    if (Array.isArray(r.gallery)) GALS = r.gallery;
    toast('Photo removed');
    gclose();
    glist();
  } catch (e) { toast(e.message); }
}

const STATES = { alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC' };
const st2 = (s) => STATES[String(s || '').toLowerCase()] || s || '';
const SUF = { drive: 'Dr', road: 'Rd', street: 'St', avenue: 'Ave', lane: 'Ln', boulevard: 'Blvd', court: 'Ct', circle: 'Cir', highway: 'Hwy', parkway: 'Pkwy', trail: 'Trl', place: 'Pl', terrace: 'Ter', square: 'Sq', north: 'N', south: 'S', east: 'E', west: 'W' };
const abbr = (s) => String(s || '').split(' ').map((w) => SUF[w.toLowerCase()] || w).join(' ');
function fmtAddr(o) {
  const l1 = [o.num, abbr(o.street || o.name)].filter(Boolean).join(' ');
  const stz = [st2(o.state), o.zip].filter(Boolean).join(' ');
  return [l1, o.city, stz].filter(Boolean).join(', ');
}
let GEO = null, GEOASKED = false;
function geo() {
  if (GEO || GEOASKED || !navigator.geolocation) return;
  GEOASKED = true;
  try { navigator.geolocation.getCurrentPosition((p) => { GEO = { lat: p.coords.latitude, lon: p.coords.longitude }; }, () => {}, { timeout: 5000, maximumAge: 600000 }); } catch (e) {}
}
function tmo(ms) { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }
async function photon(q) {
  const g = GEO || { lat: 30.438, lon: -84.281 };
  const tn = (q.match(/^\s*(\d{1,6})\b/) || [])[1];
  const r = await fetch('https://photon.komoot.io/api/?limit=8&lang=en&lat=' + g.lat + '&lon=' + g.lon + '&q=' + encodeURIComponent(q), { signal: tmo(4500) });
  if (!r.ok) throw Error('photon');
  const j = await r.json();
  return (j.features || []).filter((f) => (f.properties.countrycode || '').toUpperCase() === 'US').map((f) => {
    const p = f.properties;
    return fmtAddr({ num: p.housenumber || (!p.street && p.type === 'street' && p.name && !/^\d/.test(p.name) ? tn : ''), street: p.street, name: p.street ? '' : p.name, city: p.city || p.town || p.village || p.county, state: p.state, zip: p.postcode });
  });
}
async function nominatim(q) {
  const g = GEO;
  const vb = g ? [g.lon - 1.5, g.lat + 1.2, g.lon + 1.5, g.lat - 1.2] : [-88.0, 32.0, -82.0, 29.5];
  const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=us&bounded=0&viewbox=' + vb.join(',') + '&q=' + encodeURIComponent(q), { signal: tmo(5000) });
  if (!r.ok) throw Error('nominatim');
  return (await r.json()).map((x) => {
    const a = x.address || {};
    return fmtAddr({ num: a.house_number, street: a.road, name: a.road ? '' : x.name, city: a.city || a.town || a.village || a.hamlet || a.county, state: a.state, zip: a.postcode });
  });
}
function addrAC(id, cb) {
  const inp = document.getElementById(id), box = document.getElementById(id + 'sug');
  if (!inp || !box) return;
  let t = null, seq = 0;
  const hide = () => { box.hidden = true; box.innerHTML = ''; };
  const show = (l) => {
    if (!l.length) return hide();
    box.innerHTML = l.map((a, i) => `<button type="button" data-i="${i}">${esc(a)}</button>`).join('');
    box.hidden = false;
    box.querySelectorAll('button').forEach((b) => {
      b.onpointerdown = (e) => { e.preventDefault(); inp.value = l[+b.dataset.i]; hide(); if (cb) cb(); };
    });
  };
  const note = (m) => { box.innerHTML = `<div class="h">${m}</div>`; box.hidden = false; };
  inp.addEventListener('focus', geo);
  inp.addEventListener('blur', () => setTimeout(hide, 200));
  inp.addEventListener('input', () => {
    clearTimeout(t);
    const q = inp.value.trim();
    const my = ++seq;
    if (q.length < 6) return hide();
    t = setTimeout(async () => {
      if (navigator.onLine === false) return note('Offline. You can still type the address.');
      const typedNum = /^\s*\d{1,6}\b/.test(q);
      let l = [];
      try { l = await photon(q); } catch (e) {}
      if (typedNum && l.length && my === seq) { try { l = [...await nominatim(q), ...l]; } catch (e) {} }
      if (my !== seq) return;
      if (!l.length) {
        try { l = await nominatim(q); } catch (e) { if (my === seq) note('Suggestions are unavailable. You can still type the address.'); return; }
      }
      if (my !== seq) return;
      const rk = (s) => (/, FL\b/.test(s) ? 0 : /, GA\b/.test(s) ? 1 : /, AL\b/.test(s) ? 2 : 3);
      l = [...new Set(l.filter(Boolean))].map((s, i) => [s, i]).sort((a, b) => rk(a[0]) - rk(b[0]) || a[1] - b[1]).map((x) => x[0]).slice(0, 5);
      if (l.length) show(l); else hide();
    }, 300);
  });
}
function fieldVals() {
  const prep = [...document.querySelectorAll('#prepbox input:checked')].map((x) => x.value).join(', ');
  return {
    sqft: $('#sqft').value.trim(),
    system: $('#system').value,
    color: $('#color').value.trim(),
    prep,
    cure: $('#cure').value,
    rate: $('#rate').value.trim()
  };
}
function onSystem() {
  const name = $('#system') && $('#system').value;
  const row = formCfg().systems.find((s) => s.name === name);
  const rate = $('#rate');
  if (row && row.rate && rate && !String(rate.value || '').trim()) rate.value = row.rate;
  livePrice();
}
function customFieldsHtml(saved) {
  saved = saved || {};
  const skip = ['talk', 'name', 'address', 'email', 'phone', 'jobType', 'sqft', 'system', 'color', 'prep', 'cure', 'rate', 'hardness', 'photos', 'quote', 'addl', 'inote'];
  return formCfg().fields.filter((f) => f.show !== false && skip.indexOf(f.id) < 0).map((f) => {
    const id = 'cx-' + f.id;
    const val = saved[f.id];
    if (f.kind === 'check') return `<label class="checks" style="margin-top:12px"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="${esc(id)}" ${val ? 'checked' : ''}> ${esc(f.label)}</span></label>`;
    if (f.kind === 'select') return `<label>${esc(f.label)}</label><select id="${esc(id)}"><option value=""></option>${(f.options || []).map((o) => `<option ${String(val || '') === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    const mode = (f.kind === 'number' || f.kind === 'price') ? ' inputmode="decimal"' : '';
    return `<label>${esc(f.label)}</label><input id="${esc(id)}"${mode} value="${esc(val || '')}">`;
  }).join('');
}
function customPayload() {
  const out = {};
  formCfg().fields.forEach((f) => {
    if (['talk', 'name', 'address', 'email', 'phone', 'jobType', 'sqft', 'system', 'color', 'prep', 'cure', 'rate', 'hardness', 'photos', 'quote', 'addl', 'inote'].includes(f.id)) return;
    const el = document.getElementById('cx-' + f.id);
    if (!el) return;
    out[f.id] = el.type === 'checkbox' ? !!el.checked : String(el.value || '').slice(0, 400);
  });
  return out;
}
function livePrice() {
  const f = fieldVals();
  const sq = Number(f.sqft), rate = Number(String(f.rate).replace(/[$,]/g, ''));
  const el = $('#liveprice');
  if (!el) return;
  if (sq > 0 && rate > 0) el.textContent = SCCQuote.formatSq(sq) + ' sq ft × ' + SCCQuote.money(rate) + ' = ' + SCCQuote.money(SCCQuote.round2(sq * rate));
  else el.textContent = 'Enter square footage and a price per sq ft.';
}
async function measurePhotos(inp) {
  const files = [...(inp.files || [])].slice(0, 4);
  inp.value = '';
  const note = $('#ainote');
  const label = $('#ailabel');
  const btn = $('#mbtn');
  if (!files.length) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Measuring…'; }
  if (note) { note.hidden = true; note.textContent = ''; }
  try {
    const images = [];
    for (const f of files) images.push(await shrink(f));
    const r = await api({ a: 'measure', pin: ownerPin(), images, known: ($('#known') && $('#known').value.trim()) || '' });
    if (!r.ready) {
      if (note) { note.hidden = false; note.textContent = r.message || 'AI measuring not set up yet'; }
      return;
    }
    const sq = $('#sqft');
    if (sq) sq.value = String(r.sqft);
    if (label) label.hidden = false;
    const bits = [];
    if (r.lengthFt && r.widthFt) bits.push(r.lengthFt + ' ft by ' + r.widthFt + ' ft');
    if (r.confidence) bits.push(r.confidence + ' confidence');
    if (r.note) bits.push(r.note);
    if (note) { note.hidden = false; note.textContent = 'Internal only. ' + bits.join(' · '); }
    livePrice();
  } catch (e) {
    if (note) { note.hidden = false; note.textContent = e.message || 'Could not measure that photo. Enter the square footage by hand.'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Measure from photo'; }
  }
}
function pickOption(list, value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const norm = (s) => String(s).toLowerCase().replace(/[–—-]/g, '-').replace(/\s+/g, ' ').trim();
  const nv = norm(v);
  const exact = list.find((s) => norm(s) === nv);
  if (exact) return exact;
  return list.find((s) => norm(s).includes(nv) || nv.includes(norm(s))) || '';
}
function setChoice(id, value, list) {
  const el = document.getElementById(id);
  const raw = String(value || '').trim();
  if (!el || !raw) return;
  const picked = pickOption(list, raw) || raw;
  if (![...el.options].some((o) => o.value === picked)) {
    const opt = document.createElement('option');
    opt.value = picked;
    opt.textContent = picked;
    el.appendChild(opt);
  }
  el.value = picked;
}
function setPrep(value) {
  const wants = String(value || '').split(/[,;\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  document.querySelectorAll('#prepbox input').forEach((box) => {
    const label = box.value.toLowerCase();
    box.checked = wants.some((w) => label.includes(w) || w.includes(label));
  });
}
function applyFill(f) {
  if (!f || typeof f !== 'object') return;
  const put = (id, v) => {
    const el = document.getElementById(id);
    if (!el || v == null || String(v).trim() === '') return;
    el.value = String(v).trim();
  };
  put('nm', f.name);
  put('ph', f.phone);
  put('em', f.email);
  put('ad', f.address);
  put('sqft', f.sqft);
  setChoice('system', f.system, systemList());
  put('color', f.color);
  if (f.jobType) setChoice('jobtype', f.jobType, ['Residential', 'Commercial']);
  if (f.hardness != null && String(f.hardness).trim() && $('#hard')) $('#hard').value = String(f.hardness);
  if (f.prep != null && String(f.prep).trim()) setPrep(f.prep);
  const cureText = String(f.cure || '').trim();
  const timeline = String(f.timeline || '').trim();
  if (cureText) setChoice('cure', cureText, CURES);
  else if (timeline) setChoice('cure', timeline, CURES);
  put('rate', f.rate);
  put('addl', f.notes);
  const extraBits = [f.extras, cureText && timeline ? timeline : ''].map((v) => (v == null ? '' : String(v).trim())).filter(Boolean).join('\n');
  if (extraBits && $('#qt')) $('#qt').value = extraBits;
  if (f.name || f.phone || f.email || f.address) {
    const acc = document.getElementById('acc-qc');
    if (acc) acc.classList.add('open');
  }
  cs();
  livePrice();
}
function localColor(raw) {
  const m = String(raw || '').match(/\b(?:flake color|color|in)\s+([A-Za-z][A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
  if (!m) return '';
  const words = m[1].trim().split(/\s+/);
  if (/^(the|a|an|our|this|that|my|your|full|two|one)$/i.test(words[0])) return '';
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function localSystem(low) {
  const rules = [
    [/acid\s*stain/, 'Acid Stain and Seal'],
    [/grind and seal|grind & seal/, 'Grind and Seal'],
    [/grind and prep only|grind & prep|prep only/, 'Grind and prep only'],
    [/full\s+flake\s+broadcast|full[-\s]?broadcast/, 'Full Flake Broadcast System'],
    [/pool\s*deck/, 'Pool deck coating'],
    [/kitchen/, 'Commercial kitchen floor'],
    [/warehouse|industrial/, 'Warehouse / industrial floor'],
    [/patio|porch|lanai|breezeway/, 'Patio and porch coating'],
    [/polyaspartic/, 'Polyaspartic system'],
    [/polyurea/, 'Polyurea garage system'],
    [/metallic/, 'Metallic epoxy'],
    [/quartz/, 'Quartz broadcast'],
    [/solid(?:\s+color)?\s+epoxy|\bepoxy\b/, 'Solid color epoxy'],
    [/seal(?:er|ing)?/, 'Concrete sealing'],
    [/crack|spall/, 'Crack and spall repair']
  ];
  for (const [re, name] of rules) if (re.test(low)) return name;
  if (/flake|vinyl\s*chip|chip\s*system/.test(low) && !/color flake|flake color|flake will be/.test(low)) return 'Garage floor flake system';
  return '';
}
const WORDN = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
function spokenRate(raw) {
  const parsed = SCCQuote.parseRate(raw);
  if (parsed != null) return parsed;
  const low = String(raw || '').toLowerCase();
  const at = low.search(/per\s+square\s+foot|price\s+per\s+square|a\s+square\s+foot|per\s+sq/);
  if (at < 0) return null;
  const chunk = low.slice(at).split(/\b(?:hardness|harness|mohs)\b/)[0];
  const found = chunk.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\b/g);
  if (!found) return null;
  const w = found[found.length - 1];
  const n = WORDN[w] != null ? WORDN[w] : parseFloat(w);
  return n > 0 && n < 10000 ? n : null;
}
function filledCount(f) {
  let n = 0;
  ['name', 'phone', 'email', 'address', 'sqft', 'jobType', 'system', 'color', 'prep', 'cure', 'rate', 'notes', 'hardness'].forEach((k) => {
    if (f && f[k] != null && String(f[k]).trim() !== '') n++;
  });
  if (f && (f.extras || (f.items && f.items.length))) n++;
  return n;
}
function localPrep(low) {
  const rules = [
    [/diamond\s*grind|\bgrind/, 'Diamond grinding'],
    [/crack/, 'Crack repair'],
    [/spall|\bpatch/, 'Spall / patch repair'],
    [/moisture|vapor|\bmvt\b/, 'Moisture mitigation'],
    [/\boil\b/, 'Oil stain treatment'],
    [/joint/, 'Joint fill'],
    [/shot\s*blast|coating removal|stripp/, 'Coating removal']
  ];
  const out = [];
  for (const [re, name] of rules) if (re.test(low) && out.indexOf(name) < 0) out.push(name);
  return out.join(', ');
}
function localCure(low) {
  const rules = [
    [/same[- ]day|back today|tonight/, 'Same-day return'],
    [/24\s*hours?|back in 24|one day|1 day/, '24 hours'],
    [/48\s*hours?|two days|2 days/, '48 hours'],
    [/72\s*hours?|three days|3 days/, '72 hours'],
    [/5\s*[-–to]{1,3}\s*7|a week|one week/, '5–7 days']
  ];
  for (const [re, name] of rules) if (re.test(low)) return name;
  return '';
}
function localAddl(raw) {
  const m = String(raw || '').match(/\b(?:please note|note that|additional note|gate code|dogs? |pets? |call before|customer (?:wants|asked))\b[^.]{0,180}/i);
  if (!m) return '';
  const s = m[0].replace(/\s+/g, ' ').trim();
  if (s.length < 8) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function localFillFields(text) {
  const raw = String(text || '').trim();
  const out = {};
  if (!raw || typeof SCCQuote === 'undefined') return out;
  let sq = SCCQuote.parseSqft(raw);
  if (!sq) {
    const m = raw.match(/\b(\d[\d,]*)\s*ft\b/i);
    if (m) {
      const n = parseFloat(m[1].replace(/,/g, ''));
      if (n >= 40 && n < 1000000) sq = n;
    }
  }
  const rate = spokenRate(raw);
  if (sq) out.sqft = String(sq);
  if (rate != null) out.rate = String(rate);
  const low = raw.toLowerCase();
  const system = localSystem(low);
  if (system) out.system = system;
  const prep = localPrep(low);
  if (prep) out.prep = prep;
  const cure = localCure(low);
  if (cure) out.cure = cure;
  if (/wolf\s*gr[ae]y/i.test(raw)) out.color = 'Wolf Gray';
  else {
    const color = localColor(raw);
    if (color) out.color = color;
  }
  if (/commercial|warehouse|industrial/.test(low)) out.jobType = 'Commercial';
  else if (/\bhouse\b|\bhome\b|residential/.test(low)) out.jobType = 'Residential';
  const hard = low.match(/(?:hardnes+|harness|mohs)\D{0,24}(one|two|three|four|five|six|seven|eight|nine|ten|\d+)/);
  if (hard) {
    const n = WORDN[hard[1]] != null ? WORDN[hard[1]] : parseFloat(hard[1]);
    if (n >= 1 && n <= 10 && n === Math.floor(n)) out.hardness = String(n);
  }
  const addl = localAddl(raw);
  if (addl) out.notes = addl;
  const items = SCCQuote.rewriteQuote(raw);
  if (items.length > 1) out.extras = items.slice(1).map((it) => [it.title, it.detail].filter(Boolean).join(' - ')).join('\n');
  return out;
}
async function fillQuote() {
  const text = ($('#talk') && $('#talk').value || '').trim();
  const note = $('#fillnote');
  const btn = $('#fillbtn');
  const show = (t) => { if (note) { note.hidden = false; note.textContent = t; } };
  if (!text) { show('Say or type the job in the box above.'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Filling…'; }
  try {
    const r = await api({ a: 'qfill', pin: ownerPin(), text });
    const use = (fields, n) => {
      applyFill(fields);
      const count = n || filledCount(fields);
      show(count ? ('Filled ' + count + ' field' + (count === 1 ? '' : 's') + '. Change anything that is off.') : (r.message || 'AI fill not set up yet'));
    };
    if (!r.ready) {
      use(localFillFields(text), 0);
      return;
    }
    use(r.fields || {}, r.filled);
  } catch (e) {
    const local = localFillFields(text);
    applyFill(local);
    const n = filledCount(local);
    show(n ? ('Filled ' + n + ' field' + (n === 1 ? '' : 's') + '. Change anything that is off.') : (e.message || 'Could not fill that in.'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Fill in the quote'; }
  }
}
function newq(pre) {
  const editing = !!(pre && pre.id);
  if (editing) editId = pre.id;
  else editId = '';
  photos = [];
  ACC = {};
  cur = null;
  view = '';
  navBar(true);
  if (pre && typeof pre === 'object') ACC.qc = true;
  A.innerHTML = `<div class="card">
<label style="margin-top:0">Talk it through</label>
<div class="talkbox"><textarea id="talk" rows="8" style="min-height:180px" placeholder="Pat at 1 Call Street, 480 sq ft garage, full flake in Dominion, grind and crack repair, 6.50 a sq ft, back in 24 hours"></textarea><button class="talkmic" id="talkmic" type="button" aria-label="Microphone" aria-pressed="false">🎤</button></div>
<p id="talkhint" class="muted">Tap the mic, or use the microphone on the keyboard.</p>
<button class="btn d" id="fillbtn" type="button" onclick="fillQuote()">Fill in the quote</button>
<p id="fillnote" class="muted" hidden></p>
<h2>${editing ? 'Edit quote' : 'New quote'}</h2>
${editing ? `<p class="muted" id="estkeep" style="margin-top:0">${esc(pre.est || 'Estimate')} stays this number.</p>` : ''}
${acc('qc', 'Customer details', 'Tap to enter name, address, email', `<label>Customer name</label><input id="nm" autocomplete="name" oninput="cs()"><label>Address</label><div style="position:relative"><input id="ad" autocomplete="off" autocapitalize="words" placeholder="Start typing the Tallahassee address" oninput="cs()"><div class="sug" id="adsug" hidden></div></div><label>Customer email</label><input id="em" type="email" inputmode="email" autocomplete="off" placeholder="Saved on the job" oninput="cs()"><label>Customer phone (optional)</label><input id="ph" type="tel" inputmode="tel" autocomplete="off" placeholder="For call and text from Customers" oninput="cs()">${TEST_MODE ? `<p class="muted">Test mode is on. This address is stored on the job. The estimate email goes only to ${esc(TEST_TO)}.</p>` : '<p class="muted">This email is where the estimate is sent.</p>'}`)}
${formOn('jobType') ? `<label>${esc(fieldLabel('jobType', 'Job type'))}</label><select id="jobtype"><option value="">Choose</option><option>Residential</option><option>Commercial</option></select>` : ''}
${formOn('sqft') ? `<label>${esc(fieldLabel('sqft', 'Square footage'))}</label><input id="sqft" inputmode="decimal" placeholder="480" oninput="livePrice()">` : '<input id="sqft" hidden>'}
<p id="ailabel" hidden style="font-weight:700;color:#9a3412;margin:8px 0 0">AI estimate, verify on site</p>
<input id="mf" type="file" accept="image/*" multiple hidden onchange="measurePhotos(this)">
<button class="btn n" id="mbtn" type="button" onclick="$('#mf').click()">Measure from photo</button>
<p id="ainote" class="muted" hidden></p>
${formOn('system') ? `<label>${esc(fieldLabel('system', 'Coating system'))}</label><select id="system" onchange="onSystem()"><option value="">Choose a system</option>${systemList().map((s) => `<option>${esc(s)}</option>`).join('')}</select>` : '<select id="system" hidden></select>'}
<label>Color / flake</label><input id="color" placeholder="Dominion, Wolf Gray, custom blend">
<label>Prep</label><div class="checks" id="prepbox">${prepNames().map((p) => `<label><input type="checkbox" value="${esc(p)}"> ${esc(p)}</label>`).join('')}</div>
<label>Cure / return to service</label><select id="cure"><option value="">Choose</option>${CURES.map((s) => `<option>${esc(s)}</option>`).join('')}</select>
<label>Price per sq ft</label><input id="rate" inputmode="decimal" placeholder="6.50" oninput="livePrice()">
<p id="liveprice"></p>
${editing ? '<p class="muted">The line prices below are what get saved. Change a line if the square footage or rate changed.</p>' : ''}
${customFieldsHtml(pre && pre.custom)}
<label>Concrete hardness (Mohs 1–10)</label><select id="hard" onchange="hardHint()">${hardOpts('')}</select>
<label>How it was measured (optional)</label><input id="hardhow" autocomplete="off" placeholder="Penny scratch on the garage apron">
<p class="muted" id="hardhint"></p>
<p class="muted">Internal only. Hardness stays off the customer estimate, invoice, PDF, and emails.</p>
<input type="file" id="pf" accept="image/*" capture="environment" multiple hidden onchange="pick(this,showP)"><button class="btn d" type="button" onclick="$('#pf').click()">📷 Take photo</button>
${acc('qp', 'Photo attachments (0)', 'No photos yet', '<div id="pp"></div>')}
<label>Notes (talk or type)</label><textarea id="qt" rows="5" placeholder="480 sq ft two-car garage, full flake in Dominion, grind and crack repair, $6.50 a sq ft, back in 24 hours"></textarea>
<label>Notes for customer</label><div class="talkbox"><textarea id="addl" rows="4" placeholder="What the price includes, a gate code, or when to call."></textarea><button class="talkmic" id="addmic" type="button" aria-label="Microphone" aria-pressed="false">🎤</button></div>
<p class="muted">Shown under the total on the estimate, PDF, invoice, and answer page, as Additional notes. Optional. Not a line and not a price.</p>
<button class="btn mic" id="mb" type="button">🎤 Talk</button>
${editing ? '' : '<button class="btn huge d" type="button" onclick="prev()">Preview polished quote →</button>'}
<div id="pv"></div>
<button class="btn gr" type="button" onclick="cancelQ()">Cancel</button></div>`;
  mic('mb', 'qt');
  bindSpeech('talkmic', 'talk', 'talkhint');
  bindSpeech('addmic', 'addl', '');
  if (!SKIPNAV) markNav();
  addrAC('ad', cs);
  livePrice();
  hardHint();
  if (pre && typeof pre === 'object') {
    $('#nm').value = pre.name || '';
    $('#ad').value = pre.address || '';
    $('#em').value = pre.email || '';
    if ($('#ph')) $('#ph').value = pre.phone || '';
    cs();
    if (!editing) $('#qt').focus();
  }
  if (editing) {
    $('#sqft').value = pre.sqft == null ? '' : pre.sqft;
    setChoice('system', pre.system, systemList());
    if ($('#jobtype')) setChoice('jobtype', pre.jobType, ['Residential', 'Commercial']);
    $('#color').value = pre.color || '';
    setPrep(pre.prep);
    setChoice('cure', pre.cure, CURES);
    $('#rate').value = pre.rate == null ? '' : pre.rate;
    if ($('#hard')) $('#hard').value = pre.hardness === 0 || pre.hardness ? String(pre.hardness) : '';
    if ($('#hardhow')) $('#hardhow').value = pre.hardnessHow || '';
    if ($('#qt')) $('#qt').value = pre.quote || '';
    if ($('#addl')) $('#addl').value = pre.additionalNotes || '';
    IT = (pre.items || []).map((i) => ({
      title: i.title || '',
      detail: i.detail || '',
      price: i.price == null || i.price === '' ? null : Number(i.price)
    }));
    livePrice();
    hardHint();
    cs();
    ACC.qi = true;
    drawPv();
  }
}
function editQuote(id) {
  const j = jobs.find((x) => x.id === id);
  if (!j) return;
  newq(j);
  window.scrollTo(0, 0);
}
function cancelQ() {
  const id = editId;
  editId = '';
  IT = [];
  if (id) { cur = id; render(); window.scrollTo(0, 0); }
  else render();
}
function cs() {
  const n = $('#nm') && $('#nm').value.trim();
  const a = $('#ad') && $('#ad').value.trim();
  const m = $('#em') && $('#em').value.trim();
  sm('qc', [n, a, m].filter(Boolean).join(' · ') || 'Tap to enter name, address, email');
}
function showP() {
  const box = $('#pp');
  if (box) box.innerHTML = imgs(photos);
  const title = document.querySelector('#acc-qp b');
  if (title) title.textContent = 'Photo attachments (' + photos.length + ')';
  sm('qp', photos.length ? 'Tap to review' : 'No photos yet');
}
let IT = [];
function prev() {
  const spoken = $('#qt').value.trim();
  const f = fieldVals();
  IT = SCCQuote.buildItems(f, spoken);
  drawPv();
}
function itSum() {
  const t = SCCQuote.totalOf(IT);
  const tot = $('#tot');
  if (tot) tot.textContent = SCCQuote.money(t);
  const title = document.querySelector('#acc-qi b');
  if (title) title.textContent = 'Line items (' + IT.length + ')';
  sm('qi', SCCQuote.money(t) + ' total · tap to edit');
}
function drawPv() {
  const t = SCCQuote.totalOf(IT);
  $('#pv').innerHTML = `<div class="card" style="border:3px solid var(--g)"><h2>Customer will see</h2>
${acc('qi', 'Line items (' + IT.length + ')', SCCQuote.money(t) + ' total · tap to edit', `<p class="muted">Edit anything. A blank price means included.</p>
${IT.map((i, n) => `<div style="border-bottom:1px solid #e6e8ee;padding:8px 0"><input value="${esc(i.title)}" oninput="IT[${n}].title=this.value" style="font-weight:700"><textarea rows="2" oninput="IT[${n}].detail=this.value" style="margin-top:6px;font-size:15px">${esc(i.detail || '')}</textarea><div class="row"><input inputmode="decimal" placeholder="Price" value="${i.price ?? ''}" oninput="IT[${n}].price=this.value===''?null:Number(this.value.replace(/[$,]/g,''));itSum()"><button class="btn gr" style="margin:0;flex:0 0 110px" type="button" onclick="IT.splice(${n},1);drawPv()">Remove</button></div></div>`).join('')}
<button class="btn gr" type="button" onclick="IT.push({title:'',detail:'',price:null});drawPv()">+ Add line</button>`)}
<p style="font-size:22px;text-align:right"><b>Total: <span id="tot">${SCCQuote.money(t)}</span></b></p>
${editId
    ? '<button class="btn huge" id="sqsave" type="button" onclick="saveEdit(false)">Save quote</button><button class="btn huge d" id="sq" type="button" onclick="saveEdit(true)">Send updated estimate</button>'
    : '<button class="btn huge" id="sq" type="button" onclick="sendQ()">Send quote email + PDF</button>'}
</div>`;
  if (!editId) $('#pv').scrollIntoView({ behavior: 'smooth' });
}
async function sendQ() {
  const f = fieldVals();
  const d = {
    a: 'create', name: $('#nm').value.trim(), address: $('#ad').value.trim(), email: $('#em').value.trim(), phone: ($('#ph') ? $('#ph').value.trim() : ''),
    jobType: ($('#jobtype') && $('#jobtype').value) || '', custom: customPayload(),
    quote: $('#qt').value, additionalNotes: ($('#addl') && $('#addl').value.trim()) || '', sqft: f.sqft, system: f.system, color: f.color, prep: f.prep, cure: f.cure, rate: f.rate,
    hardness: $('#hard') ? $('#hard').value : '', hardnessHow: $('#hardhow') ? $('#hardhow').value.trim() : '',
    items: IT.filter((i) => i.title && i.title.trim()), photos
  };
  if (d.email && !SCCQuote.validEmail(d.email)) return toast('That email does not look right. Check it.');
  $('#sq').disabled = true;
  $('#sq').textContent = 'Sending…';
  try {
    const r = await api(d);
    toast(r.job && r.job.emailed === false ? 'Estimate saved' : sentMsg('Estimate'));
    await refresh();
    render();
  } catch (e) { toast(e.message); $('#sq').disabled = false; $('#sq').textContent = 'Send quote email + PDF'; }
}
async function saveEdit(send) {
  const id = editId;
  const f = fieldVals();
  const d = {
    a: 'qedit', id, send: !!send,
    name: $('#nm').value.trim(), address: $('#ad').value.trim(), email: $('#em').value.trim(), phone: ($('#ph') ? $('#ph').value.trim() : ''),
    jobType: ($('#jobtype') && $('#jobtype').value) || '', custom: customPayload(),
    quote: $('#qt').value, additionalNotes: ($('#addl') && $('#addl').value.trim()) || '', sqft: f.sqft, system: f.system, color: f.color, prep: f.prep, cure: f.cure, rate: f.rate,
    hardness: $('#hard') ? $('#hard').value : '', hardnessHow: $('#hardhow') ? $('#hardhow').value.trim() : '',
    items: IT.filter((i) => i.title && i.title.trim())
  };
  if (d.email && !SCCQuote.validEmail(d.email)) return toast('That email does not look right. Check it.');
  const b = send ? $('#sq') : $('#sqsave');
  const other = send ? $('#sqsave') : $('#sq');
  if (b) { b.disabled = true; b.textContent = send ? 'Sending…' : 'Saving…'; }
  if (other) other.disabled = true;
  try {
    const r = await api(d);
    editId = '';
    toast(send ? (r.job && r.job.emailed === false ? 'Estimate saved' : sentMsg('Estimate')) : 'Quote saved');
    await refresh();
    cur = id;
    jview(id);
  } catch (e) {
    toast(e.message);
    if (b) { b.disabled = false; b.textContent = send ? 'Send updated estimate' : 'Save quote'; }
    if (other) other.disabled = false;
  }
}
async function fixEmail(id) {
  const e = prompt('Customer email');
  if (e == null) return;
  if (!SCCQuote.validEmail(e)) return toast('That email does not look right');
  try { await api({ a: 'email', id, email: e.trim() }); await refresh(); jview(id); }
  catch (x) { toast(x.message); }
}
async function ans(id, a) {
  try { await api({ a: 'respond', id, ans: a }); await refresh(); jview(id); toast('Answer recorded'); }
  catch (e) { toast(e.message); }
}
async function up(inp, kind) {
  const batch = [];
  toast('Uploading…');
  for (const f of inp.files) batch.push(await shrink(f));
  inp.value = '';
  try { await api({ a: 'upload', id: cur, kind, photos: batch }); await refresh(); jview(cur); toast('Saved to the project folder'); }
  catch (e) { toast(e.message); }
}
async function done(id) {
  if (!confirm('Mark this floor complete and send the recap?')) return;
  $('#jc').disabled = true;
  $('#jc').textContent = 'Sending…';
  try {
    await api({ a: 'finish', id, notes: $('#cn').value });
    toast(sentMsg('Recap'));
    await refresh();
    jview(id);
  } catch (e) { toast(e.message); const btn = $('#jc'); if (btn) { btn.disabled = false; btn.textContent = 'JOB COMPLETE'; } }
}
function resendBtn(j, primary) {
  return j.est ? `<button class="btn ${primary ? 'd' : 'gr'}" id="rs" type="button" onclick="resend('${j.id}')">✉ Resend quote (A/B/C/Other) + PDF</button>` : '';
}
function hardnessHint(n) {
  n = Number(n);
  if (!(n >= 1 && n <= 10)) return '';
  if (n <= 2) return 'Very soft or dusty. Grind back to sound concrete before coating. Do not coat a crumbling surface.';
  if (n <= 4) return 'Soft. Plan extra grind passes so the coating has a profile to grab.';
  if (n <= 6) return 'Typical cured concrete. A standard diamond grind is usually enough.';
  if (n <= 8) return 'Hard, dense, or power-troweled. Use a coarser diamond so the coating can bond.';
  return 'Extremely hard. Confirm the scratch is in the paste, not a piece of rock. A surface this hard needs an aggressive profile.';
}
function hardOpts(cur) {
  let h = '<option value="">Not tested</option>';
  for (let i = 1; i <= 10; i++) h += `<option value="${i}"${String(cur) === String(i) ? ' selected' : ''}>${i}</option>`;
  return h;
}
function hardHint() {
  const el = $('#hardhint');
  if (!el) return;
  const t = hardnessHint($('#hard') && $('#hard').value);
  el.textContent = t || 'Leave this blank if you have not scratched the slab yet.';
}
function noteWhen(t) {
  try {
    return new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (e) { return String(t || ''); }
}
function jobTabs(j) {
  const n = (j.internalNotes || []).length;
  return `<div class="tabs"><button type="button" class="${jtab === 'job' ? 'on' : ''}" onclick="jtab='job';jview('${j.id}')">Job</button><button type="button" class="${jtab === 'notes' ? 'on' : ''}" onclick="jtab='notes';jview('${j.id}')">Notes<span class="cnt">${n}</span></button></div>`;
}
function hardCard(j) {
  const hv = j.hardness === 0 || j.hardness ? j.hardness : '';
  return `<div class="card"><h2>Concrete hardness</h2><p class="muted" style="margin-top:0">Mohs scratch test, 1 to 10. Internal only. This is never printed on the estimate, invoice, PDF, or any customer email.</p>
<label>Mohs value</label><select id="hard" onchange="hardHint()">${hardOpts(hv)}</select>
<label>How it was measured (optional)</label><input id="hardhow" autocomplete="off" value="${esc(j.hardnessHow || '')}" placeholder="Penny scratch on the garage apron">
<p class="muted" id="hardhint"></p>
<button class="btn n" id="hardsave" type="button" onclick="saveHard('${j.id}')">Save hardness</button></div>`;
}
function notesPane(j) {
  const list = (j.internalNotes || []).slice().reverse();
  const rows = list.length ? list.map((n) => `<div class="line"><b>${esc(noteWhen(n.t))}</b><br>${esc(n.text)}</div>`).join('') : '<p class="muted">No internal notes yet.</p>';
  return `<div class="card"><h2>Internal notes</h2><p class="muted" style="margin-top:0">A running log for the crew. Customers never see these notes.</p>
${rows}<label>Add a note</label><div class="talkbox"><textarea id="inote" rows="4" placeholder="What should the next person know?"></textarea><button class="talkmic" id="inotemic" type="button" aria-label="Microphone" aria-pressed="false">🎤</button></div>
<button class="btn huge" id="addnote" type="button" onclick="addNote('${j.id}')">Add note</button></div>`;
}
function jview(id) {
  const push = !SKIPNAV && cur !== id;
  GAL = [];
  cur = id;
  const j = jobs.find((x) => x.id === id);
  if (!j) { cur = null; return render(); }
  syncChrome();
  if (jtabFor !== id) { jtab = 'job'; jtabFor = id; }
  const st = j.status;
  const v = j.invoice || {};
  const paid = !!v.paid;
  const b = (j.crew || []).filter((p) => p.kind === 'before');
  const af = (j.crew || []).filter((p) => p.kind === 'after');
  const np = (j.photos || []).length + (j.crew || []).length;
  const li = (j.items || []).length;
  const tot = j.total != null ? SCCQuote.money(j.total) : '';
  const K = (x) => x + id;
  const specLine = [j.sqft ? SCCQuote.formatSq(j.sqft) + ' sq ft' : '', j.system, j.color].filter(Boolean).join(' · ');
  let h = `<div class="card"><h2>${esc(j.name)}</h2><p style="font-size:18px">📍 <a href="https://maps.google.com/?q=${encodeURIComponent(j.address)}" target="_blank" rel="noopener">${esc(j.address)}</a></p>
${specLine ? '<p style="font-size:18px">' + esc(specLine) + '</p>' : ''}
<p><span class="badge" style="background:${SC[stat(j)] || '#8a8f98'}">${ST[stat(j)] || esc(j.status)}</span> ${callFlag(j)}${cfBadge(j)}${j.invoice ? ` <span class="badge ${paid ? 'paid' : 'open'}">${paid ? 'PAID' : 'OPEN'}</span>` : ''}</p>
${av(j) ? '<p style="font-size:17px">🕒 <b>Customer prefers:</b> ' + esc(av(j)) + '</p>' : ''}
${TEST_MODE ? `<p class="muted">Test mode: emails go only to ${esc(TEST_TO)}</p>` : ''}</div>`;
  h += remindCard(j);
  h += jobTabs(j);
  if (jtab === 'notes') {
    h += notesPane(j);
    A.innerHTML = h;
    bindSpeech('inotemic', 'inote', '');
    if (push) markNav();
    return;
  }
  h += hardCard(j);
  h += `<div class="card"><h2>Notes for customer</h2><p class="muted" style="margin-top:0">Shown under the total on the estimate, PDF, invoice, and answer page, as Additional notes. Not a line item and not a price. Hardness and the Notes tab stay off those pages.</p><div class="talkbox"><textarea id="addl" rows="4" placeholder="Price includes a double topcoat. One topcoat lowers the price.">${esc(j.additionalNotes || '')}</textarea><button class="talkmic" id="addmic" type="button" aria-label="Microphone" aria-pressed="false">🎤</button></div><button class="btn n" id="addlsave" type="button" onclick="saveAddl('${id}')">Save</button></div>`;
  h += acc(K('jd'), 'Job details', (j.est || 'Quote') + ' · ' + (j.email || 'no email'), `${j.est ? '<p class="muted">' + esc(j.est) + (j.pdf ? ` · <a href="${esc(j.pdf)}" target="_blank" rel="noopener">PDF</a>` : '') + '</p>' : ''}<p>📧 ${esc(j.email) || '<b style="color:#b91c1c">No email on job</b>'} <a href="#" onclick="fixEmail('${id}');return false">edit</a></p><p>📞 ${j.phone ? `<a href="tel:${telH(j.phone)}">${esc(fmtPh(j.phone))}</a>` : 'No phone'} <a href="#" onclick="editPhone(['${id}']);return false">${j.phone ? 'edit' : 'add'}</a></p>${j.response ? '<p><b>Customer answer:</b> ' + esc(j.response.label) + (j.response.text ? ' — ' + esc(j.response.text) : '') + '</p>' : ''}${av(j) ? '<p><b>Availability:</b> ' + esc(av(j)) + '</p>' : ''}${specHtml(j)}${j.notes ? '<p>' + esc(j.notes) + '</p>' : ''}${j.crewNotes ? '<p><b>Job notes:</b> ' + esc(j.crewNotes) + '</p>' : ''}${j.folder ? `<p><a href="${esc(j.folder)}" target="_blank" rel="noopener">Project photos in Drive</a></p>` : ''}`);
  h += acc(K('li'), 'Line items (' + li + ')', tot ? tot + ' total' : 'Scope and price', items(j));
  if (np && st !== 'approved') h += acc(K('ph'), 'Photos (' + np + ')', 'Quote ' + (j.photos || []).length + ' · Before/After ' + (j.crew || []).length, ((j.photos || []).length ? '<label>Quote photos</label>' + imgs(j.photos) : '') + ((j.crew || []).length ? '<label>Before / After</label>' + imgs(j.crew) : ''));
  if (st === 'approved' && (j.photos || []).length) h += acc(K('qp'), 'Quote photos (' + j.photos.length + ')', 'Tap to view', imgs(j.photos));
  if (st === 'sent' || st === 'reply' || st === 'approved') h += cfDetail(j);
  if (st === 'sent' || st === 'reply' || st === 'declined') {
    h += `<div class="card"><h2>Step 1 · Quote</h2><p class="muted">Waiting on the customer. Answered by phone? Mark it:</p><div class="row"><button class="btn" type="button" onclick="ans('${id}','A')">A Approve</button><button class="btn d" type="button" onclick="ans('${id}','B')">B Changes</button><button class="btn gr" type="button" onclick="ans('${id}','C')">C Decline</button></div>${resendBtn(j, true)}<button class="btn gr" id="del" type="button" onclick="delQ('${id}')">Delete this estimate</button></div>`;
  }
  if (st === 'approved') {
    h += `<div class="card"><h2>Step 2 · Do the job</h2>${acc(K('bf'), 'Before photos (' + b.length + ')', b.length ? 'Tap to view' : 'None yet', imgs(b))}<input type="file" id="bf" accept="image/*" capture="environment" multiple hidden onchange="up(this,'before')"><button class="btn d" type="button" onclick="$('#bf').click()">📷 Before photo</button>
${acc(K('af'), 'After photos (' + af.length + ')', af.length ? 'Tap to view' : 'None yet', imgs(af))}<input type="file" id="af" accept="image/*" capture="environment" multiple hidden onchange="up(this,'after')"><button class="btn d" type="button" onclick="$('#af').click()">📷 After photo</button>
${acc(K('jn'), 'Job notes', j.crewNotes ? esc(String(j.crewNotes).slice(0, 60)) : 'Tap to add notes', `<textarea id="cn" rows="4">${esc(j.crewNotes || '')}</textarea><button class="btn mic" id="cm" type="button">🎤 Talk</button>`)}
<button class="btn huge" id="jc" type="button" onclick="done('${id}')">✅ JOB COMPLETE</button></div>`;
  }
  if (st === 'complete' || st === 'invoiced') {
    const am = v.amount || (j.total != null ? SCCQuote.money(j.total) : '');
    h += `<div class="card"><h2>Step 3 · Invoice</h2><p class="muted">Prefilled from the quote.${TEST_MODE ? ' Test mode sends this only to ' + esc(TEST_TO) + '.' : ''}</p>${acc(K('pd'), 'Payment details', 'Amount ' + am + ' · ' + (paid ? 'PAID' : st === 'invoiced' ? 'OPEN' : 'not sent'), `<label>Amount</label><input id="am" value="${esc(am)}"><label>Note</label><textarea id="an" rows="2">${esc(v.note || 'Payment due within 15 days. Thank you for the floor.')}</textarea>`)}
<button class="btn huge" id="invbtn" type="button" onclick="inv('${id}')">${j.invoice ? 'Resend invoice' : 'Send invoice'}</button>${payUI(j)}</div>${revCard(j)}`;
  }
  if ((st === 'approved' || st === 'complete' || st === 'invoiced') && j.est) h += `<div class="card">${resendBtn(j, false)}</div>`;
  A.innerHTML = h;
  hardHint();
  bindSpeech('addmic', 'addl', '');
  if (st === 'approved') mic('cm', 'cn');
  if (push) markNav();
}
async function saveAddl(id) {
  const b = $('#addlsave');
  if (b) { b.disabled = true; b.textContent = 'Saving…'; }
  try {
    await api({ a: 'addl', id, additionalNotes: ($('#addl') && $('#addl').value) || '' });
    await refresh();
    jview(id);
    toast('Notes saved');
  } catch (e) {
    toast(e.message);
    if (b) { b.disabled = false; b.textContent = 'Save'; }
  }
}
async function saveHard(id) {
  const b = $('#hardsave');
  if (b) { b.disabled = true; b.textContent = 'Saving…'; }
  try {
    await api({ a: 'hardness', id, hardness: $('#hard').value, hardnessHow: $('#hardhow').value });
    await refresh();
    jview(id);
    toast('Hardness saved');
  } catch (e) {
    toast(e.message);
    if (b) { b.disabled = false; b.textContent = 'Save hardness'; }
  }
}
async function addNote(id) {
  const text = ($('#inote') && $('#inote').value || '').trim();
  if (!text) return toast('Write a note first');
  const b = $('#addnote');
  if (b) { b.disabled = true; b.textContent = 'Saving…'; }
  jtab = 'notes';
  try {
    await api({ a: 'inote', id, text });
    await refresh();
    jview(id);
    toast('Note saved');
  } catch (e) {
    toast(e.message);
    if (b) { b.disabled = false; b.textContent = 'Add note'; }
  }
}
async function resend(id) {
  if (!confirm(TEST_MODE ? 'Resend the quote email? Test mode sends it only to ' + TEST_TO + '.' : 'Resend the quote email to the customer?')) return;
  const b = $('#rs');
  if (b) { b.disabled = true; b.textContent = 'Sending…'; }
  try { await api({ a: 'resend', id }); toast(sentMsg('Estimate')); }
  catch (e) { toast(e.message); }
  if (b) { b.disabled = false; b.textContent = '✉ Resend quote (A/B/C/Other) + PDF'; }
}
async function inv(id) {
  const btn = $('#invbtn');
  if (btn) btn.disabled = true;
  try {
    await api({ a: 'invoice', id, amount: $('#am').value, note: $('#an').value });
    toast(sentMsg('Invoice'));
    await refresh();
    jview(id);
  } catch (e) { toast(e.message); if (btn) btn.disabled = false; }
}
async function markPaid(id, p) {
  try { await api({ a: 'paid', id, paid: p }); await refresh(); jview(id); }
  catch (e) { toast(e.message); }
}
let delT = null;
async function delQ(id) {
  const b = $('#del');
  if (!b) return;
  if (!b.classList.contains('red')) {
    b.classList.add('red');
    b.textContent = 'Tap again to delete';
    clearTimeout(delT);
    delT = setTimeout(() => { if (b.isConnected) { b.classList.remove('red'); b.textContent = 'Delete this estimate'; } }, 4000);
    return;
  }
  clearTimeout(delT);
  b.disabled = true;
  b.textContent = 'Deleting…';
  const j = jobs.find((x) => x.id === id);
  try {
    await api({ a: 'delete', id, pin: ownerPin() });
    cur = null;
    tab = j && sect(j) === 'done' ? 'done' : 'est';
    await refresh();
    toast('Estimate deleted');
    render();
  } catch (e) {
    toast(e.message);
    b.disabled = false;
    b.classList.remove('red');
    b.textContent = 'Delete this estimate';
  }
}

const EXC = ['Fuel', 'Equipment repair', 'Equipment rental', 'Tools & equipment', 'Parts & supplies', 'Meals', 'Subcontractors', 'Labor', 'Insurance', 'Dump fees', 'Vehicle', 'Advertising', 'Office', 'Other'];
const PAYL = { check: 'Check', cash: 'Cash', card: 'Card', other: 'Other' };
const RQK = 'scc_rq1';
const amtN = (a) => { const n = parseFloat(String(a == null ? '' : a).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
const m0 = (v) => ((v || 0) < 0 ? '-' + SCCQuote.money(-v) : SCCQuote.money(v || 0));
const etD = (i) => { try { return i ? new Date(i).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : ''; } catch (e) { return ''; } };
const todayET = () => etD(new Date().toISOString());
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monLbl = (ym) => { const p = String(ym).split('-'); return (MN[+p[1] - 1] || p[1]) + ' ' + p[0]; };
const usD = (d) => { const p = String(d || '').split('-'); return p.length === 3 ? p[1] + '/' + p[2] + '/' + p[0] : String(d || ''); };
const longD = (d) => { const p = String(d || '').split('-'); return p.length === 3 ? MN[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0] : String(d || ''); };
const digits = (s) => String(s || '').replace(/\D/g, '');
const telH = (p) => { const d = digits(p); return d.length === 10 ? '+1' + d : (d.length === 11 && d[0] === '1' ? '+' + d : d); };
const fmtPh = (p) => { const d = digits(p), t = d.length === 11 && d[0] === '1' ? d.slice(1) : d; return t.length === 10 ? '(' + t.slice(0, 3) + ') ' + t.slice(3, 6) + '-' + t.slice(6) : String(p || ''); };
const invNo = (j) => String(j.est || j.id).replace('EST', 'INV');
const payDate = (j) => { const v = j.invoice || {}; return v.paidDate || etD(v.paidAt) || etD(v.at); };
const paidAmt = (j) => { const v = j.invoice || {}; return v.amountPaid != null && v.amountPaid !== '' ? Number(v.amountPaid) : amtN(v.amount); };
const ownerPin = () => Object.keys(ROLES).find((k) => ROLES[k] === 'Owner') || '';

function payUI(j) {
  const id = j.id, v = j.invoice || {}, paid = !!v.paid;
  if (j.status !== 'invoiced' && j.status !== 'complete') return '';
  if (paid) return `<div style="background:#eef0f8;border-radius:12px;padding:12px;margin-top:12px"><b>Paid ${m0(paidAmt(j))}</b><br><span class="muted">${esc(PAYL[v.method] || 'Payment')} · ${esc(longD(payDate(j)))}${v.ref ? ' · ' + esc(v.ref) : ''}</span></div><button class="btn gr sm" type="button" onclick="markPaid('${id}',false)">Undo payment (mark OPEN)</button>`;
  if (PAYING === id) return `<div style="border-top:1px solid #e3e6ee;margin-top:16px;padding-top:6px"><h3>Record payment</h3>
<div class="tabs" id="pm">${Object.keys(PAYL).map((m) => `<button type="button" data-m="${m}" class="${PAYM === m ? 'on' : ''}" onclick="PAYM='${m}';document.querySelectorAll('#pm button').forEach(b=>b.classList.toggle('on',b.dataset.m==PAYM))">${PAYL[m]}</button>`).join('')}</div>
<label>Amount received</label><input id="pa" inputmode="decimal" value="${esc(v.amount || (j.total != null ? SCCQuote.money(j.total) : ''))}"><label>Date received</label><input id="pd" type="date" value="${todayET()}"><label>Check # or note (optional)</label><input id="pr" autocomplete="off">
<button class="btn huge" id="ps" type="button" onclick="recPay('${id}')">Save payment</button><button class="btn gr" type="button" onclick="PAYING='';jview('${id}')">Cancel</button></div>`;
  return `<button class="btn d" type="button" onclick="PAYING='${id}';jview('${id}')">${j.invoice ? 'Record payment' : 'Customer already paid? Record payment'}</button>`;
}
async function recPay(id) {
  const b = $('#ps');
  b.disabled = true;
  b.textContent = 'Saving…';
  try {
    await api({ a: 'markpaid', id, method: PAYM, date: $('#pd').value, amount: $('#pa').value, ref: $('#pr').value.trim() });
    PAYING = '';
    await refresh();
    jview(id);
  } catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Save payment'; }
}
function revCard(j) {
  const paid = j.status === 'invoiced' && j.invoice && j.invoice.paid;
  if (!(j.status === 'complete' || paid)) return '';
  const r = j.review;
  if (!SET.reviewLink) return `<div class="card"><h2>Reviews</h2><p class="muted">Add your Google review link in Settings, then you can ask customers for a review with one tap.</p><button class="btn gr" type="button" onclick="go('set')">Open Settings</button></div>`;
  return `<div class="card"><h2>Reviews</h2><p class="muted" style="margin:0">Emails ${esc(j.email) || 'the customer'} a short thank-you with a button to your Google review page.${r ? ` Last asked ${esc(longD(etD(r.at)))}${r.count > 1 ? ' (' + r.count + ' times)' : ''}.` : ''}</p><button class="btn n" id="rv" type="button" onclick="askRev('${j.id}')">${r ? 'Ask again' : 'Request review'}</button></div>`;
}
async function askRev(id) {
  const j = jobs.find((x) => x.id === id);
  if (!j || !confirm('Email a review request to ' + (j.email || 'the customer') + '?')) return;
  const b = $('#rv');
  b.disabled = true;
  b.textContent = 'Sending…';
  try { await api({ a: 'reqreview', id }); await refresh(); jview(id); toast(sentMsg('Review request')); }
  catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Request review'; }
}
async function editPhone(ids) {
  const j = jobs.find((x) => x.id === ids[0]);
  const p = prompt('Customer phone', (j && j.phone) || '');
  if (p == null) return;
  try { await api({ a: 'phone', ids, phone: p }); await refresh(); render(); }
  catch (e) { toast(e.message); }
}
function custs() {
  const m = {};
  jobs.forEach((j) => {
    const em = String(j.email || '').trim().toLowerCase();
    const k = SCCQuote.validEmail(em) ? 'e:' + em : 'n:' + nq(j.name) + '|' + nq(j.address);
    (m[k] = m[k] || { k, jobs: [] }).jobs.push(j);
  });
  return Object.values(m).map((c) => {
    c.jobs.sort((a, b) => ((b.created || '') < (a.created || '') ? -1 : 1));
    const l = c.jobs[0];
    c.name = l.name || '(no name)';
    c.email = (c.jobs.find((j) => SCCQuote.validEmail(j.email)) || {}).email || '';
    c.phone = (c.jobs.find((j) => j.phone) || {}).phone || '';
    c.addrs = [...new Set(c.jobs.map((j) => j.address).filter(Boolean))];
    c.n = c.jobs.length;
    c.quoted = c.jobs.reduce((a, j) => a + (j.status === 'declined' ? 0 : amtN(j.total)), 0);
    const iv = c.jobs.filter((j) => j.invoice);
    c.billed = iv.reduce((a, j) => a + amtN(j.invoice.amount), 0);
    c.paid = iv.filter((j) => j.invoice.paid).reduce((a, j) => a + paidAmt(j), 0);
    c.owed = iv.filter((j) => !j.invoice.paid).reduce((a, j) => a + amtN(j.invoice.amount), 0);
    return c;
  }).sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
}
function custScreen() {
  const cs = custs();
  if (CK) { const c = cs.find((x) => x.k === CK); if (c) return custDetail(c); CK = ''; }
  A.innerHTML = `<div class="card"><h2 style="margin-bottom:8px">Customers <span class="muted">(${cs.length})</span></h2>
<input id="cq" type="search" placeholder="Search name, phone, email or address" value="${esc(CQ)}" autocomplete="off" oninput="CQ=this.value;custList()" style="font-size:16px"></div><div id="cl"></div>`;
  custList();
}
function custList() {
  const el = $('#cl');
  if (!el) return;
  const q = CQ.trim().toLowerCase(), qd = digits(CQ);
  CL = custs().filter((c) => !q || c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || c.addrs.some((a) => a.toLowerCase().includes(q)) || (qd.length >= 3 && digits(c.phone).includes(qd)));
  el.innerHTML = (CL.length ? '' : `<p class="muted" style="text-align:center;padding:20px">${q ? 'No matches. Try a name, phone number, email or address.' : 'No customers yet. They appear here automatically when you send a quote.'}</p>`) +
    CL.map((c, i) => `<button class="job" type="button" onclick="openC(${i})"><span class="t">${c.billed ? m0(c.billed) : ''}</span><b>${esc(c.name)}</b><div class="a">${esc([c.phone ? fmtPh(c.phone) : '', c.email].filter(Boolean).join(' · ') || c.addrs[0] || '')}</div><span class="badge" style="background:#3a415c">${c.n} job${c.n === 1 ? '' : 's'}</span>${c.owed > 0 ? ` <span class="badge" style="background:#9a3412">Owes ${m0(c.owed)}</span>` : ''}</button>`).join('');
}
function openC(i) { CK = CL[i].k; CEDIT = false; render(); markNav(); window.scrollTo(0, 0); }
function custDetail(c) {
  const t = telH(c.phone);
  const sample = c.jobs[0] || {};
  A.innerHTML = `<div class="card"><h2 style="margin-bottom:6px">${esc(c.name)}</h2>
${c.addrs.map((a) => `<p style="margin:0 0 6px;font-size:16px">📍 <a href="https://maps.google.com/?q=${encodeURIComponent(a)}" target="_blank" rel="noopener">${esc(a)}</a></p>`).join('')}
<p class="muted" style="margin:6px 0 0">📧 ${esc(c.email) || '<b style="color:#b42318">No email</b>'}</p>
<p class="muted" style="margin:6px 0 0">📞 ${c.phone ? esc(fmtPh(c.phone)) : 'No phone yet'} <a href="#" onclick="editPhone(CK_ids());return false">${c.phone ? 'edit' : 'add'}</a></p>
<div class="row">${c.phone ? `<a class="btn d sm" href="tel:${t}">Call</a><a class="btn d sm" href="sms:${t}">Text</a>` : ''}${c.email ? `<a class="btn d sm" href="mailto:${esc(c.email)}">Email</a>` : ''}</div>
${role === 'Owner' ? `<button class="btn n" id="callnow" type="button" onclick="callNow()">Call now</button><button class="btn n" id="textnow" type="button" onclick="textNow()">Text now</button>` : ''}
<button class="btn n" type="button" onclick="CEDIT=!CEDIT;render()">Edit customer</button></div>
${custCallLog(c)}
${CEDIT ? `<div class="card" id="cedit"><h2>Edit customer</h2><p class="muted" style="margin-top:0">This updates every job linked to this customer.</p>
<label>Name</label><input id="cnm" autocomplete="name" value="${esc(c.name)}">
<label>Phone</label><input id="cph" type="tel" value="${esc(c.phone || '')}">
<label>Email</label><input id="cem" type="email" value="${esc(c.email || '')}">
<label>Address</label><input id="cad" value="${esc(c.addrs[0] || sample.address || '')}">
<div class="acc" id="acc-cadv"><button type="button" class="acch" onclick="tg('cadv')"><span><b>Advanced</b><small>Secondary phone and contact</small></span><i>▾</i></button><div class="accb">
<label>Secondary phone</label><input id="cph2" type="tel" value="${esc(sample.phone2 || '')}">
<label>Secondary contact name</label><input id="cct2" value="${esc(sample.contact2 || '')}">
<p class="muted">Internal only. These stay off customer emails and PDFs.</p>
</div></div>
<button class="btn huge" id="csave" type="button" onclick="saveCust()">Save customer</button></div>` : ''}
<button class="btn huge" type="button" onclick="newqFor()">+ New quote for ${esc(c.name.split(' ')[0])}</button>
<div class="card" style="margin-top:12px"><h2>Totals</h2><div class="kv"><span>Quoted</span><b>${m0(c.quoted)}</b></div><div class="kv"><span>Invoiced</span><b>${m0(c.billed)}</b></div><div class="kv"><span>Paid</span><b style="color:#2f6b4f">${m0(c.paid)}</b></div><div class="kv"><span>Still owed</span><b style="color:${c.owed > 0 ? '#9a3412' : 'inherit'}">${m0(c.owed)}</b></div></div>
<div class="card"><h2>Job history (${c.n})</h2>${c.jobs.map((j) => `<button class="job" type="button" onclick="jview('${j.id}')"><span class="t">${j.total != null ? SCCQuote.money(j.total) : ''}</span><b>${esc(j.address)}</b><div class="a">${j.est ? esc(j.est) + ' · ' : ''}${esc(longD(etD(j.created)))}</div><span class="badge" style="background:${SC[stat(j)] || '#8a8f98'}">${ST[stat(j)] || esc(j.status)}</span></button>`).join('')}</div>`;
}
function CK_ids() { const c = custs().find((x) => x.k === CK); return c ? c.jobs.map((j) => j.id) : []; }
function custCallLog(c) {
  const ids = {};
  (c.jobs || []).forEach((j) => { ids[j.id] = 1; });
  const rows = (CALLS || []).filter((row) => ids[row.jobId]);
  const body = rows.length ? rows.slice(0, 6).map(remindLine).join('') : '<p class="muted" style="margin:0">No reminder call yet.</p>';
  return `<div class="card" id="custcall"><h2>Reminder call</h2>${body}</div>`;
}
async function callNow() {
  if (role !== 'Owner') return;
  const c = custs().find((x) => x.k === CK);
  if (!c) return;
  const number = fmtPh(c.phone);
  if (!digits(c.phone) || digits(c.phone).length < 10) return toast('Add a phone first');
  if (!confirm('Call ' + c.name + ' at ' + number + ' now?')) return;
  const b = $('#callnow');
  if (b) { b.disabled = true; b.textContent = 'Calling…'; }
  try {
    const r = await api({ a: 'remindnow', pin: ownerPin(), ids: c.jobs.map((j) => j.id) });
    if (Array.isArray(r.callLog)) CALLS = r.callLog;
    const outcome = r.called ? ((r.status || 'queued') + (r.sid ? ' · ' + r.sid : '')) : (r.error || 'Call not placed');
    toast(outcome);
  } catch (e) { toast(e.message); }
  if (view === 'cust') render();
}
async function textNow() {
  if (role !== 'Owner') return;
  const c = custs().find((x) => x.k === CK);
  if (!c) return;
  const t = (SET && SET.texts) || {};
  const test = t.test !== false;
  const on = t.on === true;
  const testPhone = t.testPhone || (SET && SET.reminders && SET.reminders.testPhone) || '8504453792';
  if (!test && !on) return toast('Text reminders are off');
  const dest = test ? testPhone : c.phone;
  const shown = fmtPh(dest);
  if (!digits(dest) || digits(dest).length < 10) return toast(test ? 'Add a test phone in Settings' : 'Add a phone first');
  if (!confirm('Text ' + (test ? 'the test phone' : c.name) + ' at ' + shown + ' now?')) return;
  const b = $('#textnow');
  if (b) { b.disabled = true; b.textContent = 'Texting…'; }
  try {
    const r = await api({ a: 'textnow', pin: ownerPin(), ids: c.jobs.map((j) => j.id) });
    if (Array.isArray(r.callLog)) CALLS = r.callLog;
    const outcome = r.called ? ((r.status || 'queued') + (r.sid ? ' · ' + r.sid : '')) : (r.error || 'Text not sent');
    toast(outcome);
  } catch (e) { toast(e.message); }
  if (view === 'cust') render();
}
async function saveCust() {
  const c = custs().find((x) => x.k === CK);
  if (!c) return;
  const b = $('#csave');
  if (b) { b.disabled = true; b.textContent = 'Saving…'; }
  try {
    await api({
      a: 'cedit', pin: ownerPin(), ids: c.jobs.map((j) => j.id),
      name: $('#cnm').value.trim(), phone: $('#cph').value.trim(), email: $('#cem').value.trim(), address: $('#cad').value.trim(),
      phone2: $('#cph2') ? $('#cph2').value.trim() : '', contact2: $('#cct2') ? $('#cct2').value.trim() : ''
    });
    CEDIT = false;
    await refresh();
    toast('Customer saved');
    render();
  } catch (e) {
    toast(e.message);
    if (b) { b.disabled = false; b.textContent = 'Save customer'; }
  }
}
function newqFor() {
  const c = custs().find((x) => x.k === CK);
  if (!c) return;
  newq({ name: c.name, address: c.jobs[0].address, email: c.email, phone: c.phone });
}
function bookStats() {
  const cm = todayET().slice(0, 7), cy = todayET().slice(0, 4), mo = {}, g = (ym) => mo[ym] = mo[ym] || { inv: 0, paid: 0, unp: 0, exp: 0 };
  let out = 0, outN = 0, colM = 0, colY = 0, expM = 0, expY = 0;
  const open = [];
  jobs.forEach((j) => {
    if (!j.invoice) return;
    const v = j.invoice, a = amtN(v.amount), r = g((etD(v.at) || todayET()).slice(0, 7));
    r.inv += a;
    if (v.paid) { r.paid += a; const pd = payDate(j), pa = paidAmt(j); if (pd.slice(0, 7) === cm) colM += pa; if (pd.slice(0, 4) === cy) colY += pa; }
    else { r.unp += a; out += a; outN++; open.push(j); }
  });
  EXP.forEach((e) => { const a = Number(e.amount) || 0, d = String(e.date); g(d.slice(0, 7)).exp += a; if (d.slice(0, 7) === cm) expM += a; if (d.slice(0, 4) === cy) expY += a; });
  open.sort((a, b) => ((a.invoice.at || '') < (b.invoice.at || '') ? -1 : 1));
  return { mo, out, outN, colM, colY, expM, expY, open, cm };
}
function bookScreen() {
  if (RC) return rcScreen();
  if (!EXPL && !EXPLOAD) {
    EXPLOAD = true;
    api({ a: 'explist', pin: ownerPin() }).then((r) => { EXP = r.expenses || []; EXPL = true; EXPLOAD = false; if (view === 'books' && !cur && !RC) bookScreen(); }).catch((e) => { EXPLOAD = false; toast(e.message); });
  }
  const S = bookStats();
  const ms = Object.keys(S.mo).sort().reverse().slice(0, 12);
  const yrs = [...new Set([...jobs.filter((j) => j.invoice).map((j) => (etD(j.invoice.at) || '').slice(0, 4)), ...EXP.map((e) => String(e.date).slice(0, 4)), todayET().slice(0, 4)].filter(Boolean))].sort().reverse();
  const rec = [...EXP].sort((a, b) => (String(b.date) < String(a.date) ? -1 : (String(b.date) > String(a.date) ? 1 : ((b.created || '') < (a.created || '') ? -1 : 1)))).slice(0, 15);
  const now = Date.now();
  A.innerHTML = `<input type="file" id="rf" accept="image/*" capture="environment" hidden onchange="scanR(this)"><button class="btn huge" type="button" style="margin:0 0 6px" onclick="$('#rf').click()">Scan receipt</button>
<p class="muted" style="text-align:center;margin:0 0 16px">${SET.ocr ? 'Snap a receipt and the amounts will be read for you.' : 'Snap a receipt and save it with the expense. Automatic reading is not turned on yet.'}</p>
<div class="card"><h2>Bookkeeping</h2><div class="kv"><span>Collected in ${esc(monLbl(S.cm))}</span><b style="color:#2f6b4f">${m0(S.colM)}</b></div><div class="kv"><span>Collected this year</span><b>${m0(S.colY)}</b></div>
<div class="kv"><span>Unpaid invoices (${S.outN})</span><b style="color:${S.out > 0 ? '#9a3412' : 'inherit'}">${m0(S.out)}</b></div><div class="kv"><span>Expenses this month</span><b>${m0(S.expM)}</b></div><div class="kv"><span>Expenses this year</span><b>${m0(S.expY)}</b></div>
<div class="kv"><span>Profit this month (collected − expenses)</span><b>${m0(S.colM - S.expM)}</b></div></div>
<div class="card"><h2>Outstanding invoices</h2>${S.open.length ? S.open.map((j) => { const days = Math.max(0, Math.floor((now - new Date(j.invoice.at).getTime()) / 864e5)); return `<button class="job" type="button" onclick="jview('${j.id}')"><span class="t" style="color:#9a3412">${esc(j.invoice.amount || '')}</span><b>${esc(j.name)}</b><div class="a">${esc(invNo(j))} · sent ${esc(longD(etD(j.invoice.at)))}</div><span class="badge" style="background:${days > 30 ? '#b42318' : '#9a3412'}">${days} day${days === 1 ? '' : 's'} open</span></button>`; }).join('') : '<p class="muted" style="margin:0">Nothing outstanding.</p>'}</div>
<div class="card"><h2>By month</h2><p class="muted" style="margin:0 0 6px">Invoiced is by invoice date. Profit = invoiced − expenses.</p>${ms.length ? ms.map((k) => { const r = S.mo[k]; return `<div class="line"><b>${esc(monLbl(k))}</b><b style="float:right;color:${r.inv - r.exp >= 0 ? '#2f6b4f' : '#b42318'}">${m0(r.inv - r.exp)}</b><br><span>Invoiced ${m0(r.inv)} (Paid ${m0(r.paid)} · Unpaid ${m0(r.unp)}) · Expenses ${m0(r.exp)}</span></div>`; }).join('') : '<p class="muted" style="margin:0">Nothing yet. Invoices and expenses show up here.</p>'}</div>
<div class="card"><h2>Add an expense</h2><label>Amount</label><input id="xa" inputmode="decimal" placeholder="$0.00" autocomplete="off"><label>Category</label><select id="xc">${EXC.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
<label>Note (optional)</label><input id="xn" autocomplete="off" placeholder="What was it for?"><label>Date</label><input id="xd" type="date" value="${todayET()}"><button class="btn huge" id="xs" type="button" onclick="addExp()">Save expense</button></div>
<div class="card"><h2>Recent expenses</h2>${!EXPL ? '<p class="muted" style="margin:0">Loading…</p>' : rec.length ? rec.map((e) => `<div class="line" style="display:flex;gap:12px;align-items:flex-start"><div style="flex:1;min-width:0"><b>${SCCQuote.money(Number(e.amount))}</b> <b style="color:#5c6370;font-weight:600">${esc(e.vendor || e.category)}</b><span style="float:right">${esc(usD(e.date))}</span>${(e.vendor ? e.category + (e.note ? ' · ' + e.note : '') : e.note) ? '<br><span>' + esc(e.vendor ? e.category + (e.note ? ' · ' + e.note : '') : e.note) + '</span>' : ''}${e.tax != null ? '<br><span>Tax ' + SCCQuote.money(Number(e.tax)) + '</span>' : ''}<br><a href="#" onclick="delExp('${esc(e.id)}');return false">Remove</a></div>${e.receipt ? `<img class="rth" alt="Receipt" src="" data-id="${esc(e.receipt)}" onerror="fb(this)">` : ''}</div>`).join('') : '<p class="muted" style="margin:0">No expenses entered yet.</p>'}</div>
<div class="card"><h2>Export for QuickBooks</h2><label>Period</label><select id="ey"><option value="all">All time</option>${yrs.map((y) => `<option>${y}</option>`).join('')}</select>
<button class="btn n" type="button" onclick="exportCsv('qb')">QuickBooks import (Date, Description, Amount)</button><button class="btn gr" type="button" onclick="exportCsv('detail')">Full detail (invoices, payments, expenses)</button>
<p class="muted" style="margin:10px 0 0">In QuickBooks Online: Transactions, Bank transactions, Upload from file, then pick this CSV. Payments come in as positive amounts and expenses as negative.</p></div>`;
}
async function addExp() {
  const a = $('#xa').value;
  if (!(amtN(a) > 0)) return toast('Enter the amount');
  const b = $('#xs');
  b.disabled = true;
  b.textContent = 'Saving…';
  try { const r = await api({ a: 'expadd', pin: ownerPin(), amount: a, category: $('#xc').value, note: $('#xn').value.trim(), date: $('#xd').value }); EXP = r.expenses || []; EXPL = true; toast('Expense saved'); bookScreen(); }
  catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Save expense'; }
}
async function delExp(id) {
  if (!confirm('Remove this expense?')) return;
  try { const r = await api({ a: 'expdel', pin: ownerPin(), id }); EXP = r.expenses || []; toast('Removed'); bookScreen(); }
  catch (e) { toast(e.message); }
}
const csvT = (v) => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const csvN = (v) => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
async function dlCsv(name, text) {
  const blob = new Blob([text], { type: 'text/csv' });
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
function exportCsv(kind) {
  const y = $('#ey').value, inR = (d) => y === 'all' || String(d).slice(0, 4) === y, rows = [];
  const pays = jobs.filter((j) => j.invoice && j.invoice.paid && inR(payDate(j)));
  const exps = EXP.filter((e) => inR(e.date));
  const invs = jobs.filter((j) => j.invoice && inR(etD(j.invoice.at)));
  let head, out = [];
  if (kind === 'qb') {
    head = ['Date', 'Description', 'Amount'];
    pays.forEach((j) => out.push([payDate(j), [usD(payDate(j)), 'Payment - ' + j.name + ' - ' + invNo(j) + ' (' + (PAYL[j.invoice.method] || 'payment') + ')' + (j.invoice.ref ? ' ' + j.invoice.ref : '')], paidAmt(j)]));
    exps.forEach((e) => out.push([e.date, [usD(e.date), (e.vendor ? e.vendor + ' - ' : '') + e.category + (e.note ? ': ' + e.note : '')], -(Number(e.amount) || 0)]));
    out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    rows.push(head.join(','));
    out.forEach((r) => rows.push(csvT(r[1][0]) + ',' + csvT(r[1][1]) + ',' + csvN(r[2])));
  } else {
    head = ['Type', 'Date', 'Name', 'Number', 'Method / Category', 'Memo', 'Amount', 'Status'];
    invs.forEach((j) => out.push([etD(j.invoice.at), ['Invoice', usD(etD(j.invoice.at)), j.name, invNo(j), '', (j.invoice.note || '').slice(0, 120), csvN(amtN(j.invoice.amount)), j.invoice.paid ? 'Paid' : 'Open']]));
    pays.forEach((j) => out.push([payDate(j), ['Payment', usD(payDate(j)), j.name, invNo(j), PAYL[j.invoice.method] || '', j.invoice.ref || '', csvN(paidAmt(j)), 'Received']]));
    exps.forEach((e) => out.push([e.date, ['Expense', usD(e.date), e.vendor || '', e.id, e.category, [e.note, e.tax != null ? 'Tax ' + csvN(e.tax) : ''].filter(Boolean).join(' | '), csvN(e.amount), e.receipt ? 'Receipt on file' : '']]));
    out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    rows.push(head.join(','));
    out.forEach((r) => rows.push(r[1].map((v, i) => (i === 6 ? v : csvT(v))).join(',')));
  }
  if (!out.length) return toast('Nothing to export for that period yet');
  dlCsv('southern-concrete-' + (kind === 'qb' ? 'quickbooks-import' : 'detail') + '-' + y + '-' + todayET() + '.csv', rows.join('\r\n') + '\r\n');
}
function shrinkR(f) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => {
      const m = 1600, s = Math.min(1, m / Math.max(i.width, i.height)), c = document.createElement('canvas');
      c.width = Math.round(i.width * s); c.height = Math.round(i.height * s);
      c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
      URL.revokeObjectURL(i.src);
      res(c.toDataURL('image/jpeg', 0.8));
    };
    i.onerror = () => rej(Error('photo'));
    i.src = URL.createObjectURL(f);
  });
}
function rqSave() { try { localStorage[RQK] = JSON.stringify(RQ.filter((j) => j.id && j.phase !== 'scan').map((j) => ({ tok: j.tok, id: j.id, phase: j.phase, data: j.data, ocr: j.ocr, reason: j.reason }))); } catch (e) {} }
function rqLoad() { try { const a = JSON.parse(localStorage[RQK] || '[]'); RQ = a.map((j) => Object.assign(j, { prev: '' })); RCT = Math.max(RCT, ...a.map((j) => j.tok), 0); } catch (e) { RQ = []; } }
rqLoad();
const rqGet = (t) => RQ.find((j) => j.tok === t);
function rcDropJob(j) { if (j && j.id && !j.saved) try { api({ a: 'rcdrop', pin: ownerPin(), id: j.id }).catch(function () {}); } catch (e) {} }
function rqDel(j) { RQ = RQ.filter((x) => x !== j); if (RC === j) RC = null; rqSave(); renderQ(); }
function renderQ() {
  const el = $('#rq');
  if (!el) return;
  if (!role || !RQ.length) { el.innerHTML = ''; return; }
  el.style.top = (($('#topstick') && $('#topstick').offsetHeight) || 64) + 'px';
  el.innerHTML = RQ.map((j) => {
    const t = j.tok;
    if (j.phase === 'scan') return `<div class="rqi"><div class="spin sm"></div><span style="flex:1">Scanning receipt…</span><button class="x" type="button" onclick="rqCancel(${t})" aria-label="Cancel scan">✕</button></div>`;
    return `<div class="rqi ok" onclick="rcOpen(${t})"><span style="flex:1">${j.ocr ? 'Receipt ready. Tap to review' : 'Receipt saved. Tap to add details'}</span><b>›</b></div>`;
  }).join('');
}
function rqCancel(t) { const j = rqGet(t); if (!j) return; j.dead = true; rqDel(j); rcDropJob(j); }
function rcOpen(t) { const j = rqGet(t); if (!j || j.phase === 'scan') return; RC = j; view = 'books'; cur = null; render(); window.scrollTo(0, 0); }
function rcHand(t) { const j = rqGet(t); if (!j) return; j.phase = 'ready'; j.ocr = false; j.data = {}; rqSave(); rcOpen(t); }
function rcRetry(t) { const j = rqGet(t); if (!j || j.phase === 'scan') return; j.phase = 'scan'; renderQ(); rcRun(j); }
async function rcRun(j) {
  const tok = j.tok;
  try {
    const r = j.id ? await api({ a: 'rcrescan', pin: ownerPin(), id: j.id }) : await api({ a: 'rcscan', pin: ownerPin(), image: j.img });
    if (j.dead) { if (r.receiptId) api({ a: 'rcdrop', pin: ownerPin(), id: r.receiptId }).catch(function () {}); return; }
    Object.assign(j, { id: r.receiptId || j.id, ocr: !!r.ocr, data: r.data || {}, reason: r.reason || '', offline: false, phase: 'ready' });
    if (j.id) delete j.img;
  } catch (e) {
    if (j.dead) return;
    Object.assign(j, { phase: 'ready', ocr: false, data: {}, reason: 'miss', offline: !j.id });
  }
  rqSave();
  renderQ();
  if (j.ocr) toast('Receipt ready. Tap the banner to review.');
}
function rcMissNote(j) {
  if (j && j.ocr) return '<p class="muted" style="margin:0 0 4px">Read automatically. Check the details and fix anything that looks off.</p>';
  if (j && j.reason === 'none') return '<p class="muted" style="margin:0 0 4px">Automatic reading is off. Type the details below.</p>';
  return '<p class="muted" style="margin:0 0 4px">Could not read that receipt. Type the details below.</p>';
}
function rcCancel() { const j = RC; if (j) { rqDel(j); rcDropJob(j); } RC = null; bookScreen(); window.scrollTo(0, 0); }
async function scanR(inp) {
  const f = inp.files[0];
  const retake = inp.id === 'rf2';
  inp.value = '';
  if (!f) return;
  const tok = ++RCT, j = { tok, phase: 'scan', prev: URL.createObjectURL(f) };
  if (retake && RC) { const o = RC; rqDel(o); rcDropJob(o); RC = null; }
  RQ.push(j);
  renderQ();
  if (view === 'books' && !cur) bookScreen();
  window.scrollTo(0, 0);
  toast('Scanning receipt. You can keep working.');
  try { j.img = await shrinkR(f); } catch (e) { rqDel(j); return toast('Could not read that photo. Please try again.'); }
  if (j.dead) return;
  rcRun(j);
}
function rcScreen() {
  if (!RC) return bookScreen();
  if (RC.phase === 'scan') {
    A.innerHTML = `<div class="card" style="text-align:center"><h2>Reading your receipt</h2><img class="rpv" alt="" src="${RC.prev}"><div class="spin"></div><p class="muted" style="margin:0">This takes a few seconds.</p></div><button class="btn gr" type="button" onclick="rcCancel()">Cancel</button>`;
    return;
  }
  const d = RC.data || {}, items = d.items || [];
  A.innerHTML = `<div class="card"><h2>Check this receipt</h2><img class="rpv" alt="" src="${RC.prev || ''}" style="max-height:200px;margin-bottom:12px">${rcMissNote(RC)}
<label>Vendor</label><input id="rv" autocomplete="off" value="${esc(d.vendor || '')}">
<div class="row"><div><label>Total</label><input id="rt" inputmode="decimal" placeholder="$0.00" value="${d.total != null ? d.total : ''}"></div><div><label>Tax</label><input id="rx" inputmode="decimal" placeholder="$0.00" value="${d.tax != null ? d.tax : ''}"></div></div>
<label>Date</label><input id="rd" type="date" value="${esc(d.date || todayET())}">
<label>Category</label><select id="rc">${EXC.map((c) => `<option ${c === (d.category || 'Other') ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
<label>Note (optional)</label><input id="rn" autocomplete="off" placeholder="What was it for?">
${items.length ? `<h2 style="margin-top:18px">Line items (${items.length})</h2>${items.map((i) => `<div class="kv" style="font-size:15px"><span>${esc(i.d)}</span><b>${i.a != null ? SCCQuote.money(i.a) : ''}</b></div>`).join('')}` : ''}
<button class="btn huge" id="rsave" type="button" onclick="rcSave()">Save expense</button>
<input type="file" id="rf2" accept="image/*" capture="environment" hidden onchange="scanR(this)"><button class="btn n" type="button" onclick="$('#rf2').click()">Retake photo</button><button class="btn gr" type="button" onclick="rcCancel()">Cancel</button></div>`;
}
async function rcSave() {
  const J = RC;
  if (!J) return;
  const t = amtN($('#rt').value);
  if (!(t > 0)) return toast('Enter the total');
  const b = $('#rsave');
  b.disabled = true;
  b.textContent = 'Saving…';
  const items = ((J.data && J.data.items) || []).map((i) => ({ d: i.d, a: i.a }));
  try {
    const r = await api({ a: 'expadd', pin: ownerPin(), amount: t, category: $('#rc').value, note: $('#rn').value.trim(), date: $('#rd').value, vendor: $('#rv').value.trim(), tax: $('#rx').value, items, receiptId: J.id || '', image: J.id ? '' : (J.img || ''), scanned: !!J.ocr });
    EXP = r.expenses || [];
    EXPL = true;
    J.saved = true;
    rqDel(J);
    toast('Expense saved with receipt');
    if (view === 'books' && !cur && !RC) { bookScreen(); window.scrollTo(0, 0); }
  } catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Save expense'; }
}
function clipLine(s, empty) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return empty;
  return t.length > 52 ? t.slice(0, 50) + '…' : t;
}
function setSumText() {
  const pay = ($('#sp') && $('#sp').value.trim()) || '';
  const rev = ($('#sr') && $('#sr').value.trim()) || '';
  const fin = ($('#sf') && $('#sf').value.trim()) || '';
  const min = ($('#sm') && $('#sm').value.trim()) || '';
  const body = (($('#qbody') && $('#qbody').value) || '').trim();
  const sub = (($('#qsub') && $('#qsub').value) || '').trim();
  const sign = (($('#qsign') && $('#qsign').value) || '').trim();
  const first = body.split('\n').map((x) => x.trim()).filter(Boolean)[0] || '';
  const stock = body === SCCQuote.QUOTE_EMAIL_BODY && sub === SCCQuote.QUOTE_EMAIL_SUBJECT && sign === SCCQuote.QUOTE_EMAIL_SIGN;
  const bcc = (($('#qbcc') && $('#qbcc').value.trim()) || (SET && SET.quoteBcc) || 'mccardlematt@yahoo.com');
  const write = (id, text) => { const el = document.getElementById('ssum-' + id); if (el) el.textContent = text; };
  write('pay', clipLine(pay, 'No payment link'));
  write('rev', clipLine(rev, 'No review link'));
  write('fin', fin ? clipLine(fin, '') : ('No financing link' + (min ? ' · from $' + min : '')));
  write('mail', (stock ? 'Default wording' : clipLine(first || sub, 'Default wording')) + ' · ' + bcc);
  const hiddenN = galleryHideList().length;
  write('gal', hiddenN ? hiddenN + ' hidden' : 'None hidden');
  const remOn = $('#remon') ? $('#remon').checked : !!(SET && SET.reminders && SET.reminders.on);
  const remTest = $('#remtest') ? $('#remtest').checked : !(SET && SET.reminders && SET.reminders.test === false);
  write('rem', (remOn ? 'On' : 'Off') + (remTest ? ' · test mode' : ' · live'));
  const smsOn = $('#smson') ? $('#smson').checked : !!(SET && SET.texts && SET.texts.on);
  const smsTest = $('#smstest') ? $('#smstest').checked : !(SET && SET.texts && SET.texts.test === false);
  write('sms', (smsOn ? 'On' : 'Off') + (smsTest ? ' · test mode' : ' · live'));
}
function tgSet(id) {
  const e = document.getElementById('srow-' + id);
  if (!e) return;
  e.classList.toggle('open');
  const b = e.querySelector('.srowh');
  if (b) b.setAttribute('aria-expanded', e.classList.contains('open') ? 'true' : 'false');
  setSumText();
}
function srow(id, title, body) {
  return `<div class="srow" id="srow-${id}"><button type="button" class="srowh" aria-expanded="false" onclick="tgSet('${id}')"><span><b>${title}</b><small id="ssum-${id}"></small></span><i aria-hidden="true">›</i></button><div class="srowb">${body}</div></div>`;
}
function appearanceRow() {
  const cur = themeName();
  return srow('look', 'Appearance', `<p class="muted" style="margin:0 0 8px">Modern dark is the dashboard. Classic keeps the light screens.</p>
<label class="checks" style="margin-top:8px"><span style="display:flex;gap:10px;align-items:center"><input type="radio" name="theme" value="dark" ${cur === 'dark' ? 'checked' : ''} onchange="pickTheme('dark')"> Modern dark</span></label>
<label class="checks"><span style="display:flex;gap:10px;align-items:center"><input type="radio" name="theme" value="classic" ${cur === 'classic' ? 'checked' : ''} onchange="pickTheme('classic')"> Classic</span></label>`);
}
function formEditorHtml() {
  if (!FORM) FORM = JSON.parse(JSON.stringify(formCfg()));
  const systems = FORM.systems.map((s, i) => `<div class="line"><input value="${esc(s.name)}" oninput="FORM.systems[${i}].name=this.value" placeholder="System name"><input inputmode="decimal" value="${esc(s.rate || '')}" oninput="FORM.systems[${i}].rate=this.value" placeholder="Default $ / sq ft"><button class="btn gr sm" type="button" onclick="FORM.systems.splice(${i},1);setScreen()">Remove</button></div>`).join('');
  const fields = FORM.fields.map((f, i) => `<div class="line"><label style="display:flex;gap:8px;align-items:center;margin:0"><input type="checkbox" ${f.show !== false ? 'checked' : ''} ${f.lock ? 'disabled' : ''} onchange="FORM.fields[${i}].show=this.checked"> Show</label>
<input value="${esc(f.label)}" oninput="FORM.fields[${i}].label=this.value">
<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${f.customer ? 'checked' : ''} ${f.lock ? 'disabled' : ''} onchange="FORM.fields[${i}].customer=this.checked"> Customer sees this</label>
<div class="row"><button class="btn gr sm" type="button" onclick="moveField(${i},-1)">Up</button><button class="btn gr sm" type="button" onclick="moveField(${i},1)">Down</button></div></div>`).join('');
  return `<p class="muted" style="margin:0 0 8px">Show, rename, and reorder the quote. Hardness and internal notes stay internal.</p>
<h2 style="font-size:18px">Coating systems</h2>${systems}
<button class="btn gr" type="button" onclick="FORM.systems.push({name:'',rate:''});setScreen()">Add system</button>
<h2 style="font-size:18px">Fields</h2>${fields}
<label>New field label</label><input id="nfname" placeholder="Gate code">
<label>Kind</label><select id="nfkind"><option value="text">Text</option><option value="number">Number</option><option value="select">Dropdown</option><option value="check">Checkbox</option><option value="price">Price</option></select>
<label>Dropdown choices, separated by commas</label><input id="nfopts" placeholder="Only for a dropdown">
<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="nfcust"> Customer sees this</label>
<button class="btn n" type="button" onclick="addFormField()">Add field</button>
<button class="btn gr" type="button" onclick="resetForm()">Reset to default</button>`;
}
function moveField(i, d) {
  const j = i + d;
  if (!FORM || j < 0 || j >= FORM.fields.length) return;
  const row = FORM.fields.splice(i, 1)[0];
  FORM.fields.splice(j, 0, row);
  setScreen();
}
function addFormField() {
  if (!FORM) FORM = JSON.parse(JSON.stringify(formCfg()));
  const label = ($('#nfname') && $('#nfname').value.trim()) || '';
  if (!label) return toast('Name the field');
  const kind = ($('#nfkind') && $('#nfkind').value) || 'text';
  const id = 'c' + Date.now().toString(36);
  const options = kind === 'select' ? String($('#nfopts') && $('#nfopts').value || '').split(',').map((s) => s.trim()).filter(Boolean) : [];
  FORM.fields.push({ id, label, kind, show: true, customer: !!($('#nfcust') && $('#nfcust').checked), lock: false, options, price: '' });
  setScreen();
}
function resetForm() {
  FORM = SCCQuote.defaultForm();
  setScreen();
}
function callWhen(iso) {
  try { return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch (e) { return String(iso || ''); }
}
function callFlag(j) {
  const rows = (j && j.callAnswers) || [];
  let no = false, cb = false;
  rows.forEach((a) => { if (a && a.answer === 'no') no = true; if (a && a.callback) cb = true; });
  if (!no && !cb) return '';
  const label = [no ? 'No' : '', cb ? 'Callback' : ''].filter(Boolean).join(' · ');
  return ` <span class="badge callflag" style="background:#9a3412">${esc(label)}</span>`;
}
function answerBlock(rows) {
  if (!rows || !rows.length) return '';
  return rows.slice(-8).map((a) => {
    const ans = a.callback && !a.answer ? 'Callback requested' : (a.answer === 'yes' ? 'Yes' : a.answer === 'no' ? 'No' : (a.answer || 'No answer'));
    const extra = a.callback && a.answer ? ' · Callback' : '';
    return `<p style="margin:6px 0">${esc(a.q || 'Question')} · <b>${esc(ans + extra)}</b>${a.at ? ' · ' + esc(callWhen(a.at)) : ''}</p>`;
  }).join('');
}
function remindKind(c) {
  if (c.kind === '24h') return 'Day before';
  if (c.kind === 'dayof') return 'Morning of';
  if (c.kind === 'now') return 'Now';
  return '';
}
function remindLine(c) {
  const channel = c.type === 'sms' ? 'Text' : (c.manual ? 'Manual' : (c.test ? 'Test' : 'Live'));
  const mode = c.type === 'sms' ? (c.manual ? 'Manual' : (c.test ? 'Test' : 'Live')) : '';
  const num = c.to ? fmtPh(c.to) : '';
  const outcome = c.error || c.status || 'sent';
  const flag = [c.no ? 'No' : '', c.callback ? 'Callback' : '', remindKind(c)].filter(Boolean).join(' · ');
  const who = mode && mode !== channel ? channel + ' · ' + mode : channel;
  return `<p style="margin:6px 0">${esc(callWhen(c.at))} · ${esc(who)}${num ? ' · ' + esc(num) : ''} · ${esc(outcome)}${c.sid ? ' · ' + esc(c.sid) : ''}${flag ? ' · ' + esc(flag) : ''}</p>`;
}
function remindCard(j) {
  const rows = (CALLS || []).filter((c) => c.jobId === j.id);
  const rem = j.reminded || {};
  const head = rem.forStart ? `<p class="muted" style="margin:0 0 6px">Marked reminded for ${esc(String(rem.forStart).replace('T', ' '))}${rem.status ? ' · ' + esc(rem.status) : ''}</p>` : '';
  const answers = answerBlock(j.callAnswers);
  const note = '<p class="muted" style="margin:0 0 6px">Answers stay on this screen. They are left off estimates, invoices, and customer emails.</p>';
  const body = rows.length ? rows.slice(0, 6).map(remindLine).join('') : (answers ? '' : '<p class="muted" style="margin:0">No reminder call yet.</p>');
  return `<div class="card" id="remindcard"><h2>Reminder call</h2>${callFlag(j)}${head}${note}${answers}${body}</div>`;
}
function remindLogHtml() {
  const rows = (CALLS || []).slice(0, 12);
  if (!rows.length) return '<p class="muted" id="remlog">No reminder calls yet.</p>';
  return '<div id="remlog">' + rows.map((c) => {
    const channel = c.type === 'sms' ? 'Text' : (c.manual ? 'Manual' : (c.test ? 'Test' : 'Live'));
    const mode = c.type === 'sms' ? (c.manual ? 'Manual' : (c.test ? 'Test' : 'Live')) : '';
    const who = mode && mode !== channel ? channel + ' · ' + mode : channel;
    const num = c.to ? fmtPh(c.to) : '';
    const outcome = c.error || c.status || 'sent';
    const flag = [c.no ? 'No' : '', c.callback ? 'Callback' : '', remindKind(c)].filter(Boolean).join(' · ');
    return `<p style="margin:6px 0">${esc(callWhen(c.at))} · ${esc(c.customer || c.jobId || 'Call')} · ${esc(who)}${num ? ' · ' + esc(num) : ''} · ${esc(outcome)}${flag ? ' · ' + esc(flag) : ''}</p>${answerBlock(c.answers)}`;
  }).join('') + '</div>';
}
let REMQ = null;
function ensureRemQ() {
  if (REMQ) return REMQ;
  const saved = SET && SET.reminders && SET.reminders.questions;
  if (Array.isArray(saved)) REMQ = saved.map((q) => ({ text: String(q && q.text || ''), type: q && q.type === 'speech' ? 'speech' : 'yesno' }));
  else REMQ = [{ text: 'Will the driveway or work area be cleared before we arrive?', type: 'yesno' }];
  return REMQ;
}
function moveRemQ(i, d) {
  const list = ensureRemQ();
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  const row = list.splice(i, 1)[0];
  list.splice(j, 0, row);
  setScreen();
}
function remQuestionHtml() {
  const list = ensureRemQ();
  const rows = list.map((q, i) => `<div class="line" style="align-items:stretch">
<input value="${esc(q.text)}" oninput="ensureRemQ()[${i}].text=this.value" placeholder="Question the call asks">
<select onchange="ensureRemQ()[${i}].type=this.value"><option value="yesno" ${q.type !== 'speech' ? 'selected' : ''}>Yes / no</option><option value="speech" ${q.type === 'speech' ? 'selected' : ''}>Spoken answer</option></select>
<div class="row"><button class="btn gr sm" type="button" onclick="moveRemQ(${i},-1)">Up</button><button class="btn gr sm" type="button" onclick="moveRemQ(${i},1)">Down</button><button class="btn gr sm" type="button" onclick="ensureRemQ().splice(${i},1);setScreen()">Delete</button></div>
</div>`).join('');
  return `<h3 style="margin:14px 0 6px">Call questions</h3>
<p class="muted" style="margin:0 0 8px">Asked one at a time. Yes / no says press 1 for yes and 2 for no. Every question also says press 0 to request a callback.</p>
<div id="remqs">${rows || '<p class="muted">No questions. The call gives the reminder and says goodbye.</p>'}</div>
<button class="btn gr" id="remqadd" type="button" onclick="ensureRemQ().push({text:'',type:'yesno'});setScreen()">Add question</button>`;
}
function remindRow() {
  const r = (SET && SET.reminders) || {};
  const on = r.on === true;
  const test = r.test !== false;
  return srow('rem', 'Reminder calls', `<p class="muted" style="margin:0 0 8px">One call about a day before a scheduled start. Off until you turn it on.</p>
<label class="checks"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="remon" ${on ? 'checked' : ''} onchange="setSumText()"> Reminder calls on</span></label>
<label class="checks"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="remtest" ${test ? 'checked' : ''} onchange="setSumText()"> Test mode</span></label>
<p class="muted" style="margin:6px 0">Test mode is on by default. Every call goes only to the test phone, never the customer. Customer numbers are used only when reminder calls are on and test mode is off.</p>
<label>Test phone</label><input id="remph" type="tel" inputmode="tel" autocomplete="tel" placeholder="(850) 555-0100" value="${esc(r.testPhone || '')}" oninput="setSumText()">
<button class="btn n" id="remtestbtn" type="button" onclick="remindTest()">Send test call now</button>
<button class="btn gr" id="reminstall" type="button" onclick="remindInstall()">Install hourly check</button>
${remQuestionHtml()}
<h3 style="margin:12px 0 6px">Reminder call log</h3>
${remindLogHtml()}`);
}
async function remindTest() {
  const phone = ($('#remph') && $('#remph').value.trim()) || '';
  const b = $('#remtestbtn');
  if (b) { b.disabled = true; b.textContent = 'Calling…'; }
  try {
    await saveSet(true);
    const r = await api({ a: 'remindtest', pin: ownerPin(), testPhone: phone });
    if (Array.isArray(r.callLog)) CALLS = r.callLog;
    toast(r.called ? 'Test call placed' : (r.error || 'Test call not placed'));
  } catch (e) { toast(e.message); }
  if (view === 'set') setScreen();
}
async function remindInstall() {
  const b = $('#reminstall');
  if (b) { b.disabled = true; b.textContent = 'Installing…'; }
  try {
    await api({ a: 'remindinstall', pin: ownerPin() });
    toast('Hourly check installed');
  } catch (e) { toast(e.message); }
  if (b) { b.disabled = false; b.textContent = 'Install hourly check'; }
}
const SMS_24H = "Hi {name}, this is Southern Concrete Coatings. Reminder: we're scheduled for estimate {est} ({work}) at {address} on {date} at {time}. See you then!";
const SMS_DAY = "Hey {name}, Southern Concrete Coatings here. We're on the way today at {time} for estimate {est} ({work}).";
const SMS_24H_OLD = "Hi {name}, this is Southern Concrete Coatings. Reminder: we're scheduled at {address} on {date} at {time}. See you then!";
const SMS_DAY_OLD = "Hey {name}, Southern Concrete Coatings here, we're on the way for your {time} appointment today.";
function smsShown(saved, next, old) {
  const s = String(saved || '').replace(/\s+/g, ' ').trim();
  if (!s || s === old) return next;
  return s;
}
function textRow() {
  const t = (SET && SET.texts) || {};
  const on = t.on === true;
  const test = t.test !== false;
  const phone = t.testPhone || (SET && SET.reminders && SET.reminders.testPhone) || '8504453792';
  return srow('sms', 'Text reminders', `<p class="muted" style="margin:0 0 8px">Two texts for a scheduled start: one about a day before, and one the morning of the job. Off until you turn it on.</p>
<label class="checks"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="smson" ${on ? 'checked' : ''} onchange="setSumText()"> Text reminders on</span></label>
<label class="checks"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="smstest" ${test ? 'checked' : ''} onchange="setSumText()"> Test mode</span></label>
<p class="muted" style="margin:6px 0">Test mode is on by default. Every text goes only to the test phone, never the customer. Customer numbers are used only when text reminders are on and test mode is off.</p>
<label>Test phone</label><input id="smsph" type="tel" inputmode="tel" autocomplete="tel" value="${esc(phone)}" oninput="setSumText()">
<label>Day-before text</label><textarea id="sms24" rows="4" oninput="setSumText()">${esc(smsShown(t.t24, SMS_24H, SMS_24H_OLD))}</textarea>
<label>Morning-of text</label><textarea id="smsday" rows="3" oninput="setSumText()">${esc(smsShown(t.dayof, SMS_DAY, SMS_DAY_OLD))}</textarea>
<p class="muted">{name}, {address}, {date}, {time}, {est}, and {work} fill in for that job. An empty piece is left out. These texts do not ask questions.</p>`);
}
function qboRow() {
  const q = (SET && SET.qbo) || {};
  return srow('qbo', 'QuickBooks', `<p class="muted" style="margin:0 0 8px">${q.connected ? 'Connected' : 'Not connected'} · ${esc(q.env || 'sandbox')}</p>
<p class="muted">Customers, estimates, invoices, and receipt expenses sync when QuickBooks is connected. The redirect address is the Apps Script /exec URL.</p>
<button class="btn n" type="button" onclick="qboConnect()">Connect QuickBooks</button>
<button class="btn gr" type="button" onclick="qboOff()">Disconnect</button>`);
}
async function qboConnect() {
  try {
    const r = await api({ a: 'qboconnect', pin: ownerPin() });
    if (r.url) location.href = r.url;
  } catch (e) { toast(e.message); }
}
async function qboOff() {
  try {
    const r = await api({ a: 'qbodisconnect', pin: ownerPin() });
    if (r.settings) SET = r.settings;
    toast('QuickBooks disconnected');
    setScreen();
  } catch (e) { toast(e.message); }
}
function setPayload() {
  return {
    a: 'settings', pin: ownerPin(),
    payLink: $('#sp') ? $('#sp').value.trim() : ((SET && SET.payLink) || ''),
    reviewLink: $('#sr') ? $('#sr').value.trim() : ((SET && SET.reviewLink) || ''),
    finLink: $('#sf') ? $('#sf').value.trim() : ((SET && SET.finLink) || ''),
    finMin: $('#sm') ? $('#sm').value : (SET && SET.finMin != null ? SET.finMin : 1000),
    quoteSubject: $('#qsub') ? $('#qsub').value.trim() : ((SET && SET.quoteSubject) || ''),
    quoteBody: $('#qbody') ? $('#qbody').value.trim() : ((SET && SET.quoteBody) || ''),
    quoteSign: $('#qsign') ? $('#qsign').value.trim() : ((SET && SET.quoteSign) || ''),
    quoteBcc: $('#qbcc') ? $('#qbcc').value.trim() : ((SET && SET.quoteBcc) || 'mccardlematt@yahoo.com'),
    theme: themeName(),
    form: FORM || formCfg(),
    galleryHide: galleryHideList(),
    reminders: {
      on: $('#remon') ? $('#remon').checked : !!(SET && SET.reminders && SET.reminders.on),
      test: $('#remtest') ? $('#remtest').checked : (SET && SET.reminders ? SET.reminders.test !== false : true),
      testPhone: $('#remph') ? $('#remph').value.trim() : ((SET && SET.reminders && SET.reminders.testPhone) || ''),
      questions: ensureRemQ().map((q) => ({ text: String(q.text || '').trim(), type: q.type === 'speech' ? 'speech' : 'yesno' })).filter((q) => q.text).slice(0, 8)
    },
    texts: {
      on: $('#smson') ? $('#smson').checked : !!(SET && SET.texts && SET.texts.on),
      test: $('#smstest') ? $('#smstest').checked : !(SET && SET.texts && SET.texts.test === false),
      testPhone: $('#smsph') ? $('#smsph').value.trim() : ((SET && SET.texts && SET.texts.testPhone) || (SET && SET.reminders && SET.reminders.testPhone) || '8504453792'),
      t24: $('#sms24') ? $('#sms24').value.trim() : ((SET && SET.texts && SET.texts.t24) || ''),
      dayof: $('#smsday') ? $('#smsday').value.trim() : ((SET && SET.texts && SET.texts.dayof) || '')
    }
  };
}
function pickTheme(name) {
  localStorage.sccTheme = name === 'classic' ? 'classic' : 'dark';
  applyTheme(localStorage.sccTheme);
  saveSet(true);
}
function setScreen() {
  const S = SET || {};
  if (!FORM) FORM = JSON.parse(JSON.stringify(formCfg()));
  A.innerHTML = `<h2 style="margin:0 0 4px">Settings</h2>
<p class="muted" style="margin:0 0 12px">Links customers see in their emails. Leave a box empty to hide that button.</p>
${appearanceRow()}
${srow('pay', 'Payments', `<label>Payment link (Stripe, Square or PayPal)</label><input id="sp" type="url" inputmode="url" autocomplete="off" autocapitalize="off" placeholder="https://..." value="${esc(S.payLink || '')}" oninput="setSumText()">
<p class="muted" style="margin:6px 0 0">Adds a Pay now button to quote and invoice emails. Create a payment link in Stripe, Square or PayPal and paste it here.</p>`)}
${srow('rev', 'Reviews', `<label>Google review link</label><input id="sr" type="url" inputmode="url" autocomplete="off" autocapitalize="off" placeholder="https://g.page/r/.../review" value="${esc(S.reviewLink || '')}" oninput="setSumText()">
<p class="muted" style="margin:6px 0 0">Used by the Request review button on finished and paid jobs. In your Google Business Profile, tap Ask for reviews and copy the link.</p>`)}
${srow('fin', 'Pay over time', `<label>Financing link</label><input id="sf" type="url" inputmode="url" autocomplete="off" autocapitalize="off" placeholder="https://..." value="${esc(S.finLink || '')}" oninput="setSumText()">
<label>Show it on quotes and invoices of at least ($)</label><input id="sm" inputmode="decimal" value="${esc(S.finMin == null ? 1000 : S.finMin)}" oninput="setSumText()">
<p class="muted" style="margin:6px 0 0">Adds a Pay over time button. Hidden when no link is set or the amount is below this number.</p>`)}
${srow('mail', 'Customer email', `<p class="muted" style="margin:0 0 8px">This wording is the estimate email. A blank box keeps the original line.</p>
<label>Subject</label><textarea id="qsub" rows="2" oninput="setSumText()">${esc(S.quoteSubject || SCCQuote.QUOTE_EMAIL_SUBJECT)}</textarea>
<label>Message</label><textarea id="qbody" rows="6" oninput="setSumText()">${esc(S.quoteBody || SCCQuote.QUOTE_EMAIL_BODY)}</textarea>
<label>Sign-off</label><textarea id="qsign" rows="3" oninput="setSumText()">${esc(S.quoteSign || SCCQuote.QUOTE_EMAIL_SIGN)}</textarea>
<p class="muted">Line breaks stay. {name}, {estimate}, and {address} fill in for that customer.</p>
<label>BCC on quote emails</label><input id="qbcc" type="email" inputmode="email" autocomplete="off" value="${esc(S.quoteBcc || 'mccardlematt@yahoo.com')}" oninput="setSumText()">
<p class="muted">A copy of each estimate sent to a customer. A blank box keeps mccardlematt@yahoo.com. Feedback and other alerts are not copied.</p>
<button class="btn gr" id="qreset" type="button" onclick="resetEmailCopy()">Reset to default</button>`)}
${srow('form', 'Quote form', formEditorHtml())}
${srow('gal', 'Gallery photos', `<p class="muted" style="margin:0 0 8px">Photos you upload are removed for good. Built-in swatches stay hidden until you restore them.</p>
<button class="btn gr" id="grestore" type="button" onclick="restoreGallery()">Restore deleted photos</button>`)}
${remindRow()}
${textRow()}
${qboRow()}
<button class="btn huge" id="ss" type="button" onclick="saveSet()">Save settings</button>`;
  setSumText();
}
function resetEmailCopy() {
  if ($('#qsub')) $('#qsub').value = SCCQuote.QUOTE_EMAIL_SUBJECT;
  if ($('#qbody')) $('#qbody').value = SCCQuote.QUOTE_EMAIL_BODY;
  if ($('#qsign')) $('#qsign').value = SCCQuote.QUOTE_EMAIL_SIGN;
  saveSet();
}
async function saveSet(quiet) {
  const b = $('#ss');
  if (b) { b.disabled = true; b.textContent = 'Saving…'; }
  try {
    const r = await api(setPayload());
    SET = r.settings || SET;
    FORM = null;
    REMQ = null;
    if (!quiet) toast('Settings saved');
    if (b) { b.disabled = false; b.textContent = 'Save settings'; }
    if (view === 'set') setScreen();
  } catch (e) {
    if (!quiet) toast(e.message);
    if (b) { b.disabled = false; b.textContent = 'Save settings'; }
  }
}
if (role) refresh().then(render);
else render();
