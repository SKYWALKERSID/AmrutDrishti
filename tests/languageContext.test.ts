import test from 'node:test';
import assert from 'node:assert/strict';

import { translations } from '../src/lib/data/translations.ts';

test('LanguageContext translations dictionary contains essential Hindi and English keys', () => {
  assert.ok(translations.hi);
  assert.ok(translations.en);

  // Check key translated terms
  assert.equal(translations.hi['nav.overview'], 'मुख्य पृष्ठ (Overview)');
  assert.equal(translations.en['nav.overview'], 'Overview');

  assert.equal(translations.hi['term.provenance'], 'जानकारी कहाँ से मिली (Data Source)');
  assert.equal(translations.en['term.provenance'], 'Where the data came from (Data Source)');

  assert.equal(translations.hi['term.simulatedData'], 'नमूना जानकारी, असली माप नहीं');
  assert.equal(translations.en['term.simulatedData'], 'Sample data, not real measurements');

  assert.equal(translations.hi['overview.severeTitle'], 'DISTRICT BLOCKS WITH SEVERE WARNING');
  assert.equal(translations.en['overview.severeTitle'], 'DISTRICT BLOCKS WITH SEVERE WARNING');
});
