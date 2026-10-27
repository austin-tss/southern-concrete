import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'quote.js'), 'utf8'), sandbox);
const q = sandbox.module.exports;
const TEST_MODE = sandbox.TEST_MODE;
const TEST_TO = sandbox.TEST_TO;
const CO = sandbox.CO;
const COLORS = { n: '#3a415c', g: '#424866', dg: '#2a3148' };

const jobs = [];
const blocks = [];
const inbox = [];
const feedback = [];
const expenses = [];
const receipts = new Map();
const gallery = [];
let measureOn = false;
let fillOn = false;
let settings = { payLink: '', reviewLink: '', finLink: '', finMin: 1000, ocr: false };
let seq = 1;
let rcSeq = 1;
const OWNER_PIN = Object.keys(sandbox.ROLES || {}).find((k) => sandbox.ROLES[k] === 'Owner') || '';
function pinOk(d) { return String((d && d.pin) || '') === OWNER_PIN; }
function moneyNum(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}
function hardnessVal(v) {
  if (v == null || String(v).trim() === '') return '';
  const n = Number(v);
  if (n !== Math.floor(n) || n < 1 || n > 10) return null;
  return n;
}
function seed(job) { jobs.unshift(job); return job; }
function armMeasure(on) { measureOn = !!on; }
function armFill(on) { fillOn = !!on; }

