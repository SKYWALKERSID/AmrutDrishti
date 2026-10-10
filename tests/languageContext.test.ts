import test from 'node:test';
import assert from 'node:assert/strict';

import { translations } from '../src/lib/data/translations.ts';

test('LanguageContext translations dictionary contains essential Hindi and English keys', () => {
  assert.ok(translations.hi);
  assert.ok(translations.en);

  // Check navigation items
  assert.equal(translations.hi['nav.overview'], 'मुख्य पृष्ठ (Overview)');
  assert.equal(translations.en['nav.overview'], 'Overview');
  assert.equal(translations.hi['nav.explorer'], 'मानचित्र एक्सप्लोरर (Map Explorer)');
  assert.equal(translations.en['nav.explorer'], 'Map Explorer');

  // Check terms
  assert.equal(translations.hi['term.provenance'], 'जानकारी कहाँ से मिली (Data Source)');
  assert.equal(translations.en['term.provenance'], 'Where the data came from (Data Source)');

  // Check Map Explorer
  assert.equal(translations.hi['explorer.title'], 'नक्शे पर जानकारी देखें');
  assert.equal(translations.en['explorer.title'], 'Explore the Map');

  // Check Data Sources
  assert.equal(translations.hi['datasources.title'], 'सूचना के स्रोत और साक्ष्य रजिस्ट्री');
  assert.equal(translations.en['datasources.title'], 'Data Sources & Evidence Registry');

  // Check Admin
  assert.equal(translations.hi['admin.title'], 'प्रणाली प्रशासन (Superuser) कार्यक्षेत्र');
  assert.equal(translations.en['admin.title'], 'System Administration Superuser Workspace');
});

test('Hindi and English translation dictionaries have matching key structures', () => {
  const hiKeys = Object.keys(translations.hi).sort();
  const enKeys = Object.keys(translations.en).sort();

  assert.deepEqual(hiKeys, enKeys, 'All translation keys present in Hindi must be present in English and vice-versa');
});
