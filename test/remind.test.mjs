import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('Code.gs', 'utf8');
const backend = fs.readFileSync('test/backend.js', 'utf8');

function grab(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (!depth) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

const names = ['e164_', 'reminderCfg_', 'reminderDial_', 'guardDial_', 'reminderDue_', 'reminderSay_', 'xmlEsc_', 'reminderTwiml_', 'reminderFinal_'];
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(names.map((n) => grab(code, n)).join('\n'), sandbox);

test('reminder dial stays on the test phone until live mode', () => {
  const cust = '8505550199';
  assert.equal(sandbox.reminderDial_({ on: false, test: true, testPhone: '8505550100' }, cust).skip, 'off');
  assert.equal(sandbox.reminderDial_(null, cust).skip, 'off');
  const testCall = sandbox.reminderDial_({ on: true, test: true, testPhone: '(850) 555-0100' }, cust);
  assert.equal(testCall.dial, '+18505550100');
  assert.equal(testCall.test, true);
  assert.notEqual(testCall.dial, '+18505550199');
  assert.equal(sandbox.guardDial_(testCall, '(850) 555-0100', cust), true);
  assert.equal(sandbox.reminderDial_({ on: true, test: true, testPhone: '' }, cust).skip, 'no test number');
  const live = sandbox.reminderDial_({ on: true, test: false, testPhone: '8505550100' }, cust);
  assert.equal(live.dial, '+18505550199');
  assert.equal(live.test, false);
  assert.equal(sandbox.guardDial_(live, '8505550100', cust), true);
  assert.equal(sandbox.reminderDial_({ on: true, test: false, testPhone: '8505550100' }, '').skip, 'no phone');
  const cfg = sandbox.reminderCfg_({});
  assert.equal(cfg.on, false);
  assert.equal(cfg.test, true);
  assert.equal(sandbox.reminderCfg_({ reminders: { on: true, test: false, testPhone: '8505550100' } }).on, true);
  assert.equal(sandbox.reminderCfg_({ reminders: { on: true, test: false, testPhone: '8505550100' } }).test, false);
});

test('day-before window is 20 to 28 hours', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  assert.equal(sandbox.reminderDue_(now + 20 * 36e5, now), true);
  assert.equal(sandbox.reminderDue_(now + 24 * 36e5, now), true);
  assert.equal(sandbox.reminderDue_(now + 28 * 36e5, now), true);
  assert.equal(sandbox.reminderDue_(now + 19.9 * 36e5, now), false);
  assert.equal(sandbox.reminderDue_(now + 28.1 * 36e5, now), false);
  assert.equal(sandbox.reminderDue_(now + 10 * 36e5, now), false);
  assert.equal(sandbox.reminderDue_(now + 30 * 36e5, now), false);
});

test('reminder script reads the appointment', () => {
  const withAddr = sandbox.reminderSay_('Garage floor', 'Tuesday, October 28', '8:00 AM', '1200 Call Street, Tallahassee, FL');
  assert.equal(withAddr, 'Hi, this is Southern Concrete Coatings reminding you of your appointment for Garage floor on Tuesday, October 28 at 8:00 AM at 1200 Call Street, Tallahassee, FL. Call us if you need to reschedule.');
  const plain = sandbox.reminderSay_('Garage floor', 'Tuesday, October 28', '8:00 AM', '');
  assert.equal(plain, 'Hi, this is Southern Concrete Coatings reminding you of your appointment for Garage floor on Tuesday, October 28 at 8:00 AM. Call us if you need to reschedule.');
  assert.match(sandbox.reminderTwiml_('Tom & Sue <floor>'), /Tom &amp; Sue &lt;floor&gt;/);
  assert.equal(sandbox.reminderFinal_('completed'), true);
  assert.equal(sandbox.reminderFinal_('no-answer'), true);
  assert.equal(sandbox.reminderFinal_('busy'), true);
  assert.equal(sandbox.reminderFinal_('failed'), true);
  assert.equal(sandbox.reminderFinal_('canceled'), true);
  assert.equal(sandbox.reminderFinal_('queued'), false);
});

test('hourly trigger and Twilio stay in the script', () => {
  for (const src of [code, backend]) {
    assert.match(src, /function installReminderTrigger\(\)/);
    assert.match(src, /ScriptApp\.newTrigger\('remindDue_'\)\.timeBased\(\)\.everyHours\(1\)\.create\(\)/);
    assert.match(src, /function setup\(\) \{[\s\S]*installReminderTrigger\(\)/);
    assert.match(src, /TWILIO_SID/);
    assert.match(src, /TWILIO_TOKEN/);
    assert.match(src, /TWILIO_FROM/);
    assert.match(src, /Calls\.json/);
    assert.match(src, /Twiml:/);
    assert.match(src, /error: 'not configured'/);
    const block = src.slice(src.indexOf('function e164_'), src.indexOf('function setup('));
    assert.doesNotMatch(block, /MailApp/);
    assert.match(block, /if \(!cfg\.on\) return \{ ok: true, skipped: 'off' \}/);
  }
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(app, /Send test call now/);
  assert.match(app, /id="remon"/);
  assert.match(app, /id="remtest"/);
  assert.match(app, /Reminder call log/);
  assert.match(app, /id="remindcard"/);
});
