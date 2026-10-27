import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../gallery.js', import.meta.url), 'utf8'), sandbox);
const g = sandbox.module.exports;

function names(q, extras) {
  return g.match(q, extras).map((x) => x.name);
}

test('plain language matches flake, metallic, quartz, and solid color', () => {
  const gray = names('show me gray flake garage floor');
  assert.ok(gray.includes('Feather Gray'));
  assert.ok(gray.includes('Glacier'));
  assert.ok(gray.includes('Gray flake floor'));
  assert.equal(gray.includes('Safari'), false);
  assert.equal(gray.includes('Blue metallic'), false);
  assert.ok(names('grey flake').includes('Feather Gray'));
  const blue = names('metallic blue');
  assert.ok(blue.includes('Blue metallic'));
  assert.ok(blue.includes('Blue metallic swirl'));
  assert.equal(blue.includes('Feather Gray'), false);
  assert.ok(names('quartz').includes('Quartz floor'));
  const solid = names('solid gray');
  assert.ok(solid.includes('Haze Gray solid'));
  assert.equal(solid.includes('Tile Red solid'), false);
});

test('Simiron photos stay on Simiron and own photos join the same search', () => {
  assert.ok(g.catalog.length >= 20);
  for (const item of g.catalog) {
    assert.match(item.src, /^https:\/\/simiron\.com\//);
    assert.match(item.page, /^https:\/\/simiron\.com\//);
    assert.equal(item.credit, 'Simiron');
    assert.equal(item.ours, false);
    assert.equal(item.hardness, undefined);
    assert.equal(item.internalNotes, undefined);
  }
  const own = g.ownPhoto({
    id: 'GAL1',
    caption: 'Metallic blue sample',
    tags: ['garage', 'blue'],
    url: 'data:image/jpeg;base64,abc',
    hardness: 8,
    internalNotes: [{ text: 'ZXNOTE secret hardness' }]
  });
  assert.equal(own.ours, true);
  assert.equal(own.hardness, undefined);
  assert.equal(own.internalNotes, undefined);
  assert.equal(own.credit, '');
  const hits = g.match('metallic blue', [own]);
  assert.ok(hits.some((x) => x.id === 'GAL1'));
  assert.doesNotMatch(JSON.stringify(g.match('')), /hardness|internalNotes|Mohs|ZXNOTE/);
});

test('the gallery screen and the upload action leave hardness and notes alone', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const ui = app.slice(app.indexOf('function gHits'), app.indexOf('const STATES'));
  assert.ok(ui.includes('function galScreen'));
  assert.doesNotMatch(ui, /hardness|internalNotes|Mohs/);
  assert.match(ui, /Photos:/);
  const code = fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
  assert.match(code, /getFoldersByName\('Gallery'\)/);
  assert.match(code, /gallery: gallery_\(\)/);
  const gadd = code.slice(code.indexOf("d.a === 'gadd'"), code.indexOf("d.a === 'gdel'"));
  assert.doesNotMatch(gadd, /MailApp|sendMail_|sendQuote_|hardness|internalNotes/);
  assert.equal(code.includes("var TEST_MODE = false"), true);
});
