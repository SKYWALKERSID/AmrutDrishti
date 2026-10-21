import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HIGH_STRESS_STATE_DISTRICTS,
  LOW_STRESS_STATE_DISTRICTS,
  NATIONAL_CONTRAST_DISTRICTS,
  ALL_CONTRAST_BLOCKS,
  STATE_CONTRAST_GROUPS
} from '../src/lib/data/nationalContrast.ts';
import { hasValidCoordinates } from '../src/lib/mappers/blockMapper.ts';
import { translations } from '../src/lib/data/translations.ts';

test('National Contrast: Validates Top 3 Most Scarce and Top 3 Least Scarce states', () => {
  assert.equal(STATE_CONTRAST_GROUPS.length, 6);

  const highStress = STATE_CONTRAST_GROUPS.filter(g => g.category === 'high_stress');
  const lowStress = STATE_CONTRAST_GROUPS.filter(g => g.category === 'low_stress');

  assert.equal(highStress.length, 3);
  assert.equal(lowStress.length, 3);

  // High Stress States
  const highNames = highStress.map(g => g.state);
  assert.ok(highNames.includes('Punjab'));
  assert.ok(highNames.includes('Rajasthan'));
  assert.ok(highNames.includes('Haryana'));

  // Low Stress States
  const lowNames = lowStress.map(g => g.state);
  assert.ok(lowNames.includes('Arunachal Pradesh'));
  assert.ok(lowNames.includes('Sikkim'));
  assert.ok(lowNames.includes('Assam'));
});

test('National Contrast: High stress blocks match specified red zones', () => {
  const highBlocks = HIGH_STRESS_STATE_DISTRICTS.flatMap(d => d.blocks);
  assert.equal(highBlocks.length, 21);

  const blockNames = highBlocks.map(b => b.name);

  // Punjab (Khanna, Phillaur, Majitha, Patran)
  assert.ok(blockNames.includes('Khanna'));
  assert.ok(blockNames.includes('Phillaur'));
  assert.ok(blockNames.includes('Majitha'));
  assert.ok(blockNames.includes('Patran'));

  // Rajasthan (Lalsot, Bandikui, Sikrai, Mahuwa, Bonli, Khandar, Chauth Ka Barwara, Mandore, Osian, Sam, Amer, Govindgarh, Sanganer)
  assert.ok(blockNames.includes('Lalsot'));
  assert.ok(blockNames.includes('Bandikui'));
  assert.ok(blockNames.includes('Sikrai'));
  assert.ok(blockNames.includes('Mahuwa'));
  assert.ok(blockNames.includes('Bonli'));
  assert.ok(blockNames.includes('Khandar'));
  assert.ok(blockNames.includes('Chauth Ka Barwara'));
  assert.ok(blockNames.includes('Mandore'));
  assert.ok(blockNames.includes('Osian'));
  assert.ok(blockNames.includes('Sam'));
  assert.ok(blockNames.includes('Amer'));
  assert.ok(blockNames.includes('Govindgarh'));
  assert.ok(blockNames.includes('Sanganer'));

  // Haryana (Pehowa, Rajound, Assandh, Kanina)
  assert.ok(blockNames.includes('Pehowa'));
  assert.ok(blockNames.includes('Rajound'));
  assert.ok(blockNames.includes('Assandh'));
  assert.ok(blockNames.includes('Kanina'));

  // All high stress blocks must have severe risk severity
  for (const b of highBlocks) {
    assert.equal(b.riskSeverity, 'severe');
    assert.ok(b.assessment.descriptiveStressScore >= 75);
    assert.ok(b.indicators.cgwbWellDepthMbgl! > 0);
  }
});

