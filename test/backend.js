var TEST_MODE = false; // single server flag — keep identical to config.js TEST_MODE
var TEST_TO = 'austin@techsourcedsolutions.com';
var ROOT_NAME = 'Southern Concrete Coatings';
var CO = {
  name: 'Southern Concrete Coatings',
  legal: 'Southern Concrete Coatings LLC',
  addr: 'Tallahassee, FL',
  phone: '(850) 766-9992',
  email: 'mccardlematt@yahoo.com',
  web: 'www.southernconcretecoatingsllc.com',
  site: 'https://www.southernconcretecoatingsllc.com/'
};
var COLORS = { n: '#3a415c', g: '#424866', dg: '#2a3148' };
var LOGO = '__LOGO_DATA_URL__';;
var LABELS = { A: 'Approved', B: 'Approved with changes', C: 'Declined', O: 'Question / other' };
var SLOTS = ['Weekdays 8-12', 'Weekdays 12-5', 'Weekends', 'Anytime'];

function root_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('ROOT');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(ROOT_NAME);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_NAME);
  p.setProperty('ROOT', f.getId());
  return f;
}
function file_(n) {
  var r = root_(), it = r.getFilesByName(n);
  return it.hasNext() ? it.next() : r.createFile(n, '[]', 'application/json');
}
function load_(n) { return JSON.parse(file_(n || 'jobs.json').getBlob().getDataAsString() || '[]'); }
function save_(j, n) { file_(n || 'jobs.json').setContent(JSON.stringify(j)); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(s) { return String(s || '').replace(/[\\\/]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); }
function folder_(j) {
  var r = root_();
  if (j.folderId) { try { return DriveApp.getFolderById(j.folderId); } catch (e) {} }
  var n = clean_(j.id) + ' - ' + clean_(j.name) + ' - ' + clean_(j.address);
  var it = r.getFoldersByName(n);
  var f = it.hasNext() ? it.next() : r.createFolder(n);
  j.folder = f.getUrl();
  j.folderId = f.getId();
  return f;
}
function savePhotos_(j, list, kind) {
  var f = folder_(j);
  return (list || []).map(function (d, i) {
    var b = Utilities.newBlob(Utilities.base64Decode(String(d).split(',')[1]), 'image/jpeg', kind + '-' + Date.now() + '-' + i + '.jpg');
    var x = f.createFile(b);
    x.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { id: x.getId(), url: 'https://drive.google.com/thumbnail?id=' + x.getId() + '&sz=w1200', kind: kind };
  });
}
function estNo_() {
  var p = PropertiesService.getScriptProperties(), y = new Date().getFullYear(), k = 'EST' + y;
  var n = Number(p.getProperty(k) || 0) + 1;
  p.setProperty(k, String(n));
  return 'SCC-EST-' + y + '-' + ('000' + n).slice(-4);
}
function today_() { return Utilities.formatDate(new Date(), 'America/New_York', 'MMMM d, yyyy'); }
function view_(j) {
  var o = JSON.parse(JSON.stringify(j));
  o.date = today_();
  delete o.hardness;
  delete o.hardnessHow;
  delete o.internalNotes;
  delete o.aiNote;
  delete o.phone2;
  delete o.contact2;
  delete o.callAnswers;
  delete o.smsReminded;
  return o;
}
function logoBlob_() {
  return Utilities.newBlob(Utilities.base64Decode(LOGO.split(',')[1]), 'image/png', 'logo.png');
}
function imgs_(ps, pre) {
  var inl = {}, h = '';
  (ps || []).forEach(function (p, i) {
    if (!p.id) return;
    inl[pre + i] = DriveApp.getFileById(p.id).getBlob();
    h += '<img src="cid:' + pre + i + '" alt="" style="width:48%;max-width:290px;border-radius:8px;margin:4px 1%;display:inline-block">';
  });
  return { inl: inl, h: h };
}
function respUrl_(j, k) {
  return ScriptApp.getService().getUrl() + '?a=respond&id=' + encodeURIComponent(j.id) + '&ans=' + k;
}
function envelope_(j) {
  var env = deliveryAddress(TEST_MODE, TEST_TO, j && j.email, CO.email);
  if (TEST_MODE && (env.to !== TEST_TO || env.replyTo !== TEST_TO)) {
    throw new Error('Test mode blocked a send that was not addressed only to ' + TEST_TO);
  }
  return env;
}
function sendMail_(msg) {
  var env = envelope_(msg.job);
  if (!env.to) return;
  var payload = {
    to: env.to,
    replyTo: env.replyTo,
    name: msg.name || CO.name,
    subject: (TEST_MODE ? 'TEST - ' : '') + msg.subject,
    htmlBody: msg.html
  };
  if (msg.body) payload.body = msg.body;
  if (msg.inlineImages) payload.inlineImages = msg.inlineImages;
  if (msg.attachments) payload.attachments = msg.attachments;
  if (msg.quote && !TEST_MODE) {
    var bcc = quoteBcc_(settings_().quoteBcc);
    if (bcc && bcc.toLowerCase() !== String(env.to || '').toLowerCase()) payload.bcc = bcc;
  }
  MailApp.sendEmail(payload);
}
function mailOpts_(j) {
  return { co: CO, colors: COLORS, job: view_(j), testMode: TEST_MODE, testTo: TEST_TO, logoSrc: 'cid:logo', settings: settings_() };
}
function makePdf_(j) {
  var html = pdfHtml(Object.assign(mailOpts_(j), { logoSrc: LOGO }));
  var b = Utilities.newBlob(html, 'text/html', 'estimate.html').getAs('application/pdf').setName('Southern Concrete Coatings Estimate ' + j.est + '.pdf');
  var f = folder_(j).createFile(b);
  j.pdf = f.getUrl();
  j.pdfId = f.getId();
  return b;
}
function customerOk_(j) {
  if (j.email && !validEmail(j.email)) throw new Error('That customer email does not look valid.');
}
function sendQuote_(j) {
  customerOk_(j);
  var im = imgs_(j.photos, 'q');
  im.inl.logo = logoBlob_();
  var pdf = null;
  if (j.pdfId) { try { pdf = DriveApp.getFileById(j.pdfId).getBlob().setName('Southern Concrete Coatings Estimate ' + j.est + '.pdf'); } catch (e) { pdf = null; } }
  if (!pdf) pdf = makePdf_(j);
  var copy = quoteEmailCopy(mailOpts_(j));
  j.emailed = !!envelope_(j).to;
  if (!j.emailed) return;
  sendMail_({
    job: j,
    quote: true,
    subject: copy.subject,
    html: quoteEmailHtml(Object.assign(mailOpts_(j), { photosHtml: im.h, link: function (k) { return respUrl_(j, k); } })),
    inlineImages: im.inl,
    attachments: [pdf]
  });
}
function sendRecap_(j) {
  customerOk_(j);
  var ib = imgs_((j.crew || []).filter(function (p) { return p.kind === 'before'; }), 'b');
  var ia = imgs_((j.crew || []).filter(function (p) { return p.kind === 'after'; }), 'a');
  var inl = { logo: logoBlob_() }, k;
  for (k in ib.inl) inl[k] = ib.inl[k];
  for (k in ia.inl) inl[k] = ia.inl[k];
  sendMail_({
    job: j,
    subject: 'Your floor is done - Southern Concrete Coatings',
    html: recapEmailHtml(Object.assign(mailOpts_(j), { beforeHtml: ib.h, afterHtml: ia.h })),
    inlineImages: inl
  });
}
function sendInvoice_(j) {
  customerOk_(j);
  sendMail_({
    job: j,
    subject: 'Invoice from Southern Concrete Coatings - ' + (j.invoice && j.invoice.amount || ''),
    html: invoiceEmailHtml(mailOpts_(j)),
    inlineImages: { logo: logoBlob_() }
  });
}
function respond_(j, p) {
  j.response = {
    ans: p.ans,
    label: LABELS[p.ans] || p.ans,
    text: p.text || '',
    avail: p.avail || '',
    when: p.when || '',
    at: new Date().toISOString()
  };
  j.status = (p.ans === 'A' || p.ans === 'B') ? 'approved' : (p.ans === 'C' ? 'declined' : 'reply');
}
function page_(body) {
  var css = 'body{margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#212020}.w{max-width:520px;margin:0 auto;padding:18px}';
  return HtmlService.createHtmlOutput(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style>' +
    '<div style="background:' + COLORS.n + ';color:#fff;padding:14px 18px;font-weight:bold;font-size:18px">Southern Concrete Coatings</div>' +
    (TEST_MODE ? '<div style="background:#fff3cd;color:#5c4300;padding:10px 14px;font-weight:bold">Test mode — messages about this estimate go only to ' + TEST_TO + '</div>' : '') +
    '<div class="w">' + body + '</div>'
  ).setTitle('Southern Concrete Coatings').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

var OWNER_PIN = '1234';
function pinOk_(d) { return String(d && d.pin || '') === OWNER_PIN; }
function loadObj_(n) {
  var raw = '';
  try { raw = file_(n).getBlob().getDataAsString() || ''; } catch (e) { raw = ''; }
  if (!raw || raw === '[]') return {};
  try {
    var o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    return o;
  } catch (e2) { return {}; }
}
function quoteBcc_(raw) {
  var s = String(raw == null ? '' : raw).trim().slice(0, 120);
  if (/^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(s)) return s;
  return 'mccardlematt@yahoo.com';
}
function settings_() {
  var o = loadObj_('settings.json');
  var min = o.finMin == null || o.finMin === '' ? 1000 : Number(String(o.finMin).replace(/[^0-9.\-]/g, ''));
  if (isNaN(min)) min = 1000;
  return {
    payLink: String(o.payLink || ''), reviewLink: String(o.reviewLink || ''), finLink: String(o.finLink || ''), finMin: min, ocr: o.ocr === false ? false : true, qbo: qboPublic_(),
    form: normalizeForm(o.form), mileRate: mileRate_(o.mileRate), theme: o.theme === 'classic' ? 'classic' : 'dark',
    quoteBody: String(o.quoteBody || ''), quoteSubject: String(o.quoteSubject || ''), quoteSign: String(o.quoteSign || ''),
    quoteBcc: quoteBcc_(o.quoteBcc),
    galleryHide: galleryHide_(o.galleryHide),
    reminders: reminderCfg_(o),
    texts: smsCfg_(o),
    voice: !!scriptProp_('GEMINI_API_KEY')
  };
}
function moneyNum_(v) {
  var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function hardnessVal_(v) {
  if (v == null || String(v).trim() === '') return '';
  var n = Number(v);
  if (n !== Math.floor(n) || n < 1 || n > 10) return null;
  return n;
}
function expenses_() {
  var list = load_('expenses.json');
  return Array.isArray(list) ? list : [];
}
function receiptsFolder_() {
  var r = root_();
  var it = r.getFoldersByName('Receipts');
  return it.hasNext() ? it.next() : r.createFolder('Receipts');
}
function galleryFolder_() {
  var r = root_();
  var it = r.getFoldersByName('Gallery');
  return it.hasNext() ? it.next() : r.createFolder('Gallery');
}
function gallery_() {
  var list = load_('gallery.json');
  return Array.isArray(list) ? list : [];
}
function galleryHide_(v) {
  var a = Array.isArray(v) ? v : [];
  var out = [], seen = {};
  for (var i = 0; i < a.length && out.length < 200; i++) {
    var id = String(a[i] || '').trim().slice(0, 80);
    if (!id || seen[id] || id.indexOf('sim-') !== 0) continue;
    seen[id] = 1;
    out.push(id);
  }
  return out;
}
function e164_(raw) {
  var d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.charAt(0) === '1') return '+' + d;
  return '';
}
function questionsFrom_(list) {
  var fallback = [{ text: 'Will the driveway or work area be cleared before we arrive?', type: 'yesno' }];
  if (!Array.isArray(list)) return fallback;
  var out = [], i, text, type;
  for (i = 0; i < list.length && out.length < 8; i++) {
    text = String((list[i] && list[i].text) || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!text) continue;
    type = list[i] && list[i].type === 'speech' ? 'speech' : 'yesno';
    out.push({ text: text, type: type });
  }
  return out;
}
function reminderCfg_(o) {
  var r = o && o.reminders;
  return {
    on: !!(r && r.on === true),
    test: !r || r.test !== false,
    testPhone: String((r && r.testPhone) || '').slice(0, 40),
    questions: (r && Array.isArray(r.questions)) ? questionsFrom_(r.questions) : questionsFrom_(null)
  };
}
function reminderDial_(s, customerPhone) {
  var on = !!(s && s.on);
  var test = !s || s.test !== false;
  var testPhone = e164_(s && s.testPhone);
  var cust = e164_(customerPhone);
  if (!on) return { skip: 'off' };
  if (test) {
    if (!testPhone) return { skip: 'no test number' };
    return { dial: testPhone, test: true };
  }
  if (!cust) return { skip: 'no phone' };
  return { dial: cust, test: false };
}
function guardDial_(choice, testPhone, customerPhone) {
  if (!choice || choice.skip || !choice.dial) return false;
  if (choice.test) return choice.dial === e164_(testPhone);
  return choice.dial === e164_(customerPhone);
}
function smsDefault24_() {
  return "Hi {name}, this is Southern Concrete Coatings. Reminder: we're scheduled for estimate {est} ({work}) at {address} on {date} at {time}. See you then!";
}
function smsDefaultDay_() {
  return "Hey {name}, Southern Concrete Coatings here. We're on the way today at {time} for estimate {est} ({work}).";
}
function smsOld24_() {
  return "Hi {name}, this is Southern Concrete Coatings. Reminder: we're scheduled at {address} on {date} at {time}. See you then!";
}
function smsOldDay_() {
  return "Hey {name}, Southern Concrete Coatings here, we're on the way for your {time} appointment today.";
}
function smsStored_(raw, fallback, old) {
  var s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s || s === old) return fallback;
  return s.slice(0, 480);
}
function smsCfg_(o) {
  var t = o && o.texts;
  var calls = o && o.reminders;
  var phone = String((t && t.testPhone) || '').trim();
  if (!phone) phone = String((calls && calls.testPhone) || '').trim();
  if (!phone) phone = '8504453792';
  var t24 = String((t && t.t24) || '').replace(/\s+/g, ' ').trim();
  var day = String((t && t.dayof) || '').replace(/\s+/g, ' ').trim();
  return {
    on: !!(t && t.on === true),
    test: !t || t.test !== false,
    testPhone: phone.slice(0, 40),
    t24: smsStored_(t24, smsDefault24_(), smsOld24_()),
    dayof: smsStored_(day, smsDefaultDay_(), smsOldDay_())
  };
}
function smsDial_(s, customerPhone) {
  var on = !!(s && s.on);
  var test = !s || s.test !== false;
  var testPhone = e164_(s && s.testPhone);
  var cust = e164_(customerPhone);
  if (!on) return { skip: 'off' };
  if (test) {
    if (!testPhone) return { skip: 'no test number' };
    return { dial: testPhone, test: true };
  }
  if (!cust) return { skip: 'no phone' };
  return { dial: cust, test: false };
}
function smsBit_(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 80);
}
function smsEst_(raw) {
  var est = smsBit_(raw, 40);
  var m = est.match(/^SCC-EST-\d{4}-(\d+)$/i);
  if (m) return 'EST-' + m[1];
  return est;
}
function smsSq_(sqft) {
  if (sqft == null || String(sqft).trim() === '') return '';
  var n = Number(String(sqft).replace(/,/g, ''));
  if (!isFinite(n) || n <= 0) return '';
  var r = Math.round(n * 10) / 10;
  var s = String(r);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  var parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.') + ' sq ft';
}
function smsWork_(system, sqft) {
  var name = smsBit_(system, 80);
  var area = smsSq_(sqft);
  if (name && area) return (name + ', ' + area).slice(0, 140);
  return (name || area).slice(0, 140);
}
function smsTidy_(text) {
  var s = String(text || '');
  s = s.replace(/\(\s*\)/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\bestimate\s+\(/gi, '(');
  s = s.replace(/\bestimate\s+(at|on|for)\b/gi, '$1');
  s = s.replace(/\bestimate\s*([.!?])/gi, '$1');
  s = s.replace(/\s+for\s*([.!?])/gi, '$1');
  s = s.replace(/\s+for\s+(at|on)\b/gi, ' $1');
  s = s.replace(/\bat\s+on\b/gi, 'on');
  s = s.replace(/\bon\s+at\b/gi, 'at');
  s = s.replace(/\bat\s+at\b/gi, 'at');
  s = s.replace(/\bat\s*([.!?])/gi, '$1');
  s = s.replace(/\s+,/g, ',');
  s = s.replace(/,\s*,/g, ',');
  s = s.replace(/\(\s+/g, '(');
  s = s.replace(/\s+\)/g, ')');
  s = s.replace(/\s+([.!?])/g, '$1');
  s = s.replace(/\s{2,}/g, ' ');
  return s.trim();
}
function smsFill_(template, fields) {
  var f = fields || {};
  var map = {
    name: smsBit_(f.name, 80),
    address: smsBit_(f.address, 120),
    date: smsBit_(f.date, 60),
    time: smsBit_(f.time, 20),
    est: smsBit_(f.est, 40),
    work: smsBit_(f.work, 140)
  };
  var text = String(template || '');
  text = text.replace(/\{(name|address|date|time|est|work)\}/gi, function (_, key) { return map[String(key).toLowerCase()] || ''; });
  text = text.replace(/\{hardnessHow\}/gi, '').replace(/\{hardness\}/gi, '').replace(/\{internalNotes\}/gi, '').replace(/\{notes\}/gi, '');
  return smsTidy_(text).slice(0, 480);
}
function smsSendAtMs_(startMs, sevenMs) {
  var two = Number(startMs) - 2 * 36e5;
  if (sevenMs == null || isNaN(Number(sevenMs))) return two;
  return Math.min(two, Number(sevenMs));
}
function smsDayDue_(startMs, sevenMs, nowMs) {
  var sendAt = smsSendAtMs_(startMs, sevenMs);
  var now = Number(nowMs);
  if (now < sendAt || now >= Number(startMs)) return false;
  return now - sendAt <= 2 * 36e5;
}
function reminderDue_(startMs, nowMs) {
  var h = (Number(startMs) - Number(nowMs)) / 36e5;
  return h >= 20 && h <= 28;
}
function reminderSay_(jobName, dateLabel, timeLabel, address) {
  var line = 'Hi, this is Southern Concrete Coatings reminding you of your appointment for ' + (jobName || 'your floor') + ' on ' + dateLabel + ' at ' + timeLabel;
  address = String(address || '').replace(/\s+/g, ' ').trim();
  if (address) line += ' at ' + address;
  line += '. Call us if you need to reschedule.';
  return line;
}
function manualSay_() {
  return 'This is Southern Concrete Coatings calling with a reminder about your upcoming service. Call us with any questions.';
}
function xmlEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function reminderTwiml_(text) {
  return '<Response><Say voice="alice">' + xmlEsc_(text) + '</Say></Response>';
}
function goodbyeTwiml_() {
  return '<Say voice="alice">' + xmlEsc_('Thanks, see you then. Call us if anything changes.') + '</Say>';
}
function questionPrompt_(q) {
  var line = String(q && q.text || '').replace(/\s+/g, ' ').trim();
  if (!q || q.type !== 'speech') line += ' Press 1 for yes, 2 for no.';
  line += ' Press 0 to request a callback.';
  return line.replace(/\s+/g, ' ').trim();
}
function voiceMsg_(jobId, logId, qIndex) {
  return String(jobId || '') + '|' + String(logId || '') + '|' + String(qIndex);
}
function voiceToken_(jobId, logId, qIndex, secret, sign) {
  return sign(voiceMsg_(jobId, logId, qIndex), String(secret || ''));
}
function voiceOk_(jobId, logId, qIndex, token, secret, sign) {
  if (!secret || !token || !sign) return false;
  return voiceToken_(jobId, logId, qIndex, secret, sign) === String(token);
}
function voiceUrl_(base, jobId, logId, qIndex, token) {
  var b = String(base || '').replace(/\?.*$/, '').replace(/\/$/, '');
  return b + '?a=twvoice&job=' + encodeURIComponent(jobId || '') + '&log=' + encodeURIComponent(logId || '') + '&q=' + encodeURIComponent(String(qIndex)) + '&tok=' + encodeURIComponent(token || '');
}
function gatherXml_(q, action) {
  return '<Gather input="dtmf speech" numDigits="1" timeout="6" speechTimeout="auto" method="GET" action="' + xmlEsc_(action) + '"><Say voice="alice">' + xmlEsc_(questionPrompt_(q)) + '</Say></Gather>';
}
function openingTwiml_(intro, questions, action) {
  var qs = Array.isArray(questions) ? questions : [];
  var xml = '<Response>';
  if (intro) xml += '<Say voice="alice">' + xmlEsc_(intro) + '</Say>';
  if (qs.length && action) xml += gatherXml_(qs[0], action);
  xml += goodbyeTwiml_();
  xml += '</Response>';
  return xml;
}
function callTwiml_(intro, questions, jobId, logId, secret, base, sign) {
  var qs = Array.isArray(questions) ? questions : [];
  var action = '';
  if (qs.length && base && secret && sign) action = voiceUrl_(base, jobId, logId, 0, voiceToken_(jobId, logId, 0, secret, sign));
  return openingTwiml_(intro, qs, action);
}
function voiceAnswer_(type, digits, speech) {
  var d = String(digits == null ? '' : digits).replace(/\D/g, '');
  var key = d ? d.charAt(0) : '';
  var said = String(speech == null ? '' : speech).replace(/\s+/g, ' ').trim().slice(0, 500);
  var low = said.toLowerCase();
  if (key === '0') return { answer: '', callback: true };
  if (low && /\b(callback|call me back)\b/.test(low) && (type === 'speech' ? said.length < 40 : true)) return { answer: '', callback: true };
  if (type === 'speech') return said ? { answer: said, callback: false } : null;
  if (key === '1') return { answer: 'yes', callback: false };
  if (key === '2') return { answer: 'no', callback: false };
  if (low && /\b(no|nope)\b/.test(low)) return { answer: 'no', callback: false };
  if (low && /\b(yes|yeah|yep)\b/.test(low)) return { answer: 'yes', callback: false };
  return null;
}
function voiceRejectTwiml_() {
  return '<Response><Say voice="alice">Sorry, this reminder cannot continue.</Say><Hangup/></Response>';
}
function voiceStep_(opts) {
  var o = opts || {};
  var jobId = String(o.jobId || '');
  var logId = String(o.logId || '');
  var qIndex = parseInt(o.q, 10);
  var sign = o.sign;
  if (!sign || isNaN(qIndex) || qIndex < 0 || qIndex > 20 || !voiceOk_(jobId, logId, qIndex, o.tok, o.secret, sign)) {
    return { ok: false, twiml: voiceRejectTwiml_(), save: null };
  }
  var qs = Array.isArray(o.questions) ? o.questions : [];
  var question = qs[qIndex];
  if (!question) return { ok: true, twiml: '<Response>' + goodbyeTwiml_() + '</Response>', save: null };
  var parsed = voiceAnswer_(question.type, o.digits, o.speech);
  var save = null;
  if (parsed && (parsed.answer || parsed.callback)) {
    save = {
      q: question.text,
      type: question.type === 'speech' ? 'speech' : 'yesno',
      answer: parsed.answer || '',
      callback: !!parsed.callback
    };
  }
  var next = qIndex + 1;
  if (next >= qs.length || !o.base) return { ok: true, twiml: '<Response>' + goodbyeTwiml_() + '</Response>', save: save };
  var action = voiceUrl_(o.base, jobId, logId, next, voiceToken_(jobId, logId, next, o.secret, sign));
  return { ok: true, twiml: '<Response>' + gatherXml_(qs[next], action) + goodbyeTwiml_() + '</Response>', save: save };
}
function reminderFinal_(status) {
  var s = String(status || '');
  return s === 'completed' || s === 'busy' || s === 'failed' || s === 'no-answer' || s === 'canceled';
}
function scriptProp_(name) {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(name);
    return v ? String(v) : '';
  } catch (eProp) { return ''; }
}
function geminiModel_() {
  return scriptProp_('GEMINI_MODEL') || 'gemini-3.8-flash';
}
function geminiConfig_(model) {
  var gen = { responseMimeType: 'application/json' };
  if (/gemini-[34]/.test(String(model || '')) || model === 'gemini-flash-latest') gen.thinkingConfig = { thinkingLevel: 'low' };
  return gen;
}
function clipErr_(body, key) {
  var s = String(body || '').replace(/\s+/g, ' ').trim();
  if (key) s = s.split(key).join('[redacted]');
  return s.slice(0, 200);
}
function geminiFetch_(key, model, parts) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { 'x-goog-api-key': key },
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: parts }],
      generationConfig: geminiConfig_(model)
    })
  });
  return { code: res.getResponseCode(), body: res.getContentText() || '' };
}
function geminiWalk_(model, fetchModel, sleep) {
  var waits = [0, 1000, 3000];
  var last = { code: 0, body: '' };
  var i;
  for (i = 0; i < waits.length; i++) {
    if (waits[i] && sleep) sleep(waits[i]);
    try { last = fetchModel(model) || { code: 0, body: '' }; }
    catch (eTry) { last = { code: 0, body: '' }; }
    if (last.code >= 200 && last.code < 300) return last;
    if (!(last.code === 429 || last.code === 500 || last.code === 503 || last.code === 0)) break;
  }
  if (model === 'gemini-flash-latest') return last;
  try { last = fetchModel('gemini-flash-latest') || last; }
  catch (eAlt) {}
  return last;
}
function geminiGenerate_(key, parts) {
  return geminiWalk_(geminiModel_(), function (model) { return geminiFetch_(key, model, parts); }, function (ms) { Utilities.sleep(ms); });
}
function normalizeMeasure_(raw) {
  var o = raw;
  if (typeof raw === 'string') {
    var t = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    var start = t.indexOf('{'), end = t.lastIndexOf('}');
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
    try { o = JSON.parse(t); } catch (eJson) { return null; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  function num(v) {
    var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    if (isNaN(n) || n <= 0 || n > 100000) return null;
    return Math.round(n * 10) / 10;
  }
  var lengthFt = num(o.lengthFt != null ? o.lengthFt : o.length);
  var widthFt = num(o.widthFt != null ? o.widthFt : o.width);
  var sqft = num(o.sqft != null ? o.sqft : (o.squareFeet != null ? o.squareFeet : o.area));
  if (!sqft && lengthFt && widthFt) sqft = Math.round(lengthFt * widthFt * 10) / 10;
  if (!sqft) return null;
  var conf = String(o.confidence || 'low').toLowerCase();
  if (conf !== 'low' && conf !== 'medium' && conf !== 'high') conf = 'low';
  var note = String(o.note || o.reasoning || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  return { lengthFt: lengthFt, widthFt: widthFt, sqft: Math.round(sqft), confidence: conf, note: note };
}
function geminiText_(parsed) {
  var c = parsed && parsed.candidates && parsed.candidates[0];
  var parts = (c && c.content && c.content.parts) || [];
  var text = '';
  for (var i = 0; i < parts.length; i++) if (parts[i] && parts[i].text && !parts[i].thought) text += parts[i].text;
  return text;
}
function measureFail_() {
  return { ok: true, ready: false, message: 'Could not measure that photo. Enter the square footage by hand.' };
}
function measureFloor_(images, known) {
  // GEMINI_API_KEY and optional GEMINI_MODEL are Script Properties. Never paste the key into this file.
  var key = scriptProp_('GEMINI_API_KEY');
  if (!key) return { ok: true, ready: false, message: 'AI measuring not set up yet' };
  var shots = Array.isArray(images) ? images : (images ? [images] : []);
  var parts = [];
  var prompt = 'You measure concrete floors from photos for a coatings contractor. Estimate the floor length, width, and area in feet and square feet. Use reference cues when they are visible: a single-car garage door is about 8 or 9 feet wide, a double-car garage door is about 16 feet wide, a typical car is about 6 feet wide and 14 to 16 feet long, and count the bays. If the contractor gives one known dimension, trust it and scale the other dimension from the photo. Return JSON with keys lengthFt, widthFt, sqft, confidence (low, medium, or high), and note. The note is one or two sentences on the cues you used. Do not include a price.';
  var knownText = String(known || '').trim().slice(0, 200);
  if (knownText) prompt += ' Known dimension from the contractor: ' + knownText;
  for (var i = 0; i < shots.length && parts.length < 4; i++) {
    var s = String(shots[i] || '');
    var m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!m || m[2].length > 2000000) continue;
    parts.push({ inline_data: { mime_type: m[1], data: m[2].replace(/\s/g, '') } });
  }
  if (!parts.length) return { ok: true, ready: false, message: 'Add a photo of the floor first' };
  parts.unshift({ text: prompt });
  var gotFetch = geminiGenerate_(key, parts);
  if (!gotFetch || gotFetch.code < 200 || gotFetch.code >= 300) return measureFail_();
  var parsed;
  try { parsed = JSON.parse(gotFetch.body); } catch (eParse) { return measureFail_(); }
  var got = normalizeMeasure_(geminiText_(parsed));
  if (!got) return measureFail_();
  return { ok: true, ready: true, sqft: got.sqft, lengthFt: got.lengthFt, widthFt: got.widthFt, confidence: got.confidence, note: got.note };
}
function normalizeFill_(raw) {
  var o = raw;
  if (typeof o === 'string') {
    var t = o.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    var start = t.indexOf('{'), end = t.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { o = JSON.parse(t.slice(start, end + 1)); } catch (eJson) { return null; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.fields && typeof o.fields === 'object' && !Array.isArray(o.fields)) o = o.fields;
  var out = {};
  function text(v, n) {
    if (v == null) return '';
    return String(v).replace(/[ \t]+/g, ' ').trim().slice(0, n || 400);
  }
  function put(k, v, n) {
    var s = text(v, n);
    if (s) out[k] = s;
  }
  put('name', o.name || o.customer || o.customerName, 120);
  put('phone', o.phone || o.customerPhone, 40);
  put('email', o.email || o.customerEmail, 120);
  put('address', o.address || o.customerAddress, 200);
  var sqRaw = o.sqft != null ? o.sqft : (o.squareFeet != null ? o.squareFeet : o.sqFt);
  if (sqRaw != null && String(sqRaw).trim() !== '') {
    var nsq = Number(String(sqRaw).replace(/[^0-9.]/g, ''));
    if (!isNaN(nsq) && nsq > 0 && nsq < 1000000) out.sqft = Math.round(nsq);
  }
  put('system', o.system || o.coating || o.coatingType, 80);
  put('color', o.color || o.flake || o.flakeColor, 80);
  var prep = o.prep != null ? o.prep : o.preparation;
  if (Array.isArray(prep)) prep = prep.map(function (x) { return text(x, 60); }).filter(Boolean).join(', ');
  put('prep', prep, 240);
  put('cure', o.cure || o.returnToService, 80);
  var rateRaw = o.rate != null ? o.rate : (o.pricePerSqft != null ? o.pricePerSqft : (o.pricePerSqFt != null ? o.pricePerSqFt : o.pricePerSquareFoot));
  if (rateRaw != null && String(rateRaw).trim() !== '') {
    var nr = Number(String(rateRaw).replace(/[^0-9.]/g, ''));
    if (!isNaN(nr) && nr > 0 && nr < 10000) out.rate = Math.round(nr * 100) / 100;
  }
  var vRaw = o.vertical != null ? o.vertical : o.verticalFeet;
  if (vRaw != null && String(vRaw).trim() !== '') {
    var nvf = Number(String(vRaw).replace(/[^0-9.]/g, ''));
    if (!isNaN(nvf) && nvf > 0 && nvf < 100000) out.vertical = Math.round(nvf * 10) / 10;
  }
  var vrRaw = o.vrate != null ? o.vrate : (o.verticalRate != null ? o.verticalRate : o.verticalCost);
  if (vrRaw != null && String(vrRaw).trim() !== '') {
    var nvr = Number(String(vrRaw).replace(/[^0-9.]/g, ''));
    if (!isNaN(nvr) && nvr > 0 && nvr < 10000) out.vrate = Math.round(nvr * 100) / 100;
  }
  put('timeline', o.timeline, 160);
  put('notes', o.notes, 800);
  var extras = o.extras != null ? o.extras : (o.extra != null ? o.extra : o.addOns);
  if (Array.isArray(extras)) {
    var lines = extras.map(function (x) {
      if (x == null) return '';
      if (typeof x !== 'object') return text(x, 200);
      var title = text(x.title || x.name, 120);
      var detail = text(x.detail || '', 200);
      var price = (x.price == null || x.price === '') ? '' : text(x.price, 20);
      return [title, detail, price].filter(Boolean).join(' - ');
    }).filter(Boolean);
    if (lines.length) out.extras = lines.join('\n').slice(0, 800);
  } else put('extras', extras, 800);
  var jobType = snapJobType_(o.jobType || o.job || o.place || '');
  if (jobType) out.jobType = jobType;
  var system = snapList_(o.system || o.coating || o.coatingType || out.system, FILL_SYSTEMS);
  if (system) out.system = system;
  var color = snapColor_(o.color || o.flake || o.flakeColor || out.color);
  if (color) out.color = color;
  var prep = snapPrep_(o.prep != null ? o.prep : (out.prep || ''));
  if (prep) out.prep = prep;
  var cure = snapList_(o.cure || o.returnToService || out.cure, FILL_CURES);
  if (cure) out.cure = cure;
  var hard = hardnessVal_(o.hardness);
  if (hard) out.hardness = hard;
  if (Array.isArray(o.items)) {
    var lines = o.items.map(function (x) {
      if (!x || typeof x !== 'object') return null;
      var title = text(x.title || x.name, 160);
      if (!title) return null;
      var price = (x.price == null || x.price === '') ? null : Number(String(x.price).replace(/[^0-9.\-]/g, ''));
      if (price != null && isNaN(price)) price = null;
      return { title: title, detail: text(x.detail || '', 400), price: price };
    }).filter(Boolean).slice(0, 20);
    if (lines.length) out.items = lines;
  }
  return Object.keys(out).length ? out : null;
}
var FILL_SYSTEMS = ['Garage floor flake system', 'Full Flake Broadcast System', 'Acid Stain and Seal', 'Grind and Seal', 'Metallic epoxy', 'Solid color epoxy', 'Polyaspartic system', 'Polyurea garage system', 'Quartz broadcast', 'Pool deck coating', 'Patio and porch coating', 'Commercial kitchen floor', 'Warehouse / industrial floor', 'Concrete sealing', 'Grind and prep only', 'Crack and spall repair'];
var FILL_PREPS = ['Diamond grinding', 'Crack repair', 'Spall / patch repair', 'Moisture mitigation', 'Oil stain treatment', 'Joint fill', 'Coating removal'];
var FILL_CURES = ['Same-day return', '24 hours', '48 hours', '72 hours', '5-7 days'];
var FILL_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
function fillWord_(w) {
  var s = String(w || '').toLowerCase();
  if (FILL_NUM[s] != null) return FILL_NUM[s];
  var n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}
function normWords_(s) {
  return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}
function snapList_(value, list) {
  var v = normWords_(value);
  if (!v || !list) return '';
  var i, best = '', score = 0;
  for (i = 0; i < list.length; i++) {
    var n = normWords_(list[i]);
    if (n === v) return list[i];
    var as = v.split(' '), bs = n.split(' '), s = 0, k;
    for (k = 0; k < as.length; k++) if (as[k].length > 2 && bs.indexOf(as[k]) >= 0) s++;
    if (n.indexOf(v) >= 0 || v.indexOf(n) >= 0) s += 2;
    if (s > score) { score = s; best = list[i]; }
  }
  return score ? best : '';
}
function snapColor_(value) {
  var raw = String(value || '').replace(/\s+/g, ' ').trim();
  var flat = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!flat) return '';
  if (flat.indexOf('wolf') >= 0 && flat.indexOf('gr') >= 0) return 'Wolf Gray';
  if (flat.indexOf('dominion') >= 0) return 'Dominion';
  return raw.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }).slice(0, 80);
}
function snapPrep_(value) {
  var src = Array.isArray(value) ? value.join(', ') : String(value || '');
  var low = src.toLowerCase();
  var out = [];
  var rules = [
    [/diamond\s*grind|\bgrind/, 'Diamond grinding'],
    [/crack/, 'Crack repair'],
    [/spall|\bpatch/, 'Spall / patch repair'],
    [/moisture|vapor/, 'Moisture mitigation'],
    [/\boil\b/, 'Oil stain treatment'],
    [/joint/, 'Joint fill'],
    [/removal|strip/, 'Coating removal']
  ];
  var i;
  for (i = 0; i < rules.length; i++) if (rules[i][0].test(low) && out.indexOf(rules[i][1]) < 0) out.push(rules[i][1]);
  if (!out.length) {
    var snapped = snapList_(src, FILL_PREPS);
    if (snapped) out.push(snapped);
  }
  return out.join(', ');
}
function snapJobType_(value) {
  var low = String(value || '').toLowerCase();
  if (/commercial|warehouse|shop|store|industrial/.test(low)) return 'Commercial';
  if (/house|home|residential/.test(low)) return 'Residential';
  return '';
}
function speechItems_(o) {
  var items = [];
  var sq = Number(o.sqft), rate = Number(o.rate);
  if (o.system) {
    var title = o.system + (sq ? ' — ' + sq + ' sq ft' : '');
    var detail = [];
    if (o.color) detail.push('Color / flake: ' + o.color + '.');
    if (o.prep) detail.push('Prep: ' + o.prep + '.');
    if (sq && rate) detail.push(sq + ' sq ft at $' + rate.toFixed(2) + ' per sq ft.');
    items.push({ title: title, detail: detail.join(' '), price: (sq > 0 && rate > 0) ? Math.round(sq * rate * 100) / 100 : null });
  }
  String(o.prep || '').split(',').forEach(function (p) {
    p = p.trim();
    if (p) items.push({ title: p, detail: p + '.', price: null });
  });
  return items;
}
function interpretSpeech_(text) {
  var raw = String(text || '').replace(/\s+/g, ' ').trim();
  var low = raw.toLowerCase();
  var out = {};
  if (!raw) return out;
  var sq = raw.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*-?\s*ft|sqft|square\s*feet|sq\.?\s*feet|\bsf\b)/i);
  var looseFt = false;
  if (!sq) { sq = raw.match(/\b(\d[\d,]*)\s*ft\b/i); looseFt = !!sq; }
  if (sq) {
    var around = raw.slice(Math.max(0, sq.index - 16), sq.index + sq[0].length + 16);
    if (!(looseFt && /vertical/i.test(around))) {
      var nsq = parseFloat(sq[1].replace(/,/g, ''));
      if (nsq >= 40 && nsq < 1000000) out.sqft = Math.round(nsq);
    }
  }
  if (typeof parseVertical === 'function') {
    var vertFt = parseVertical(raw);
    if (vertFt) out.vertical = vertFt;
    var vertRate = parseVerticalRate(raw);
    if (vertRate) out.vrate = vertRate;
  }
  if (/acid\s*stain/.test(low)) out.system = 'Acid Stain and Seal';
  else if (/grind and seal|grind & seal/.test(low)) out.system = 'Grind and Seal';
  else if (/grind and prep only|grind & prep|prep only/.test(low)) out.system = 'Grind and prep only';
  else if (/full\s+flake\s+broadcast|full[-\s]?broadcast/.test(low)) out.system = 'Full Flake Broadcast System';
  else if (/polyaspartic/.test(low)) out.system = 'Polyaspartic system';
  else if (/polyurea/.test(low)) out.system = 'Polyurea garage system';
  else if (/\bmetallic\b/.test(low)) out.system = 'Metallic epoxy';
  else if (/\bquartz\b/.test(low)) out.system = 'Quartz broadcast';
  else if (/pool\s*deck/.test(low)) out.system = 'Pool deck coating';
  else if (/\bkitchen\b/.test(low)) out.system = 'Commercial kitchen floor';
  else if (/warehouse|industrial/.test(low)) out.system = 'Warehouse / industrial floor';
  else if (/\bpatio\b|\bporch\b/.test(low)) out.system = 'Patio and porch coating';
  else if (/\bflake\b|\bchip\b/.test(low) && !/color flake|flake color|flake will be/.test(low)) out.system = 'Garage floor flake system';
  else if (/\bseal/.test(low)) out.system = 'Concrete sealing';
  else if (/\bsolid\b/.test(low)) out.system = 'Solid color epoxy';
  if (/wolf\s*gr[ae]y/.test(low)) out.color = 'Wolf Gray';
  else if (/\bdominion\b/.test(low)) out.color = 'Dominion';
  var prep = snapPrep_(low);
  if (prep) out.prep = prep;
  var rateTail = low.split(/per\s+square\s+foot|price\s+per\s+square|a\s+square\s+foot/);
  var rateM = null;
  if (rateTail.length > 1) {
    var rateChunk = rateTail.slice(1).join(' ').split(/\b(?:hardness|harness|mohs)\b/)[0];
    var rateWords = rateChunk.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\b/g);
    if (rateWords && rateWords.length) rateM = [null, rateWords[rateWords.length - 1]];
  }
  if (!rateM) rateM = low.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\s*(?:dollars|bucks)?\s*(?:per|a)\s+(?:square\s+foot|sq(?:uare)?\.?\s*ft)/);
  if (rateM) {
    var nr = fillWord_(rateM[1]);
    if (nr > 0 && nr < 10000) out.rate = Math.round(nr * 100) / 100;
  }
  var hardM = low.match(/(?:hardnes+|harness|mohs)\D{0,24}(one|two|three|four|five|six|seven|eight|nine|ten|\d+)/);
  if (hardM) {
    var nh = fillWord_(hardM[1]);
    if (nh >= 1 && nh <= 10 && nh === Math.floor(nh)) out.hardness = nh;
  }
  var jt = snapJobType_(low);
  if (jt) out.jobType = jt;
  if (out.system || out.prep) out.items = speechItems_(out);
  return out;
}
function mergeFill_(base, extra) {
  var out = extra || {};
  var k;
  base = base || {};
  for (k in base) if (base[k] != null && base[k] !== '' && (out[k] == null || out[k] === '' || (k === 'items' && (!out.items || !out.items.length)))) out[k] = base[k];
  if ((!out.items || !out.items.length) && (out.system || out.prep)) out.items = speechItems_(out);
  return out;
}
function fillCount_(o) {
  var n = 0;
  ['name', 'phone', 'email', 'address', 'sqft', 'vertical', 'vrate', 'jobType', 'system', 'color', 'prep', 'cure', 'rate', 'notes', 'hardness'].forEach(function (k) {
    if (o && o[k] != null && String(o[k]).trim() !== '') n++;
  });
  if (o && o.items && o.items.length) n++;
  else if (o && o.extras) n++;
  return n;
}
function fillReady_(fields) {
  var n = fillCount_(fields);
  if (!n) return { ok: true, ready: false, message: 'Could not fill that in. The notes on this phone were used instead.' };
  return { ok: true, ready: true, filled: n, fields: fields };
}
function fillKeep_(form, fields) {
  var list = (form && form.fields) || [];
  var shown = {};
  var i;
  for (i = 0; i < list.length; i++) if (list[i] && list[i].id && list[i].show !== false) shown[list[i].id] = 1;
  var map = { notes: 'addl' };
  var keep = { items: 1, extras: 1, timeline: 1 };
  var out = {}, k, id;
  fields = fields || {};
  for (k in fields) {
    if (fields[k] == null || fields[k] === '') continue;
    if (k === 'internalNotes' || k === 'aiNote') continue;
    id = map[k] || k;
    if (keep[k] || !list.length || shown[id]) out[k] = fields[k];
  }
  if (!shown.hardness) delete out.hardnessHow;
  return out;
}
function quoteFill_(d) {
  // GEMINI_API_KEY and optional GEMINI_MODEL are Script Properties. Never paste the key into this file.
  // Nothing is saved or emailed here. The form is filled for review.
  var spoken = '', audio = '', mime = 'audio/webm';
  if (d && typeof d === 'object') {
    spoken = String(d.text || '').trim();
    audio = String(d.audio || '').replace(/^data:[^,]*,/, '');
    mime = String(d.mime || 'audio/webm').split(';')[0].trim().toLowerCase();
  } else spoken = String(d || '').trim();
  if (mime === 'audio/x-m4a' || mime === 'audio/m4a') mime = 'audio/mp4';
  if (!spoken && !audio) return { ok: true, ready: false, message: 'Say or type the job first.' };
  if (audio && audio.length > 14000000) return { ok: false, err: 'That recording is too long. Keep it under about 5 minutes.' };
  spoken = spoken.slice(0, 8000);
  var form = normalizeForm(settings_().form);
  FILL_SYSTEMS = form.systems.map(function (s) { return s.name; });
  FILL_PREPS = form.addons.map(function (a) { return a.name; });
  var colorList = form.colors.join(', ') || 'Wolf Gray, Dominion';
  var local = spoken ? interpretSpeech_(spoken) : {};
  var key = scriptProp_('GEMINI_API_KEY');
  if (!key) {
    if (!spoken) return { ok: true, ready: false, message: 'AI fill not set up yet' };
    var offline = fillReady_(fillKeep_(form, local));
    return offline.ready ? offline : { ok: true, ready: false, message: 'AI fill not set up yet' };
  }
  var prompt = 'You turn a contractor spoken note into a concrete coating estimate for Southern Concrete Coatings. The note may contain speech-to-text mistakes. Fix those before you answer. cutting means coating. harness means hardness, a Mohs number from 1 to 10. A floor size given in ft is square feet unless they say long, wide, door, or vertical. vertical is vertical feet, a number, only when the note says vertical. vrate is dollars per vertical foot. Do not count vertical feet as sqft. Return one JSON object and nothing else. Keys you may use: name, phone, email, address, sqft, vertical, vrate, jobType, system, color, prep, cure, rate, items, notes, hardness. sqft, rate, vrate, and hardness are numbers. jobType is Residential or Commercial. A house or home is Residential. system must be exactly one of: ' + FILL_SYSTEMS.join('; ') + '. prep is a comma-separated list using only: ' + FILL_PREPS.join('; ') + '. cure, when you know it, is exactly one of: ' + FILL_CURES.join('; ') + '. color is the flake or coating color with spelling corrected. Real color names: ' + colorList + '. items is an array of objects with title, detail, and price. price is a number, or null when the line is included. Include the main system line, and a separate line for each prep add-on such as crack repair and diamond grinding. When sqft and rate are both known, the main line price is sqft times rate. When vertical and vrate are both known, do not fold that money into the floor line. notes is optional customer-facing additional text with no price. Omit notes when the customer does not need extra text. Omit any key you cannot tell. Do not invent a phone or email. Never put hardness, a Mohs number, or private notes into notes or items.';
  var parts = [{ text: prompt }];
  if (audio) parts.push({ inline_data: { mime_type: mime || 'audio/webm', data: audio } });
  if (spoken) parts.push({ text: 'Spoken note:\n' + spoken });
  var gotFetch = geminiGenerate_(key, parts);
  if (!gotFetch || gotFetch.code < 200 || gotFetch.code >= 300) return fillReady_(fillKeep_(form, local));
  var parsed;
  try { parsed = JSON.parse(gotFetch.body); } catch (eParse) { return fillReady_(fillKeep_(form, local)); }
  var got = normalizeFill_(geminiText_(parsed));
  return fillReady_(fillKeep_(form, mergeFill_(local, got || {})));
}
function aiDebug_() {
  var key = scriptProp_('GEMINI_API_KEY');
  if (!key) return { ok: true, ready: false, message: 'AI fill not set up yet', tries: [] };
  var primary = geminiModel_();
  var models = [primary];
  if (primary !== 'gemini-flash-latest') models.push('gemini-flash-latest');
  var tries = [];
  var i;
  for (i = 0; i < models.length; i++) {
    var got = geminiFetch_(key, models[i], [{ text: 'Reply with JSON {"ok":true}.' }]);
    var code = got && got.code ? got.code : 0;
    var err = (code >= 200 && code < 300) ? '' : clipErr_(got && got.body, key);
    tries.push({ model: models[i], code: code, error: err });
  }
  return { ok: true, tries: tries };
}
function saveReceiptImage_(image) {
  var parts = String(image || '').split(',');
  if (parts.length < 2 || !parts[1]) throw new Error('No receipt photo');
  var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), 'image/jpeg', 'receipt-' + Date.now() + '.jpg');
  return receiptsFolder_().createFile(blob).getId();
}
var RECEIPT_CATS = ['Fuel', 'Equipment repair', 'Equipment rental', 'Tools & equipment', 'Parts & supplies', 'Meals', 'Subcontractors', 'Labor', 'Insurance', 'Dump fees', 'Vehicle', 'Advertising', 'Office', 'Other'];
function normalizeReceipt_(raw) {
  var o = raw;
  if (typeof o === 'string') {
    var t = o.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    var start = t.indexOf('{'), end = t.lastIndexOf('}');
    if (start < 0 || end <= start) return {};
    try { o = JSON.parse(t.slice(start, end + 1)); } catch (eR) { return {}; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  var data = {};
  var vendor = String(o.vendor || o.merchant || o.store || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (vendor) data.vendor = vendor;
  var date = String(o.date || '').trim();
  var dm = date.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!dm) {
    var us = date.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (us) {
      var y = us[3].length === 2 ? '20' + us[3] : us[3];
      date = y + '-' + ('0' + us[1]).slice(-2) + '-' + ('0' + us[2]).slice(-2);
      dm = date.match(/(\d{4})-(\d{2})-(\d{2})/);
    }
  }
  if (dm) data.date = dm[0];
  function moneyOrNull(v) {
    if (v == null || String(v).trim() === '') return null;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    if (isNaN(n)) return null;
    return Math.round(n * 100) / 100;
  }
  var total = moneyOrNull(o.total != null ? o.total : o.amount);
  if (total != null && total > 0) data.total = total;
  if (o.tax != null && String(o.tax).trim() !== '') {
    var tax = moneyOrNull(o.tax);
    if (tax != null) data.tax = tax;
  }
  var cat = snapList_(o.category || '', RECEIPT_CATS) || 'Other';
  if (o.category) data.category = cat;
  return data;
}
function receiptImagePart_(image) {
  var s = String(image || '');
  var m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m || m[2].replace(/\s/g, '').length > 2000000) return null;
  return { inline_data: { mime_type: m[1], data: m[2].replace(/\s/g, '') } };
}
function readReceipt_(image) {
  var key = scriptProp_('GEMINI_API_KEY');
  var part = receiptImagePart_(image);
  if (!key || !part) return { ocr: false, reason: 'miss', data: {} };
  var prompt = 'Read this receipt. Return one JSON object and nothing else. Keys: vendor, date, total, tax, category. date is YYYY-MM-DD. total and tax are numbers. tax may be null. category is exactly one of: ' + RECEIPT_CATS.join('; ') + '. Omit a key you cannot see. Do not invent amounts.';
  var got = geminiGenerate_(key, [{ text: prompt }, part]);
  if (!got || got.code < 200 || got.code >= 300) return { ocr: false, reason: 'miss', data: {} };
  var parsed;
  try { parsed = JSON.parse(got.body); } catch (eParse) { return { ocr: false, reason: 'miss', data: {} }; }
  var data = normalizeReceipt_(geminiText_(parsed));
  if (!data.vendor && data.total == null && !data.date) return { ocr: false, reason: 'miss', data: {} };
  return { ocr: true, reason: '', data: data };
}
function scanReceipt_(image) {
  var id = saveReceiptImage_(image);
  var read;
  try { read = readReceipt_(image); } catch (eRead) { read = { ocr: false, reason: 'miss', data: {} }; }
  return { ok: true, receiptId: id, ocr: !!read.ocr, reason: read.ocr ? '' : 'miss', data: read.data || {} };
}
function rescanReceipt_(id) {
  var read = { ocr: false, reason: 'miss', data: {} };
  try {
    var b = DriveApp.getFileById(id).getBlob();
    var url = 'data:' + (b.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(b.getBytes());
    read = readReceipt_(url);
  } catch (eRescan) {}
  return { ok: true, receiptId: id || '', ocr: !!read.ocr, reason: read.ocr ? '' : 'miss', data: read.data || {} };
}
function feedbackAddr_() {
  return scriptProp_('FEEDBACK_EMAIL') || 'austin@techsourcedsolutions.com';
}
function mailFeedback_(row) {
  try {
    var when = Utilities.formatDate(new Date(row.at || new Date()), 'America/New_York', 'MMMM d, yyyy h:mm a');
    var text = String(row.text || '');
    var who = String(row.role || '');
    var plain = 'Feedback\n\n' + text + '\n\nRole: ' + who + '\nTime: ' + when + ' Eastern';
    sendMail_({
      job: { email: feedbackAddr_() },
      name: 'Southern Concrete Coatings',
      subject: 'Southern Concrete Coatings app feedback',
      body: plain,
      html: '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#212020"><p style="white-space:pre-wrap">' + escHtml(text) + '</p><p><b>Role:</b> ' + escHtml(who) + '<br><b>Time:</b> ' + escHtml(when) + ' Eastern</p></div>'
    });
  } catch (eMail) {}
}
function sendReview_(j) {
  customerOk_(j);
  if (!settings_().reviewLink) throw new Error('Add a Google review link in Settings first.');
  sendMail_({
    job: j,
    subject: 'How did we do? Southern Concrete Coatings',
    html: reviewEmailHtml(mailOpts_(j)),
    inlineImages: { logo: logoBlob_() }
  });
}
function mileRate_(v) {
  if (v == null || v === '') return 0.70;
  var n = Number(v);
  if (isNaN(n) || n < 0 || n > 100) return 0.70;
  return Math.round(n * 1000) / 1000;
}
function mileage_() {
  var list = load_('mileage.json');
  return Array.isArray(list) ? list : [];
}
function qboEnv_() {
  var e = String(scriptProp_('QBO_ENV') || 'sandbox').toLowerCase();
  return e === 'production' ? 'production' : 'sandbox';
}
function qboRedirect_() { return ScriptApp.getService().getUrl(); }
function qboLoad_() {
  var o = loadObj_('qbo.json');
  if (!o.refreshToken || !o.realmId) return null;
  return o;
}
function qboPublic_() {
  var o = loadObj_('qbo.json');
  return { connected: !!(o.refreshToken && o.realmId), env: o.env || qboEnv_() };
}
function qboSave_(o) { save_(o || {}, 'qbo.json'); }
function qboApiBase_() {
  return qboEnv_() === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
}
function qboBasic_() {
  return Utilities.base64Encode(scriptProp_('QBO_CLIENT_ID') + ':' + scriptProp_('QBO_CLIENT_SECRET'));
}
function qboExchange_(body) {
  var res = UrlFetchApp.fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'post', contentType: 'application/x-www-form-urlencoded', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + qboBasic_(), Accept: 'application/json' }, payload: body
  });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) throw new Error('QuickBooks auth failed');
  return JSON.parse(res.getContentText() || '{}');
}
function qboApplyTok_(cur, tok, realm) {
  cur = cur || {};
  cur.accessToken = tok.access_token;
  if (tok.refresh_token) cur.refreshToken = tok.refresh_token;
  cur.accessExp = Date.now() + (Number(tok.expires_in) || 3000) * 1000 - 60000;
  if (realm) cur.realmId = realm;
  cur.env = qboEnv_();
  qboSave_(cur);
  return cur;
}
function qboConnectUrl_() {
  var id = scriptProp_('QBO_CLIENT_ID'), sec = scriptProp_('QBO_CLIENT_SECRET');
  if (!id || !sec) return '';
  var state = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('QBO_STATE', state);
  return 'https://appcenter.intuit.com/connect/oauth2?client_id=' + encodeURIComponent(id) + '&response_type=code&scope=' + encodeURIComponent('com.intuit.quickbooks.accounting') + '&redirect_uri=' + encodeURIComponent(qboRedirect_()) + '&state=' + encodeURIComponent(state);
}
function qboFinish_(p) {
  var expect = '';
  try { expect = PropertiesService.getScriptProperties().getProperty('QBO_STATE') || ''; } catch (eSt) {}
  if (!p.code || !p.state || p.state !== expect) return page_('<h2>QuickBooks</h2><p>That connection link was not valid. Use Connect in Settings again.</p>');
  try { PropertiesService.getScriptProperties().deleteProperty('QBO_STATE'); } catch (eDel) {}
  try { qboApplyTok_({}, qboExchange_('grant_type=authorization_code&code=' + encodeURIComponent(p.code) + '&redirect_uri=' + encodeURIComponent(qboRedirect_())), p.realmId); }
  catch (eFin) { return page_('<h2>QuickBooks</h2><p>Could not finish connecting. Check the Intuit keys and try again.</p>'); }
  return page_('<h2>QuickBooks connected</h2><p>You can close this tab and return to the app.</p><p><a href="https://austin-tss.github.io/southern-concrete/">Back to Southern Concrete Coatings</a></p>');
}
function qboAccess_() {
  var cur = qboLoad_();
  if (!cur) return null;
  if (cur.accessToken && cur.accessExp && Date.now() < Number(cur.accessExp)) return cur;
  return qboApplyTok_(cur, qboExchange_('grant_type=refresh_token&refresh_token=' + encodeURIComponent(cur.refreshToken)), cur.realmId);
}
function qboFetch_(method, path, payload) {
  var cur = qboAccess_();
  if (!cur) return null;
  var url = qboApiBase_() + '/v3/company/' + encodeURIComponent(cur.realmId) + path + (String(path).indexOf('?') >= 0 ? '&' : '?') + 'minorversion=75';
  var opt = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + cur.accessToken, Accept: 'application/json' } };
  if (payload) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(payload); }
  var res = UrlFetchApp.fetch(url, opt);
  if (res.getResponseCode() === 401) {
    cur.accessExp = 0;
    qboSave_(cur);
    cur = qboAccess_();
    if (!cur) return null;
    opt.headers.Authorization = 'Bearer ' + cur.accessToken;
    res = UrlFetchApp.fetch(url, opt);
  }
  var body = {};
  try { body = JSON.parse(res.getContentText() || '{}'); } catch (eJ) {}
  return { code: res.getResponseCode(), body: body };
}
function qboQuery_(q) {
  var got = qboFetch_('get', '/query?query=' + encodeURIComponent(q));
  return (got && got.body && got.body.QueryResponse) || {};
}
function qboEnsureItem_() {
  var cur = qboLoad_();
  if (!cur) return '';
  if (cur.itemId) return String(cur.itemId);
  var rows = qboQuery_("select * from Item where Name = 'Concrete coating'").Item || [];
  if (rows.length) { cur.itemId = rows[0].Id; qboSave_(cur); return String(cur.itemId); }
  var made = qboFetch_('post', '/item', { Name: 'Concrete coating', Type: 'Service' });
  var id = made && made.body && made.body.Item && made.body.Item.Id;
  if (id) { cur.itemId = id; qboSave_(cur); }
  return id ? String(id) : '';
}
function qboEnsureAccount_(kind) {
  var cur = qboLoad_();
  if (!cur) return '';
  var key = kind === 'pay' ? 'payAccountId' : 'expAccountId';
  if (cur[key]) return String(cur[key]);
  var q = kind === 'pay' ? "select * from Account where AccountType = 'Bank' maxresults 1" : "select * from Account where AccountType = 'Expense' maxresults 1";
  var rows = qboQuery_(q).Account || [];
  if (!rows.length) return '';
  cur[key] = rows[0].Id;
  qboSave_(cur);
  return String(cur[key]);
}
function qboCustomer_(j) {
  if (!j || !qboLoad_()) return;
  var name = String(j.name || 'Customer').trim().slice(0, 100) || 'Customer';
  var payload = { DisplayName: name };
  if (j.email) payload.PrimaryEmailAddr = { Address: String(j.email).slice(0, 100) };
  if (j.phone) payload.PrimaryPhone = { FreeFormNumber: String(j.phone).slice(0, 30) };
  if (j.address) payload.BillAddr = { Line1: String(j.address).slice(0, 400) };
  if (j.qboCustomerId) {
    var got = qboFetch_('get', '/customer/' + encodeURIComponent(j.qboCustomerId));
    var row = got && got.body && got.body.Customer;
    if (row) {
      payload.Id = row.Id; payload.SyncToken = row.SyncToken; payload.sparse = true;
      var upd = qboFetch_('post', '/customer', payload);
      if (upd && upd.code >= 200 && upd.code < 300) return;
    }
  }
  var made = qboFetch_('post', '/customer', payload);
  var id = made && made.body && made.body.Customer && made.body.Customer.Id;
  if (!id) {
    var safe = name.replace(/'/g, '');
    var found = qboQuery_("select * from Customer where DisplayName = '" + safe + "'").Customer || [];
    if (found.length) id = found[0].Id;
  }
  if (id) j.qboCustomerId = id;
}
function qboLines_(j) {
  var item = qboEnsureItem_() || '1';
  var items = (j.items || []).filter(function (it) { return it && it.title && !it.internal; });
  if (!items.length) items = [{ title: j.system || 'Coating', price: j.total || 0 }];
  return items.map(function (it) {
    var amt = it.price == null || it.price === '' ? 0 : Number(it.price) || 0;
    return { DetailType: 'SalesItemLineDetail', Amount: amt, Description: String(it.title).slice(0, 4000), SalesItemLineDetail: { ItemRef: { value: String(item) }, Qty: 1, UnitPrice: amt } };
  });
}
function qboDoc_(j, kind) {
  if (!j || !qboLoad_()) return;
  qboCustomer_(j);
  if (!j.qboCustomerId) return;
  var idKey = kind === 'invoice' ? 'qboInvoiceId' : 'qboEstimateId';
  var path = kind === 'invoice' ? '/invoice' : '/estimate';
  var key = kind === 'invoice' ? 'Invoice' : 'Estimate';
  var payload = { CustomerRef: { value: String(j.qboCustomerId) }, Line: qboLines_(j) };
  if (kind === 'estimate' && j.est) payload.DocNumber = String(j.est).slice(0, 21);
  if (j[idKey]) {
    var got = qboFetch_('get', path + '/' + encodeURIComponent(j[idKey]));
    var row = got && got.body && got.body[key];
    if (row) { payload.Id = row.Id; payload.SyncToken = row.SyncToken; payload.sparse = true; }
  }
  var made = qboFetch_('post', path, payload);
  var id = made && made.body && made.body[key] && made.body[key].Id;
  if (id) j[idKey] = id;
}
function qboPurchase_(ex) {
  if (!ex || !qboLoad_()) return;
  var pay = qboEnsureAccount_('pay'), expA = qboEnsureAccount_('exp');
  if (!pay || !expA) return;
  var payload = { PaymentType: 'Cash', AccountRef: { value: String(pay) }, Line: [{ Amount: Number(ex.amount) || 0, DetailType: 'AccountBasedExpenseLineDetail', Description: String(ex.vendor || ex.category || 'Receipt').slice(0, 400), AccountBasedExpenseLineDetail: { AccountRef: { value: String(expA) } } }] };
  if (ex.qboPurchaseId) {
    var got = qboFetch_('get', '/purchase/' + encodeURIComponent(ex.qboPurchaseId));
    var row = got && got.body && got.body.Purchase;
    if (row) { payload.Id = row.Id; payload.SyncToken = row.SyncToken; payload.sparse = true; }
  }
  var made = qboFetch_('post', '/purchase', payload);
  var id = made && made.body && made.body.Purchase && made.body.Purchase.Id;
  if (id) ex.qboPurchaseId = id;
}
function qboQuietJob_(kind, j) { try { if (qboLoad_()) qboDoc_(j, kind); } catch (eQ) {} }
function qboQuietExp_(ex) { try { if (qboLoad_()) qboPurchase_(ex); } catch (eQ) {} }
function qboQuietCustomers_(list) { try { if (!qboLoad_()) return; (list || []).forEach(qboCustomer_); } catch (eQ) {} }
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.a === 'twvoice') return twvoice_(p);
  if (p.code && p.state) return qboFinish_(p);
  if (p.a === 'logins') return out_({ ok: true, logins: load_('logins.json') });
  if (p.a === 'feedback') {
    var fbGet = load_('feedback.json');
    if (!Array.isArray(fbGet)) fbGet = [];
    return out_({ ok: true, feedback: fbGet.map(function (row) {
      return { at: String(row && row.at || ''), role: String(row && row.role || ''), text: String(row && row.text || '') };
    }) });
  }
  if (p.a === 'img' && p.id) {
    var b = DriveApp.getFileById(p.id).getBlob();
    return out_({ ok: true, data: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) });
  }
  if (p.a === 'respond') {
    var js = load_(), j = js.filter(function (x) { return x.id === p.id; })[0];
    if (!j) return page_('<h2>Estimate not found</h2><p>Please call ' + CO.phone + '.</p>');
    if (p.ans !== 'C' && !p.done) {
      return page_(responseFormHtml({
        co: CO, colors: COLORS, job: j, ans: p.ans, labels: LABELS, slots: SLOTS,
        action: ScriptApp.getService().getUrl()
      }));
    }
    var L = LockService.getScriptLock();
    L.waitLock(20000);
    try {
      js = load_();
      j = js.filter(function (x) { return x.id === p.id; })[0];
      respond_(j, p);
      save_(js);
    } finally { L.releaseLock(); }
    return page_(responseThanksHtml({ co: CO, colors: COLORS, job: j }));
  }
  return out_({ ok: true, test: TEST_MODE, testMode: TEST_MODE, testTo: TEST_MODE ? TEST_TO : '', root: root_().getUrl(), jobs: load_(), blocks: load_('blocks.json'), settings: settings_(), gallery: gallery_(), callLog: callLog_().slice(0, 80) });
}
function numField_(v) {
  if (v == null || v === '') return '';
  var n = Number(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? '' : n;
}
function cleanItems_(list) {
  var out = [], arr = Array.isArray(list) ? list : [], i;
  for (i = 0; i < arr.length && out.length < 40; i++) {
    var it = arr[i] || {};
    var title = String(it.title || '').trim().slice(0, 200);
    if (!title) continue;
    var detail = String(it.detail || '').replace(/\u0000/g, '').trim().slice(0, 2000);
    var price = null;
    if (it.price != null && String(it.price).trim() !== '') {
      var n = Number(String(it.price).replace(/[$,]/g, ''));
      if (!isNaN(n)) price = Math.round(n * 100) / 100;
    }
    out.push({ title: title, detail: detail, price: price, internal: !!it.internal });
  }
  return out;
}
function doPost(e) {
  var peek = (e && e.parameter) || {};
  if (peek.a === 'twvoice') return twvoice_(peek);
  var d = JSON.parse(e.postData.contents);
  if (d && d.a === 'twvoice') return twvoice_(d);
  var L = LockService.getScriptLock();
  L.waitLock(30000);
  var j, send = null, js;
  try {
    if (d.a === 'signin') {
      var lg = load_('logins.json');
      lg.push({ t: new Date().toISOString(), role: String(d.role || ''), ua: String(d.ua || '').slice(0, 200) });
      if (lg.length > 500) lg = lg.slice(-500);
      save_(lg, 'logins.json');
      return out_({ ok: true });
    }
    if (d.a === 'log') {
      var act = load_('activity.json');
      if (!Array.isArray(act)) act = [];
      act.push({ t: new Date().toISOString(), what: String(d.what || '').slice(0, 200), role: String(d.role || ''), ua: String(d.ua || '').slice(0, 200) });
      if (act.length > 500) act = act.slice(-500);
      save_(act, 'activity.json');
      return out_({ ok: true });
    }
    if (d.a === 'gadd') {
      var parts = String(d.image || '').split(',');
      if (parts.length < 2 || !parts[1]) return out_({ ok: false, err: 'Choose a photo first' });
      var cap = String(d.caption || '').trim().slice(0, 200);
      var tags = String(d.tags || '').split(',').map(function (s) { return s.trim().slice(0, 40); }).filter(Boolean).slice(0, 12);
      var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), 'image/jpeg', 'gallery-' + Date.now() + '.jpg');
      var file = galleryFolder_().createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var list = gallery_();
      list.unshift({
        id: file.getId(),
        caption: cap,
        tags: tags,
        t: new Date().toISOString(),
        url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600'
      });
      if (list.length > 400) list = list.slice(0, 400);
      save_(list, 'gallery.json');
      return out_({ ok: true, gallery: list });
    }
    if (d.a === 'gdel') {
      var before = gallery_();
      var had = before.some(function (x) { return x.id === d.id; });
      var left = before.filter(function (x) { return x.id !== d.id; });
      if (had && d.id) { try { DriveApp.getFileById(d.id).setTrashed(true); } catch (eG) {} }
      save_(left, 'gallery.json');
      return out_({ ok: true, gallery: left });
    }
    if (d.a === 'measure') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      return out_(measureFloor_(d.images || d.photos, d.known));
    }
    if (d.a === 'qfill') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      return out_(quoteFill_(d));
    }
    if (d.a === 'aidebug') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      return out_(aiDebug_());
    }
    if (d.a === 'qboconnect') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      var qUrl = qboConnectUrl_();
      if (!qUrl) return out_({ ok: false, err: 'Add QBO_CLIENT_ID and QBO_CLIENT_SECRET in Script Properties.' });
      return out_({ ok: true, url: qUrl });
    }
    if (d.a === 'qbodisconnect') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      qboSave_({});
      return out_({ ok: true, settings: settings_() });
    }
    if (d.a === 'milelist' || d.a === 'mileadd' || d.a === 'miledel' || d.a === 'cedit') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      if (d.a === 'milelist') return out_({ ok: true, trips: mileage_(), mileRate: settings_().mileRate });
      if (d.a === 'miledel') {
        save_(mileage_().filter(function (t) { return t.id !== d.id; }), 'mileage.json');
        return out_({ ok: true, trips: mileage_() });
      }
      if (d.a === 'mileadd') {
        var trips = mileage_();
        function optNum(v) { return v == null || String(v).trim() === '' ? '' : moneyNum_(v); }
        trips.unshift({
          id: 'MI' + Date.now().toString(36).toUpperCase(),
          date: String(d.date || Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd')).slice(0, 10),
          jobId: String(d.jobId || '').slice(0, 40),
          customer: String(d.customer || '').slice(0, 120),
          start: optNum(d.start), end: optNum(d.end), miles: optNum(d.miles),
          purpose: String(d.purpose || '').slice(0, 200),
          notes: String(d.notes || '').slice(0, 2000),
          created: new Date().toISOString()
        });
        save_(trips, 'mileage.json');
        return out_({ ok: true, trips: trips });
      }
      if (d.email && !validEmail(d.email)) return out_({ ok: false, err: 'That customer email does not look valid.' });
      var cids = d.ids || [];
      var cjs = load_();
      cjs.forEach(function (x) {
        if (cids.indexOf(x.id) < 0) return;
        x.name = String(d.name || '').trim().slice(0, 200);
        x.phone = String(d.phone || '').trim().slice(0, 40);
        x.email = String(d.email || '').trim();
        x.address = String(d.address || '').trim().slice(0, 300);
        x.phone2 = String(d.phone2 || '').trim().slice(0, 40);
        x.contact2 = String(d.contact2 || '').trim().slice(0, 120);
      });
      qboQuietCustomers_(cjs.filter(function (x) { return cids.indexOf(x.id) >= 0; }));
      save_(cjs);
      return out_({ ok: true });
    }
    if (d.a === 'feedback') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      var fbText = String(d.text || '').trim();
      if (!fbText) return out_({ ok: false, err: 'Write a note first' });
      var fbList = load_('feedback.json');
      if (!Array.isArray(fbList)) fbList = [];
      fbList.push({ at: new Date().toISOString(), role: String(d.role || '').slice(0, 40), text: fbText.slice(0, 4000) });
      if (fbList.length > 500) fbList = fbList.slice(-500);
      save_(fbList, 'feedback.json');
      mailFeedback_(fbList[fbList.length - 1]);
      return out_({ ok: true });
    }
    if (d.a === 'remindtest' || d.a === 'remindinstall' || d.a === 'remindnow' || d.a === 'textnow') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      if (d.a === 'remindinstall') {
        try { installReminderTrigger(); }
        catch (eInst) { return out_({ ok: false, err: String(eInst.message || eInst).slice(0, 180) }); }
        return out_({ ok: true, installed: true });
      }
      if (d.a === 'remindnow') return out_(remindNow_(d.ids));
      if (d.a === 'textnow') return out_(textNow_(d.ids));
      return out_(remindTest_(d.testPhone));
    }
    if (d.a === 'settings' || d.a === 'explist' || d.a === 'expadd' || d.a === 'expdel' || d.a === 'rcscan' || d.a === 'rcrescan' || d.a === 'rcdrop') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      if (d.a === 'settings') {
        var curS = loadObj_('settings.json');
        curS.payLink = String(d.payLink || '').trim();
        curS.reviewLink = String(d.reviewLink || '').trim();
        curS.finLink = String(d.finLink || '').trim();
        var fm = Number(String(d.finMin == null ? '' : d.finMin).replace(/[^0-9.\-]/g, ''));
        curS.finMin = isNaN(fm) ? 1000 : fm;
        if (typeof curS.ocr !== 'boolean') curS.ocr = true;
        if (d.form) curS.form = normalizeForm(d.form);
        if (d.mileRate != null && String(d.mileRate).trim() !== '') curS.mileRate = mileRate_(d.mileRate);
        if (d.theme === 'classic' || d.theme === 'dark') curS.theme = d.theme;
        curS.quoteBody = String(d.quoteBody || '').trim().slice(0, 4000);
        curS.quoteSubject = String(d.quoteSubject || '').trim().slice(0, 300);
        curS.quoteSign = String(d.quoteSign || '').trim().slice(0, 800);
        if (d.quoteBcc != null) curS.quoteBcc = quoteBcc_(d.quoteBcc);
        if (Array.isArray(d.galleryHide)) curS.galleryHide = galleryHide_(d.galleryHide);
        if (d.reminders && typeof d.reminders === 'object') {
          var postedR = d.reminders;
          if (!Array.isArray(postedR.questions) && curS.reminders && Array.isArray(curS.reminders.questions)) {
            postedR = { on: postedR.on, test: postedR.test, testPhone: postedR.testPhone, questions: curS.reminders.questions };
          }
          curS.reminders = reminderCfg_({ reminders: postedR });
        }
        if (d.texts && typeof d.texts === 'object') curS.texts = smsCfg_({ texts: d.texts, reminders: curS.reminders });
        save_(curS, 'settings.json');
        return out_({ ok: true, settings: settings_() });
      }
      if (d.a === 'explist') return out_({ ok: true, expenses: expenses_() });
      if (d.a === 'expadd') {
        var amt = moneyNum_(d.amount);
        if (!(amt > 0)) return out_({ ok: false, err: 'Enter the amount' });
        var ex = expenses_();
        var receipt = String(d.receiptId || '');
        if (!receipt && d.image) receipt = saveReceiptImage_(d.image);
        var tax = (d.tax == null || d.tax === '') ? null : moneyNum_(d.tax);
        ex.unshift({
          id: 'EX' + Date.now().toString(36).toUpperCase(),
          amount: amt,
          category: String(d.category || 'Other'),
          note: String(d.note || ''),
          date: String(d.date || Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd')),
          vendor: String(d.vendor || ''),
          tax: tax,
          items: d.items || [],
          receipt: receipt,
          scanned: !!d.scanned,
          created: new Date().toISOString()
        });
        try { qboQuietExp_(ex[0]); } catch (eQe) {}
        save_(ex, 'expenses.json');
        return out_({ ok: true, expenses: ex });
      }
      if (d.a === 'expdel') {
        var ex2 = expenses_().filter(function (x) { return x.id !== d.id; });
        save_(ex2, 'expenses.json');
        return out_({ ok: true, expenses: ex2 });
      }
      if (d.a === 'rcscan') return out_(scanReceipt_(d.image));
      if (d.a === 'rcrescan') return out_(rescanReceipt_(d.id));
      if (d.a === 'rcdrop') {
        if (d.id) { try { DriveApp.getFileById(d.id).setTrashed(true); } catch (eDrop) {} }
        return out_({ ok: true });
      }
    }
    js = load_();
    if (d.a === 'block' || d.a === 'unblock') {
      var bl = load_('blocks.json');
      bl = bl.filter(function (b) { return b.id !== d.block.id; });
      if (d.a === 'block') {
        if (!d.block.id) d.block.id = 'B' + Date.now().toString(36);
        bl.push(d.block);
      }
      save_(bl, 'blocks.json');
      return out_({ ok: true, blocks: bl, testMode: TEST_MODE });
    }
    if (d.a === 'delete') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      js = js.filter(function (x) { return x.id !== d.id; });
      save_(js);
      return out_({ ok: true });
    }
    if (d.a === 'phone') {
      var ids = d.ids || [];
      var ph = String(d.phone || '').trim();
      js.forEach(function (x) { if (ids.indexOf(x.id) >= 0) x.phone = ph; });
      save_(js);
      return out_({ ok: true });
    }
    if (d.a === 'create') {
      if (d.email && !validEmail(d.email)) return out_({ ok: false, err: 'That customer email does not look valid.' });
      if (hardnessVal_(d.hardness) === null) return out_({ ok: false, err: 'Hardness is a whole number from 1 to 10.' });
      var fields = { sqft: d.sqft, system: d.system, color: d.color, prep: d.prep, cure: d.cure, rate: d.rate, vertical: d.vertical, vrate: d.vrate };
      var items = ensureVertical((d.items && d.items.length) ? d.items : buildItems(fields, d.quote), fields);
      j = {
        id: 'SCC-' + Date.now().toString(36).toUpperCase(),
        est: estNo_(),
        name: d.name,
        address: d.address,
        email: String(d.email || '').trim(),
        phone: String(d.phone || '').trim(),
        jobType: String(d.jobType || '').trim().slice(0, 40),
        custom: (d.custom && typeof d.custom === 'object' && !Array.isArray(d.custom)) ? d.custom : {},
        quote: d.quote || '',
        sqft: numField_(d.sqft),
        system: d.system || '',
        color: d.color || '',
        prep: d.prep || '',
        cure: d.cure || '',
        rate: numField_(d.rate),
        vertical: numField_(d.vertical),
        vrate: numField_(d.vrate),
        hardness: hardnessVal_(d.hardness),
        hardnessHow: String(d.hardnessHow || '').trim().slice(0, 300),
        internalNotes: [],
        additionalNotes: String(d.additionalNotes || '').trim().slice(0, 4000),
        items: items,
        total: totalOf(items),
        status: 'sent',
        created: new Date().toISOString(),
        photos: [],
        crew: []
      };
      folder_(j);
      j.photos = savePhotos_(j, d.photos, 'quote');
      js.unshift(j);
      send = sendQuote_;
    } else {
      j = js.filter(function (x) { return x.id === d.id; })[0];
      if (!j) return out_({ ok: false, err: 'Job not found' });
      if (d.a === 'upload') j.crew = (j.crew || []).concat(savePhotos_(j, d.photos, d.kind));
      else if (d.a === 'finish') {
        j.crewNotes = d.notes || '';
        j.status = 'complete';
        j.finished = new Date().toISOString();
        send = sendRecap_;
      } else if (d.a === 'invoice') {
        j.invoice = { amount: d.amount, note: d.note || '', at: new Date().toISOString(), paid: j.invoice && j.invoice.paid };
        j.status = 'invoiced';
        send = sendInvoice_;
      } else if (d.a === 'paid') {
        j.invoice = j.invoice || {};
        j.invoice.paid = !!d.paid;
        j.invoice.paidAt = d.paid ? new Date().toISOString() : '';
      } else if (d.a === 'email') {
        if (!validEmail(d.email)) return out_({ ok: false, err: 'Invalid email' });
        j.email = String(d.email).trim();
      } else if (d.a === 'respond') respond_(j, d);
      else if (d.a === 'hardness') {
        var hv = hardnessVal_(d.hardness);
        if (hv === null) return out_({ ok: false, err: 'Hardness is a whole number from 1 to 10.' });
        j.hardness = hv;
        j.hardnessHow = String(d.hardnessHow || '').trim().slice(0, 300);
      } else if (d.a === 'qedit') {
        if (d.email && !validEmail(d.email)) return out_({ ok: false, err: 'That customer email does not look valid.' });
        if (hardnessVal_(d.hardness) === null) return out_({ ok: false, err: 'Hardness is a whole number from 1 to 10.' });
        j.name = String(d.name || '').trim().slice(0, 200);
        j.address = String(d.address || '').trim().slice(0, 300);
        j.email = String(d.email || '').trim();
        j.phone = String(d.phone || '').trim().slice(0, 40);
        j.jobType = String(d.jobType || '').trim().slice(0, 40);
        j.custom = (d.custom && typeof d.custom === 'object' && !Array.isArray(d.custom)) ? d.custom : {};
        j.quote = String(d.quote || '').slice(0, 8000);
        j.sqft = numField_(d.sqft);
        j.system = String(d.system || '').trim().slice(0, 80);
        j.color = String(d.color || '').trim().slice(0, 80);
        j.prep = String(d.prep || '').trim().slice(0, 240);
        j.cure = String(d.cure || '').trim().slice(0, 80);
        j.rate = numField_(d.rate);
        j.vertical = numField_(d.vertical);
        j.vrate = numField_(d.vrate);
        j.hardness = hardnessVal_(d.hardness);
        j.hardnessHow = String(d.hardnessHow || '').trim().slice(0, 300);
        j.additionalNotes = String(d.additionalNotes || '').trim().slice(0, 4000);
        j.items = ensureVertical(cleanItems_(d.items), { vertical: d.vertical, vrate: d.vrate });
        j.total = totalOf(j.items);
        j.pdfId = '';
        j.updated = new Date().toISOString();
        try { makePdf_(j); } catch (ePdf) { j.pdf = ''; }
        if (d.send) send = sendQuote_;
      } else if (d.a === 'addl') {
        j.additionalNotes = String(d.additionalNotes != null ? d.additionalNotes : '').trim().slice(0, 4000);
        j.pdfId = '';
        try { makePdf_(j); } catch (ePdf) { j.pdf = ''; }
      } else if (d.a === 'inote') {
        var noteText = String(d.text || '').trim();
        if (!noteText) return out_({ ok: false, err: 'Write a note first' });
        if (!Array.isArray(j.internalNotes)) j.internalNotes = [];
        j.internalNotes.push({ t: new Date().toISOString(), text: noteText.slice(0, 2000) });
        if (j.internalNotes.length > 200) j.internalNotes = j.internalNotes.slice(-200);
      } else if (d.a === 'resend' || d.a === 'resendquote') {
        if (!j.est) return out_({ ok: false, err: 'This job has no quote to resend' });
        send = sendQuote_;
        j.resent = (j.resent || 0) + 1;
        j.resentAt = new Date().toISOString();
      } else if (d.a === 'markpaid') {
        j.invoice = j.invoice || {};
        j.invoice.paid = true;
        j.invoice.paidAt = new Date().toISOString();
        j.invoice.paidDate = String(d.date || '');
        j.invoice.method = String(d.method || '');
        j.invoice.amountPaid = moneyNum_(d.amount);
        j.invoice.ref = String(d.ref || '');
        if (!j.invoice.amount) j.invoice.amount = money(j.invoice.amountPaid);
        if (!j.invoice.at) j.invoice.at = j.invoice.paidAt;
        j.status = 'invoiced';
      } else if (d.a === 'reqreview') {
        j.review = { at: new Date().toISOString(), count: ((j.review && j.review.count) || 0) + 1 };
        send = sendReview_;
      } else return out_({ ok: false, err: 'Bad action' });
    }
    if (send) {
      try { send(j); } catch (x) { return out_({ ok: false, err: String(x.message || x) }); }
    }
    try {
      if (d.a === 'create' || d.a === 'qedit') qboQuietJob_('estimate', j);
      else if (d.a === 'invoice') qboQuietJob_('invoice', j);
    } catch (eQj) {}
    save_(js);
  } finally { L.releaseLock(); }
  return out_({ ok: true, testMode: TEST_MODE, job: j });
}
var REM_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
var REM_MON = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
var REM_DONE = { declined: 1, complete: 1, invoiced: 1 };
var REM_N = 0;
function callLog_() {
  var list = load_('reminders.json');
  return Array.isArray(list) ? list : [];
}
function saveCallLog_(list) {
  if (!Array.isArray(list)) list = [];
  if (list.length > 200) list = list.slice(0, 200);
  save_(list, 'reminders.json');
}
function logReminder_(row) {
  var list = callLog_();
  var err = String(row && row.error || '');
  var manual = !!(row && row.manual);
  var type = String(row && row.type || '').slice(0, 12);
  if (!manual && err === 'not configured' && list.length && list[0].error === 'not configured' && String(list[0].type || '') === type) {
    var prev = Date.parse(list[0].at || '');
    if (!isNaN(prev) && Date.now() - prev < 6 * 36e5) return list;
  }
  list.unshift({
    id: String((row && row.id) || ('RC' + Date.now().toString(36).toUpperCase() + (REM_N++))).slice(0, 48),
    at: new Date().toISOString(),
    jobId: String(row && row.jobId || '').slice(0, 40),
    customer: String(row && row.customer || '').slice(0, 120),
    to: String(row && row.to || '').slice(0, 20),
    test: !!(row && row.test),
    manual: manual,
    type: type,
    kind: String(row && row.kind || '').slice(0, 12),
    sid: String(row && row.sid || '').slice(0, 64),
    status: String(row && row.status || '').slice(0, 40),
    error: err.slice(0, 180),
    forStart: String(row && row.forStart || '').slice(0, 40),
    final: !!(row && (row.final || reminderFinal_(row.status))),
    questions: (row && Array.isArray(row.questions)) ? questionsFrom_(row.questions) : [],
    answers: [],
    no: false,
    callback: false
  });
  if (list.length > 200) list = list.slice(0, 200);
  saveCallLog_(list);
  return list;
}
function alreadyLogged_(list, jobId, forStart, error) {
  var i;
  for (i = 0; i < list.length; i++) {
    if (list[i].jobId === jobId && list[i].forStart === forStart && list[i].error === error) return true;
  }
  return false;
}
function twilioCreds_() {
  var sid = scriptProp_('TWILIO_SID');
  var token = scriptProp_('TWILIO_TOKEN');
  var from = e164_(scriptProp_('TWILIO_FROM'));
  if (!sid || !token || !from) return null;
  return { sid: sid, token: token, from: from };
}
function twilioAuth_(creds) {
  return 'Basic ' + Utilities.base64Encode(creds.sid + ':' + creds.token);
}
function twilioClip_(msg, creds) {
  var s = clipErr_(msg, creds && creds.token);
  s = clipErr_(s, creds && creds.sid);
  return s.slice(0, 180) || 'call failed';
}
function voiceSign_(msg, secret) {
  var raw = Utilities.computeHmacSha256Signature(String(msg), String(secret || ''));
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '');
}
function twilioCall_(creds, to, twiml) {
  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(creds.sid) + '/Calls.json';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    headers: { Authorization: twilioAuth_(creds) },
    payload: { To: to, From: creds.from, Twiml: twiml }
  });
  var code = res.getResponseCode();
  var body = res.getContentText() || '';
  var parsed = {};
  try { parsed = JSON.parse(body) || {}; } catch (e) { parsed = {}; }
  if (code < 200 || code >= 300 || !parsed.sid) return { ok: false, error: twilioClip_(parsed.message || body || ('HTTP ' + code), creds) };
  return { ok: true, sid: String(parsed.sid), status: String(parsed.status || 'queued') };
}
function placeReminder_(creds, to, intro, questions, jobId, logId) {
  var base = '';
  try { base = ScriptApp.getService().getUrl() || ''; } catch (eUrl) { base = ''; }
  return twilioCall_(creds, to, callTwiml_(intro, questions, jobId, logId, creds.token, base, voiceSign_));
}
function twilioSms_(creds, to, body) {
  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(creds.sid) + '/Messages.json';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    headers: { Authorization: twilioAuth_(creds) },
    payload: { To: to, From: creds.from, Body: String(body || '').slice(0, 480) }
  });
  var code = res.getResponseCode();
  var raw = res.getContentText() || '';
  var parsed = {};
  try { parsed = JSON.parse(raw) || {}; } catch (eSms) { parsed = {}; }
  if (code < 200 || code >= 300 || !parsed.sid) return { ok: false, error: twilioClip_(parsed.message || raw || ('HTTP ' + code), creds) };
  return { ok: true, sid: String(parsed.sid), status: String(parsed.status || 'queued') };
}
function twilioStatus_(creds, sid) {
  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(creds.sid) + '/Calls/' + encodeURIComponent(sid) + '.json';
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: twilioAuth_(creds) }
  });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) return '';
  try { return String((JSON.parse(res.getContentText() || '{}') || {}).status || ''); }
  catch (e) { return ''; }
}
function etDate_(ymd, hm) {
  var p = String(hm || '08:00').split(':');
  var hh = ('0' + (parseInt(p[0], 10) || 0)).slice(-2);
  var mm = ('0' + (parseInt(p[1], 10) || 0)).slice(-2);
  var y = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return null;
  try { return Utilities.parseDate(y + ' ' + hh + ':' + mm + ':00', 'America/New_York', 'yyyy-MM-dd HH:mm:ss'); }
  catch (e) { return null; }
}
function addEtDays_(ymd, days) {
  var noon = etDate_(ymd, '12:00');
  if (!noon) return '';
  return Utilities.formatDate(new Date(noon.getTime() + days * 86400000), 'America/New_York', 'yyyy-MM-dd');
}
function etDow_(ymd) {
  var noon = etDate_(ymd, '12:00');
  if (!noon) return -1;
  var eee = Utilities.formatDate(noon, 'America/New_York', 'EEE').toLowerCase();
  var i;
  for (i = 0; i < REM_DAYS.length; i++) if (REM_DAYS[i].indexOf(eee) === 0) return i;
  return -1;
}
function whenClock_(text) {
  var t = String(text || '').toLowerCase();
  var m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  var h, min;
  if (m) {
    h = parseInt(m[1], 10);
    min = parseInt(m[2] || '0', 10) || 0;
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) return '08:00';
    return ('0' + h).slice(-2) + ':' + ('0' + min).slice(-2);
  }
  var at = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (at) {
    h = parseInt(at[1], 10);
    min = parseInt(at[2] || '0', 10) || 0;
    if (h < 7) h += 12;
    if (h > 23 || min > 59) return '08:00';
    return ('0' + h).slice(-2) + ':' + ('0' + min).slice(-2);
  }
  if (/\bafternoon\b/.test(t)) return '12:00';
  return '08:00';
}
function whenYmd_(text, todayYmd, nowMs) {
  var t = String(text || '').toLowerCase();
  var year = parseInt(String(todayYmd).slice(0, 4), 10);
  if (!year) return '';
  var md = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  var mo, da, y, ymd, i, mon, dn, hit, hits, dow, delta, clock, startToday;
  if (md) {
    mo = parseInt(md[1], 10);
    da = parseInt(md[2], 10);
    y = md[3] ? parseInt(md[3], 10) : year;
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return '';
    ymd = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + da).slice(-2);
    if (!md[3] && ymd < todayYmd) ymd = (y + 1) + '-' + ('0' + mo).slice(-2) + '-' + ('0' + da).slice(-2);
    return ymd;
  }
  mon = -1;
  dn = 0;
  for (i = 0; i < REM_MON.length; i++) {
    hit = t.match(new RegExp('\\b' + REM_MON[i].slice(0, 3) + '[a-z]*\\.?\\s+(\\d{1,2})\\b'));
    if (hit) { mon = i + 1; dn = parseInt(hit[1], 10); break; }
  }
  if (mon > 0 && dn >= 1 && dn <= 31) {
    ymd = year + '-' + ('0' + mon).slice(-2) + '-' + ('0' + dn).slice(-2);
    if (ymd < todayYmd) ymd = (year + 1) + '-' + ('0' + mon).slice(-2) + '-' + ('0' + dn).slice(-2);
    return ymd;
  }
  if (/\btomorrow\b/.test(t)) return addEtDays_(todayYmd, 1);
  hits = [];
  for (i = 0; i < REM_DAYS.length; i++) if (new RegExp('\\b' + REM_DAYS[i] + '\\b').test(t)) hits.push(i);
  if (hits.length !== 1) return '';
  dow = etDow_(todayYmd);
  if (dow < 0) return '';
  delta = (hits[0] - dow + 7) % 7;
  clock = whenClock_(t);
  if (delta === 0) {
    startToday = etDate_(todayYmd, clock);
    if (!(startToday && startToday.getTime() > nowMs)) delta = 7;
  }
  if (!delta) return todayYmd;
  return addEtDays_(todayYmd, delta);
}
function jobLabel_(j) {
  var name = String(j && j.name || '').replace(/\s+/g, ' ').trim();
  var system = String(j && j.system || '').replace(/\s+/g, ' ').trim();
  var line = name && system ? name + ', ' + system : (name || system || 'your floor');
  return line.slice(0, 80);
}
function jobAppt_(job, blocks, now) {
  if (!job || REM_DONE[job.status]) return null;
  var nowMs = now.getTime();
  var best = null, bestMs = 0, i, b, start, ms, when, today, ymd;
  var list = Array.isArray(blocks) ? blocks : [];
  for (i = 0; i < list.length; i++) {
    b = list[i];
    if (!b || b.job !== job.id || !b.date || !b.start) continue;
    start = etDate_(String(b.date).slice(0, 10), String(b.start).slice(0, 5));
    if (!start) continue;
    ms = start.getTime();
    if (ms <= nowMs) continue;
    if (!best || ms < bestMs) { best = start; bestMs = ms; }
  }
  if (!best && job.status === 'approved') {
    when = String((job.response && job.response.when) || '').trim();
    today = Utilities.formatDate(now, 'America/New_York', 'yyyy-MM-dd');
    ymd = whenYmd_(when, today, nowMs);
    if (ymd) best = etDate_(ymd, whenClock_(when));
  }
  if (!best || best.getTime() <= nowMs) return null;
  return {
    start: best,
    key: Utilities.formatDate(best, 'America/New_York', "yyyy-MM-dd'T'HH:mm"),
    dateLabel: Utilities.formatDate(best, 'America/New_York', 'EEEE, MMMM d'),
    timeLabel: Utilities.formatDate(best, 'America/New_York', 'h:mm a')
  };
}
function pollReminders_(creds, jobs, log) {
  var changed = false, now = Date.now(), i, row, at, status, j;
  for (i = 0; i < log.length; i++) {
    row = log[i];
    if (!row || !row.sid || row.final || row.type === 'sms') continue;
    at = Date.parse(row.at || '');
    if (isNaN(at) || now - at > 36 * 36e5) continue;
    status = twilioStatus_(creds, row.sid);
    if (!status || status === row.status) continue;
    row.status = status;
    if (reminderFinal_(status)) row.final = true;
    changed = true;
    for (j = 0; j < jobs.length; j++) {
      if (jobs[j].reminded && jobs[j].reminded.sid === row.sid) jobs[j].reminded.status = status;
    }
  }
  return changed;
}
function runRemindersLocked_() {
  var cfg = reminderCfg_(loadObj_('settings.json'));
  if (!cfg.on) return { ok: true, skipped: 'off' };
  var creds = twilioCreds_();
  var jobs = load_();
  var blocks = load_('blocks.json');
  if (!Array.isArray(jobs)) jobs = [];
  if (!Array.isArray(blocks)) blocks = [];
  var log = callLog_();
  var jobsChanged = false;
  if (creds && pollReminders_(creds, jobs, log)) {
    saveCallLog_(log);
    jobsChanged = true;
  }
  if (!creds) {
    logReminder_({ jobId: '', customer: '', to: '', test: cfg.test !== false, error: 'not configured', status: '' });
    if (jobsChanged) save_(jobs);
    return { ok: true, called: false, error: 'not configured' };
  }
  var now = new Date(), i, j, appt, choice, say, made;
  for (i = 0; i < jobs.length; i++) {
    j = jobs[i];
    appt = jobAppt_(j, blocks, now);
    if (!appt || !reminderDue_(appt.start.getTime(), now.getTime())) continue;
    if (j.reminded && j.reminded.forStart === appt.key) continue;
    choice = reminderDial_(cfg, j.phone);
    if (!guardDial_(choice, cfg.testPhone, j.phone)) {
      if (choice && (choice.skip === 'no phone' || choice.skip === 'no test number') && !alreadyLogged_(log, j.id, appt.key, choice.skip)) {
        log = logReminder_({ jobId: j.id, customer: j.name || '', to: '', test: cfg.test !== false, error: choice.skip, forStart: appt.key, status: 'skipped' });
      }
      continue;
    }
    say = reminderSay_(jobLabel_(j), appt.dateLabel, appt.timeLabel, j.address || '');
    var logId = 'RC' + Date.now().toString(36).toUpperCase() + (REM_N++);
    try { made = placeReminder_(creds, choice.dial, say, cfg.questions, j.id, logId); }
    catch (eCall) { made = { ok: false, error: String(eCall.message || eCall).slice(0, 180) }; }
    log = logReminder_({
      id: logId, jobId: j.id, customer: j.name || '', to: choice.dial, test: !!choice.test,
      sid: made.sid || '', status: made.status || '', error: made.error || '',
      forStart: appt.key, final: reminderFinal_(made.status), questions: cfg.questions
    });
    if (made.ok && made.sid) {
      j.reminded = { at: new Date().toISOString(), forStart: appt.key, sid: made.sid, status: made.status || 'queued', to: choice.dial, test: !!choice.test };
      jobsChanged = true;
    }
  }
  if (jobsChanged) save_(jobs);
  return { ok: true };
}
function remindDue_() {
  var L = LockService.getScriptLock();
  try { L.waitLock(25000); } catch (eLock) { return; }
  try { runRemindersLocked_(); }
  catch (e) {
    try { logReminder_({ jobId: '', customer: '', to: '', test: false, error: String(e && e.message || e).slice(0, 180), status: 'error' }); } catch (e2) {}
  }
  try { runTextsLocked_(); }
  catch (eText) {
    try { logReminder_({ jobId: '', customer: '', to: '', test: false, type: 'sms', error: String(eText && eText.message || eText).slice(0, 180), status: 'error' }); } catch (e4) {}
  } finally { try { L.releaseLock(); } catch (e3) {} }
}
function smsMarked_(j, kind, key) {
  var bag = j && j.smsReminded;
  return !!(bag && bag[kind] && bag[kind].forStart === key);
}
function runTextsLocked_() {
  var cfg = smsCfg_(loadObj_('settings.json'));
  if (!cfg.on) return { ok: true, skipped: 'off' };
  var creds = twilioCreds_();
  var jobs = load_();
  var blocks = load_('blocks.json');
  if (!Array.isArray(jobs)) jobs = [];
  if (!Array.isArray(blocks)) blocks = [];
  if (!creds) {
    logReminder_({ jobId: '', customer: '', to: '', test: cfg.test !== false, error: 'not configured', status: '', type: 'sms' });
    return { ok: true, called: false, error: 'not configured' };
  }
  var now = new Date();
  var log = callLog_();
  var jobsChanged = false;
  var i, j, appt, ymd, seven, k, kind, due, choice, body, made, logId;
  for (i = 0; i < jobs.length; i++) {
    j = jobs[i];
    appt = jobAppt_(j, blocks, now);
    if (!appt) continue;
    ymd = Utilities.formatDate(appt.start, 'America/New_York', 'yyyy-MM-dd');
    seven = etDate_(ymd, '07:00');
    for (k = 0; k < 2; k++) {
      kind = k === 0 ? '24h' : 'dayof';
      due = kind === '24h' ? reminderDue_(appt.start.getTime(), now.getTime()) : smsDayDue_(appt.start.getTime(), seven ? seven.getTime() : (appt.start.getTime() - 2 * 36e5), now.getTime());
      if (!due || smsMarked_(j, kind, appt.key)) continue;
      choice = smsDial_(cfg, j.phone);
      if (!guardDial_(choice, cfg.testPhone, j.phone)) {
        if (choice && (choice.skip === 'no phone' || choice.skip === 'no test number') && !alreadyLogged_(log, j.id, appt.key + '|' + kind, choice.skip)) {
          log = logReminder_({ jobId: j.id, customer: j.name || '', to: '', test: cfg.test !== false, error: choice.skip, forStart: appt.key + '|' + kind, status: 'skipped', type: 'sms', kind: kind });
        }
        continue;
      }
      body = smsFill_(kind === '24h' ? cfg.t24 : cfg.dayof, { name: j.name, address: j.address, date: appt.dateLabel, time: appt.timeLabel, est: smsEst_(j.est), work: smsWork_(j.system, j.sqft) });
      logId = 'RC' + Date.now().toString(36).toUpperCase() + (REM_N++);
      try { made = twilioSms_(creds, choice.dial, body); }
      catch (eSend) { made = { ok: false, error: String(eSend.message || eSend).slice(0, 180) }; }
      log = logReminder_({
        id: logId, jobId: j.id, customer: j.name || '', to: choice.dial, test: !!choice.test,
        sid: made.sid || '', status: made.status || '', error: made.error || '',
        forStart: appt.key, type: 'sms', kind: kind, final: true
      });
      if (made.ok && made.sid) {
        if (!j.smsReminded || typeof j.smsReminded !== 'object') j.smsReminded = {};
        j.smsReminded[kind] = { at: new Date().toISOString(), forStart: appt.key, sid: made.sid, status: made.status || 'queued', to: choice.dial, test: !!choice.test };
        jobsChanged = true;
      }
    }
  }
  if (jobsChanged) save_(jobs);
  return { ok: true };
}
function remindTest_(testPhoneRaw) {
  var phone = e164_(testPhoneRaw) || e164_(reminderCfg_(loadObj_('settings.json')).testPhone);
  var now = new Date();
  var today = Utilities.formatDate(now, 'America/New_York', 'yyyy-MM-dd');
  var start = etDate_(addEtDays_(today, 1), '08:00');
  var say = reminderSay_('Sample floor', Utilities.formatDate(start, 'America/New_York', 'EEEE, MMMM d'), Utilities.formatDate(start, 'America/New_York', 'h:mm a'), '1200 Call Street, Tallahassee, FL');
  var creds, made, log;
  if (!phone) {
    log = logReminder_({ jobId: 'sample', customer: 'Sample floor', to: '', test: true, error: 'no test number', status: 'skipped' });
    return { ok: true, called: false, error: 'no test number', callLog: log.slice(0, 80) };
  }
  creds = twilioCreds_();
  if (!creds) {
    log = logReminder_({ jobId: 'sample', customer: 'Sample floor', to: phone, test: true, error: 'not configured', status: '' });
    return { ok: true, called: false, error: 'not configured', callLog: log.slice(0, 80) };
  }
  var logId = 'RC' + Date.now().toString(36).toUpperCase() + (REM_N++);
  var qs = reminderCfg_(loadObj_('settings.json')).questions;
  try { made = placeReminder_(creds, phone, say, qs, 'sample', logId); }
  catch (e) { made = { ok: false, error: String(e.message || e).slice(0, 180) }; }
  log = logReminder_({
    id: logId, jobId: 'sample', customer: 'Sample floor', to: phone, test: true,
    sid: made.sid || '', status: made.status || '', error: made.error || '',
    forStart: Utilities.formatDate(start, 'America/New_York', "yyyy-MM-dd'T'HH:mm"),
    final: reminderFinal_(made.status), questions: qs
  });
  return { ok: true, called: !!made.ok, sid: made.sid || '', status: made.status || '', error: made.error || '', callLog: log.slice(0, 80) };
}
function upcomingJob_(jobs, blocks, now) {
  var best = null, bestJob = null, i, appt;
  var list = Array.isArray(jobs) ? jobs : [];
  for (i = 0; i < list.length; i++) {
    appt = jobAppt_(list[i], blocks, now);
    if (!appt) continue;
    if (!best || appt.start.getTime() < best.start.getTime()) {
      best = appt;
      bestJob = list[i];
    }
  }
  return bestJob ? { job: bestJob, appt: best } : null;
}
function remindNow_(ids) {
  var raw = Array.isArray(ids) ? ids : [];
  var jobs = load_();
  if (!Array.isArray(jobs)) jobs = [];
  var mine = [], seen = {}, i, k, id;
  for (i = 0; i < raw.length && mine.length < 40; i++) {
    id = String(raw[i] || '');
    if (!id || seen[id]) continue;
    for (k = 0; k < jobs.length; k++) {
      if (jobs[k] && jobs[k].id === id) { mine.push(jobs[k]); seen[id] = 1; break; }
    }
  }
  var name = mine.length && mine[0].name ? String(mine[0].name) : '';
  var phone = '';
  var fallbackId = mine.length ? String(mine[0].id || '') : '';
  for (i = 0; i < mine.length; i++) if (!phone) phone = e164_(mine[i].phone);
  var blocks = load_('blocks.json');
  if (!Array.isArray(blocks)) blocks = [];
  var hit = upcomingJob_(mine, blocks, new Date());
  var jobId = hit ? String(hit.job.id || '') : fallbackId;
  var say = hit ? reminderSay_(jobLabel_(hit.job), hit.appt.dateLabel, hit.appt.timeLabel, hit.job.address || '') : manualSay_();
  var forStart = hit ? hit.appt.key : '';
  var customer = (hit && hit.job.name) ? String(hit.job.name) : name;
  var log, creds, made;
  if (!phone) {
    log = logReminder_({ jobId: jobId, customer: customer, to: '', test: false, manual: true, error: 'no phone', status: 'skipped' });
    return { ok: true, called: false, error: 'no phone', callLog: log.slice(0, 80) };
  }
  creds = twilioCreds_();
  if (!creds) {
    log = logReminder_({ jobId: jobId, customer: customer, to: phone, test: false, manual: true, error: 'not configured', status: '' });
    return { ok: true, called: false, error: 'not configured', callLog: log.slice(0, 80) };
  }
  var logId = 'RC' + Date.now().toString(36).toUpperCase() + (REM_N++);
  var qs = questionsFrom_(((loadObj_('settings.json') || {}).reminders || {}).questions);
  try { made = placeReminder_(creds, phone, say, qs, jobId, logId); }
  catch (eNow) { made = { ok: false, error: String(eNow.message || eNow).slice(0, 180) }; }
  log = logReminder_({
    id: logId, jobId: jobId, customer: customer, to: phone, test: false, manual: true,
    sid: made.sid || '', status: made.status || '', error: made.error || '',
    forStart: forStart, final: reminderFinal_(made.status), questions: qs
  });
  return { ok: true, called: !!made.ok, sid: made.sid || '', status: made.status || '', error: made.error || '', callLog: log.slice(0, 80) };
}
function textNow_(ids) {
  var raw = Array.isArray(ids) ? ids : [];
  var jobs = load_();
  if (!Array.isArray(jobs)) jobs = [];
  var mine = [], seen = {}, i, k, id;
  for (i = 0; i < raw.length && mine.length < 40; i++) {
    id = String(raw[i] || '');
    if (!id || seen[id]) continue;
    for (k = 0; k < jobs.length; k++) {
      if (jobs[k] && jobs[k].id === id) { mine.push(jobs[k]); seen[id] = 1; break; }
    }
  }
  var name = mine.length && mine[0].name ? String(mine[0].name) : '';
  var phone = '';
  var fallbackId = mine.length ? String(mine[0].id || '') : '';
  var address = mine.length ? String(mine[0].address || '') : '';
  for (i = 0; i < mine.length; i++) if (!phone) phone = e164_(mine[i].phone);
  var blocks = load_('blocks.json');
  if (!Array.isArray(blocks)) blocks = [];
  var hit = upcomingJob_(mine, blocks, new Date());
  var jobId = hit ? String(hit.job.id || '') : fallbackId;
  var customer = (hit && hit.job.name) ? String(hit.job.name) : name;
  var cfg = smsCfg_(loadObj_('settings.json'));
  var choice, log, creds, made, body;
  if (cfg.test !== false) {
    choice = { dial: e164_(cfg.testPhone), test: true };
    if (!choice.dial) {
      log = logReminder_({ jobId: jobId, customer: customer, to: '', test: true, manual: true, type: 'sms', kind: 'now', error: 'no test number', status: 'skipped' });
      return { ok: true, called: false, error: 'no test number', callLog: log.slice(0, 80) };
    }
  } else if (!cfg.on) {
    return { ok: true, called: false, error: 'off', callLog: callLog_().slice(0, 80) };
  } else {
    choice = { dial: phone, test: false };
    if (!choice.dial) {
      log = logReminder_({ jobId: jobId, customer: customer, to: '', test: false, manual: true, type: 'sms', kind: 'now', error: 'no phone', status: 'skipped' });
      return { ok: true, called: false, error: 'no phone', callLog: log.slice(0, 80) };
    }
  }
  if (!guardDial_(choice, cfg.testPhone, phone)) {
    return { ok: true, called: false, error: 'off', callLog: callLog_().slice(0, 80) };
  }
  var srcJob = hit ? hit.job : (mine.length ? mine[0] : {});
  var fields = {
    name: (srcJob && srcJob.name) || customer,
    address: (srcJob && srcJob.address) || address,
    date: hit ? hit.appt.dateLabel : '',
    time: hit ? hit.appt.timeLabel : '',
    est: smsEst_(srcJob && srcJob.est),
    work: smsWork_(srcJob && srcJob.system, srcJob && srcJob.sqft)
  };
  if (hit) body = smsFill_(cfg.t24, fields);
  else body = smsFill_('Hi {name}, this is Southern Concrete Coatings with a reminder about estimate {est} ({work}).', fields);
  creds = twilioCreds_();
  if (!creds) {
    log = logReminder_({ jobId: jobId, customer: customer, to: choice.dial, test: !!choice.test, manual: true, type: 'sms', kind: 'now', error: 'not configured', status: '' });
    return { ok: true, called: false, error: 'not configured', callLog: log.slice(0, 80) };
  }
  try { made = twilioSms_(creds, choice.dial, body); }
  catch (eText) { made = { ok: false, error: String(eText.message || eText).slice(0, 180) }; }
  log = logReminder_({
    jobId: jobId, customer: customer, to: choice.dial, test: !!choice.test, manual: true, type: 'sms', kind: 'now',
    sid: made.sid || '', status: made.status || '', error: made.error || '', final: true
  });
  return { ok: true, called: !!made.ok, sid: made.sid || '', status: made.status || '', error: made.error || '', callLog: log.slice(0, 80) };
}
function saveVoiceAnswer_(jobId, logId, row) {
  var item = {
    q: String(row && row.q || '').slice(0, 240),
    type: row && row.type === 'speech' ? 'speech' : 'yesno',
    answer: String(row && row.answer || '').slice(0, 500),
    callback: !!(row && row.callback),
    at: new Date().toISOString()
  };
  var jobs = load_();
  var i, changed = false;
  if (jobId && jobId !== 'sample' && Array.isArray(jobs)) {
    for (i = 0; i < jobs.length; i++) {
      if (!jobs[i] || jobs[i].id !== jobId) continue;
      if (!Array.isArray(jobs[i].callAnswers)) jobs[i].callAnswers = [];
      jobs[i].callAnswers.push(item);
      if (jobs[i].callAnswers.length > 40) jobs[i].callAnswers = jobs[i].callAnswers.slice(-40);
      changed = true;
      break;
    }
    if (changed) save_(jobs);
  }
  var log = callLog_();
  for (i = 0; i < log.length; i++) {
    if (!log[i] || log[i].id !== logId) continue;
    if (!Array.isArray(log[i].answers)) log[i].answers = [];
    log[i].answers.push(item);
    if (log[i].answers.length > 20) log[i].answers = log[i].answers.slice(-20);
    if (item.answer === 'no') log[i].no = true;
    if (item.callback) log[i].callback = true;
    break;
  }
  saveCallLog_(log);
}
function twimlOut_(xml) {
  return ContentService.createTextOutput(xml).setMimeType(ContentService.MimeType.XML);
}
function twvoice_(p) {
  var jobId = String(p && p.job || '').slice(0, 40);
  var logId = String(p && p.log || '').slice(0, 48);
  var cfg = reminderCfg_(loadObj_('settings.json'));
  var questions = cfg.questions;
  var log = callLog_();
  var i;
  for (i = 0; i < log.length; i++) {
    if (log[i] && log[i].id === logId && Array.isArray(log[i].questions) && log[i].questions.length) {
      questions = log[i].questions;
      break;
    }
  }
  var base = '';
  try { base = ScriptApp.getService().getUrl() || ''; } catch (eUrl) { base = ''; }
  var step = voiceStep_({
    jobId: jobId, logId: logId, q: p && p.q, tok: p && p.tok,
    digits: (p && (p.Digits || p.digits)) || '',
    speech: (p && (p.SpeechResult || p.speech)) || '',
    questions: questions, secret: scriptProp_('TWILIO_TOKEN'), base: base, sign: voiceSign_
  });
  if (step.save) {
    var L = LockService.getScriptLock();
    try { L.waitLock(20000); saveVoiceAnswer_(jobId, logId, step.save); }
    catch (eSave) {}
    finally { try { L.releaseLock(); } catch (eRel) {} }
  }
  return twimlOut_(step.twiml);
}
function installReminderTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'remindDue_') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('remindDue_').timeBased().everyHours(1).create();
}
function setup() {
  Logger.log(root_().getUrl());
  installReminderTrigger();
}
