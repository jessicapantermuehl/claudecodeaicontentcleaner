/*
 * Ghost Ink: invisible character and AI typography cleaner.
 *
 * Works in the browser (window.GhostInk) and in Node (module.exports).
 * No dependencies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GhostInk = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Character catalog
  // ---------------------------------------------------------------------------

  var GROUPS = {
    zw: { label: 'Zero-width characters', blurb: 'Take up no space at all. The classic invisible watermark.' },
    bidi: { label: 'Direction controls', blurb: 'Invisible marks that steer right-to-left text. Rarely legitimate in plain English.' },
    space: { label: 'Look-alike spaces', blurb: 'Render like an ordinary space but are different code points.' },
    format: { label: 'Formatting characters', blurb: 'Soft hyphens and other invisible layout hints.' },
    filler: { label: 'Filler characters', blurb: 'Blank placeholders from Hangul and Khmer that show as nothing.' },
    control: { label: 'Control codes', blurb: 'Legacy terminal and C1 control characters.' },
    linesep: { label: 'Line separators', blurb: 'Unicode line and paragraph separators that are not real newlines.' },
    vs: { label: 'Variation selectors', blurb: 'Invisible modifiers. Kept only where they shape an emoji.' },
    tag: { label: 'Tag characters', blurb: 'An invisible copy of ASCII used to smuggle hidden text. Kept only inside flag emoji.' }
  };

  var ACTIONS = { remove: 'remove', space: 'space', newline: 'newline', keep: 'keep' };

  function single(cp, name, abbr, group, action) {
    return { from: cp, to: cp, name: name, abbr: abbr, group: group, action: action || ACTIONS.remove };
  }

  var SINGLES = [
    single(0x200B, 'ZERO WIDTH SPACE', 'ZWSP', 'zw'),
    single(0x200C, 'ZERO WIDTH NON-JOINER', 'ZWNJ', 'zw'),
    single(0x200D, 'ZERO WIDTH JOINER', 'ZWJ', 'zw'),
    single(0x2060, 'WORD JOINER', 'WJ', 'zw'),
    single(0xFEFF, 'ZERO WIDTH NO-BREAK SPACE (BOM)', 'BOM', 'zw'),
    single(0x2061, 'FUNCTION APPLICATION', 'FA', 'zw'),
    single(0x2062, 'INVISIBLE TIMES', 'IT', 'zw'),
    single(0x2063, 'INVISIBLE SEPARATOR', 'IS', 'zw'),
    single(0x2064, 'INVISIBLE PLUS', 'IP', 'zw'),
    single(0x180E, 'MONGOLIAN VOWEL SEPARATOR', 'MVS', 'zw'),
    single(0x034F, 'COMBINING GRAPHEME JOINER', 'CGJ', 'zw'),

    single(0x200E, 'LEFT-TO-RIGHT MARK', 'LRM', 'bidi'),
    single(0x200F, 'RIGHT-TO-LEFT MARK', 'RLM', 'bidi'),
    single(0x061C, 'ARABIC LETTER MARK', 'ALM', 'bidi'),
    single(0x202A, 'LEFT-TO-RIGHT EMBEDDING', 'LRE', 'bidi'),
    single(0x202B, 'RIGHT-TO-LEFT EMBEDDING', 'RLE', 'bidi'),
    single(0x202C, 'POP DIRECTIONAL FORMATTING', 'PDF', 'bidi'),
    single(0x202D, 'LEFT-TO-RIGHT OVERRIDE', 'LRO', 'bidi'),
    single(0x202E, 'RIGHT-TO-LEFT OVERRIDE', 'RLO', 'bidi'),
    single(0x2066, 'LEFT-TO-RIGHT ISOLATE', 'LRI', 'bidi'),
    single(0x2067, 'RIGHT-TO-LEFT ISOLATE', 'RLI', 'bidi'),
    single(0x2068, 'FIRST STRONG ISOLATE', 'FSI', 'bidi'),
    single(0x2069, 'POP DIRECTIONAL ISOLATE', 'PDI', 'bidi'),

    single(0x00A0, 'NO-BREAK SPACE', 'NBSP', 'space', ACTIONS.space),
    single(0x1680, 'OGHAM SPACE MARK', 'OGSP', 'space', ACTIONS.space),
    single(0x2000, 'EN QUAD', 'NQSP', 'space', ACTIONS.space),
    single(0x2001, 'EM QUAD', 'MQSP', 'space', ACTIONS.space),
    single(0x2002, 'EN SPACE', 'ENSP', 'space', ACTIONS.space),
    single(0x2003, 'EM SPACE', 'EMSP', 'space', ACTIONS.space),
    single(0x2004, 'THREE-PER-EM SPACE', '3/MSP', 'space', ACTIONS.space),
    single(0x2005, 'FOUR-PER-EM SPACE', '4/MSP', 'space', ACTIONS.space),
    single(0x2006, 'SIX-PER-EM SPACE', '6/MSP', 'space', ACTIONS.space),
    single(0x2007, 'FIGURE SPACE', 'FSP', 'space', ACTIONS.space),
    single(0x2008, 'PUNCTUATION SPACE', 'PSP', 'space', ACTIONS.space),
    single(0x2009, 'THIN SPACE', 'THSP', 'space', ACTIONS.space),
    single(0x200A, 'HAIR SPACE', 'HSP', 'space', ACTIONS.space),
    single(0x202F, 'NARROW NO-BREAK SPACE', 'NNBSP', 'space', ACTIONS.space),
    single(0x205F, 'MEDIUM MATHEMATICAL SPACE', 'MMSP', 'space', ACTIONS.space),
    single(0x3000, 'IDEOGRAPHIC SPACE', 'IDSP', 'space', ACTIONS.space),
    single(0x2800, 'BRAILLE PATTERN BLANK', 'BRSP', 'space', ACTIONS.space),

    single(0x00AD, 'SOFT HYPHEN', 'SHY', 'format'),
    single(0xFFF9, 'INTERLINEAR ANNOTATION ANCHOR', 'IAA', 'format'),
    single(0xFFFA, 'INTERLINEAR ANNOTATION SEPARATOR', 'IAS', 'format'),
    single(0xFFFB, 'INTERLINEAR ANNOTATION TERMINATOR', 'IAT', 'format'),
    single(0xFFFC, 'OBJECT REPLACEMENT CHARACTER', 'OBJ', 'format'),

    single(0x115F, 'HANGUL CHOSEONG FILLER', 'HCF', 'filler'),
    single(0x1160, 'HANGUL JUNGSEONG FILLER', 'HJF', 'filler'),
    single(0x3164, 'HANGUL FILLER', 'HF', 'filler'),
    single(0xFFA0, 'HALFWIDTH HANGUL FILLER', 'HWHF', 'filler'),
    single(0x17B4, 'KHMER VOWEL INHERENT AQ', 'KIV', 'filler'),
    single(0x17B5, 'KHMER VOWEL INHERENT AA', 'KIV', 'filler'),

    single(0x2028, 'LINE SEPARATOR', 'LSEP', 'linesep', ACTIONS.newline),
    single(0x2029, 'PARAGRAPH SEPARATOR', 'PSEP', 'linesep', ACTIONS.newline),
    single(0x0085, 'NEXT LINE', 'NEL', 'linesep', ACTIONS.newline)
  ];

  var RANGES = [
    { from: 0x0000, to: 0x0008, group: 'control', abbr: 'CTRL', action: ACTIONS.remove, name: controlName },
    { from: 0x000B, to: 0x000C, group: 'control', abbr: 'CTRL', action: ACTIONS.remove, name: controlName },
    { from: 0x000E, to: 0x001F, group: 'control', abbr: 'CTRL', action: ACTIONS.remove, name: controlName },
    { from: 0x007F, to: 0x0084, group: 'control', abbr: 'CTRL', action: ACTIONS.remove, name: controlName },
    { from: 0x0086, to: 0x009F, group: 'control', abbr: 'CTRL', action: ACTIONS.remove, name: controlName },
    { from: 0xFE00, to: 0xFE0F, group: 'vs', abbr: 'VS', action: ACTIONS.remove, contextual: true,
      name: function (cp) { return 'VARIATION SELECTOR-' + (cp - 0xFE00 + 1); } },
    { from: 0xE0100, to: 0xE01EF, group: 'vs', abbr: 'VS', action: ACTIONS.remove, contextual: true,
      name: function (cp) { return 'VARIATION SELECTOR-' + (cp - 0xE0100 + 17); } },
    { from: 0xE0000, to: 0xE007F, group: 'tag', abbr: 'TAG', action: ACTIONS.remove, contextual: true, name: tagName },
    { from: 0x1D173, to: 0x1D17A, group: 'format', abbr: 'MUS', action: ACTIONS.remove,
      name: function (cp) { return 'MUSICAL SYMBOL FORMAT CONTROL U+' + hex(cp); } }
  ];

  function hex(cp) {
    var h = cp.toString(16).toUpperCase();
    while (h.length < 4) h = '0' + h;
    return h;
  }

  var C0_NAMES = {
    0x00: 'NULL', 0x01: 'START OF HEADING', 0x02: 'START OF TEXT', 0x03: 'END OF TEXT', 0x04: 'END OF TRANSMISSION',
    0x05: 'ENQUIRY', 0x06: 'ACKNOWLEDGE', 0x07: 'BELL', 0x08: 'BACKSPACE', 0x0B: 'VERTICAL TAB', 0x0C: 'FORM FEED',
    0x0E: 'SHIFT OUT', 0x0F: 'SHIFT IN', 0x1B: 'ESCAPE', 0x7F: 'DELETE'
  };

  function controlName(cp) {
    return C0_NAMES[cp] || ('CONTROL CHARACTER U+' + hex(cp));
  }

  function tagName(cp) {
    if (cp === 0xE0001) return 'LANGUAGE TAG';
    if (cp === 0xE007F) return 'CANCEL TAG';
    if (cp >= 0xE0020 && cp <= 0xE007E) {
      var ascii = String.fromCharCode(cp - 0xE0000);
      return 'TAG ' + (ascii === ' ' ? 'SPACE' : '"' + ascii + '"');
    }
    return 'TAG CHARACTER U+' + hex(cp);
  }

  var LOOKUP = new Map();
  SINGLES.forEach(function (s) { LOOKUP.set(s.from, s); });

  function describe(cp) {
    var s = LOOKUP.get(cp);
    if (s) return s;
    for (var i = 0; i < RANGES.length; i++) {
      var r = RANGES[i];
      if (cp >= r.from && cp <= r.to) {
        return { from: cp, to: cp, name: r.name(cp), abbr: r.abbr, group: r.group, action: r.action, contextual: !!r.contextual };
      }
    }
    return null;
  }

  // Quick pre-check so clean text costs almost nothing.
  var ANY_SUSPECT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00A0\u00AD\u034F\u061C\u115F\u1160\u1680\u17B4\u17B5\u180E\u2000-\u200F\u2028-\u202F\u205F-\u2064\u2066-\u2069\u2800\u3000\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF9-\uFFFC]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC00-\uDC7F\uDD00-\uDDEF]/;

  // ---------------------------------------------------------------------------
  // Context protection: emoji sequences and scripts that need joiners
  // ---------------------------------------------------------------------------

  var EMOJI_ZWJ_SEQ = /\p{Extended_Pictographic}[\uFE0F\uFE0E]?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}[\uFE0F\uFE0E]?(?:\p{Emoji_Modifier})?)+/gu;
  var EMOJI_VS = /(?:\p{Extended_Pictographic}|[#*0-9\u00A9\u00AE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299])[\uFE0E\uFE0F]/gu;
  var CJK_VS = /\p{Script=Han}(?:[\uFE00-\uFE0F]|\uDB40[\uDD00-\uDDEF])/gu;
  var TAG_FLAG = /\u{1F3F4}[\u{E0061}-\u{E007A}]{2,}\u{E007F}/gu;
  var JOINER_SCRIPTS = '\\p{Script=Arabic}\\p{Script=Syriac}\\p{Script=Devanagari}\\p{Script=Bengali}\\p{Script=Gurmukhi}\\p{Script=Gujarati}\\p{Script=Oriya}\\p{Script=Tamil}\\p{Script=Telugu}\\p{Script=Kannada}\\p{Script=Malayalam}\\p{Script=Sinhala}\\p{Script=Myanmar}\\p{Script=Khmer}\\p{Script=Mongolian}\\p{Script=Tibetan}\\p{Script=Thaana}';
  var SCRIPT_JOINER = new RegExp('[' + JOINER_SCRIPTS + '\\p{M}][\\u200C\\u200D]+(?=[' + JOINER_SCRIPTS + '])', 'gu');

  function protectedIndices(text, options) {
    var set = new Set();
    var m;
    function markWithin(re, predicate) {
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        var start = m.index;
        var s = m[0];
        for (var i = 0; i < s.length; i++) {
          var code = s.charCodeAt(i);
          if (predicate(code, s, i)) set.add(start + i);
        }
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    var isJoinerOrVs = function (code) { return code === 0x200D || code === 0xFE0F || code === 0xFE0E; };
    var isVs = function (code) { return code >= 0xFE00 && code <= 0xFE0F; };
    var isTag = function (code, s, i) {
      // Tag characters are surrogate pairs whose high half is 0xDB40; protect the pair's start index.
      return code === 0xDB40;
    };
    var isCjkVs = function (code, s, i) {
      return isVs(code) || code === 0xDB40;
    };
    var isJoiner = function (code) { return code === 0x200C || code === 0x200D; };

    if (options.protectEmoji !== false) {
      markWithin(EMOJI_ZWJ_SEQ, isJoinerOrVs);
      markWithin(EMOJI_VS, isVs);
      markWithin(TAG_FLAG, isTag);
    }
    if (options.protectScripts !== false) {
      markWithin(SCRIPT_JOINER, isJoiner);
      markWithin(CJK_VS, isCjkVs);
    }
    return set;
  }

  // ---------------------------------------------------------------------------
  // Analysis
  // ---------------------------------------------------------------------------

  function analyze(text, options) {
    options = options || {};
    var findings = [];
    if (typeof text !== 'string' || !text || !ANY_SUSPECT.test(text)) return findings;

    var guard = protectedIndices(text, options);
    var i = 0;
    while (i < text.length) {
      var cp = text.codePointAt(i);
      var len = cp > 0xFFFF ? 2 : 1;
      var info = describe(cp);
      if (info) {
        var action = info.action;
        if (guard.has(i)) action = ACTIONS.keep;
        findings.push({
          index: i,
          length: len,
          cp: cp,
          code: 'U+' + hex(cp),
          char: text.slice(i, i + len),
          name: info.name,
          abbr: info.abbr,
          group: info.group,
          action: action
        });
      }
      i += len;
    }
    return findings;
  }

  function summarize(findings) {
    var byKey = new Map();
    findings.forEach(function (f) {
      var key = f.code + ':' + f.action;
      var row = byKey.get(key);
      if (!row) {
        row = { code: f.code, cp: f.cp, name: f.name, abbr: f.abbr, group: f.group, groupLabel: GROUPS[f.group].label, action: f.action, count: 0 };
        byKey.set(key, row);
      }
      row.count++;
    });
    var order = Object.keys(GROUPS);
    return Array.from(byKey.values()).sort(function (a, b) {
      var g = order.indexOf(a.group) - order.indexOf(b.group);
      if (g !== 0) return g;
      if (a.count !== b.count) return b.count - a.count;
      return a.cp - b.cp;
    });
  }

  // Split text into plain runs and marks, for a "reveal" view.
  function segments(text, findings) {
    var out = [];
    var pos = 0;
    findings.forEach(function (f) {
      if (f.index > pos) out.push({ type: 'text', value: text.slice(pos, f.index) });
      out.push({ type: 'mark', finding: f });
      pos = f.index + f.length;
    });
    if (pos < text.length) out.push({ type: 'text', value: text.slice(pos) });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Look-alike letters (homoglyphs) inside otherwise-Latin words
  // ---------------------------------------------------------------------------

  var HOMOGLYPHS = {
    // Cyrillic lower
    '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c', '\u0443': 'y', '\u0445': 'x',
    '\u0456': 'i', '\u0458': 'j', '\u0455': 's', '\u0501': 'd', '\u04BB': 'h', '\u051B': 'q', '\u051D': 'w',
    '\u04CF': 'l', '\u0475': 'v', '\u0432': 'b', '\u043D': 'h', '\u0442': 't', '\u043A': 'k', '\u043C': 'm',
    // Cyrillic upper
    '\u0410': 'A', '\u0412': 'B', '\u0415': 'E', '\u041A': 'K', '\u041C': 'M', '\u041D': 'H', '\u041E': 'O',
    '\u0420': 'P', '\u0421': 'C', '\u0422': 'T', '\u0425': 'X', '\u0405': 'S', '\u0406': 'I', '\u0408': 'J',
    '\u04C0': 'I', '\u0474': 'V', '\u0417': 'Z', '\u0423': 'Y',
    // Greek
    '\u03BF': 'o', '\u039F': 'O', '\u0391': 'A', '\u0392': 'B', '\u0395': 'E', '\u0396': 'Z', '\u0397': 'H',
    '\u0399': 'I', '\u039A': 'K', '\u039C': 'M', '\u039D': 'N', '\u03A1': 'P', '\u03A4': 'T', '\u03A5': 'Y',
    '\u03A7': 'X', '\u03BD': 'v', '\u03B9': 'i', '\u03BA': 'k', '\u03C1': 'p',
    // Latin look-alikes
    '\u0131': 'i', '\u017F': 's', '\u0251': 'a', '\u0261': 'g', '\u026A': 'i', '\u0274': 'N', '\u0280': 'R',
    '\u1D00': 'A', '\u1D04': 'C', '\u1D05': 'D', '\u1D07': 'E', '\u1D0A': 'J', '\u1D0B': 'K', '\u1D0D': 'M',
    '\u1D0F': 'O', '\u1D18': 'P', '\u1D1B': 'T', '\u1D1C': 'U', '\u1D20': 'V', '\u1D21': 'W', '\u1D22': 'Z',
    // Armenian
    '\u0585': 'o', '\u0570': 'h', '\u0578': 'n', '\u057D': 'u', '\u0581': 'g'
  };

  function fullwidthToAscii(ch) {
    var c = ch.charCodeAt(0);
    if (c >= 0xFF01 && c <= 0xFF5E) return String.fromCharCode(c - 0xFEE0);
    return null;
  }

  var HOMOGLYPH_CLASS = '[' + Object.keys(HOMOGLYPHS).join('') + '\uFF01-\uFF5E]';
  var HOMOGLYPH_RE = new RegExp(HOMOGLYPH_CLASS, 'gu');
  var WORD_RE = /[\p{L}\p{M}\p{Nd}\uFF01-\uFF5E]+/gu;
  var HAS_LATIN = /[A-Za-z\uFF21-\uFF3A\uFF41-\uFF5A]/;
  var HAS_HOMOGLYPH = new RegExp(HOMOGLYPH_CLASS, 'u');

  function fixHomoglyphs(text) {
    var count = 0;
    var out = text.replace(WORD_RE, function (word) {
      if (!HAS_HOMOGLYPH.test(word)) return word;
      // Only touch words that already contain plain Latin letters (mixed-script words).
      // A word entirely in Cyrillic or Greek is probably real Cyrillic or Greek.
      if (!HAS_LATIN.test(word)) return word;
      return word.replace(HOMOGLYPH_RE, function (ch) {
        var rep = HOMOGLYPHS[ch] || fullwidthToAscii(ch);
        if (rep == null) return ch;
        count++;
        return rep;
      });
    });
    return { text: out, count: count };
  }

  // ---------------------------------------------------------------------------
  // Style cleanup (opt-in typography)
  // ---------------------------------------------------------------------------

  var TYPOGRAPHY_RULES = [
    { id: 'emDash', label: 'Em dashes' },
    { id: 'enDash', label: 'En dashes' },
    { id: 'quotes', label: 'Curly quotes' },
    { id: 'ellipsis', label: 'Ellipsis characters' },
    { id: 'collapseSpaces', label: 'Doubled spaces' }
  ];

  var PUNCT = /[.,;:!?]/;

  function applyTypography(text, options) {
    var counts = { emDash: 0, enDash: 0, quotes: 0, ellipsis: 0, collapseSpaces: 0 };

    var emDashMode = options.emDash || 'off';
    if (emDashMode === 'hyphen' || emDashMode === 'comma') {
      text = text.replace(/[ \t]*[\u2014\u2015\u2E3A\u2E3B]+[ \t]*/g, function (m, offset, whole) {
        counts.emDash++;
        var prev = offset > 0 ? whole[offset - 1] : '';
        var nextIdx = offset + m.length;
        var next = nextIdx < whole.length ? whole[nextIdx] : '';
        var atLineStart = prev === '' || prev === '\n';
        var atLineEnd = next === '' || next === '\n' || next === '\r';
        if (emDashMode === 'hyphen') {
          if (atLineStart) return '- ';
          if (atLineEnd) return '';
          return ' - ';
        }
        // comma mode: "word\u2014word" becomes "word, word"
        if (atLineStart) return '';
        if (atLineEnd) return '.';
        if (PUNCT.test(next)) return '';
        if (PUNCT.test(prev)) return ' ';
        return ', ';
      });
      if (emDashMode === 'comma') text = text.replace(/,\s*([.,;:!?])/g, '$1');
    }

    if (options.enDash) {
      text = text.replace(/(\d)\s?\u2013\s?(\d)/g, function (m, a, b) { counts.enDash++; return a + '-' + b; });
      text = text.replace(/[ \t]*\u2013[ \t]*/g, function (m, offset, whole) {
        counts.enDash++;
        var prev = offset > 0 ? whole[offset - 1] : '';
        var nextIdx = offset + m.length;
        var next = nextIdx < whole.length ? whole[nextIdx] : '';
        if (prev === '' || prev === '\n') return '- ';
        if (next === '' || next === '\n') return '';
        return ' - ';
      });
    }

    if (options.quotes) {
      text = text.replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2033\u301D\u301E]/g, function () { counts.quotes++; return '"'; });
      text = text.replace(/[\u2018\u2019\u201A\u201B\u2039\u203A\u02BC\u02C8\u2032\u00B4]/g, function () { counts.quotes++; return "'"; });
    }

    if (options.ellipsis) {
      text = text.replace(/\u2026/g, function () { counts.ellipsis++; return '...'; });
    }

    if (options.collapseSpaces) {
      text = text.replace(/[ \t]{2,}/g, function () { counts.collapseSpaces++; return ' '; });
      text = text.replace(/[ \t]+(?=\r?\n)/g, function () { counts.collapseSpaces++; return ''; });
      text = text.replace(/[ \t]+$/, function () { counts.collapseSpaces++; return ''; });
    }

    return { text: text, counts: counts };
  }

  // ---------------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------------

  var DEFAULTS = {
    protectEmoji: true,
    protectScripts: true,
    homoglyphs: true,
    nfc: true,
    emDash: 'off',      // 'off' | 'hyphen' | 'comma'
    enDash: false,
    quotes: false,
    ellipsis: false,
    collapseSpaces: false
  };

  function withDefaults(options) {
    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    if (options) for (var j in options) if (options[j] !== undefined) o[j] = options[j];
    return o;
  }

  function clean(text, options) {
    var opts = withDefaults(options);
    text = typeof text === 'string' ? text : String(text == null ? '' : text);

    var findings = analyze(text, opts);
    var removed = 0;
    var replaced = 0;
    var out;

    if (findings.length === 0) {
      out = text;
    } else {
      var parts = [];
      var pos = 0;
      findings.forEach(function (f) {
        if (f.action === ACTIONS.keep) return;
        parts.push(text.slice(pos, f.index));
        if (f.action === ACTIONS.space) { parts.push(' '); replaced++; }
        else if (f.action === ACTIONS.newline) { parts.push('\n'); replaced++; }
        else removed++;
        pos = f.index + f.length;
      });
      parts.push(text.slice(pos));
      out = parts.join('');
    }

    var homoglyphCount = 0;
    if (opts.homoglyphs) {
      var h = fixHomoglyphs(out);
      out = h.text;
      homoglyphCount = h.count;
    }

    var normalized = false;
    if (opts.nfc && typeof out.normalize === 'function') {
      var n = out.normalize('NFC');
      normalized = n !== out;
      out = n;
    }

    var typo = applyTypography(out, opts);
    out = typo.text;

    var typography = TYPOGRAPHY_RULES.map(function (r) {
      return { id: r.id, label: r.label, count: typo.counts[r.id] || 0 };
    }).filter(function (r) { return r.count > 0; });

    var styleChanges = typography.reduce(function (acc, r) { return acc + r.count; }, 0);
    var kept = findings.filter(function (f) { return f.action === ACTIONS.keep; }).length;

    return {
      input: text,
      output: out,
      findings: findings,
      summary: summarize(findings),
      typography: typography,
      homoglyphs: homoglyphCount,
      normalized: normalized,
      stats: {
        inputLength: Array.from(text).length,
        outputLength: Array.from(out).length,
        hidden: findings.length - kept,
        kept: kept,
        removed: removed,
        replaced: replaced + homoglyphCount,
        styleChanges: styleChanges
      },
      changed: out !== text
    };
  }

  function catalog() {
    var rows = SINGLES.map(function (s) {
      return { code: 'U+' + hex(s.from), name: s.name, abbr: s.abbr, group: s.group, groupLabel: GROUPS[s.group].label, action: s.action };
    });
    RANGES.forEach(function (r) {
      rows.push({
        code: 'U+' + hex(r.from) + ' to U+' + hex(r.to),
        name: r.name(r.from) + (r.to > r.from ? ' ... ' + r.name(r.to) : ''),
        abbr: r.abbr, group: r.group, groupLabel: GROUPS[r.group].label, action: r.action, contextual: !!r.contextual
      });
    });
    return rows;
  }

  return {
    clean: clean,
    analyze: analyze,
    summarize: summarize,
    segments: segments,
    catalog: catalog,
    fixHomoglyphs: fixHomoglyphs,
    GROUPS: GROUPS,
    ACTIONS: ACTIONS,
    DEFAULTS: DEFAULTS,
    TYPOGRAPHY_RULES: TYPOGRAPHY_RULES,
    version: '1.0.0'
  };
});
