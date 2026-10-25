// Dev utility: reports i18n key coverage and hardcoded-English JSX hotspots.
// Usage: node scripts/i18n_coverage.cjs [--list-missing]
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('src/lib/data/translations.ts', 'utf8');
const hiStart = src.indexOf('hi: {');
const enStart = src.indexOf('en: {');
const keysOf = (s) => {
  const out = new Set();
  const re = /^\s*'([^']+)':/gm;
  let m;
  while ((m = re.exec(s))) out.add(m[1]);
  return out;
};
const hi = keysOf(src.slice(hiStart, enStart));
const en = keysOf(src.slice(enStart));

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk('src').filter((f) => f.endsWith('.tsx'));

const used = new Map();
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const re = /\bt\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(t))) if (!used.has(m[1])) used.set(m[1], f);
}
const missingHi = [...used.keys()].filter((k) => !hi.has(k));
const missingEn = [...used.keys()].filter((k) => !en.has(k));
console.log(`dict keys: hi=${hi.size} en=${en.size}; in en not hi=${[...en].filter((k) => !hi.has(k)).length}`);
console.log(`t() keys used=${used.size}; missing in hi=${missingHi.length}; missing in en=${missingEn.length}`);
if (process.argv.includes('--list-missing')) {
  missingHi.forEach((k) => console.log('  MISSING hi:', k, '<-', used.get(k)));
}
const rows = files.map((f) => {
  const t = fs.readFileSync(f, 'utf8');
  const jsx = (t.match(/>\s*[A-Z][A-Za-z ,.&\/\-()]{8,}\s*</g) || []).length;
  return { f, jsx, localized: /useLanguage/.test(t) };
}).sort((a, b) => b.jsx - a.jsx);
rows.filter((r) => r.jsx > 0).forEach((r) => console.log(String(r.jsx).padStart(4), r.localized ? 'uses-t ' : 'NO-LANG ', r.f));
