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

const names = ['e164_', 'questionsFrom_', 'reminderCfg_', 'reminderDial_', 'guardDial_', 'smsDefault24_', 'smsDefaultDay_', 'smsOld24_', 'smsOldDay_', 'smsStored_', 'smsCfg_', 'smsDial_', 'smsBit_', 'smsEst_', 'smsSq_', 'smsWork_', 'smsTidy_', 'smsFill_', 'smsSendAtMs_', 'smsDayDue_', 'reminderDue_', 'reminderSay_', 'manualSay_', 'xmlEsc_', 'reminderTwiml_', 'goodbyeTwiml_', 'questionPrompt_', 'voiceMsg_', 'voiceToken_', 'voiceOk_', 'voiceUrl_', 'gatherXml_', 'openingTwiml_', 'callTwiml_', 'voiceAnswer_', 'voiceRejectTwiml_', 'voiceStep_', 'reminderFinal_'];
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
  assert.equal(sandbox.manualSay_(), 'This is Southern Concrete Coatings calling with a reminder about your upcoming service. Call us with any questions.');
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

test('manual call dials the customer and leaves the job unmarked', () => {
  for (const src of [code, backend]) {
    const body = grab(src, 'remindNow_');
    assert.match(src, /d\.a === 'remindnow'/);
    assert.match(body, /manual: true/);
    assert.match(body, /placeReminder_\(creds, phone, say/);
    assert.match(body, /manualSay_\(\)/);
    assert.match(body, /upcomingJob_/);
    assert.doesNotMatch(body, /reminded/);
    assert.doesNotMatch(body, /reminderDial_/);
    assert.doesNotMatch(body, /reminderCfg_/);
    assert.doesNotMatch(body, /MailApp/);
  }
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(app, /id="callnow"/);
  assert.match(app, /Call ' \+ c\.name \+ ' at ' \+ number \+ ' now\?/);
  assert.match(app, /a: 'remindnow'/);
  assert.match(app, /role !== 'Owner'/);
  assert.match(app, /c\.manual \? 'Manual'/);
});

test('call questions gather on GET and reject a bad token', () => {
  const sign = (msg, secret) => secret + ':' + msg;
  const cfg = sandbox.reminderCfg_({});
  assert.equal(cfg.questions.length, 1);
  assert.equal(cfg.questions[0].text, 'Will the driveway or work area be cleared before we arrive?');
  assert.equal(cfg.questions[0].type, 'yesno');
  assert.equal(sandbox.questionsFrom_([]).length, 0);
  const custom = sandbox.questionsFrom_([
    { text: '  Gate code? ', type: 'speech' },
    { text: 'Tom & Sue ready?', type: 'yesno' },
    { text: '   ', type: 'yesno' }
  ]);
  assert.equal(custom.length, 2);
  assert.equal(custom[0].type, 'speech');
  const qs = cfg.questions.concat([{ text: 'What is the gate code?', type: 'speech' }]);
  const tok0 = sandbox.voiceToken_('J1', 'RC1', 0, 'sek', sign);
  const opening = sandbox.callTwiml_('Hello there.', qs, 'J1', 'RC1', 'sek', 'https://script.google.com/macros/s/ABC/exec', sign);
  assert.match(opening, /Hello there\./);
  assert.match(opening, /input="dtmf speech"/);
  assert.match(opening, /method="GET"/);
  assert.match(opening, /Press 1 for yes, 2 for no\./);
  assert.match(opening, /Press 0 to request a callback\./);
  assert.match(opening, /Thanks, see you then\. Call us if anything changes\./);
  assert.match(opening, /a=twvoice/);
  assert.match(opening, /&amp;log=/);
  assert.doesNotMatch(opening, /method="POST"/);
  const first = sandbox.voiceStep_({
    jobId: 'J1', logId: 'RC1', q: 0, tok: tok0, digits: '2', speech: '',
    questions: qs, secret: 'sek', base: 'https://script.google.com/macros/s/ABC/exec', sign
  });
  assert.equal(first.ok, true);
  assert.equal(first.save.answer, 'no');
  assert.equal(first.save.callback, false);
  assert.match(first.twiml, /What is the gate code\?/);
  assert.match(first.twiml, /method="GET"/);
  assert.match(first.twiml, /&amp;q=1/);
  const spoken = sandbox.voiceStep_({
    jobId: 'J1', logId: 'RC1', q: 1, tok: sandbox.voiceToken_('J1', 'RC1', 1, 'sek', sign),
    digits: '', speech: 'The code is 12', questions: qs, secret: 'sek',
    base: 'https://script.google.com/macros/s/ABC/exec', sign
  });
  assert.equal(spoken.save.answer, 'The code is 12');
  assert.match(spoken.twiml, /Thanks, see you then\. Call us if anything changes\./);
  assert.doesNotMatch(spoken.twiml, /<Gather/);
  const cb = sandbox.voiceAnswer_('yesno', '0', 'yes');
  assert.equal(cb.callback, true);
  assert.equal(sandbox.voiceAnswer_('yesno', '', 'nope').answer, 'no');
  assert.equal(sandbox.voiceAnswer_('yesno', '1', 'no').answer, 'yes');
  const bad = sandbox.voiceStep_({
    jobId: 'J1', logId: 'RC1', q: 0, tok: 'nope', digits: '1', speech: '',
    questions: qs, secret: 'sek', base: 'https://script.google.com/macros/s/ABC/exec', sign
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.save, null);
  assert.match(bad.twiml, /<Hangup\/>/);
  const escaped = sandbox.gatherXml_({ text: 'Tom & Sue <ready>?', type: 'yesno' }, 'https://example.com/exec?a=twvoice&q=0');
  assert.match(escaped, /Tom &amp; Sue &lt;ready&gt;\?/);
  assert.match(escaped, /action="https:\/\/example.com\/exec\?a=twvoice&amp;q=0"/);
  for (const src of [code, backend]) {
    assert.match(src, /p\.a === 'twvoice'/);
    assert.match(src, /peek\.a === 'twvoice'/);
    assert.match(src, /function saveVoiceAnswer_/);
    assert.match(src, /method="GET"/);
    assert.match(src, /delete o\.callAnswers/);
    const voice = src.slice(src.indexOf('function twvoice_'), src.indexOf('function installReminderTrigger'));
    assert.doesNotMatch(voice, /MailApp/);
  }
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(app, /Call questions/);
  assert.match(app, /id="remqadd"/);
  assert.match(app, /class="badge callflag"/);
  assert.match(app, /Will the driveway or work area be cleared before we arrive\?/);
});

test('text reminders stay on the test phone and leave hardness out', () => {
  const cust = '8505550199';
  const cfg = sandbox.smsCfg_({});
  assert.equal(cfg.on, false);
  assert.equal(cfg.test, true);
  assert.equal(cfg.testPhone, '8504453792');
  assert.equal(sandbox.smsCfg_({ reminders: { testPhone: '8505550100' } }).testPhone, '8505550100');
  assert.equal(sandbox.smsDial_({ on: false, test: true, testPhone: '8504453792' }, cust).skip, 'off');
  const testText = sandbox.smsDial_({ on: true, test: true, testPhone: '(850) 445-3792' }, cust);
  assert.equal(testText.dial, '+18504453792');
  assert.equal(testText.test, true);
  assert.notEqual(testText.dial, '+18505550199');
  assert.equal(sandbox.guardDial_(testText, '8504453792', cust), true);
  const live = sandbox.smsDial_({ on: true, test: false, testPhone: '8504453792' }, cust);
  assert.equal(live.dial, '+18505550199');
  assert.equal(live.test, false);
  assert.equal(sandbox.guardDial_(live, '8504453792', cust), true);
  const work = sandbox.smsWork_('Garage floor flake system', 480);
  assert.equal(work, 'Garage floor flake system, 480 sq ft');
  assert.equal(sandbox.smsWork_('Garage floor flake system', ''), 'Garage floor flake system');
  assert.equal(sandbox.smsWork_('', 1200), '1,200 sq ft');
  assert.equal(sandbox.smsEst_('SCC-EST-2026-0012'), 'EST-0012');
  assert.equal(sandbox.smsEst_(''), '');
  const full = { name: 'Pat', address: '1200 Call Street', date: 'Tuesday, October 28', time: '8:00 AM', est: 'EST-0012', work: work };
  const dayBefore = sandbox.smsFill_(sandbox.smsDefault24_(), full);
  assert.equal(dayBefore, "Hi Pat, this is Southern Concrete Coatings. Reminder: we're scheduled for estimate EST-0012 (Garage floor flake system, 480 sq ft) at 1200 Call Street on Tuesday, October 28 at 8:00 AM. See you then!");
  const morning = sandbox.smsFill_(sandbox.smsDefaultDay_(), full);
  assert.equal(morning, "Hey Pat, Southern Concrete Coatings here. We're on the way today at 8:00 AM for estimate EST-0012 (Garage floor flake system, 480 sq ft).");
  const bare = sandbox.smsFill_(sandbox.smsDefault24_(), { name: 'Pat', address: '1200 Call Street', date: 'Tuesday, October 28', time: '8:00 AM' });
  assert.equal(bare, "Hi Pat, this is Southern Concrete Coatings. Reminder: we're scheduled at 1200 Call Street on Tuesday, October 28 at 8:00 AM. See you then!");
  const morningBare = sandbox.smsFill_(sandbox.smsDefaultDay_(), { name: 'Pat', time: '8:00 AM' });
  assert.equal(morningBare, "Hey Pat, Southern Concrete Coatings here. We're on the way today at 8:00 AM.");
  const estOnly = sandbox.smsFill_(sandbox.smsDefaultDay_(), { name: 'Pat', time: '8:00 AM', est: 'EST-0012' });
  assert.equal(estOnly, "Hey Pat, Southern Concrete Coatings here. We're on the way today at 8:00 AM for estimate EST-0012.");
  assert.equal(sandbox.smsCfg_({ texts: { t24: sandbox.smsOld24_(), dayof: sandbox.smsOldDay_() } }).t24, sandbox.smsDefault24_());
  const dirty = sandbox.smsFill_('Note {hardness} {hardnessHow} {internalNotes} {name}', { name: 'Pat' });
  assert.equal(dirty, 'Note Pat');
  assert.doesNotMatch(dirty, /ZXNOTE|Mohs|hardness/);
  const H = 36e5;
  assert.equal(sandbox.smsSendAtMs_(10 * H, 7 * H), 7 * H);
  assert.equal(sandbox.smsDayDue_(10 * H, 7 * H, 7 * H), true);
  assert.equal(sandbox.smsDayDue_(10 * H, 7 * H, 7 * H - 1), false);
  assert.equal(sandbox.smsDayDue_(10 * H, 7 * H, 9 * H), true);
  assert.equal(sandbox.smsDayDue_(10 * H, 7 * H, 9 * H + 1), false);
  assert.equal(sandbox.smsSendAtMs_(8 * H, 7 * H), 6 * H);
  assert.equal(sandbox.smsDayDue_(8 * H, 7 * H, 6.5 * H), true);
  assert.equal(sandbox.smsDayDue_(8 * H, 7 * H, 8 * H), false);
  assert.match(code, /Polly\.Matthew-Neural/);
  for (const src of [code, backend]) {
    assert.match(src, /Messages\.json/);
    assert.match(src, /runTextsLocked_\(\)/);
    assert.match(src, /type: 'sms'/);
    assert.match(src, /d\.a === 'textnow'/);
    const manual = grab(src, 'textNow_');
    const scheduled = grab(src, 'runTextsLocked_');
    assert.match(manual, /guardDial_/);
    assert.match(scheduled, /guardDial_/);
    assert.match(scheduled, /smsReminded/);
    assert.doesNotMatch(manual, /smsReminded|hardness|internalNotes|MailApp/);
    assert.doesNotMatch(scheduled, /hardness|internalNotes|MailApp/);
    assert.match(scheduled, /if \(!cfg\.on\) return \{ ok: true, skipped: 'off' \}/);
  }
  const app = fs.readFileSync('app.js', 'utf8');
  assert.match(app, /Text reminders/);
  assert.match(app, /id="textnow"/);
  assert.match(app, /id="smson"/);
  assert.match(app, /id="smstest"/);
  assert.match(app, /8504453792/);
  assert.match(app, /'the test phone'/);
});
