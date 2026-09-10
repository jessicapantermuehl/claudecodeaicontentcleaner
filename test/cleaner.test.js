'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const GhostInk = require('../cleaner.js');

const clean = (text, opts) => GhostInk.clean(text, opts).output;

test('plain text passes through untouched', () => {
  const text = 'The quick brown fox.\nSecond line, with "quotes" and 3-4 items.';
  const r = GhostInk.clean(text);
  assert.equal(r.output, text);
  assert.equal(r.changed, false);
  assert.equal(r.findings.length, 0);
});

test('removes zero-width characters', () => {
  assert.equal(clean('a\u200Bb\u200Cc\u200Dd\u2060e\uFEFFf'), 'abcdef');
  assert.equal(clean('x\u2061\u2062\u2063\u2064y\u180Ez\u034F'), 'xyz');
});

test('removes bidi controls', () => {
  assert.equal(clean('\u202Eevil\u202C \u200Eok\u200F \u2066a\u2069\u061C'), 'evil ok a');
});

test('replaces look-alike spaces with a regular space', () => {
  const spaces = '\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2800';
  const out = clean('a' + spaces.split('').join('b') + 'c');
  assert.equal(out, 'a' + ' b'.repeat(spaces.length - 1) + ' c');
  assert.equal(clean('non\u00A0breaking'), 'non breaking');
});

test('removes soft hyphens and control codes, keeps tab and newline', () => {
  assert.equal(clean('hy\u00ADphen\u0007\u001B\u0000\u009F'), 'hyphen');
  assert.equal(clean('tab\there\nnew\r\nline'), 'tab\there\nnew\r\nline');
});

test('turns unicode line and paragraph separators into newlines', () => {
  assert.equal(clean('a\u2028b\u2029c\u0085d'), 'a\nb\nc\nd');
});

test('strips tag characters used to hide text', () => {
  const hidden = 'h\u{E0068}\u{E0069}\u{E0064}\u{E0064}\u{E0065}\u{E006E}';
  assert.equal(clean(hidden), 'h');
  const r = GhostInk.clean(hidden);
  assert.equal(r.stats.removed, 6);
  assert.equal(r.summary[0].group, 'tag');
});

test('keeps tag characters inside subdivision flag emoji', () => {
  const england = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
  assert.equal(clean('Flag ' + england + '!'), 'Flag ' + england + '!');
  const r = GhostInk.clean(england);
  assert.equal(r.stats.kept, 6);
  assert.equal(r.stats.hidden, 0);
});

test('keeps joiners and VS16 inside emoji sequences', () => {
  const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
  const check = '\u2714\uFE0F';
  const heart = '\u2764\uFE0F';
  const text = family + ' ' + check + ' ' + heart + ' 1\uFE0F\u20E3';
  assert.equal(clean(text), text);
  const r = GhostInk.clean(text);
  assert.equal(r.stats.hidden, 0);
  assert.equal(r.stats.kept, 5);
});

test('removes a stray variation selector that follows an ordinary letter', () => {
  assert.equal(clean('a\uFE0Fb\uFE01c'), 'abc');
});

test('emoji protection can be turned off', () => {
  const family = '\u{1F468}\u200D\u{1F469}';
  assert.equal(clean(family, { protectEmoji: false }), '\u{1F468}\u{1F469}');
});

test('keeps ZWNJ and ZWJ inside scripts that need them', () => {
  const persian = '\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645';
  const devanagari = '\u0915\u094D\u200D\u0937';
  assert.equal(clean(persian + ' ' + devanagari), persian + ' ' + devanagari);
  assert.equal(clean(persian, { protectScripts: false }), persian.replace('\u200C', ''));
});

test('fixes Cyrillic and Greek look-alikes inside Latin words only', () => {
  assert.equal(clean('s\u0430l\u0435 pr\u03BFduct'), 'sale product');
  const russian = '\u043F\u0440\u0438\u0432\u0435\u0442';
  assert.equal(clean(russian + ' hello'), russian + ' hello');
  assert.equal(GhostInk.clean('s\u0430le').homoglyphs, 1);
  assert.equal(clean('s\u0430le', { homoglyphs: false }), 's\u0430le');
});

test('maps fullwidth ASCII inside mixed words', () => {
  assert.equal(clean('\uFF28ello w\uFF4Frld'), 'Hello world');
});

