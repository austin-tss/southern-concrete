import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (p) => fs.readFileSync(p, 'utf8');
const config = read('config.js');
const code = read('Code.gs').split('\n').filter((line) => !line.includes('base64,')).join('\n');
const appFiles = ['index.html', 'app.js', 'quote.js', 'config.js', 'test/backend.js'].map(read).join('\n') + '\n' + code;

function flag(src, name) {
  const m = src.match(new RegExp('var ' + name + ' = ([^;]+);'));
  assert.ok(m, name + ' missing');
  return m[1].trim();
}

test('test mode is the same single flag in the browser and Apps Script', () => {
  assert.equal(flag(config, 'TEST_MODE'), 'true');
  assert.equal(flag(code, 'TEST_MODE'), 'true');
  assert.equal(flag(config, 'TEST_TO'), flag(code, 'TEST_TO'));
  assert.equal(flag(config, 'TEST_TO'), "'austin@techsourcedsolutions.com'");
});

test('the only MailApp send goes through the test-mode envelope', () => {
  const sends = [...code.matchAll(/MailApp\.sendEmail/g)];
  assert.equal(sends.length, 1);
  assert.match(code, /function sendMail_\([\s\S]*envelope_\(msg\.job\)[\s\S]*MailApp\.sendEmail/);
  assert.doesNotMatch(code, /to:\s*j\.email/);
  assert.doesNotMatch(code, /to:\s*d\.email/);
  assert.match(code, /deliveryAddress\(TEST_MODE,\s*TEST_TO/);
});

test('app copy has no tree-service wording and no powershell', () => {
  const banned = /\b(fielder|fieldertree|stump|pruning|timberlane|powershell|crepe myrtle|live oak)\b|\.ps1\b|656-8737/i;
  assert.doesNotMatch(appFiles, banned);
  assert.doesNotMatch(appFiles, /\btree\b/i);
});

test('config does not point at the Fielder web app', () => {
  assert.match(config, /var API_URL = '';/);
  assert.doesNotMatch(config + '\n' + code, /AKfycb/);
});

test('quote email builders refuse a customer recipient while test mode is on', () => {
  const sandbox = { module: { exports: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(config, sandbox);
  vm.runInContext(read('quote.js'), sandbox);
  const env = sandbox.module.exports.deliveryAddress(true, sandbox.TEST_TO, 'customer@example.com', 'shop@example.com');
  assert.equal(env.to, 'austin@techsourcedsolutions.com');
  assert.equal(env.replyTo, 'austin@techsourcedsolutions.com');
  assert.notEqual(env.to, 'customer@example.com');
});