test('National Contrast: Low stress blocks match specified surplus basins', () => {
  const lowBlocks = LOW_STRESS_STATE_DISTRICTS.flatMap(d => d.blocks);
  assert.equal(lowBlocks.length, 27);

  const blockNames = lowBlocks.map(b => b.name);

  // Arunachal Pradesh (Yupia, Doimukh, Sagalee, Miao, Jairampur, Bordumsa, Ziro, Yachuli)
  assert.ok(blockNames.includes('Yupia'));
  assert.ok(blockNames.includes('Doimukh'));
  assert.ok(blockNames.includes('Sagalee'));
  assert.ok(blockNames.includes('Miao'));
  assert.ok(blockNames.includes('Jairampur'));
  assert.ok(blockNames.includes('Bordumsa'));
  assert.ok(blockNames.includes('Ziro'));
  assert.ok(blockNames.includes('Yachuli'));

  // Sikkim (Rakdong-Tintek, Khamdong, Duga, Ravangla, Sikkip, Jorethang, Dentam, Chumbong)
  assert.ok(blockNames.includes('Rakdong-Tintek'));
  assert.ok(blockNames.includes('Khamdong'));
  assert.ok(blockNames.includes('Duga'));
  assert.ok(blockNames.includes('Ravangla'));
  assert.ok(blockNames.includes('Sikkip'));
  assert.ok(blockNames.includes('Jorethang'));
  assert.ok(blockNames.includes('Dentam'));
  assert.ok(blockNames.includes('Chumbong'));

  // Assam (Boko, Chaygaon, Hajo, Barbaruah, Tingkhong, Joypur, Balipara, Gabharu, Dhekiajuli, Lakhipur, Sonai)
  assert.ok(blockNames.includes('Boko'));
  assert.ok(blockNames.includes('Chaygaon'));
  assert.ok(blockNames.includes('Hajo'));
  assert.ok(blockNames.includes('Barbaruah'));
  assert.ok(blockNames.includes('Tingkhong'));
  assert.ok(blockNames.includes('Joypur'));
  assert.ok(blockNames.includes('Balipara'));
  assert.ok(blockNames.includes('Gabharu'));
  assert.ok(blockNames.includes('Dhekiajuli'));
  assert.ok(blockNames.includes('Lakhipur'));
  assert.ok(blockNames.includes('Sonai'));

  // Low stress blocks have normal risk severity; Arunachal & Assam have shallow well depth, Sikkim has honest null
  for (const b of lowBlocks) {
    assert.equal(b.riskSeverity, 'normal');
    assert.ok(b.assessment.descriptiveStressScore <= 20);
    if (b.state === 'Sikkim') {
      assert.equal(b.indicators.cgwbWellDepthMbgl, null);
    } else {
      assert.ok(b.indicators.cgwbWellDepthMbgl !== null && b.indicators.cgwbWellDepthMbgl <= 7.5);
    }
  }
});

test('National Contrast: Every contrast block has valid coordinates and honest data tags', () => {
  assert.equal(ALL_CONTRAST_BLOCKS.length, 48);
  for (const block of ALL_CONTRAST_BLOCKS) {
    assert.ok(Array.isArray(block.coordinates));
    assert.ok(hasValidCoordinates(block.coordinates as [number, number]));
    if (block.state === 'Sikkim') {
      // Mountain springshed blocks without CGWB piezometer wells are honestly tagged as derived / pending_field_review
      assert.equal(block.assessment.dataStatus, 'derived');
      assert.equal(block.assessment.validationStatus, 'pending_field_review');
      assert.equal(block.indicators.cgwbWellDepthMbgl, null);
    } else {
      assert.equal(block.assessment.dataStatus, 'observed');
      assert.equal(block.assessment.validationStatus, 'validated');
      assert.ok(block.indicators.cgwbWellDepthMbgl !== null);
    }
  }
});

test('National Contrast: Bilingual scope labels present in translation dictionaries', () => {
  assert.ok(translations.en['explorer.scopeContrast']);
  assert.ok(translations.hi['explorer.scopeContrast']);
  assert.ok(translations.en['explorer.contrastHighStress']);
  assert.ok(translations.hi['explorer.contrastHighStress']);
  assert.ok(translations.en['explorer.contrastLowStress']);
  assert.ok(translations.hi['explorer.contrastLowStress']);
});
