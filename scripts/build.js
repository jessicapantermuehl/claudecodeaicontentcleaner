#!/usr/bin/env node
'use strict';
// Builds dist/ghost-ink.html: the whole app in one file with cleaner.js and tells.js inlined,
// so it can be emailed, dropped on any static host, or opened by double-clicking.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const tag = /<script src="([\w.-]+\.js)"><\/script>/g;
if (!tag.test(html)) throw new Error('index.html no longer references local scripts the way build.js expects');
tag.lastIndex = 0;

const out = html.replace(tag, (m, file) => {
  const lib = fs.readFileSync(path.join(root, file), 'utf8');
  return '<script>\n' + lib.replace(/<\/script/gi, '<\\/script') + '\n</script>';
});
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'ghost-ink.html'), out);
console.log('Wrote dist/ghost-ink.html (' + (out.length / 1024).toFixed(1) + ' KB)');