test('normalizes decomposed characters to NFC', () => {
  const r = GhostInk.clean('cafe\u0301');
  assert.equal(r.output, 'caf\u00E9');
  assert.equal(r.normalized, true);
  assert.equal(clean('cafe\u0301', { nfc: false }), 'cafe\u0301');
});

test('typography options are off by default', () => {
  const text = 'Wait\u2014what? \u201CQuotes\u201D and \u2018more\u2019 \u2026 2019\u20132024';
  assert.equal(clean(text), text);
});

test('em dash to hyphen', () => {
  assert.equal(clean('Wait\u2014what?', { emDash: 'hyphen' }), 'Wait - what?');
  assert.equal(clean('Wait \u2014 what?', { emDash: 'hyphen' }), 'Wait - what?');
  assert.equal(clean('\u2014Dialogue line', { emDash: 'hyphen' }), '- Dialogue line');
  assert.equal(clean('Trailing\u2014', { emDash: 'hyphen' }), 'Trailing');
  assert.equal(clean('a\u2014b\nc\u2014d', { emDash: 'hyphen' }), 'a - b\nc - d');
});

test('em dash to comma', () => {
  assert.equal(clean('It works\u2014mostly.', { emDash: 'comma' }), 'It works, mostly.');
  assert.equal(clean('It works \u2014 mostly \u2014 today.', { emDash: 'comma' }), 'It works, mostly, today.');
  assert.equal(clean('Done\u2014.', { emDash: 'comma' }), 'Done.');
  assert.equal(clean('And then\u2014', { emDash: 'comma' }), 'And then.');
});

test('en dash', () => {
  assert.equal(clean('2019\u20132024', { enDash: true }), '2019-2024');
  assert.equal(clean('pages 10 \u2013 12', { enDash: true }), 'pages 10-12');
  assert.equal(clean('one \u2013 two', { enDash: true }), 'one - two');
});

test('curly quotes and ellipsis', () => {
  assert.equal(clean('\u201CHi\u201D \u2018there\u2019 don\u2019t \u00ABok\u00BB', { quotes: true }), '"Hi" \'there\' don\'t "ok"');
  assert.equal(clean('Wait\u2026 what', { ellipsis: true }), 'Wait... what');
});

test('collapse doubled spaces and trailing whitespace', () => {
  assert.equal(clean('a  b   c \nd\t\t e  ', { collapseSpaces: true }), 'a b c\nd e');
});

test('summary groups findings by code point and action', () => {
  const r = GhostInk.clean('a\u200Bb\u200Bc\u00A0d\u200D\u{1F468}\u200D\u{1F469}');
  const zwsp = r.summary.find((s) => s.code === 'U+200B');
  assert.equal(zwsp.count, 2);
  assert.equal(zwsp.action, 'remove');
  const nbsp = r.summary.find((s) => s.code === 'U+00A0');
  assert.equal(nbsp.action, 'space');
  const removedZwj = r.summary.find((s) => s.code === 'U+200D' && s.action === 'remove');
  const keptZwj = r.summary.find((s) => s.code === 'U+200D' && s.action === 'keep');
  assert.equal(removedZwj.count, 1);
  assert.equal(keptZwj.count, 1);
});

test('segments cover the whole input in order', () => {
  const text = 'ab\u200Bcd\u00A0e';
  const segs = GhostInk.segments(text, GhostInk.analyze(text));
  assert.deepEqual(segs.map((s) => s.type), ['text', 'mark', 'text', 'mark', 'text']);
  const rebuilt = segs.map((s) => (s.type === 'text' ? s.value : s.finding.char)).join('');
  assert.equal(rebuilt, text);
});

test('stats count code points, not UTF-16 units', () => {
  const r = GhostInk.clean('\u{1F600}\u200B');
  assert.equal(r.stats.inputLength, 2);
  assert.equal(r.stats.outputLength, 1);
});

test('handles empty and non-string input', () => {
  assert.equal(clean(''), '');
  assert.equal(clean(null), '');
  assert.equal(clean(42), '42');
});

test('catalog lists every group', () => {
  const groups = new Set(GhostInk.catalog().map((c) => c.group));
  for (const g of Object.keys(GhostInk.GROUPS)) assert.ok(groups.has(g), g);
});
