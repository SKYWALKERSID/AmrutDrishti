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

  // Check new Interventions modal keys
  assert.equal(translations.hi['interventions.modalTitle'], 'नया जल संरक्षण प्रस्ताव तैयार करें');
  assert.equal(translations.en['interventions.modalTitle'], 'Draft New Intervention Proposal');

  // Check new Alerts simulator keys
  assert.equal(translations.hi['alerts.dispatchSimulator'], 'सलाह संदेश प्रेषण सिमुलेटर');
  assert.equal(translations.en['alerts.dispatchSimulator'], 'Advisory Dispatch Simulator');
  assert.equal(translations.hi['alerts.statusSimulated'], 'सिमुलेटेड (नमूना)');
  assert.equal(translations.en['alerts.statusSimulated'], 'SIMULATED');

  // Check Risk override keys
  assert.equal(translations.hi['risk.humanOverrideTitle'], 'मानव समीक्षा एवं जोखिम ओवरराइड');
  assert.equal(translations.en['risk.humanOverrideTitle'], 'Human Review & Risk Override');

  // Check Monitoring chart legend keys
  assert.equal(translations.hi['monitoring.wellDepthLegend'], 'कुएँ की गहराई (m bgl) — नमूना डेटा');
  assert.equal(translations.en['monitoring.wellDepthLegend'], 'Well Depth (m bgl) — simulated');

  // Check Role keys
  assert.equal(translations.hi['role.bdo'], 'खंड विकास अधिकारी (BDO)');
  assert.equal(translations.en['role.bdo'], 'Block Development Officer (BDO)');

  // Check Status keys
  assert.equal(translations.hi['status.under_review'], 'समीक्षाधीन (Under Review)');
  assert.equal(translations.en['status.under_review'], 'Under Review');

  // Check Scheme Focus keys
  assert.equal(translations.hi['scheme.sch_atal_bhujal.focus'], 'भूजल पुनर्भरण, जल बजट एवं मांग प्रबंधन');
  assert.equal(translations.en['scheme.sch_atal_bhujal.focus'], 'Groundwater Recharge, Water Budgeting & Demand Management');

  // Check Proposal titles & rationales
  assert.equal(translations.hi['interventions.prop1.title'], 'कुंडेश्वर जलग्रहण क्षेत्र में चेक डैम एवं पीज़ोमीटर नेटवर्क विस्तार');
  assert.equal(translations.en['interventions.prop1.title'], 'Check Dam & Piezometer Network Augmentation at Kundeshwar Catchment');
});

test('Hindi and English translation dictionaries have matching key structures', () => {
  const hiKeys = Object.keys(translations.hi).sort();
  const enKeys = Object.keys(translations.en).sort();

  assert.deepEqual(hiKeys, enKeys, 'All translation keys present in Hindi must be present in English and vice-versa');
});


