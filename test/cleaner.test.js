'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PlainTyped = require('../cleaner.js');

const clean = (text, opts) => PlainTyped.clean(text, opts).output;

test('plain text passes through untouched', () => {
  const text = 'The quick brown fox.\nSecond line, with "quotes" and 3-4 items.';
  const r = PlainTyped.clean(text);
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
  const r = PlainTyped.clean(hidden);
  assert.equal(r.stats.removed, 6);
  assert.equal(r.summary[0].group, 'tag');
});

test('keeps tag characters inside subdivision flag emoji', () => {
  const england = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
  assert.equal(clean('Flag ' + england + '!'), 'Flag ' + england + '!');
  const r = PlainTyped.clean(england);
  assert.equal(r.stats.kept, 6);
  assert.equal(r.stats.hidden, 0);
});

test('keeps joiners and VS16 inside emoji sequences', () => {
  const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
  const check = '\u2714\uFE0F';
  const heart = '\u2764\uFE0F';
  const text = family + ' ' + check + ' ' + heart + ' 1\uFE0F\u20E3';
  assert.equal(clean(text), text);
  const r = PlainTyped.clean(text);
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
  assert.equal(PlainTyped.clean('s\u0430le').homoglyphs, 1);
  assert.equal(clean('s\u0430le', { homoglyphs: false }), 's\u0430le');
});

test('maps fullwidth ASCII inside mixed words', () => {
  assert.equal(clean('\uFF28ello w\uFF4Frld'), 'Hello world');
});

test('normalizes decomposed characters to NFC', () => {
  const r = PlainTyped.clean('cafe\u0301');
  assert.equal(r.output, 'caf\u00E9');
  assert.equal(r.normalized, true);
  assert.equal(clean('cafe\u0301', { nfc: false }), 'cafe\u0301');
});

test('typography rewrites are on by default and can all be turned off', () => {
  const text = 'Wait\u2014what? \u201CQuotes\u201D and \u2018more\u2019 \u2026 2019\u20132024 \u2192 go';
  assert.equal(clean(text), 'Wait - what? "Quotes" and \'more\' ... 2019-2024 -> go');
  const off = { quotes: false, emDash: 'off', dashes: false, ellipsis: false, symbols: false };
  assert.equal(clean(text, off), text);
});

test('reports non-keyboard characters with the action the options imply', () => {
  const r = PlainTyped.clean('I\u2019m here\u2026 caf\u00E9 \u2728 \u2022 ok', { ellipsis: false });
  const byCode = Object.fromEntries(r.nonKeyboard.map((x) => [x.code, x]));
  assert.equal(byCode['U+2019'].category, 'quote');
  assert.equal(byCode['U+2019'].action, 'rewrite');
  assert.equal(byCode['U+2019'].replacement, "'");
  assert.equal(byCode['U+2026'].action, 'keep');
  assert.equal(byCode['U+00E9'].category, 'letter');
  assert.equal(byCode['U+00E9'].action, 'keep');
  assert.equal(byCode['U+2728'].category, 'emoji');
  assert.equal(byCode['U+2022'].replacement, '-');
  assert.equal(r.stats.nonKeyboard, 5);
  assert.equal(r.stats.nonKeyboardKept, 3);
});

test('non-keyboard report counts emoji sequences as one item and skips invisibles', () => {
  const f = PlainTyped.analyzeNonKeyboard('a\u200B\u2019b \u{1F468}\u200D\u{1F469}\u200D\u{1F467} \u{1F1FA}\u{1F1F8} 1\uFE0F\u20E3');
  assert.deepEqual(f.map((x) => x.category), ['quote', 'emoji', 'emoji', 'emoji']);
  assert.equal(f[1].char, '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}');
});

test('symbols map to keyboard equivalents', () => {
  assert.equal(clean('Read more \u2192 here \u2022 5 \u00D7 3 \u2122'), 'Read more -> here - 5 x 3 (TM)');
  assert.equal(clean('a \u2192 b', { symbols: false }), 'a \u2192 b');
});

test('emoji removal is opt-in and tidies the spaces it leaves', () => {
  const text = 'Hello \u{1F44B}\u{1F3FD} world \u2728\nNext \u{1F468}\u200D\u{1F469}\u200D\u{1F467} line';
  assert.equal(clean(text), text);
  assert.equal(clean(text, { emoji: true }), 'Hello world\nNext line');
  assert.equal(PlainTyped.clean(text, { emoji: true }).typography.find((t) => t.id === 'emoji').count, 3);
});

