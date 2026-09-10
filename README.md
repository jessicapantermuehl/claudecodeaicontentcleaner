# Ghost Ink

Find and remove the invisible characters, hidden watermarks, look-alike letters, and typography tells that AI tools and copy-protection systems leave inside text. Everything runs locally, in the browser or from the command line. No dependencies, no network calls.

## What it catches

| Group | Examples | What happens |
| --- | --- | --- |
| Zero-width characters | ZWSP, ZWNJ, ZWJ, word joiner, BOM, invisible times/separator/plus | Removed |
| Direction controls | LRM, RLM, LRO, RLO, isolates | Removed |
| Look-alike spaces | NBSP, thin space, hair space, ideographic space, braille blank | Replaced with a normal space |
| Formatting characters | Soft hyphen, interlinear annotation marks | Removed |
| Filler characters | Hangul and Khmer fillers | Removed |
| Control codes | C0 and C1 controls (tab and newline are kept) | Removed |
| Line separators | U+2028, U+2029, NEL | Replaced with a newline |
| Variation selectors | VS1 to VS256 | Removed unless they shape an emoji or CJK character |
| Tag characters | U+E0000 to U+E007F, an invisible copy of ASCII | Removed unless part of a subdivision flag emoji |
| Look-alike letters | Cyrillic, Greek, Armenian, and fullwidth letters inside Latin words | Replaced with the Latin letter |
| Split accents | `e` + combining acute | Normalized to NFC |

Emoji sequences (families, flags, skin tones) and scripts that need zero-width joiners for correct spelling (Arabic, Persian, Devanagari, and others) are protected by default.

**Non-keyboard characters.** Everything else a keyboard cannot type is listed too, with a count and what will happen to it: curly quotes and apostrophes, em and en dashes, the ellipsis character, arrows, bullets, trademark signs, emoji, and accented letters. By default the typographic ones are rewritten as their keyboard equivalents (`"` `'` `-` `...` `->`), emoji and accented letters are kept, and both can be changed in settings. The output is verified until it contains keyboard characters only, apart from what you chose to keep.

## Writing tells

Below the character ledger, a second panel reads the text the way a statistical detector or a sharp editor would and flags twelve patterns associated with AI drafts. It measures and points. It never rewrites.

| Check | What it looks for |
| --- | --- |
| Even sentence rhythm | Sentences of nearly the same length throughout (low burstiness) |
| AI vocabulary | delve, elevate, leverage, unlock, tapestry, seamless, journey, and about sixty more |
| Stock phrases | "in today's fast-paced world", "here's the thing", "you've got this", "consistency beats intensity" |
| Not X, but Y framing | "It's not about doing more, it's about doing what lasts" |
| Short rhetorical questions | "Sound familiar?", "The result?" |
| Lists of three | "X, Y, and Z" over and over |
| Punchy fragment triplets | "Small. Boring. Repeatable." |
| Label-style openers | "Translation:", "The result:", "Enter:" |
| Repeated sentence starters | Many sentences or paragraphs opening on the same word |
| Dash-driven sentences | Em dashes splicing clauses together |
| Stacked intensifiers | truly, genuinely, incredibly, absolutely |
| Wrap-up closing paragraph | A final paragraph that restates the piece or signs off with a pep talk |

Each flagged check shows a severity, a count per 100 words, examples from the text, and a one-line fix. The Reveal view underlines every match in place. From the command line, `ghost-ink --tells file.txt` prints the same report. The engine lives in `tells.js` and exposes `analyzeTells(text)` and `highlights(report)`.

## What this does and does not do

Ghost Ink removes the character-level evidence that text was pasted from an AI tool: invisible watermarks, look-alike letters, and typography that no keyboard produces. That is what crawlers, plagiarism checkers, and paste inspectors can prove from the bytes themselves.

It does not change the words. Statistical AI detectors score sentence rhythm, word choice, and predictability, and no character cleaner affects that. The Writing tells panel shows you where those patterns are so an editing pass in your own voice knows where to go. Ghost Ink deliberately does not automate that pass: an automatic "humanizer" cannot run locally, cannot show its work, and makes copy worse.

## Use it

**In the browser.** Open `index.html`, or run `npm start` and visit http://localhost:8787. Paste text, read the breakdown, copy the clean version. The Reveal tab shows every hidden character in place as a small labelled chip.

**As one file.** `npm run build` writes `dist/ghost-ink.html`, the whole app with the engine inlined, ready to drop on any static host or open by double-clicking.

**From the command line.**

```sh
# print the cleaned text
node bin/ghost-ink.js article.txt

# just list what is hiding
node bin/ghost-ink.js --report article.txt

# clean from the clipboard on macOS
pbpaste | node bin/ghost-ink.js | pbcopy

# keep curly quotes, turn em dashes into commas, drop emoji
node bin/ghost-ink.js --no-quotes --em-dash comma --emoji -o clean.txt draft.txt
```

Run `node bin/ghost-ink.js --help` for every flag.

**As a library.**

```js
const GhostInk = require('./cleaner.js');

const result = GhostInk.clean(text, { emDash: 'comma', emoji: true });
result.output;        // the cleaned string
result.summary;       // hidden characters: [{ code: 'U+200B', name: 'ZERO WIDTH SPACE', count: 12, action: 'remove', ... }]
result.nonKeyboard;   // [{ char: '’', code: 'U+2019', category: 'quote', count: 58, action: 'rewrite', replacement: "'" }, ...]
result.stats;         // { hidden, kept, removed, replaced, nonKeyboard, nonKeyboardKept, styleChanges, inputLength, outputLength }
result.typography;    // [{ id: 'quotes', label: 'Curly quotes', count: 58 }, ...]
result.homoglyphs;    // number of look-alike letters fixed
result.changed;       // true when output differs from input
```

Options and their defaults:

```js
{
  protectEmoji: true,     // keep joiners and selectors inside emoji sequences
  protectScripts: true,   // keep ZWJ/ZWNJ between Arabic, Indic, and similar letters
  homoglyphs: true,       // fix look-alike letters inside Latin words
  nfc: true,              // Unicode NFC normalization
  quotes: true,           // curly quotes and apostrophes to " and '
  emDash: 'hyphen',       // 'off' | 'hyphen' | 'comma'
  dashes: true,           // en dashes, hyphen variants, minus signs to -
  ellipsis: true,         // the ellipsis character to ...
  symbols: true,          // arrows, bullets, (TM), (c), fractions to keyboard equivalents
  emoji: false,           // remove emoji
  accents: false,         // strip accents from Latin letters
  collapseSpaces: false
}
```

`GhostInk.analyze(text)` returns the raw per-character findings for hidden characters, `GhostInk.analyzeNonKeyboard(text, options)` does the same for everything else outside ASCII, and `GhostInk.segments(text, findings)` splits the text into runs and marks for rendering a reveal view.

## Develop

```sh
npm test        # runs the test suite with node:test
npm start       # local dev server
npm run build   # single-file build in dist/
```

Requires Node 18 or newer. There are no runtime or development dependencies.

## Why these characters

Zero-width and tag characters are the usual carriers for text watermarks: they survive copy and paste, are invisible in every editor, and can encode a payload of arbitrary length. Look-alike spaces and letters are used both for watermarking and for slipping past plagiarism and AI detectors. Ghost Ink reports exactly what it found and what it did about each one, so you can judge the result instead of trusting a black box.
