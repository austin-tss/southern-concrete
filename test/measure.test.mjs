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
vm.runInContext(grab('normalizeMeasure_') + '\n' + grab('geminiText_') + '\n' + grab('normalizeFill_'), sandbox);

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
  assert.match(code, /gemini-2\.5-flash/);
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
  assert.equal(got.hardness, undefined);
  assert.equal(got.hardnessHow, undefined);
  assert.equal(got.internalNotes, undefined);
  assert.equal(got.aiNote, undefined);
  assert.equal(sandbox.normalizeFill_('not json'), null);
  const fill = code.slice(code.indexOf('function quoteFill_'), code.indexOf('function saveReceiptImage_'));
  assert.match(fill, /AI fill not set up yet/);
  assert.match(fill, /scriptProp_\('GEMINI_API_KEY'\)/);
  assert.match(fill, /geminiModel_\(\)/);
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
});
