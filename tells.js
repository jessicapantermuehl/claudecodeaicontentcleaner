/*
 * Ghost Ink writing tells: patterns readers and statistical detectors
 * associate with AI drafts. This module only measures and points; it never
 * rewrites anything. Works in the browser (window.GhostInkTells) and Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GhostInkTells = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Word lists
  // ---------------------------------------------------------------------------

  // Single words and short compounds that show up far more often in model output
  // than in ordinary writing. Stems cover common inflections.
  var AI_WORDS = [
    'delv(?:e|es|ed|ing)', 'elevat(?:e|es|ed|ing)', 'leverag(?:e|es|ed|ing)', 'unlock(?:s|ed|ing)?', 'unleash(?:es|ed|ing)?',
    'tapestry', 'landscape', 'realm', 'testament', 'game[- ]chang(?:er|ers|ing)', 'seamless(?:ly)?', 'robust', 'harness(?:es|ed|ing)?',
    'embark(?:s|ed|ing)?', 'journey', 'pivotal', 'crucial', 'vibrant', 'bustling', 'foster(?:s|ed|ing)?', 'navigat(?:e|es|ed|ing)',
    'empower(?:s|ed|ing|ment)?', 'streamlin(?:e|es|ed|ing)', 'cutting[- ]edge', 'comprehensive', 'multifaceted', 'nuanced', 'intricate',
    'ever[- ]evolving', 'underscor(?:e|es|ed|ing)', 'meticulous(?:ly)?', 'transformative', 'revolutioniz(?:e|es|ed|ing)', 'paradigm',
    'synergy', 'supercharg(?:e|es|ed|ing)', 'effortless(?:ly)?', 'actionable', 'insights?', 'resonat(?:e|es|ed|ing)', 'curated?',
    'bespoke', 'top[- ]notch', 'next[- ]level', 'unpack(?:s|ed|ing)?', 'dive (?:in|into|deeper)', 'deep dive', 'treasure trove',
    'hidden gem', 'ever[- ]changing', 'rapidly evolving', 'shed(?:s|ding)? light', 'plays? a (?:vital|crucial|key|pivotal) role',
    'stands? as', 'serves? as', 'aims? to', 'in essence', 'holistically', 'thrive', 'thriving', 'transformational', 'optimi[sz](?:e|es|ed|ing)',
    'align(?:s|ed|ing)? with', 'sustainable', 'intentional(?:ly)?', 'mindful(?:ly)?', 'nourish(?:es|ed|ing)?', 'radiant', 'glow(?:ing)? up'
  ];

  // Sentence-level formulas.
  var STOCK_PHRASES = [
    "in today'?s (?:fast-paced |digital |ever-changing |modern |busy )?(?:world|age|landscape|society|era|life)",
    'whether you\'?re (?:a|an|looking|trying|just)', 'look no further', 'say goodbye to', 'say hello to', 'the world of',
    'when it comes to', 'a world where', 'here\'?s the thing', 'let\'?s be honest', 'let\'?s face it', 'spoiler alert', 'pro tip',
    'buckle up', 'picture this', 'imagine (?:a|this|if)', 'think of it as', 'the best part\\?', 'the result\\?', 'sound familiar\\?',
    'and that\'?s (?:okay|ok|fine)', 'you\'?ve got this', 'you\'?re not alone', 'no fluff', 'chef\'?s kiss', 'level up',
    'at the end of the day', 'it\'?s (?:also )?worth noting', 'it\'?s important to (?:note|remember|understand)', 'in conclusion',
    'in summary', 'to sum up', 'the bottom line', 'more than just', 'not just about', 'isn\'?t just about', 'is about more than',
    'take (?:your|it) to the next level', 'in the realm of', 'a (?:gentle|friendly) reminder', 'small (?:but|yet) (?:mighty|powerful)',
    'the truth is', 'real talk', 'plot twist', 'fun fact', 'trust me', 'i get it', 'we\'?ve all been there', 'this is your sign',
    'your future self will thank you', 'one step at a time', 'it doesn\'?t have to be (?:complicated|hard|perfect|overwhelming)',
    'meet you where you are', 'show up for yourself', 'give yourself (?:grace|permission)', 'feel like yourself again',
    'little things add up', 'consistency (?:over|beats) (?:intensity|perfection)', 'progress,? not perfection'
  ];

  // Label-style openers: a one- to three-word tag, a colon, then the reveal.
  var LABEL_OPENERS = [
    'translation', 'the result', 'the takeaway', 'bottom line', 'the bottom line', 'pro tip', 'reality check', 'the truth', 'the catch',
    'the kicker', 'the good news', 'the bad news', 'the better news', 'spoiler', 'enter', 'cue', 'plot twist', 'real talk',
    'here\'?s the thing', 'the fix', 'the goal', 'the problem', 'the solution', 'the lesson', 'the key', 'the trick', 'the secret',
    'the short version', 'the long version', 'my take', 'hot take', 'the shift', 'the move', 'the ask', 'the win', 'quick reminder',
    'friendly reminder', 'gentle reminder', 'the best part', 'the twist', 'the point', 'the upshot', 'in short', 'tl;?dr'
  ];

  var CLOSERS = [
    'in conclusion', 'ultimately', 'at the end of the day', 'remember', 'the bottom line', 'bottom line', 'to sum up', 'in short',
    'in summary', 'all in all', 'so,? (?:here\'?s|there you have it|whether|if|the next time)', 'the takeaway', 'final thoughts?',
    'here\'?s to', 'you\'?ve got this', 'your (?:body|health|future self) will thank you'
  ];

  var INTENSIFIERS = [
    'truly', 'genuinely', 'incredibly', 'absolutely', 'remarkably', 'undeniably', 'profoundly', 'immensely', 'deeply', 'utterly',
    'exceptionally', 'extremely', 'wonderfully', 'beautifully', 'perfectly', 'completely', 'entirely', 'highly', 'seriously', 'honestly'
  ];

  // Patterns are written with straight apostrophes; text usually has curly ones.
  function alternation(list) {
    return '(?:' + list.join('|').replace(/'/g, "['\\u2019]") + ')';
  }

  var RE_AI_WORDS = new RegExp('\\b' + alternation(AI_WORDS) + '\\b', 'gi');
  var RE_STOCK = new RegExp('\\b' + alternation(STOCK_PHRASES), 'gi');
  var RE_LABEL = new RegExp('(?:^|[.!?]\\s+|\\n\\s*)(' + alternation(LABEL_OPENERS) + '):\\s', 'gi');
  var RE_CLOSER = new RegExp('^\\W*' + alternation(CLOSERS) + '\\b', 'i');
  var RE_INTENSIFIERS = new RegExp('\\b' + alternation(INTENSIFIERS) + '\\b', 'gi');

  // "It's not X, it's Y" and its cousins. Kept fairly tight to avoid ordinary negation.
  var RE_NOT_BUT = [
    /\b(?:it|this|that|there|success|health|wellness|healing|the goal|the point|the answer|the secret|the key)(?:['\u2019]s| is|['\u2019]re| are)\s+not\s+(?:just\s+|only\s+|merely\s+|simply\s+|about\s+)?[^.!?\n]{2,70}?[,;.]\s*(?:it['\u2019]?s|this is|that['\u2019]?s|but|they['\u2019]?re|but rather|rather)\b/gi,
    /\bnot\s+(?:just|only|merely|simply)\s+[^.!?\n,;]{2,50}?[,;]?\s+but\s+(?:also\s+)?/gi,
    /\b(?:isn['\u2019]?t|aren['\u2019]?t|wasn['\u2019]?t|doesn['\u2019]?t have to be)\s+(?:just\s+|only\s+|about\s+)?[^.!?\n]{2,60}[.!?]\s+(?:It['\u2019]?s|This is|That['\u2019]?s|They['\u2019]?re)\b/g,
    /\bless\s+[^.!?\n,]{2,30},\s+more\s+[^.!?\n,]{2,30}\b/gi
  ];

  // Three parallel items with a serial "and" or "or": "X, Y, and Z".
  var RE_TRICOLON = /\b([A-Za-z][\w'-]*(?:\s[\w'-]+){0,2}),\s([A-Za-z][\w'-]*(?:\s[\w'-]+){0,2}),?\s(?:and|or)\s([A-Za-z][\w'-]*(?:\s[\w'-]+){0,2})\b/g;
  // Three one- or two-word fragments in a row: "Small. Boring. Repeatable."
  var RE_FRAGMENTS = /(?:^|[.!?:]\s+)((?:[A-Z][\w'-]*(?:\s[\w'-]+)?[.!])\s(?:[A-Z][\w'-]*(?:\s[\w'-]+)?[.!])\s(?:[A-Z][\w'-]*(?:\s[\w'-]+)?[.!]))/g;
  var RE_EM_DASH = /[\u2014\u2015]|\s-\s|--/g;
  var RE_SHORT_QUESTION = /(?:^|[.!?]\s+|\n\s*)((?:[A-Z][\w'\u2019-]*)(?:\s[\w'\u2019-]+){0,4}\?)/g;

  // ---------------------------------------------------------------------------
  // Text utilities
  // ---------------------------------------------------------------------------

  var WORD_RE = /[A-Za-z0-9\u00C0-\u024F][\w'\u2019\u00C0-\u024F-]*/g;

  function countWords(text) {
    var m = text.match(WORD_RE);
    return m ? m.length : 0;
  }

  // Sentences with their offsets. Splits on terminal punctuation followed by
  // space and an uppercase/quote/number, and on line breaks.
  function splitSentences(text) {
    var out = [];
    var re = /[^.!?\n]+(?:[.!?]+["')\]\u2019\u201D]*|\n|$)/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var raw = m[0];
      var lead = raw.length - raw.replace(/^\s+/, '').length;
      var s = raw.trim();
      if (!s) { if (raw.length === 0) re.lastIndex++; continue; }
      var wc = countWords(s);
      if (wc === 0) continue;
      out.push({ text: s, index: m.index + lead, length: s.length, words: wc });
      if (m[0].length === 0) re.lastIndex++;
    }
    return out;
  }

  function paragraphs(text) {
    var out = [];
    var re = /[^\n]+/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      if (m[0].trim()) out.push({ text: m[0].trim(), index: m.index + (m[0].length - m[0].replace(/^\s+/, '').length) });
    }
    return out;
  }

  function collect(re, text, groupIndex) {
    var out = [];
    re.lastIndex = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
      var s = groupIndex ? m[groupIndex] : m[0];
      if (s == null) continue;
      var offset = groupIndex ? m.index + m[0].indexOf(s) : m.index;
      out.push({ index: offset, length: s.length, text: s });
      if (m[0].length === 0) re.lastIndex++;
    }
    return out;
  }

  function dedupe(matches) {
    matches.sort(function (a, b) { return a.index - b.index || b.length - a.length; });
    var out = [];
    var end = -1;
    matches.forEach(function (m) {
      if (m.index >= end) { out.push(m); end = m.index + m.length; }
    });
    return out;
  }

  function firstWord(s) {
    var m = s.match(/^[^\w]*([\w'\u2019-]+)/);
    return m ? m[1].toLowerCase().replace(/[\u2019']s$/, '') : '';
  }

  // Severity from both density (per 100 words) and absolute count, so a short
  // text with one hit is never marked high.
  function sevFromRate(count, rate, low, mid, minMid, minHigh) {
    if (count <= 0) return 0;
    if (rate < low || count < minMid) return 1;
    if (rate < mid || count < minHigh) return 2;
    return 3;
  }

  function sevFromCount(n, one, two, three) {
    if (n <= 0) return 0;
    if (n < two) return one;
    if (n < three) return 2;
    return 3;
  }

  // ---------------------------------------------------------------------------
  // The analysis
  // ---------------------------------------------------------------------------

  var SEVERITY_LABEL = ['none', 'low', 'medium', 'high'];

  function analyzeTells(text) {
    text = typeof text === 'string' ? text : '';
    var words = countWords(text);
    var sents = splitSentences(text);
    var paras = paragraphs(text);
    var per100 = function (n) { return words ? (n * 100) / words : 0; };
    var tells = [];

    function add(id, label, blurb, matches, severity, detail, advice) {
      tells.push({
        id: id, label: label, blurb: blurb, count: matches.length, per100: +per100(matches.length).toFixed(2),
        severity: severity, severityLabel: SEVERITY_LABEL[severity], matches: matches, detail: detail || '', advice: advice || ''
      });
    }

    if (words === 0) {
      return { words: 0, sentences: 0, paragraphs: 0, tells: [], score: 0, verdict: 'Nothing to read yet', verdictLevel: 0 };
    }

    // 1. Sentence rhythm ------------------------------------------------------
    var rhythmSev = 0;
    var rhythmDetail = '';
    if (sents.length >= 6) {
      var lens = sents.map(function (s) { return s.words; });
      var mean = lens.reduce(function (a, b) { return a + b; }, 0) / lens.length;
      var sd = Math.sqrt(lens.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / lens.length);
      var cv = mean ? sd / mean : 0;
      var min = Math.min.apply(null, lens);
      var max = Math.max.apply(null, lens);
      rhythmSev = cv < 0.3 ? 3 : cv < 0.4 ? 2 : cv < 0.5 ? 1 : 0;
      rhythmDetail = sents.length + ' sentences, ' + Math.round(mean) + ' words on average, shortest ' + min + ', longest ' + max +
        '. Variation ' + Math.round(cv * 100) + '%' + (rhythmSev ? ', which is narrow. Human paragraphs usually mix very short sentences with long ones.' : '. That is a healthy spread.');
      add('rhythm', 'Even sentence rhythm', 'Statistical detectors call this low burstiness: sentence after sentence of about the same length.',
        [], rhythmSev, rhythmDetail, rhythmSev ? 'Cut one sentence in each paragraph down to a few words, and let another run long.' : '');
    } else {
      add('rhythm', 'Even sentence rhythm', 'Statistical detectors call this low burstiness: sentence after sentence of about the same length.',
        [], 0, sents.length + ' sentences. Too few to judge rhythm; six or more are needed.', '');
    }

    // 2. AI vocabulary -----------------------------------------------------------
    var vocab = collect(RE_AI_WORDS, text);
    add('vocabulary', 'AI vocabulary', 'Words models reach for far more often than people do.',
      vocab, sevFromRate(vocab.length, per100(vocab.length), 1, 2, 3, 6), topTerms(vocab), 'Swap each for the plain word you would say out loud.');

    // 3. Stock phrases -----------------------------------------------------------
    var stock = collect(RE_STOCK, text);
    add('stock', 'Stock phrases', 'Ready-made openers, transitions, and reassurances.',
      stock, sevFromRate(stock.length, per100(stock.length), 0.5, 1, 2, 4), topTerms(stock),
      'Delete the phrase or replace it with a specific detail from your own experience.');

    // 4. Not X, but Y ------------------------------------------------------------
    var notBut = [];
    RE_NOT_BUT.forEach(function (re) { notBut = notBut.concat(collect(re, text)); });
    notBut = dedupe(notBut);
    add('contrast', 'Not X, but Y framing', 'Defining something by what it is not, then pivoting. A signature move.',
      notBut, sevFromCount(notBut.length, 1, 2, 3), '', 'State the positive claim directly and drop the setup.');

    // 5. Short rhetorical questions ---------------------------------------------
    var questions = collect(RE_SHORT_QUESTION, text, 1).filter(function (q) { return countWords(q.text) <= 5; });
    add('questions', 'Short rhetorical questions', 'One-liners like "Sound familiar?" or "The result?" used as hooks.',
      questions, sevFromCount(questions.length, 1, 2, 4), '', 'Keep one at most. Turn the rest into statements.');

    // 6. Lists of three ----------------------------------------------------------
    var tri = collect(RE_TRICOLON, text);
    add('tricolon', 'Lists of three', 'Three parallel items, again and again. One is rhetoric, five is a pattern.',
      tri, sevFromRate(tri.length, per100(tri.length), 0.4, 0.8, 2, 4), '', 'Vary the count: two items here, four there, or a single strong one.');

    // 7. Fragment triplets -------------------------------------------------------
    var frags = collect(RE_FRAGMENTS, text, 1);
    add('fragments', 'Punchy fragment triplets', 'Three clipped fragments in a row: "Small. Boring. Repeatable."',
      frags, sevFromCount(frags.length, 2, 2, 3), '', 'Join them into one sentence, or keep a single fragment.');

    // 8. Label openers -----------------------------------------------------------
    var labels = collect(RE_LABEL, text, 1);
    add('labels', 'Label-style openers', 'A tag, a colon, a reveal: "Translation:", "The result:", "Enter:".',
      labels, sevFromCount(labels.length, 1, 2, 3), '', 'Write the sentence without the label.');

    // 9. Repeated sentence starters ---------------------------------------------
    var starters = {};
    sents.forEach(function (s) {
      var w = firstWord(s.text);
      if (!w || w.length < 2) return;
      (starters[w] = starters[w] || []).push(s);
    });
    var repeated = [];
    var repDetail = [];
    var repSev = 0;
    Object.keys(starters).forEach(function (w) {
      var list = starters[w];
      var share = list.length / sents.length;
      if (list.length >= 3 && share >= 0.2) {
        repDetail.push('"' + capitalize(w) + '" opens ' + list.length + ' of ' + sents.length + ' sentences');
        repSev = Math.max(repSev, share >= 0.4 ? 3 : share >= 0.3 ? 2 : 1);
        list.forEach(function (s) { repeated.push({ index: s.index, length: Math.min(s.length, w.length + 1), text: w }); });
      }
    });
    var paraStarts = {};
    paras.forEach(function (p) { var w = firstWord(p.text); if (w) (paraStarts[w] = paraStarts[w] || []).push(p); });
    Object.keys(paraStarts).forEach(function (w) {
      var list = paraStarts[w];
      if (list.length >= 3 && paras.length >= 4) {
        repDetail.push('"' + capitalize(w) + '" opens ' + list.length + ' paragraphs');
        repSev = Math.max(repSev, 1);
        list.forEach(function (p) { repeated.push({ index: p.index, length: w.length, text: w }); });
      }
    });
    add('starters', 'Repeated sentence starters', 'Many sentences or paragraphs opening on the same word.',
      dedupe(repeated), repSev, repDetail.join('. '), 'Recast a few of those sentences so the subject moves.');

    // 10. Em dash density --------------------------------------------------------
    var dashes = collect(RE_EM_DASH, text);
    add('dashes', 'Dash-driven sentences', 'Em dashes (or their spaced-hyphen stand-ins) splicing clauses together.',
      dashes, sevFromRate(dashes.length, per100(dashes.length), 0.5, 1, 2, 4), dashes.length ? dashes.length + ' in ' + words + ' words' : '',
      'Break each one into two sentences, or use a comma or colon.');

    // 11. Intensifiers -------------------------------------------------------------
    var intens = collect(RE_INTENSIFIERS, text);
    add('intensifiers', 'Stacked intensifiers', 'Truly, genuinely, incredibly, absolutely. Emphasis that adds nothing.',
      intens, sevFromRate(intens.length, per100(intens.length), 0.5, 1, 2, 4), topTerms(intens), 'Delete them. The sentence is usually stronger without.');

    // 12. Summary closer -------------------------------------------------------------
    var closer = [];
    if (paras.length >= 3) {
      var last = paras[paras.length - 1];
      var m = last.text.match(RE_CLOSER);
      if (m) closer.push({ index: last.index + m.index, length: m[0].length, text: m[0] });
    }
    add('closer', 'Wrap-up closing paragraph', 'A final paragraph that restates the piece or signs off with a pep talk.',
      closer, closer.length ? 2 : 0, '', 'End on the last concrete point instead.');

    // Overall ---------------------------------------------------------------------
    var score = tells.reduce(function (a, t) { return a + t.severity; }, 0);
    var flagged = tells.filter(function (t) { return t.severity > 0; }).length;
    var verdictLevel = score <= 2 ? 0 : score <= 7 ? 1 : score <= 14 ? 2 : 3;
    var verdict = ['Few tells', 'Some tells', 'Several tells', 'Many tells'][verdictLevel];

    return { words: words, sentences: sents.length, paragraphs: paras.length, tells: tells, flagged: flagged, score: score, verdict: verdict, verdictLevel: verdictLevel };
  }

  function topTerms(matches) {
    if (!matches.length) return '';
    var counts = {};
    matches.forEach(function (m) { var k = m.text.toLowerCase().replace(/\s+/g, ' '); counts[k] = (counts[k] || 0) + 1; });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 6)
      .map(function (k) { return k + (counts[k] > 1 ? ' (' + counts[k] + ')' : ''); }).join(', ');
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // All highlightable matches across tells, tagged with the tell id, non-overlapping.
  function highlights(report) {
    var all = [];
    report.tells.forEach(function (t) {
      if (t.severity === 0) return;
      t.matches.forEach(function (m) { all.push({ index: m.index, length: m.length, text: m.text, tell: t.id, label: t.label }); });
    });
    return dedupe(all);
  }

  return {
    analyzeTells: analyzeTells,
    highlights: highlights,
    splitSentences: splitSentences,
    countWords: countWords,
    SEVERITY_LABEL: SEVERITY_LABEL,
    version: '1.0.0'
  };
});
