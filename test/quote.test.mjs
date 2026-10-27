import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const q = require('../quote.js');

const colors = { n: '#3a415c', g: '#424866', dg: '#2a3148' };
const co = {
  name: 'Southern Concrete Coatings',
  legal: 'Southern Concrete Coatings LLC',
  addr: 'Tallahassee, FL',
  phone: '(850) 766-9992',
  email: 'mccardlematt@yahoo.com',
  web: 'www.southernconcretecoatingsllc.com',
  site: 'https://www.southernconcretecoatingsllc.com/'
};
const TEST_TO = 'austin@techsourcedsolutions.com';

test('per-sq-ft garage flake price', () => {
  const items = q.rewriteQuote('480 sq ft garage flake system in Dominion $6.50 per sq ft');
  assert.equal(items.length, 1);
  assert.match(items[0].title, /Garage Floor/);
  assert.match(items[0].title, /Flake System/);
  assert.match(items[0].title, /480 sq ft/);
  assert.equal(items[0].price, 3120);
  assert.match(items[0].detail, /\$6\.50 per sq ft/);
});

test('metallic epoxy rate without a dollar sign on the rate words', () => {
  const items = q.rewriteQuote('220 square feet metallic epoxy at $12 a sq ft');
  assert.equal(items[0].price, 2640);
  assert.match(items[0].title, /Metallic Epoxy/);
});

test('slash rate and commercial kitchen', () => {
  const items = q.rewriteQuote('1200 sq ft commercial kitchen polyaspartic $8/sq ft');
  assert.equal(items[0].price, 9600);
  assert.match(items[0].title, /Commercial Kitchen/);
  assert.match(items[0].title, /Polyaspartic/);
});

test('lump sum sealer does not invent a sq ft rate', () => {
  const items = q.rewriteQuote('seal the patio $450');
  assert.equal(items[0].price, 450);
  assert.match(items[0].title, /Patio/);
  assert.match(items[0].title, /Sealer/);
});

test('crack repair line', () => {
  const items = q.rewriteQuote('crack repair on the garage $275');
  assert.equal(items[0].price, 275);
  assert.match(items[0].title, /Garage Floor|Crack Repair/);
});

test('two areas split into two priced lines', () => {
  const items = q.rewriteQuote('garage 400 sq ft flake $6/sq ft and patio 200 sq ft sealer $3 per sq ft');
  assert.equal(items.length, 2);
  assert.equal(items[0].price, 2400);
  assert.equal(items[1].price, 600);
  assert.equal(q.totalOf(items), 3000);
});

test('grind and crack stay one included line', () => {
  const items = q.rewriteQuote('grind and crack repair included');
  assert.equal(items.length, 1);
  assert.equal(items[0].price, null);
  assert.match(items[0].title + items[0].detail, /Grind|Crack/);
});

test('structured fields price the floor and spoken notes add a line', () => {
  const items = q.buildItems({
    sqft: '480',
    system: 'Garage floor flake system',
    color: 'Dominion',
    prep: 'Diamond grinding, Crack repair',
    cure: '24 hours',
    rate: '6.50'
  }, 'extra moisture mitigation $350');
  assert.equal(items[0].price, 3120);
  assert.match(items[0].detail, /Dominion/);
  assert.match(items[0].detail, /24 hours/);
  assert.match(items[0].detail, /Diamond grinding/);
  assert.equal(items[1].price, 350);
});

test('delivery address ignores the customer while test mode is on', () => {
  const on = q.deliveryAddress(true, TEST_TO, 'homeowner@example.com', co.email);
  assert.deepEqual(on, { to: TEST_TO, replyTo: TEST_TO });
  const off = q.deliveryAddress(false, TEST_TO, 'homeowner@example.com', co.email);
  assert.equal(off.to, 'homeowner@example.com');
  assert.equal(off.replyTo, co.email);
});

