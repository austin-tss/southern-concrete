import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import puppeteer from 'puppeteer-core';
import { start } from './mock-server.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), sandbox);
const TEST_TO = sandbox.TEST_TO;
const pins = Object.fromEntries(Object.entries(sandbox.ROLES).map(([pin, role]) => [role, pin]));
const shots = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-e2e-'));
const customer = 'homeowner@example.com';

function fail(msg) { throw new Error(msg); }
async function shot(page, name) { await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true }); }
async function pressPin(page, pin) {
  for (const digit of pin) {
    await page.evaluate((digit) => {
      const btn = [...document.querySelectorAll('.pin button')].find((b) => b.textContent === digit);
      if (!btn) throw new Error('missing pin key');
      btn.click();
    }, digit);
  }
}
async function waitText(page, text) {
  await page.waitForFunction((text) => document.body.innerText.includes(text), { timeout: 15000 }, text);
}

const server = await start(0);
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
page.setDefaultTimeout(15000);
page.on('dialog', (d) => d.accept());
const png = path.join(shots, 'swatch.png');
fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

try {
  await page.goto(base + '/?api=' + encodeURIComponent(base + '/exec'), { waitUntil: 'networkidle0' });
  await waitText(page, 'Test mode');
  await waitText(page, TEST_TO);
  const logo = await page.$eval('header img', (img) => img.naturalWidth);
  if (!logo) fail('logo did not load');
  await shot(page, '01-login');

  await pressPin(page, pins.Manager);
  await waitText(page, 'New customer quote');
  await page.click('button.huge');
  await waitText(page, 'Price per sq ft');
  await page.type('#nm', 'Pat Homeowner');
  await page.type('#ad', '1200 Call Street Tallahassee');
  await page.waitForSelector('#adsug button', { timeout: 8000 });
  await page.click('#adsug button');
  const chosen = await page.$eval('#ad', (el) => el.value);
  if (!/Tallahassee/i.test(chosen) || !/FL|Florida/i.test(chosen)) fail('address suggestion was ' + chosen);
  await page.type('#em', customer);
  await page.type('#sqft', '480');
  await page.select('#system', 'Garage floor flake system');
  await page.type('#color', 'Dominion');
  await page.click('#prepbox input[value="Diamond grinding"]');
  await page.click('#prepbox input[value="Crack repair"]');
  await page.select('#cure', '24 hours');
  await page.type('#rate', '6.50');
  await waitText(page, '$3,120.00');
  const talk = await page.$eval('#mb', (b) => b.textContent);
  if (!talk.includes('Talk')) fail('voice button missing');
  await shot(page, '02-quote');
  await page.click('button.huge.d');
  await waitText(page, 'Customer will see');
  await page.waitForFunction(() => [...document.querySelectorAll('#pv textarea,#pv input')].some((el) => (el.value || '').includes('Dominion') && (el.value || '').includes('480')));
  await page.click('#sq');
  await waitText(page, 'Projects (1)');
  await shot(page, '03-manager-list');

  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Pat Homeowner')).click();
  });
  await waitText(page, 'A Approve');
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('A Approve')).click();
  });
  await waitText(page, 'Approved');
  await shot(page, '04-approved');
  await page.click('#out');
  await waitText(page, 'Enter your PIN');

  await pressPin(page, pins.Crew);
  await waitText(page, 'JOB COMPLETE');
  await waitText(page, 'Dominion');
  await waitText(page, '480 sq ft');
  const before = await page.$('#bf');
  await before.uploadFile(png);
  await waitText(page, 'Before (1)');
  const after = await page.$('#af');
  await after.uploadFile(png);
  await waitText(page, 'After (1)');
  await shot(page, '05-crew');
  await page.click('#jc');
  await waitText(page, 'Your jobs');
  await shot(page, '06-crew-done');
  await page.click('#out');

  await pressPin(page, pins.Admin);
  await waitText(page, 'Invoices');
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Pat Homeowner')).click();
  });
  await waitText(page, 'Prefilled from the quote');
  const amount = await page.$eval('#am', (el) => el.value);
  if (amount !== '$3,120.00') fail('invoice amount was ' + amount);
  await shot(page, '07-invoice');
  await page.click('#invbtn');
  await waitText(page, 'Mark PAID');
  await waitText(page, 'OPEN');
  await page.click('#paidbtn');
  await waitText(page, 'PAID');
  await shot(page, '08-paid');

  const inbox = await (await fetch(base + '/inbox')).json();
  if (inbox.length !== 3) fail('expected 3 emails, got ' + inbox.length);
  for (const mail of inbox) {
    if (mail.to !== TEST_TO || mail.replyTo !== TEST_TO) fail('mail left test mode: ' + JSON.stringify({ to: mail.to, replyTo: mail.replyTo, kind: mail.kind }));
    if (String(mail.to).includes('example.com') || String(mail.replyTo).includes('example.com')) fail('customer address used');
    if (!/TEST - /.test(mail.subject)) fail('subject missing TEST prefix');
  }
  const quote = inbox.find((m) => m.kind === 'quote');
  const recap = inbox.find((m) => m.kind === 'recap');
  const invoice = inbox.find((m) => m.kind === 'invoice');
  for (const bit of ['A) Approve', 'B) Approve with changes', 'C) Decline', 'Other', 'Dominion', '$3,120.00']) {
    if (!quote.html.includes(bit)) fail('quote missing ' + bit);
  }
  if (quote.html.includes('mailto:' + customer)) fail('quote links to the customer');
  for (const bit of ['Before', 'After', 'Refer a neighbor', 'southernconcretecoatingsllc.com']) {
    if (!recap.html.includes(bit)) fail('recap missing ' + bit);
  }
  if (!invoice.html.includes('$3,120.00')) fail('invoice html missing amount');
  console.log(JSON.stringify({ ok: true, shots, emails: inbox.map((m) => ({ kind: m.kind, to: m.to, subject: m.subject })) }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
