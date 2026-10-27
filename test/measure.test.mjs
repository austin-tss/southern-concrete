import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function grab(name) {
  const start = code.indexOf('function ' + name);
  assert.ok(start > 0, name);
  let i = code.indexOf('{', start), depth = 0, end = i;
  for (; end < code.length; end++) {
    if (code[end] === '{') depth++;
    else if (code[end] === '}' && --depth === 0) { end++; break; }
  }
  return code.slice(start, end);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code.slice(code.indexOf('function hardnessVal_'), code.indexOf('function speechItems_')), sandbox);

test('Gemini measure JSON becomes length, width, square feet, and a confidence', () => {
  const wrapped = '```json\n{"lengthFt":24,"widthFt":18,"sqft":432,"confidence":"medium","note":"Double door looks 16 ft."}\n```';
  const got = sandbox.normalizeMeasure_(wrapped);
  assert.equal(got.sqft, 432);
  assert.equal(got.lengthFt, 24);
  assert.equal(got.widthFt, 18);
  assert.equal(got.confidence, 'medium');
  assert.match(got.note, /16 ft/);
  const fromSize = sandbox.normalizeMeasure_({ length: 20, width: 20, confidence: 'sure' });
  assert.equal(fromSize.sqft, 400);
  assert.equal(fromSize.confidence, 'low');
  const text = sandbox.geminiText_({ candidates: [{ content: { parts: [{ text: '{"sqft":100,"confidence":"high","note":"one bay"}' }] } }] });
  assert.equal(sandbox.normalizeMeasure_(text).sqft, 100);
  assert.equal(sandbox.normalizeMeasure_('not json'), null);
});

test('the Gemini key stays in Script Properties and the reasoning stays off the quote', () => {
  assert.match(code, /scriptProp_\('GEMINI_API_KEY'\)/);
  assert.match(code, /scriptProp_\('GEMINI_MODEL'\)/);
  assert.match(code, /getProperty\(name\)/);
  assert.match(code, /gemini-3\.8-flash/);
  assert.match(code, /gemini-flash-latest/);
  assert.doesNotMatch(code, /gemini-2\.5-flash/);
  assert.match(code, /AI measuring not set up yet/);
  assert.doesNotMatch(code, /AIza[0-9A-Za-z_\-]{20,}/);
  assert.doesNotMatch(app + config + html, /GEMINI_API_KEY|AIza[0-9A-Za-z_\-]{20,}/);
  const measure = code.slice(code.indexOf('function measureFloor_'), code.indexOf('function saveReceiptImage_'));
  assert.match(measure, /if \(!key\) return \{ ok: true, ready: false, message: 'AI measuring not set up yet' \}/);
  assert.doesNotMatch(measure, /MailApp|sendMail_|sendQuote_/);
  const send = app.slice(app.indexOf('async function sendQ'), app.indexOf('async function fixEmail'));
  assert.doesNotMatch(send, /ainote|aiNote|known|measure/);
  assert.match(app, /AI estimate, verify on site/);
  assert.match(code, /d\.a === 'measure'/);
});

