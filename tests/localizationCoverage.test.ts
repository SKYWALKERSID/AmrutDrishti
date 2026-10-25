import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { translations } from '../src/lib/data/translations.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

test('hi and en dictionaries have identical key sets and no empty values', () => {
  const hi = Object.keys(translations.hi).sort();
  const en = Object.keys(translations.en).sort();
  assert.deepEqual(hi, en);
  for (const lang of ['hi', 'en'] as const) {
    for (const [k, v] of Object.entries(translations[lang])) {
      assert.ok(v.trim().length > 0, `${lang}:${k} is empty`);
    }
  }
});

test('every literal t() key used in src exists in both dictionaries', () => {
  const missing: string[] = [];
  for (const file of walk(path.join(root, 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+\.[a-zA-Z0-9_.]+)'/g)) {
      const key = m[1];
      if (!(key in translations.hi) || !(key in translations.en)) missing.push(`${key} <- ${path.relative(root, file)}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('Hindi translations of body keys contain Devanagari', () => {
  for (const [k, v] of Object.entries(translations.hi)) {
    if (/^(footer|terms|privacy|legal)\./.test(k)) {
      assert.match(v, /[\u0900-\u097F]/, `hi:${k} has no Devanagari`);
    }
  }
});

test('Footer, Terms and Privacy bodies consume the shared language context', () => {
  assert.match(read('src/components/Footer.tsx'), /useLanguage\(\)/);
  const legal = read('src/components/LegalBodies.tsx');
  assert.match(legal, /useLanguage\(\)/);
  assert.match(read('src/app/terms/page.tsx'), /TermsBody/);
  assert.match(read('src/app/privacy/page.tsx'), /PrivacyBody/);
});

test('Footer has no hardcoded English prose (all via t())', () => {
  const src = read('src/components/Footer.tsx');
  for (const phrase of ['Platform Modules', 'Governance & Policies', 'Non-operational research prototype', 'Terms of Service (Draft)']) {
    assert.ok(!src.includes(phrase), `Footer still hardcodes "${phrase}"`);
  }
});

test('single global language state: one provider, mounted in root layout, persisted', () => {
  const ctxFiles = walk(path.join(root, 'src')).filter((f) => /createContext/.test(fs.readFileSync(f, 'utf8')) && /Language/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(ctxFiles.map((f) => path.relative(root, f).replace(/\\/g, '/')), ['src/lib/context/LanguageContext.tsx']);
  assert.match(read('src/app/layout.tsx'), /<LanguageProvider>/);
  const ctx = read('src/lib/context/LanguageContext.tsx');
  assert.match(ctx, /localStorage\.setItem\(STORAGE_KEY_LANG/);
  assert.match(ctx, /localStorage\.getItem\(STORAGE_KEY_LANG/);
  assert.match(ctx, /warnMissingKey/);
});