test('accent stripping is opt-in and only touches Latin letters', () => {
  const text = 'caf\u00E9 na\u00EFve \u00DFtra\u00DFe \u00F8re \u043F\u0440\u0438\u0432\u0435\u0442';
  assert.equal(clean(text), text);
  assert.equal(clean(text, { accents: true }), 'cafe naive sstrasse ore \u043F\u0440\u0438\u0432\u0435\u0442');
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

test('en dash and hyphen variants', () => {
  assert.equal(clean('2019\u20132024', { dashes: true }), '2019-2024');
  assert.equal(clean('pages 10 \u2013 12', { dashes: true }), 'pages 10-12');
  assert.equal(clean('one \u2013 two', { dashes: true }), 'one - two');
  assert.equal(clean('non\u2011breaking \u2212 minus', { dashes: true }), 'non-breaking - minus');
  assert.equal(clean('2019\u20132024', { dashes: false }), '2019\u20132024');
});

test('curly quotes and ellipsis', () => {
  assert.equal(clean('\u201CHi\u201D \u2018there\u2019 don\u2019t \u00ABok\u00BB', { quotes: true }), '"Hi" \'there\' don\'t "ok"');
  assert.equal(clean('Wait\u2026 what', { ellipsis: true }), 'Wait... what');
});

test('collapse doubled spaces and trailing whitespace', () => {
  assert.equal(clean('a  b   c \nd\t\t e  ', { collapseSpaces: true }), 'a b c\nd e');
});

test('summary groups findings by code point and action', () => {
  const r = PlainTyped.clean('a\u200Bb\u200Bc\u00A0d\u200D\u{1F468}\u200D\u{1F469}');
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
  const segs = PlainTyped.segments(text, PlainTyped.analyze(text));
  assert.deepEqual(segs.map((s) => s.type), ['text', 'mark', 'text', 'mark', 'text']);
  const rebuilt = segs.map((s) => (s.type === 'text' ? s.value : s.finding.char)).join('');
  assert.equal(rebuilt, text);
});

test('stats count code points, not UTF-16 units', () => {
  const r = PlainTyped.clean('\u{1F600}\u200B');
  assert.equal(r.stats.inputLength, 2);
  assert.equal(r.stats.outputLength, 1);
});

test('handles empty and non-string input', () => {
  assert.equal(clean(''), '');
  assert.equal(clean(null), '');
  assert.equal(clean(42), '42');
});

test('catalog lists every group', () => {
  const groups = new Set(PlainTyped.catalog().map((c) => c.group));
  for (const g of Object.keys(PlainTyped.GROUPS)) assert.ok(groups.has(g), g);
});

// ---------------------------------------------------------------------------
// Writing tells
// ---------------------------------------------------------------------------
const Tells = require('../tells.js');

test('tells: plain human prose scores few tells', () => {
  const r = Tells.analyzeTells('I went to the store. It was closed, so I walked home the long way, past the park where the old men play chess even when it rains. Bought bread at the corner shop instead. Dinner was late.');
  assert.equal(r.verdictLevel, 0);
  assert.equal(r.flagged, 0);
});

test('tells: catches the classic patterns, with curly apostrophes', () => {
  const text = 'It\u2019s not about doing more, it\u2019s about doing what lasts. Sound familiar? Translation: less pressure, more progress. ' +
    'Small. Boring. Repeatable. This truly, genuinely, absolutely elevates your journey.';
  const r = Tells.analyzeTells(text);
  const by = Object.fromEntries(r.tells.map((t) => [t.id, t]));
  assert.ok(by.contrast.count >= 1, 'contrast');
  assert.equal(by.questions.count, 1);
  assert.equal(by.labels.count, 1);
  assert.equal(by.fragments.count, 1);
  assert.equal(by.intensifiers.count, 3);
  assert.ok(by.vocabulary.matches.some((m) => /elevates/i.test(m.text)));
  assert.ok(r.verdictLevel >= 2);
});

test('tells: even rhythm is flagged, varied rhythm is not', () => {
  const even = Array.from({ length: 8 }, (_, i) => `Sentence number ${i} has exactly seven words here.`).join(' ');
  const varied = 'Short. This one runs a good deal longer than the others, wandering through a few clauses before it stops. Then brief again. And one more that stretches out for a while, just to be sure the variation shows. Done. Okay.';
  assert.ok(Tells.analyzeTells(even).tells.find((t) => t.id === 'rhythm').severity >= 2);
  assert.equal(Tells.analyzeTells(varied).tells.find((t) => t.id === 'rhythm').severity, 0);
});

test('tells: repeated starters and closing wrap-up', () => {
  const text = 'You wake up. You drink water. You step outside. You write three things down.\n\nYou are doing fine.\n\nRemember, small steps count.';
  const by = Object.fromEntries(Tells.analyzeTells(text).tells.map((t) => [t.id, t]));
  assert.ok(by.starters.severity >= 1);
  assert.equal(by.closer.count, 1);
});

test('tells: highlights are non-overlapping and carry positions', () => {
  const text = 'Pro tip: truly delve into it. Truly.';
  const r = Tells.analyzeTells(text);
  const h = Tells.highlights(r);
  let end = -1;
  for (const m of h) {
    assert.ok(m.index >= end);
    assert.equal(text.slice(m.index, m.index + m.length), m.text);
    end = m.index + m.length;
  }
  assert.ok(h.length >= 3);
});

test('tells: empty input', () => {
  const r = Tells.analyzeTells('');
  assert.equal(r.words, 0);
  assert.deepEqual(r.tells, []);
});