test('talk-through fill returns quote fields and leaves internal notes out', () => {
  const got = sandbox.normalizeFill_('```json\n{"name":"Pat Homeowner","phone":"850-555-0148","email":"pat@example.com","address":"1 Call St","sqft":"480","system":"Garage floor flake system","color":"Dominion","prep":["Diamond grinding","Crack repair"],"rate":"6.50","cure":"24 hours","extras":[{"title":"Moisture mitigation","price":350}],"notes":"Gate is on the left","hardness":8,"hardnessHow":"ZXHARD","internalNotes":"ZXNOTE","aiNote":"ZXAI"}\n```');
  assert.equal(got.name, 'Pat Homeowner');
  assert.equal(got.sqft, 480);
  assert.equal(got.rate, 6.5);
  assert.match(got.prep, /Diamond grinding/);
  assert.match(got.extras, /Moisture mitigation/);
  assert.equal(got.hardness, 8);
  assert.equal(got.hardnessHow, undefined);
  assert.equal(got.internalNotes, undefined);
  assert.equal(got.aiNote, undefined);
  assert.equal(sandbox.normalizeFill_('not json'), null);
  const fill = code.slice(code.indexOf('function quoteFill_'), code.indexOf('function saveReceiptImage_'));
  assert.match(fill, /AI fill not set up yet/);
  assert.match(fill, /scriptProp_\('GEMINI_API_KEY'\)/);
  assert.match(fill, /geminiGenerate_\(/);
  assert.match(fill, /customer-facing additional text/);
  assert.doesNotMatch(fill, /MailApp|sendMail_|sendQuote_/);
  assert.match(code, /d\.a === 'qfill'/);
  assert.match(app, /Talk it through/);
  assert.match(app, /Fill in the quote/);
  assert.match(app, /Customer email/);
  assert.match(app, /Reset to default/);
  assert.match(code, /quoteBody/);
  assert.doesNotMatch(html + '\n' + app, /required\s*=/);
  const prev = app.slice(app.indexOf('function prev('), app.indexOf('function itSum'));
  assert.doesNotMatch(prev, /toast\(/);
  const send = app.slice(app.indexOf('async function sendQ'), app.indexOf('async function fixEmail'));
  assert.doesNotMatch(send, /Add the customer name|Add a valid customer email|Add at least one line/);
  const quote = fs.readFileSync(new URL('../quote.js', import.meta.url), 'utf8').trim();
  const embedded = code.slice(code.indexOf('/* Quote rewriter'), code.indexOf('var TEST_MODE')).trim();
  assert.equal(embedded, quote);
  assert.match(app, /id="talkmic"/);
  assert.match(app, /Additional notes/);
  assert.match(app, /Notes for customer/);
  assert.match(app, /Edit quote/);
  assert.match(app, /Send updated estimate/);
  assert.match(app, /a: 'qedit'/);
  assert.match(app, /go\('fb'\)/);
  assert.match(app, /Send feedback/);
  assert.match(app, /Thank you\. Your note was saved\./);
  assert.match(app, /continuous = true/);
  assert.match(app, /interimResults = true/);
  assert.match(app, /en-US/);
  assert.match(html, /\.talkmic\.on/);
  assert.match(send, /additionalNotes/);
  const fb = code.slice(code.indexOf("if (d.a === 'feedback')"), code.indexOf("if (d.a === 'settings'"));
  assert.match(fb, /pinOk_\(d\)/);
  assert.match(fb, /feedback\.json/);
  assert.match(fb, /at: new Date\(\)\.toISOString\(\)/);
  assert.match(fb, /mailFeedback_\(fbList\[fbList\.length - 1\]\)/);
  assert.doesNotMatch(fb, /sendQuote_/);
  assert.match(code, /scriptProp_\('FEEDBACK_EMAIL'\)/);
  assert.match(code, /Southern Concrete Coatings app feedback/);
  assert.match(code, /function mailFeedback_\([\s\S]*catch \(eMail\)/);
  assert.match(grab('mailFeedback_'), /America\/New_York/);
  assert.match(grab('mailFeedback_'), /name: 'Southern Concrete Coatings'/);
  assert.doesNotMatch(grab('geminiFetch_'), /temperature|topP|topK/);
  assert.match(grab('geminiConfig_'), /thinkingLevel: 'low'/);
  const getFb = code.slice(code.indexOf("if (p.a === 'feedback')"), code.indexOf("if (p.a === 'img'"));
  assert.match(getFb, /feedback\.json/);
  assert.doesNotMatch(getFb, /pinOk_|MailApp/);
  const addl = code.slice(code.indexOf("d.a === 'addl'"), code.indexOf("d.a === 'inote'"));
  assert.match(addl, /additionalNotes/);
  assert.doesNotMatch(addl, /send = send/);
  const qe = code.slice(code.indexOf("d.a === 'qedit'"), code.indexOf("d.a === 'addl'"));
  assert.match(qe, /j\.total = totalOf\(j\.items\)/);
  assert.match(qe, /if \(d\.send\) send = sendQuote_/);
  assert.match(qe, /cleanItems_\(d\.items\)/);
  assert.doesNotMatch(qe, /j\.est\s*=/);
  assert.doesNotMatch(qe, /MailApp/);
});

test('a house note fills sq ft, system, color, prep, rate, and hardness', () => {
  const start = code.indexOf('var FILL_SYSTEMS');
  const end = code.indexOf('function mergeFill_');
  const box = {};
  vm.createContext(box);
  vm.runInContext(code.slice(start, end), box);
  const got = box.interpretSpeech_("doing a concrete job at a house it's about 300 ft the cutting system will use is grind and prep only color flake will be just a wolf gray wanted to do crack repair diamond grinding and the price per square foot on this one will probably need to do seven with a concrete harness of six");
  assert.equal(got.sqft, 300);
  assert.equal(got.jobType, 'Residential');
  assert.equal(got.system, 'Grind and prep only');
  assert.equal(got.color, 'Wolf Gray');
  assert.match(got.prep, /Diamond grinding/);
  assert.match(got.prep, /Crack repair/);
  assert.equal(got.rate, 7);
  assert.equal(got.hardness, 6);
});

test('Gemini retries a busy model, then tries the flash alias once', () => {
  const box = {};
  vm.createContext(box);
  vm.runInContext(grab('geminiWalk_'), box);
  const sleeps = [];
  const calls = [];
  const busy = box.geminiWalk_('gemini-3.8-flash', (model) => {
    calls.push(model);
    if (calls.length < 3) return { code: 503, body: 'high demand' };
    return { code: 200, body: '{"ok":true}' };
  }, (ms) => { sleeps.push(ms); });
  assert.deepEqual(sleeps, [1000, 3000]);
  assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash']);
  assert.equal(busy.code, 200);
  const gone = [];
  const slept = [];
  const alt = box.geminiWalk_('gemini-3.8-flash', (model) => {
    gone.push(model);
    return { code: model === 'gemini-flash-latest' ? 200 : 404, body: '' };
  }, (ms) => { slept.push(ms); });
  assert.deepEqual(slept, []);
  assert.deepEqual(gone, ['gemini-3.8-flash', 'gemini-flash-latest']);
  assert.equal(alt.code, 200);
  const once = [];
  const first = box.geminiWalk_('gemini-3.8-flash', (model) => { once.push(model); return { code: 200, body: 'ready' }; }, () => { throw new Error('should not sleep'); });
  assert.deepEqual(once, ['gemini-3.8-flash']);
  assert.equal(first.body, 'ready');
});
