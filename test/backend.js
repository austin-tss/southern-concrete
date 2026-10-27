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
var LOGO = '__LOGO_DATA_URL__';
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
    name: CO.name,
    subject: (TEST_MODE ? 'TEST - ' : '') + msg.subject,
    htmlBody: msg.html
  };
  if (msg.inlineImages) payload.inlineImages = msg.inlineImages;
  if (msg.attachments) payload.attachments = msg.attachments;
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
function settings_() {
  var o = loadObj_('settings.json');
  var min = o.finMin == null || o.finMin === '' ? 1000 : Number(String(o.finMin).replace(/[^0-9.\-]/g, ''));
  if (isNaN(min)) min = 1000;
  return {
    payLink: String(o.payLink || ''), reviewLink: String(o.reviewLink || ''), finLink: String(o.finLink || ''), finMin: min, ocr: false,
    quoteBody: String(o.quoteBody || ''), quoteSubject: String(o.quoteSubject || ''), quoteSign: String(o.quoteSign || '')
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
function scriptProp_(name) {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(name);
    return v ? String(v) : '';
  } catch (eProp) { return ''; }
}
function geminiModel_() {
  return scriptProp_('GEMINI_MODEL') || 'gemini-3.8-flash';
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
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
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
  for (var i = 0; i < parts.length; i++) if (parts[i] && parts[i].text) text += parts[i].text;
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
  return Object.keys(out).length ? out : null;
}
function quoteFill_(text) {
  // GEMINI_API_KEY and optional GEMINI_MODEL are Script Properties. Never paste the key into this file.
  var spoken = String(text || '').trim();
  if (!spoken) return { ok: true, ready: false, message: 'Say or type the job first.' };
  var key = scriptProp_('GEMINI_API_KEY');
  if (!key) return { ok: true, ready: false, message: 'AI fill not set up yet' };
  spoken = spoken.slice(0, 8000);
  var prompt = 'You fill a concrete coating estimate from what the contractor says. Return JSON with only the keys you can tell. Allowed keys: name, phone, email, address, sqft, system, color, prep, cure, rate, extras, timeline, notes. sqft and rate are numbers. prep is a comma-separated list such as diamond grinding and crack repair. extras is add-on work with its price. notes is optional customer-facing additional text that is not a line item and has no price, such as a gate code, a pet, or when to call. Omit notes when the customer does not need any extra text. Omit any key you do not know. Do not invent a price, phone, or email. Never return hardness, a Mohs number, or private notes, and do not place those in notes or extras.';
  prompt += ' Coating systems you can use: Garage floor flake system, Metallic epoxy, Solid color epoxy, Polyaspartic system, Polyurea garage system, Quartz broadcast, Pool deck coating, Patio and porch coating, Commercial kitchen floor, Warehouse / industrial floor, Concrete sealing, Grind and prep only, Crack and spall repair.';
  prompt += ' Cure choices: Same-day return, 24 hours, 48 hours, 72 hours, 5-7 days.';
  prompt += '\n\nSpoken notes:\n' + spoken;
  var gotFetch = geminiGenerate_(key, [{ text: prompt }]);
  if (!gotFetch || gotFetch.code < 200 || gotFetch.code >= 300) return { ok: true, ready: false, message: 'Could not fill that in. The notes on this phone were used instead.' };
  var parsed;
  try { parsed = JSON.parse(gotFetch.body); } catch (eParse) {
    return { ok: true, ready: false, message: 'Could not fill that in. The notes on this phone were used instead.' };
  }
  var got = normalizeFill_(geminiText_(parsed));
  if (!got) return { ok: true, ready: false, message: 'Could not fill that in. The notes on this phone were used instead.' };
  return { ok: true, ready: true, fields: got };
}
function saveReceiptImage_(image) {
  var parts = String(image || '').split(',');
  if (parts.length < 2 || !parts[1]) throw new Error('No receipt photo');
  var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), 'image/jpeg', 'receipt-' + Date.now() + '.jpg');
  return receiptsFolder_().createFile(blob).getId();
}
function blankScan_(id) {
  return { ok: true, receiptId: id || '', ocr: false, reason: 'none', data: {} };
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
function doGet(e) {
  var p = (e && e.parameter) || {};
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
  return out_({ ok: true, test: TEST_MODE, testMode: TEST_MODE, testTo: TEST_MODE ? TEST_TO : '', root: root_().getUrl(), jobs: load_(), blocks: load_('blocks.json'), settings: settings_(), gallery: gallery_() });
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
    out.push({ title: title, detail: detail, price: price });
  }
  return out;
}
function doPost(e) {
  var d = JSON.parse(e.postData.contents);
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
      return out_(quoteFill_(d.text));
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
      return out_({ ok: true });
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
        curS.ocr = false;
        curS.quoteBody = String(d.quoteBody || '').trim().slice(0, 4000);
        curS.quoteSubject = String(d.quoteSubject || '').trim().slice(0, 300);
        curS.quoteSign = String(d.quoteSign || '').trim().slice(0, 800);
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
        save_(ex, 'expenses.json');
        return out_({ ok: true, expenses: ex });
      }
      if (d.a === 'expdel') {
        var ex2 = expenses_().filter(function (x) { return x.id !== d.id; });
        save_(ex2, 'expenses.json');
        return out_({ ok: true, expenses: ex2 });
      }
      if (d.a === 'rcscan') return out_(blankScan_(saveReceiptImage_(d.image)));
      if (d.a === 'rcrescan') return out_(blankScan_(d.id));
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
      var fields = { sqft: d.sqft, system: d.system, color: d.color, prep: d.prep, cure: d.cure, rate: d.rate };
      var items = (d.items && d.items.length) ? d.items : buildItems(fields, d.quote);
      j = {
        id: 'SCC-' + Date.now().toString(36).toUpperCase(),
        est: estNo_(),
        name: d.name,
        address: d.address,
        email: String(d.email || '').trim(),
        phone: String(d.phone || '').trim(),
        quote: d.quote || '',
        sqft: numField_(d.sqft),
        system: d.system || '',
        color: d.color || '',
        prep: d.prep || '',
        cure: d.cure || '',
        rate: numField_(d.rate),
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
        j.quote = String(d.quote || '').slice(0, 8000);
        j.sqft = numField_(d.sqft);
        j.system = String(d.system || '').trim().slice(0, 80);
        j.color = String(d.color || '').trim().slice(0, 80);
        j.prep = String(d.prep || '').trim().slice(0, 240);
        j.cure = String(d.cure || '').trim().slice(0, 80);
        j.rate = numField_(d.rate);
        j.hardness = hardnessVal_(d.hardness);
        j.hardnessHow = String(d.hardnessHow || '').trim().slice(0, 300);
        j.additionalNotes = String(d.additionalNotes || '').trim().slice(0, 4000);
        j.items = cleanItems_(d.items);
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
    save_(js);
  } finally { L.releaseLock(); }
  return out_({ ok: true, testMode: TEST_MODE, job: j });
}
function setup() { Logger.log(root_().getUrl()); }
