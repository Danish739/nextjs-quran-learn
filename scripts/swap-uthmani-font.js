const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skip = new Set(['node_modules', '.next', '.git', 'scripts']);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(css|tsx|ts|scss)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const marker = /Naskh IndoPak|Scheherazade|Noto Naskh|KFGQPC|IndoPak Composite|PDMS Saleem|Traditional Arabic/;
const cssRe =
  /font-family\s*:\s*[^;{}]*?(?:Naskh IndoPak|Scheherazade|Noto Naskh|KFGQPC|IndoPak Composite|PDMS Saleem|Traditional Arabic|Amiri)[^;{}]*/g;
const stackRe =
  /(['"])(?:[^'"]*?)(?:Naskh IndoPak|Scheherazade New|Noto Naskh Arabic|KFGQPC|IndoPak Composite|PDMS Saleem AC Quran|Traditional Arabic)[^'"]*\1/g;

const changed = [];
for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8');
  if (!marker.test(text)) continue;
  const next = text.replace(cssRe, 'font-family: "UthmanicHafs", serif').replace(stackRe, '"UthmanicHafs", serif');
  if (next !== text) {
    fs.writeFileSync(file, next);
    changed.push(path.relative(root, file));
  }
}
console.log(changed.join('\n'));
console.log('COUNT', changed.length);
