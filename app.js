/* Southern Concrete Coatings Field Desk — one Owner login, one project screen. */
let API = new URLSearchParams(location.search).get('api') || localStorage.sccApi || API_URL || '';
if (API) localStorage.sccApi = API;

let blocks = [], role = sessionStorage.sccRole || '', jobs = [], root = '', cur = null, pin = '', photos = [];
let serverTest = null;
const $ = (s) => document.querySelector(s);
const A = $('#app');
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
    serverTest = d.testMode;
    const bar = $('#testbar');
    if (d.testMode === false) {
      bar.className = 'bad';
      bar.textContent = 'Server test mode is OFF. Do not send customer mail until Code.gs TEST_MODE is true.';
    }
  } catch (e) { toast(e.message); }
}
function logout() { sessionStorage.sccRole = ''; role = ''; cur = null; render(); }
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
  return `<div class="card"><h2>Connect backend</h2><p class="muted">Paste the Apps Script web app URL (the one that ends in /exec). Drive folders and mail run there. Test mode stays on in config.js and Code.gs.</p><input id="apiu" placeholder="https://script.google.com/macros/s/.../exec"><button class="btn n" onclick="saveApi()">Save</button></div>`;
}
function saveApi() {
  API = $('#apiu').value.trim();
  localStorage.sccApi = API;
  render();
}
function render() {
  GAL = [];
  ACC = {};
  $('#out').hidden = !role;
  $('#who').textContent = role ? 'All-in-one · Test mode' : 'All-in-one · Tallahassee';
  if (!TEST_MODE) { $('#testbar').hidden = true; $('#testpill').hidden = true; }
  if (role && !Object.values(ROLES).includes(role)) {
    sessionStorage.sccRole = '';
    role = '';
  }
  if (!role) {
    pin = '';
    A.innerHTML = setupCard() + `<div class="card"><h2>Enter your PIN</h2><div id="dots"></div><div class="pin">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map((k) => `<button type="button" onclick="key('${k}')">${k}</button>`).join('')}</div></div><p class="muted">Free estimates · Garage floors &amp; commercial coatings · ${esc(CO.phone)}</p>`;
    return;
  }
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
const ST = { paid: 'Paid', inprogress: 'In progress', sent: 'Quoted', approved: 'Approved · do the job', declined: 'Declined', reply: 'Customer replied', complete: 'Done · invoice it', invoiced: 'Invoiced' };
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
  if (!j.items || !j.items.length) return `<p style="white-space:pre-wrap">${esc(j.quote || '')}</p>`;
  return j.items.map((i) => `<p style="margin:6px 0;font-size:17px"><b>${esc(i.title)}</b>${i.price != null && i.price !== '' ? ' — ' + SCCQuote.money(Number(i.price)) : ''}<br><span class="muted">${esc(i.detail || '')}</span></p>`).join('') + `<p style="font-size:19px"><b>Total: ${SCCQuote.money(j.total)}</b></p>`;
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
  A.innerHTML = `<div class="card"><h2>Crew schedule</h2><div class="row"><button class="btn ${SV.mode === 'week' ? '' : 'gr'}" onclick="SV.mode='week';sched()">Week</button><button class="btn ${SV.mode === 'month' ? '' : 'gr'}" onclick="SV.mode='month';sched()">Month</button></div><button class="btn huge" onclick="blk('')">+ Block time</button><div class="row"><button class="btn n" onclick="mv(-1)">◀</button><button class="btn n" onclick="mv(1)">▶</button></div><h2 style="text-align:center">${title}</h2></div>${SV.mode === 'month' ? '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px">' + 'SMTWTFS'.split('').map((x) => `<b style="text-align:center">${x}</b>`).join('') + cells + '</div>' : cells}<button class="btn gr" onclick="render()">← All projects</button>`;
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

function home() {
  list('All my projects (' + jobs.length + ')', [...jobs].sort((a, b) => (a.created < b.created ? 1 : -1)), 'jview', `<button class="btn huge" onclick="newq()">+ New customer quote</button><button class="btn huge n" onclick="sched()">Crew schedule</button>`);
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
function livePrice() {
  const f = fieldVals();
  const sq = Number(f.sqft), rate = Number(String(f.rate).replace(/[$,]/g, ''));
  const el = $('#liveprice');
  if (!el) return;
  if (sq > 0 && rate > 0) el.textContent = SCCQuote.formatSq(sq) + ' sq ft × ' + SCCQuote.money(rate) + ' = ' + SCCQuote.money(SCCQuote.round2(sq * rate));
  else el.textContent = 'Enter square footage and a price per sq ft.';
}
function newq() {
  photos = [];
  ACC = {};
  A.innerHTML = `<div class="card"><h2>New quote</h2>
${acc('qc', 'Customer details', 'Tap to enter name, address, email', `<label>Customer name</label><input id="nm" autocomplete="name" oninput="cs()"><label>Address</label><div style="position:relative"><input id="ad" autocomplete="off" autocapitalize="words" placeholder="Start typing the Tallahassee address" oninput="cs()"><div class="sug" id="adsug" hidden></div></div><label>Customer email</label><input id="em" type="email" inputmode="email" autocomplete="off" placeholder="Saved on the job" oninput="cs()"><p class="muted">Test mode is on. This address is stored on the job. The estimate email goes only to ${esc(TEST_TO)}.</p>`)}
<label>Square footage</label><input id="sqft" inputmode="decimal" placeholder="480" oninput="livePrice()">
<label>Coating system</label><select id="system" onchange="livePrice()"><option value="">Choose a system</option>${SYSTEMS.map((s) => `<option>${esc(s)}</option>`).join('')}</select>
<label>Color / flake</label><input id="color" placeholder="Dominion, Wolf Gray, custom blend">
<label>Prep</label><div class="checks" id="prepbox">${PREP_OPTS.map((p) => `<label><input type="checkbox" value="${esc(p)}"> ${esc(p)}</label>`).join('')}</div>
<label>Cure / return to service</label><select id="cure"><option value="">Choose</option>${CURES.map((s) => `<option>${esc(s)}</option>`).join('')}</select>
<label>Price per sq ft</label><input id="rate" inputmode="decimal" placeholder="6.50" oninput="livePrice()">
<p id="liveprice"></p>
<input type="file" id="pf" accept="image/*" capture="environment" multiple hidden onchange="pick(this,showP)"><button class="btn d" type="button" onclick="$('#pf').click()">📷 Take photo</button>
${acc('qp', 'Photo attachments (0)', 'No photos yet', '<div id="pp"></div>')}
<label>Notes (talk or type)</label><textarea id="qt" rows="5" placeholder="480 sq ft two-car garage, full flake in Dominion, grind and crack repair, $6.50 a sq ft, back in 24 hours"></textarea>
<button class="btn mic" id="mb" type="button">🎤 Talk</button>
<button class="btn huge d" type="button" onclick="prev()">Preview polished quote →</button>
<div id="pv"></div>
<button class="btn gr" type="button" onclick="render()">Cancel</button></div>`;
  mic('mb', 'qt');
  addrAC('ad', cs);
  livePrice();
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
  if (!spoken && !f.system && !f.sqft) return toast('Add the floor details or say the work first');
  IT = SCCQuote.buildItems(f, spoken);
  if (!IT.length) return toast('Add at least one line');
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
<button class="btn huge" id="sq" type="button" onclick="sendQ()">Send quote email + PDF</button></div>`;
  $('#pv').scrollIntoView({ behavior: 'smooth' });
}
async function sendQ() {
  const f = fieldVals();
  const d = {
    a: 'create', name: $('#nm').value.trim(), address: $('#ad').value.trim(), email: $('#em').value.trim(),
    quote: $('#qt').value, sqft: f.sqft, system: f.system, color: f.color, prep: f.prep, cure: f.cure, rate: f.rate,
    items: IT.filter((i) => i.title && i.title.trim()), photos
  };
  if (!d.name) return toast('Add the customer name');
  if (d.email && !SCCQuote.validEmail(d.email)) return toast('That email does not look right. Check it.');
  if (!TEST_MODE && !SCCQuote.validEmail(d.email)) return toast('Add a valid customer email before sending.');
  if (!d.items.length) return toast('Add at least one line');
  $('#sq').disabled = true;
  $('#sq').textContent = 'Sending…';
  try {
    await api(d);
    toast(sentMsg('Estimate'));
    await refresh();
    render();
  } catch (e) { toast(e.message); $('#sq').disabled = false; $('#sq').textContent = 'Send quote email + PDF'; }
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
function jview(id) {
  GAL = [];
  cur = id;
  const j = jobs.find((x) => x.id === id);
  if (!j) return render();
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
<p><span class="badge" style="background:${SC[stat(j)] || '#8a8f98'}">${ST[stat(j)] || esc(j.status)}</span> ${cfBadge(j)}${j.invoice ? ` <span class="badge ${paid ? 'paid' : 'open'}">${paid ? 'PAID' : 'OPEN'}</span>` : ''}</p>
${av(j) ? '<p style="font-size:17px">🕒 <b>Customer prefers:</b> ' + esc(av(j)) + '</p>' : ''}
<p class="muted">Test mode: emails go only to ${esc(TEST_TO)}</p></div>`;
  h += acc(K('jd'), 'Job details', (j.est || 'Quote') + ' · ' + (j.email || 'no email'), `${j.est ? '<p class="muted">' + esc(j.est) + (j.pdf ? ` · <a href="${esc(j.pdf)}" target="_blank" rel="noopener">PDF</a>` : '') + '</p>' : ''}<p>📧 ${esc(j.email) || '<b style="color:#b91c1c">No email on job</b>'} <a href="#" onclick="fixEmail('${id}');return false">edit</a></p>${j.response ? '<p><b>Customer answer:</b> ' + esc(j.response.label) + (j.response.text ? ' — ' + esc(j.response.text) : '') + '</p>' : ''}${av(j) ? '<p><b>Availability:</b> ' + esc(av(j)) + '</p>' : ''}${specHtml(j)}${j.notes ? '<p>' + esc(j.notes) + '</p>' : ''}${j.crewNotes ? '<p><b>Job notes:</b> ' + esc(j.crewNotes) + '</p>' : ''}${j.folder ? `<p><a href="${esc(j.folder)}" target="_blank" rel="noopener">Project photos in Drive</a></p>` : ''}`);
  h += acc(K('li'), 'Line items (' + li + ')', tot ? tot + ' total' : 'Scope and price', items(j));
  if (np && st !== 'approved') h += acc(K('ph'), 'Photos (' + np + ')', 'Quote ' + (j.photos || []).length + ' · Before/After ' + (j.crew || []).length, ((j.photos || []).length ? '<label>Quote photos</label>' + imgs(j.photos) : '') + ((j.crew || []).length ? '<label>Before / After</label>' + imgs(j.crew) : ''));
  if (st === 'approved' && (j.photos || []).length) h += acc(K('qp'), 'Quote photos (' + j.photos.length + ')', 'Tap to view', imgs(j.photos));
  if (st === 'sent' || st === 'reply' || st === 'approved') h += cfDetail(j);
  if (st === 'sent' || st === 'reply' || st === 'declined') {
    h += `<div class="card"><h2>Step 1 · Quote</h2><p class="muted">Waiting on the customer. Answered by phone? Mark it:</p><div class="row"><button class="btn" type="button" onclick="ans('${id}','A')">A Approve</button><button class="btn d" type="button" onclick="ans('${id}','B')">B Changes</button><button class="btn gr" type="button" onclick="ans('${id}','C')">C Decline</button></div>${resendBtn(j, true)}</div>`;
  }
  if (st === 'approved') {
    h += `<div class="card"><h2>Step 2 · Do the job</h2>${acc(K('bf'), 'Before photos (' + b.length + ')', b.length ? 'Tap to view' : 'None yet', imgs(b))}<input type="file" id="bf" accept="image/*" capture="environment" multiple hidden onchange="up(this,'before')"><button class="btn d" type="button" onclick="$('#bf').click()">📷 Before photo</button>
${acc(K('af'), 'After photos (' + af.length + ')', af.length ? 'Tap to view' : 'None yet', imgs(af))}<input type="file" id="af" accept="image/*" capture="environment" multiple hidden onchange="up(this,'after')"><button class="btn d" type="button" onclick="$('#af').click()">📷 After photo</button>
${acc(K('jn'), 'Job notes', j.crewNotes ? esc(String(j.crewNotes).slice(0, 60)) : 'Tap to add notes', `<textarea id="cn" rows="4">${esc(j.crewNotes || '')}</textarea><button class="btn mic" id="cm" type="button">🎤 Talk</button>`)}
<button class="btn huge" id="jc" type="button" onclick="done('${id}')">✅ JOB COMPLETE</button></div>`;
  }
  if (st === 'complete' || st === 'invoiced') {
    const am = v.amount || (j.total != null ? SCCQuote.money(j.total) : '');
    h += `<div class="card"><h2>Step 3 · Invoice</h2><p class="muted">Prefilled from the quote. Test mode sends this only to ${esc(TEST_TO)}.</p>${acc(K('pd'), 'Payment details', 'Amount ' + am + ' · ' + (paid ? 'PAID' : st === 'invoiced' ? 'OPEN' : 'not sent'), `<label>Amount</label><input id="am" value="${esc(am)}"><label>Note</label><textarea id="an" rows="2">${esc(v.note || 'Payment due within 15 days. Thank you for the floor.')}</textarea>`)}
<button class="btn huge" id="invbtn" type="button" onclick="inv('${id}')">${j.invoice ? 'Resend invoice' : 'Send invoice'}</button>${st === 'invoiced' ? `<button class="btn ${paid ? 'gr' : 'd'}" id="paidbtn" type="button" onclick="markPaid('${id}',${!paid})">${paid ? 'Mark OPEN' : 'Mark PAID'}</button>` : ''}</div>`;
  }
  if ((st === 'approved' || st === 'complete' || st === 'invoiced') && j.est) h += `<div class="card">${resendBtn(j, false)}</div>`;
  h += '<button class="btn gr" type="button" onclick="render()">← All projects</button>';
  A.innerHTML = h;
  if (st === 'approved') mic('cm', 'cn');
}
async function resend(id) {
  if (!confirm('Resend the quote email? Test mode sends it only to ' + TEST_TO + '.')) return;
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

if (role) refresh().then(render);
else render();
