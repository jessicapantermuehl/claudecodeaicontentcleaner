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

Opt-in style cleanup: em dashes to a hyphen or comma, en dashes to hyphens, curly quotes to straight, the ellipsis character to three dots, and collapsing doubled spaces.

## Use it

**In the browser.** Open `index.html`, or run `npm start` and visit http://localhost:8787. Paste text, read the breakdown, copy the clean version. The Reveal tab shows every hidden character in place as a small labelled chip.

**As one file.** `npm run build` writes `dist/ghost-ink.html`, the whole app with the engine inlined, ready to drop on any static host or open by double-clicking.

**From the command line.**

```sh
# print the cleaned text
node bin/ghost-ink.js article.txt

# just list what is hiding
node bin/ghost-ink.js --report article.txt

# clean from the clipboard on macOS, with style cleanup
pbpaste | node bin/ghost-ink.js --em-dash hyphen --quotes | pbcopy

# write to a file and see the report
node bin/ghost-ink.js --em-dash comma -o clean.txt draft.txt
```

Run `node bin/ghost-ink.js --help` for every flag.

**As a library.**

```js
const GhostInk = require('./cleaner.js');

const result = GhostInk.clean(text, { emDash: 'hyphen', quotes: true });
result.output;        // the cleaned string
result.summary;       // [{ code: 'U+200B', name: 'ZERO WIDTH SPACE', count: 12, action: 'remove', ... }]
result.stats;         // { hidden, kept, removed, replaced, styleChanges, inputLength, outputLength }
result.typography;    // [{ id: 'emDash', label: 'Em dashes', count: 3 }]
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
  emDash: 'off',          // 'off' | 'hyphen' | 'comma'
  enDash: false,
  quotes: false,
  ellipsis: false,
  collapseSpaces: false
}
```

`GhostInk.analyze(text)` returns the raw per-character findings, and `GhostInk.segments(text, findings)` splits the text into runs and marks for rendering a reveal view.

## Develop

```sh
npm test        # runs the test suite with node:test
npm start       # local dev server
npm run build   # single-file build in dist/
```

Requires Node 18 or newer. There are no runtime or development dependencies.

## Why these characters

Zero-width and tag characters are the usual carriers for text watermarks: they survive copy and paste, are invisible in every editor, and can encode a payload of arbitrary length. Look-alike spaces and letters are used both for watermarking and for slipping past plagiarism and AI detectors. Ghost Ink reports exactly what it found and what it did about each one, so you can judge the result instead of trusting a black box.
