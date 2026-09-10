#!/usr/bin/env node
'use strict';
/*
 * Ghost Ink command line.
 *
 *   ghost-ink [options] [file]        clean a file (or stdin) and print the result
 *   ghost-ink --report [file]         list hidden characters without printing cleaned text
 *
 * Options:
 *   --em-dash <off|hyphen|comma>   how to rewrite em dashes (default: off)
 *   --en-dash                      rewrite en dashes as hyphens
 *   --quotes                       straighten curly quotes
 *   --ellipsis                     turn the ellipsis character into three dots
 *   --collapse-spaces              collapse doubled spaces and trailing whitespace
 *   --no-homoglyphs                leave look-alike letters alone
 *   --no-nfc                       skip Unicode NFC normalization
 *   --no-protect-emoji             also strip joiners inside emoji
 *   --no-protect-scripts           also strip joiners inside Arabic and Indic text
 *   --json                         print the full result as JSON
 *   -o, --output <file>            write the cleaned text to a file
 *   -h, --help                     show this help
 */
const fs = require('fs');
const path = require('path');
const GhostInk = require('../cleaner.js');

function usage() {
  const src = fs.readFileSync(__filename, 'utf8');
  const block = src.split('/*')[1].split('*/')[0];
  return block.split('\n').map((l) => l.replace(/^\s*\* ?/, '')).join('\n').trim();
}

function parseArgs(argv) {
  const opts = { options: {}, report: false, json: false, output: null, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-h': case '--help': console.log(usage()); process.exit(0); break;
      case '--report': opts.report = true; break;
      case '--json': opts.json = true; break;
      case '-o': case '--output': opts.output = argv[++i]; break;
      case '--em-dash': opts.options.emDash = argv[++i]; break;
      case '--en-dash': opts.options.enDash = true; break;
      case '--quotes': opts.options.quotes = true; break;
      case '--ellipsis': opts.options.ellipsis = true; break;
      case '--collapse-spaces': opts.options.collapseSpaces = true; break;
      case '--no-homoglyphs': opts.options.homoglyphs = false; break;
      case '--no-nfc': opts.options.nfc = false; break;
      case '--no-protect-emoji': opts.options.protectEmoji = false; break;
      case '--no-protect-scripts': opts.options.protectScripts = false; break;
      default:
        if (a.startsWith('-') && a !== '-') {
          console.error('Unknown option: ' + a + '\n');
          console.error(usage());
          process.exit(2);
        }
        opts.file = a;
    }
  }
  if (opts.options.emDash && !['off', 'hyphen', 'comma'].includes(opts.options.emDash)) {
    console.error('--em-dash must be off, hyphen, or comma');
    process.exit(2);
  }
  return opts;
}

function readInput(file) {
  if (file && file !== '-') return fs.readFileSync(path.resolve(file), 'utf8');
  if (process.stdin.isTTY) {
    console.error('Reading from stdin. Paste text, then press Ctrl+D.');
  }
  return fs.readFileSync(0, 'utf8');
}

function actionWord(action) {
  return {
    remove: 'removed',
    space: 'replaced with space',
    newline: 'replaced with newline',
    keep: 'kept (emoji or script)'
  }[action];
}

function plural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

function report(result) {
  const lines = [];
  if (result.summary.length === 0) {
    lines.push('No hidden characters found.');
  } else {
    lines.push(plural(result.stats.hidden, 'hidden character') + ' found' +
      (result.stats.kept ? ' (' + result.stats.kept + ' more kept because they shape emoji or script)' : '') + '.');
    lines.push('');
    let group = null;
    for (const row of result.summary) {
      if (row.groupLabel !== group) {
        group = row.groupLabel;
        lines.push(group);
      }
      lines.push('  ' + row.code.padEnd(8) + String(row.count).padStart(5) + '  ' + row.name + '  [' + actionWord(row.action) + ']');
    }
  }
  if (result.homoglyphs) lines.push('\n' + plural(result.homoglyphs, 'look-alike letter') + ' fixed.');
  if (result.normalized) lines.push('Unicode normalization (NFC) changed the text.');
  for (const t of result.typography) lines.push(t.label + ': ' + t.count + ' rewritten.');
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const input = readInput(args.file);
const result = GhostInk.clean(input, args.options);

if (args.json) {
  const { findings, ...rest } = result;
  console.log(JSON.stringify({ ...rest, findings: findings.map(({ char, ...f }) => f) }, null, 2));
} else if (args.report) {
  console.log(report(result));
} else if (args.output) {
  fs.writeFileSync(args.output, result.output);
  console.error(report(result));
  console.error('Wrote ' + args.output);
} else {
  process.stdout.write(result.output);
}