function envelope(job) {
  const env = q.deliveryAddress(TEST_MODE, TEST_TO, job && job.email, CO.email);
  if (TEST_MODE && (env.to !== TEST_TO || env.replyTo !== TEST_TO)) {
    throw new Error('Test mode blocked a send that was not addressed only to ' + TEST_TO);
  }
  return env;
}
function record(kind, job, subject, html) {
  const env = envelope(job);
  if (!env.to) return;
  inbox.push({ kind, to: env.to, replyTo: env.replyTo, subject: (TEST_MODE ? 'TEST - ' : '') + subject, html, customer: job.email || '' });
}
function quoteOut(j, html) {
  const copy = q.quoteEmailCopy({ co: CO, settings, job: j });
  const env = q.deliveryAddress(TEST_MODE, TEST_TO, j && j.email, CO.email);
  j.emailed = !!env.to;
  if (j.emailed) record('quote', j, copy.subject, html);
}
function storePhotos(list, kind) {
  return (list || []).map((d, i) => ({ url: d, kind, n: i }));
}
function numField(v) {
  if (v == null || v === '') return '';
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isNaN(n) ? '' : n;
}
function respond(j, p) {
  const labels = { A: 'Approved', B: 'Approved with changes', C: 'Declined', O: 'Question / other' };
  j.response = { ans: p.ans, label: labels[p.ans] || p.ans, text: p.text || '', avail: p.avail || '', when: p.when || '', at: new Date().toISOString() };
  j.status = (p.ans === 'A' || p.ans === 'B') ? 'approved' : (p.ans === 'C' ? 'declined' : 'reply');
}
function handle(d) {
  if (d.a === 'signin' || d.a === 'log') return { ok: true };
  if (d.a === 'gadd') {
    const parts = String(d.image || '').split(',');
    if (parts.length < 2 || !parts[1]) return { ok: false, err: 'Choose a photo first' };
    const tags = String(d.tags || '').split(',').map((s) => s.trim().slice(0, 40)).filter(Boolean).slice(0, 12);
    const item = {
      id: 'GAL' + (seq++),
      caption: String(d.caption || '').trim().slice(0, 200),
      tags,
      t: new Date().toISOString(),
      url: d.image
    };
    gallery.unshift(item);
    return { ok: true, gallery };
  }
  if (d.a === 'gdel') {
    const i = gallery.findIndex((x) => x.id === d.id);
    if (i >= 0) gallery.splice(i, 1);
    return { ok: true, gallery };
  }
  if (d.a === 'measure') {
    if (!pinOk(d)) return { ok: false, err: 'Wrong PIN' };
    const images = Array.isArray(d.images) ? d.images : (d.photos || []);
    if (!images.length) return { ok: true, ready: false, message: 'Add a photo of the floor first' };
    if (!measureOn) return { ok: true, ready: false, message: 'AI measuring not set up yet' };
    return {
      ok: true, ready: true, sqft: 432, lengthFt: 24, widthFt: 18, confidence: 'medium',
      note: 'ZXAI double door about 16 ft, two bays'
    };
  }
  if (d.a === 'feedback') {
    if (!pinOk(d)) return { ok: false, err: 'Wrong PIN' };
    const text = String(d.text || '').trim();
    if (!text) return { ok: false, err: 'Write a note first' };
    feedback.push({ at: new Date().toISOString(), role: String(d.role || '').slice(0, 40), text: text.slice(0, 4000) });
    if (feedback.length > 500) feedback.splice(0, feedback.length - 500);
    return { ok: true };
  }
  if (d.a === 'qfill') {
    if (!pinOk(d)) return { ok: false, err: 'Wrong PIN' };
    const text = String(d.text || '').trim();
    if (!text) return { ok: true, ready: false, message: 'Say or type the job first.' };
    if (!fillOn) return { ok: true, ready: false, message: 'AI fill not set up yet' };
    return {
      ok: true, ready: true,
      fields: {
        name: 'Pat Homeowner', phone: '850-555-0148', email: 'pat@example.com',
        address: '1 Call St, Tallahassee, FL', sqft: 480, system: 'Garage floor flake system',
        color: 'Dominion', prep: 'Diamond grinding, Crack repair', cure: '24 hours', rate: 6.5,
        extras: 'moisture mitigation $350', notes: 'Gate is on the left',
        hardness: 8, hardnessHow: 'ZXHARD', internalNotes: 'ZXNOTE', aiNote: 'ZXAI'
      }
    };
  }
  if (['settings', 'explist', 'expadd', 'expdel', 'rcscan', 'rcrescan', 'rcdrop'].includes(d.a)) {
    if (!pinOk(d)) return { ok: false, err: 'Wrong PIN' };
    if (d.a === 'settings') {
      const fm = Number(String(d.finMin == null ? '' : d.finMin).replace(/[^0-9.\-]/g, ''));
      settings = {
        payLink: String(d.payLink || '').trim(),
        reviewLink: String(d.reviewLink || '').trim(),
        finLink: String(d.finLink || '').trim(),
        finMin: Number.isNaN(fm) ? 1000 : fm,
        ocr: false,
        quoteBody: String(d.quoteBody || '').trim().slice(0, 4000),
        quoteSubject: String(d.quoteSubject || '').trim().slice(0, 300),
        quoteSign: String(d.quoteSign || '').trim().slice(0, 800)
      };
      return { ok: true, settings };
    }
    if (d.a === 'explist') return { ok: true, expenses };
    if (d.a === 'expadd') {
      const amt = moneyNum(d.amount);
      if (!(amt > 0)) return { ok: false, err: 'Enter the amount' };
      let receipt = String(d.receiptId || '');
      if (!receipt && d.image) { receipt = 'RC' + (rcSeq++); receipts.set(receipt, d.image); }
      expenses.unshift({
        id: 'EX' + (seq++), amount: amt, category: d.category || 'Other', note: d.note || '',
        date: d.date || '2026-10-27', vendor: d.vendor || '',
        tax: d.tax == null || d.tax === '' ? null : moneyNum(d.tax),
        items: d.items || [], receipt, scanned: !!d.scanned, created: new Date().toISOString()
      });
      return { ok: true, expenses };
    }
    if (d.a === 'expdel') {
      for (let i = expenses.length - 1; i >= 0; i--) if (expenses[i].id === d.id) expenses.splice(i, 1);
      return { ok: true, expenses };
    }
    if (d.a === 'rcscan') {
      const id = 'RC' + (rcSeq++);
      receipts.set(id, d.image || '');
      return { ok: true, receiptId: id, ocr: false, reason: 'none', data: {} };
    }
    if (d.a === 'rcrescan') return { ok: true, receiptId: d.id || '', ocr: false, reason: 'none', data: {} };
    if (d.a === 'rcdrop') { receipts.delete(d.id); return { ok: true }; }
  }
  if (d.a === 'delete') {
    if (!pinOk(d)) return { ok: false, err: 'Wrong PIN' };
    const i = jobs.findIndex((x) => x.id === d.id);
    if (i >= 0) jobs.splice(i, 1);
    return { ok: true };
  }
  if (d.a === 'phone') {
    const ids = d.ids || [];
    jobs.forEach((x) => { if (ids.includes(x.id)) x.phone = String(d.phone || '').trim(); });
    return { ok: true };
  }
  if (d.a === 'block' || d.a === 'unblock') {
    const id = d.block && d.block.id;
    for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].id === id) blocks.splice(i, 1);
    if (d.a === 'block') {
      if (!d.block.id) d.block.id = 'B' + Date.now().toString(36);
      blocks.push(d.block);
    }
    return { ok: true, blocks, testMode: TEST_MODE };
  }
  if (d.a === 'create') {
    if (d.email && !q.validEmail(d.email)) return { ok: false, err: 'That customer email does not look valid.' };
    if (hardnessVal(d.hardness) === null) return { ok: false, err: 'Hardness is a whole number from 1 to 10.' };
    const fields = { sqft: d.sqft, system: d.system, color: d.color, prep: d.prep, cure: d.cure, rate: d.rate };
    const items = (d.items && d.items.length) ? d.items : q.buildItems(fields, d.quote);
    const j = {
      id: 'SCC-' + (seq++).toString(36).toUpperCase(),
      est: 'SCC-EST-2026-' + String(seq).padStart(4, '0'),
      name: d.name, address: d.address, email: String(d.email || '').trim(), phone: String(d.phone || '').trim(),
      quote: d.quote || '', sqft: numField(d.sqft), system: d.system || '', color: d.color || '',
      prep: d.prep || '', cure: d.cure || '', rate: numField(d.rate),
      hardness: hardnessVal(d.hardness), hardnessHow: String(d.hardnessHow || '').trim().slice(0, 300), internalNotes: [],
      additionalNotes: String(d.additionalNotes || '').trim().slice(0, 4000),
      items, total: q.totalOf(items), status: 'sent', created: new Date().toISOString(),
      photos: storePhotos(d.photos, 'quote'), crew: [],
      folder: 'https://drive.google.com/drive/folders/scc-project-' + seq,
      pdf: 'https://drive.google.com/file/d/scc-estimate/view'
    };
    const html = q.quoteEmailHtml({
      co: CO, colors: COLORS, job: Object.assign({ date: 'October 27, 2026' }, j),
      testMode: TEST_MODE, testTo: TEST_TO, logoSrc: 'cid:logo', settings, photosHtml: j.photos.length ? '<img alt="site">' : '',
      link: (k) => '/exec?a=respond&id=' + encodeURIComponent(j.id) + '&ans=' + k
    });
    quoteOut(j, html);
    jobs.unshift(j);
    return { ok: true, testMode: TEST_MODE, job: j };
  }
  const j = jobs.find((x) => x.id === d.id);
  if (!j) return { ok: false, err: 'Job not found' };
  if (d.a === 'upload') j.crew = j.crew.concat(storePhotos(d.photos, d.kind));
  else if (d.a === 'finish') {
    j.crewNotes = d.notes || '';
    j.status = 'complete';
    j.finished = new Date().toISOString();
    const before = j.crew.filter((p) => p.kind === 'before').length ? '<img alt="before">' : '';
    const after = j.crew.filter((p) => p.kind === 'after').length ? '<img alt="after">' : '';
    record('recap', j, 'Your floor is done - Southern Concrete Coatings', q.recapEmailHtml({
      co: CO, colors: COLORS, job: j, testMode: TEST_MODE, testTo: TEST_TO, logoSrc: 'cid:logo', beforeHtml: before, afterHtml: after
    }));
  } else if (d.a === 'invoice') {
    j.invoice = { amount: d.amount, note: d.note || '', at: new Date().toISOString(), paid: !!(j.invoice && j.invoice.paid) };
    j.status = 'invoiced';
    record('invoice', j, 'Invoice from Southern Concrete Coatings - ' + d.amount, q.invoiceEmailHtml({
      co: CO, colors: COLORS, job: j, testMode: TEST_MODE, testTo: TEST_TO, logoSrc: 'cid:logo'
    }));
  } else if (d.a === 'paid') {
    j.invoice = j.invoice || {};
    j.invoice.paid = !!d.paid;
    j.invoice.paidAt = d.paid ? new Date().toISOString() : '';
  } else if (d.a === 'email') {
    if (!q.validEmail(d.email)) return { ok: false, err: 'Invalid email' };
    j.email = String(d.email).trim();
  } else if (d.a === 'respond') respond(j, d);
  else if (d.a === 'hardness') {
    const hv = hardnessVal(d.hardness);
    if (hv === null) return { ok: false, err: 'Hardness is a whole number from 1 to 10.' };
    j.hardness = hv;
    j.hardnessHow = String(d.hardnessHow || '').trim().slice(0, 300);
  } else if (d.a === 'qedit') {
    if (d.email && !q.validEmail(d.email)) return { ok: false, err: 'That customer email does not look valid.' };
    if (hardnessVal(d.hardness) === null) return { ok: false, err: 'Hardness is a whole number from 1 to 10.' };
    const keptId = j.id, keptEst = j.est, keptStatus = j.status, keptNotes = j.internalNotes;
    j.name = String(d.name || '').trim().slice(0, 200);
    j.address = String(d.address || '').trim().slice(0, 300);
    j.email = String(d.email || '').trim();
    j.phone = String(d.phone || '').trim().slice(0, 40);
    j.quote = String(d.quote || '').slice(0, 8000);
    j.sqft = numField(d.sqft);
    j.system = String(d.system || '').trim().slice(0, 80);
    j.color = String(d.color || '').trim().slice(0, 80);
    j.prep = String(d.prep || '').trim().slice(0, 240);
    j.cure = String(d.cure || '').trim().slice(0, 80);
    j.rate = numField(d.rate);
    j.hardness = hardnessVal(d.hardness);
    j.hardnessHow = String(d.hardnessHow || '').trim().slice(0, 300);
    j.additionalNotes = String(d.additionalNotes || '').trim().slice(0, 4000);
    j.items = (Array.isArray(d.items) ? d.items : []).map((it) => {
      const title = String(it && it.title || '').trim().slice(0, 200);
      if (!title) return null;
      let price = null;
      if (it.price != null && String(it.price).trim() !== '') {
        const n = Number(String(it.price).replace(/[$,]/g, ''));
        if (!Number.isNaN(n)) price = Math.round(n * 100) / 100;
      }
      return { title, detail: String(it.detail || '').trim().slice(0, 2000), price };
    }).filter(Boolean).slice(0, 40);
    j.total = q.totalOf(j.items);
    j.id = keptId;
    j.est = keptEst;
    j.status = keptStatus;
    j.internalNotes = keptNotes;
    if (d.send) {
      const html = q.quoteEmailHtml({
        co: CO, colors: COLORS, job: Object.assign({ date: 'October 27, 2026' }, j),
        testMode: TEST_MODE, testTo: TEST_TO, logoSrc: 'cid:logo', settings,
        link: (k) => '/exec?a=respond&id=' + encodeURIComponent(j.id) + '&ans=' + k
      });
      quoteOut(j, html);
    }
  } else if (d.a === 'addl') {
    j.additionalNotes = String(d.additionalNotes != null ? d.additionalNotes : '').trim().slice(0, 4000);
  } else if (d.a === 'inote') {
    const noteText = String(d.text || '').trim();
    if (!noteText) return { ok: false, err: 'Write a note first' };
    if (!Array.isArray(j.internalNotes)) j.internalNotes = [];
    j.internalNotes.push({ t: new Date().toISOString(), text: noteText.slice(0, 2000) });
    if (j.internalNotes.length > 200) j.internalNotes = j.internalNotes.slice(-200);
  } else if (d.a === 'markpaid') {
    j.invoice = j.invoice || {};
    j.invoice.paid = true;
    j.invoice.paidAt = new Date().toISOString();
    j.invoice.paidDate = String(d.date || '');
    j.invoice.method = String(d.method || '');
    j.invoice.amountPaid = moneyNum(d.amount);
    j.invoice.ref = String(d.ref || '');
    if (!j.invoice.amount) j.invoice.amount = q.money(j.invoice.amountPaid);
    if (!j.invoice.at) j.invoice.at = j.invoice.paidAt;
    j.status = 'invoiced';
  } else if (d.a === 'reqreview') {
    if (!settings.reviewLink) return { ok: false, err: 'Add a Google review link in Settings first.' };
    j.review = { at: new Date().toISOString(), count: ((j.review && j.review.count) || 0) + 1 };
    record('review', j, 'How did we do? Southern Concrete Coatings', 'Leave a review');
  } else if (d.a === 'resend' || d.a === 'resendquote') {
    if (!j.est) return { ok: false, err: 'This job has no quote to resend' };
    j.resent = (j.resent || 0) + 1;
    j.resentAt = new Date().toISOString();
    const html = q.quoteEmailHtml({
      co: CO, colors: COLORS, job: Object.assign({ date: 'October 27, 2026' }, j),
      testMode: TEST_MODE, testTo: TEST_TO, logoSrc: 'cid:logo', photosHtml: (j.photos || []).length ? '<img alt="site">' : '',
      link: (k) => '/exec?a=respond&id=' + encodeURIComponent(j.id) + '&ans=' + k
    });
    quoteOut(j, html);
  } else return { ok: false, err: 'Bad action' };
  return { ok: true, testMode: TEST_MODE, job: j };
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css', '.md': 'text/plain' };