test('quote email has A/B/C/Other, test banner, and no customer recipient', () => {
  const job = {
    id: 'SCC-1', est: 'SCC-EST-2026-0001', name: 'Pat Homeowner',
    address: '1 Call St, Tallahassee, FL', email: 'pat@example.com',
    sqft: 480, system: 'Garage floor flake system', color: 'Dominion',
    prep: 'Diamond grinding', cure: '24 hours', rate: 6.5,
    items: q.buildItems({ sqft: 480, system: 'Garage floor flake system', color: 'Dominion', prep: 'Diamond grinding', cure: '24 hours', rate: 6.5 }, ''),
    total: 3120, date: 'October 27, 2026'
  };
  const html = q.quoteEmailHtml({
    co, colors, job, testMode: true, testTo: TEST_TO, logoSrc: 'cid:logo',
    photosHtml: '<img alt="site">',
    link: (k) => 'https://script.example/?ans=' + k
  });
  for (const bit of ['A) Approve', 'B) Approve with changes', 'C) Decline', 'Other', 'Dominion', '480 sq ft', '$6.50', TEST_TO, 'TEST MODE']) {
    assert.match(html, new RegExp(bit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(html, /mailto:pat@example.com/i);
  assert.doesNotMatch(html, /\b(tree|stump|pruning|fielder|oak)\b/i);
});

test('recap has before, after, and refer-a-neighbor', () => {
  const html = q.recapEmailHtml({
    co, colors, testMode: true, testTo: TEST_TO, logoSrc: 'cid:logo',
    beforeHtml: '<img alt="before">', afterHtml: '<img alt="after">',
    job: {
      name: 'Pat', address: '1 Call St', email: 'pat@example.com', est: 'SCC-EST-2026-0001',
      items: [{ title: 'Garage Floor Flake System', detail: '480 sq ft', price: 3120 }],
      total: 3120, crewNotes: 'Floor was clear.', response: { avail: 'Weekdays 8-12', when: 'Tuesday' }
    }
  });
  assert.match(html, /Before/);
  assert.match(html, /After/);
  assert.match(html, /Refer a neighbor/);
  assert.match(html, /southernconcretecoatingsllc\.com/);
  assert.match(html, /TEST MODE/);
  assert.match(html, new RegExp(TEST_TO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('response form offers the chosen answer and a time window', () => {
  const html = q.responseFormHtml({
    co, colors, ans: 'O', action: 'https://script.example/exec',
    labels: { A: 'Approved', B: 'Approved with changes', C: 'Declined', O: 'Question / other' },
    slots: ['Weekdays 8-12', 'Weekdays 12-5', 'Weekends', 'Anytime'],
    job: { id: 'SCC-1', est: 'SCC-EST-2026-0001', address: '1 Call St' }
  });
  assert.match(html, /Question \/ other/);
  assert.match(html, /name="ans" value="O"/);
  assert.match(html, /Anytime/);
  assert.match(html, /When can the crew have the floor/);
});

test('pay and financing links appear only when settings allow them', () => {
  const job = {
    name: 'Pat', address: '1 Call St', email: 'pat@example.com', est: 'SCC-EST-2026-0001',
    items: [{ title: 'Garage Floor Flake System', detail: '480 sq ft', price: 3120 }],
    total: 3120, invoice: { amount: '$3,120.00', note: 'Due now' }
  };
  const base = { co, colors, job, testMode: false, testTo: TEST_TO, logoSrc: 'cid:logo', link: (k) => 'https://script.example/?ans=' + k };
  assert.doesNotMatch(q.quoteEmailHtml(base), /Pay now/);
  const on = Object.assign({}, base, { settings: { payLink: 'https://pay.example/scc', finLink: 'https://finance.example/scc', finMin: 1000 } });
  assert.match(q.quoteEmailHtml(on), /Pay now/);
  assert.match(q.quoteEmailHtml(on), /Pay over time/);
  assert.match(q.invoiceEmailHtml(on), /Pay now/);
  const small = Object.assign({}, base, { job: Object.assign({}, job, { total: 400, invoice: { amount: '$400.00' } }), settings: { payLink: '', finLink: 'https://finance.example/scc', finMin: 1000 } });
  assert.doesNotMatch(q.invoiceEmailHtml(small), /Pay over time/);
});

test('hardness and internal notes never reach a customer-facing render', () => {
  const shared = {
    id: 'SCC-1', est: 'SCC-EST-2026-0001', name: 'Pat Homeowner',
    address: '1 Call St, Tallahassee, FL', email: 'pat@example.com',
    sqft: 480, system: 'Garage floor flake system', color: 'Dominion',
    prep: 'Diamond grinding', cure: '24 hours', rate: 6.5,
    items: [{ title: 'Garage Floor Flake System', detail: '480 sq ft', price: 3120 }],
    total: 3120, date: 'October 27, 2026',
    crewNotes: 'Floor was clear.',
    invoice: { amount: '$3,120.00', note: 'Payment due within 15 days.' },
    response: { ans: 'A', label: 'Approved', text: 'Please call before noon', avail: 'Weekdays 8-12', when: 'Tuesday' }
  };
  function face(extra) {
    return {
      co, colors, testMode: false, testTo: TEST_TO, logoSrc: 'cid:logo',
      settings: { reviewLink: 'https://g.page/r/example/review', payLink: 'https://pay.example/scc', finLink: '', finMin: 1000 },
      link: (k) => 'https://script.example/?ans=' + k,
      ans: 'A', action: 'https://script.example/exec',
      labels: { A: 'Approved', B: 'Approved with changes', C: 'Declined', O: 'Question / other' },
      slots: ['Weekdays 8-12', 'Weekdays 12-5', 'Weekends', 'Anytime'],
      photosHtml: '<img alt="site">', beforeHtml: '<img alt="before">', afterHtml: '<img alt="after">',
      job: Object.assign({}, shared, extra)
    };
  }
  const dirty = {
    hardness: 8,
    hardnessHow: 'ZXHARD penny scratch on the north slab',
    internalNotes: [{ t: '2026-10-27T18:04:00.000Z', text: 'ZXNOTE do not mention the failed scratch' }]
  };
  const other = { hardness: 3, hardnessHow: '', internalNotes: [] };
  const fns = ['quoteEmailHtml', 'pdfHtml', 'recapEmailHtml', 'invoiceEmailHtml', 'responseFormHtml', 'responseThanksHtml', 'reviewEmailHtml'];
  for (const name of fns) {
    const left = q[name](face(dirty));
    const right = q[name](face(other));
    assert.equal(left, right, name + ' changed when the hardness value or internal notes changed');
    assert.doesNotMatch(left, /ZXHARD/, name);
    assert.doesNotMatch(left, /ZXNOTE/, name);
    assert.doesNotMatch(left, /Mohs/i, name);
    assert.doesNotMatch(left, /hardnessHow|internalNotes/, name);
  }
  const stripped = q.customerJob(Object.assign({}, shared, dirty));
  assert.equal(stripped.hardness, undefined);
  assert.equal(stripped.hardnessHow, undefined);
  assert.equal(stripped.internalNotes, undefined);
  assert.equal(stripped.crewNotes, 'Floor was clear.');
  assert.match(q.quoteEmailHtml(face(dirty)), /A\) Approve/);
  assert.match(q.pdfHtml(face(dirty)), /Dominion/);
  assert.match(q.recapEmailHtml(face(dirty)), /Floor was clear/);
  assert.match(q.invoiceEmailHtml(face(dirty)), /\$3,120\.00/);
  assert.match(q.responseFormHtml(face(dirty)), /When can the crew have the floor/);
  assert.match(q.responseThanksHtml(face(dirty)), /Please call before noon/);
  assert.match(q.reviewEmailHtml(face(dirty)), /Leave a review/);
  assert.doesNotMatch(q.responseThanksHtml(face(dirty)), /ZXNOTE/);
});
