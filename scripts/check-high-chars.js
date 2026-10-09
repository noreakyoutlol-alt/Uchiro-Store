const fs = require('fs');
const path = require('path');
const dirs = [
  path.join(__dirname, '..', 'server', 'src'),
  path.join(__dirname, '..', 'client-store', 'src'),
  path.join(__dirname, '..', 'client-admin', 'src')
];

function walk(dir) {
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) res = res.concat(walk(p));
    else if (/\.(ts|tsx|js|jsx|json|html|css)$/.test(f)) res.push(p);
  }
  return res;
}
let allFiles = [];
dirs.forEach(d => allFiles = allFiles.concat(walk(d)));

const scanned = require('./found-emojis.json').map(i => i.emoji);
const scannedSet = new Set();
scanned.forEach(e => {
  for (const char of e) scannedSet.add(char);
});

const otherHighChars = new Map();
allFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  for (const char of content) {
    const cp = char.codePointAt(0);
    // Ignore Khmer script (U+1780 - U+17FF)
    if (cp >= 0x1780 && cp <= 0x17FF) continue;
    // Ignore common typographic punctuation (dashes, quotes, bullets, etc.)
    if ([0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2039, 0x203A, 0x2190, 0x2191, 0x2192, 0x2193, 0xFEFF, 0x00A0].includes(cp)) continue;
    if (cp > 0x2000) {
      if (!scannedSet.has(char)) {
        otherHighChars.set(char, (otherHighChars.get(char) || 0) + 1);
      }
    }
  }
});

for (const [ch, count] of otherHighChars.entries()) {
  const cp = 'U+' + ch.codePointAt(0).toString(16).toUpperCase();
  console.log(`Char: [${ch}] (${cp}) count: ${count}`);
}