function start(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (url.pathname === '/inbox') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(inbox));
      return;
    }
    if (url.pathname === '/exec') {
      if (req.method === 'GET' && url.searchParams.get('a') === 'respond') {
        const id = url.searchParams.get('id');
        const job = jobs.find((x) => x.id === id);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (!job) { res.end('<h1>Estimate not found</h1>'); return; }
        if (url.searchParams.get('done') === '1' || url.searchParams.get('ans') === 'C') {
          respond(job, Object.fromEntries(url.searchParams.entries()));
          res.end('<h1>Thank you</h1><p>' + q.escHtml(job.response.label) + '</p>');
          return;
        }
        res.end(q.responseFormHtml({
          co: CO, colors: COLORS, job, ans: url.searchParams.get('ans'), action: '/exec',
          labels: { A: 'Approved', B: 'Approved with changes', C: 'Declined', O: 'Question / other' },
          slots: ['Weekdays 8-12', 'Weekdays 12-5', 'Weekends', 'Anytime']
        }));
        return;
      }
      if (req.method === 'GET' && url.searchParams.get('a') === 'feedback') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          feedback: feedback.map((row) => ({ at: String(row.at || ''), role: String(row.role || ''), text: String(row.text || '') }))
        }));
        return;
      }
      if (req.method === 'POST') {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          let body;
          try { body = handle(JSON.parse(raw || '{}')); }
          catch (e) { body = { ok: false, err: String(e.message || e) }; }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, test: TEST_MODE, testMode: TEST_MODE, testTo: TEST_TO, root: 'https://drive.google.com/drive/folders/scc-root', jobs, blocks, settings, gallery }));
      return;
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] && process.argv[1].endsWith('mock-server.mjs')) {
  const port = Number(process.env.PORT || 8765);
  start(port).then(() => console.log('mock http://127.0.0.1:' + port + '/?api=http://127.0.0.1:' + port + '/exec'));
}

export { start, inbox, seed, armMeasure, armFill };
