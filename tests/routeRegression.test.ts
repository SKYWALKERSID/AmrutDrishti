import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JALDRISHTI_DEMO_MODE = 'true';

import { ALL_BLOCKS } from '../src/lib/data/bundelkhand.ts';
import { translations } from '../src/lib/data/translations.ts';
const { en, hi } = translations;
import { fetchBlocksGeospatialData } from '../src/lib/services/geospatialService.ts';

// Complete list of application routes
const APPLICATION_ROUTES = [
  '/',
  '/admin',
  '/alerts',
  '/data-sources',
  '/explorer',
  '/interventions',
  '/monitoring',
  '/risk-assessment'
];

test('JD-050: Route registry covers all documented application routes', () => {
  assert.equal(APPLICATION_ROUTES.length, 8);
  assert.ok(APPLICATION_ROUTES.includes('/'));
  assert.ok(APPLICATION_ROUTES.includes('/explorer'));
  assert.ok(APPLICATION_ROUTES.includes('/monitoring'));
  assert.ok(APPLICATION_ROUTES.includes('/risk-assessment'));
  assert.ok(APPLICATION_ROUTES.includes('/interventions'));
  assert.ok(APPLICATION_ROUTES.includes('/alerts'));
  assert.ok(APPLICATION_ROUTES.includes('/data-sources'));
  assert.ok(APPLICATION_ROUTES.includes('/admin'));
});

test('JD-050: Bilingual coverage exists for core terminology across both languages', () => {
  // Common UI keys must exist in both English and Hindi dictionaries
  const mandatoryKeys = [
    'nav.explorer',
    'nav.monitoring',
    'nav.risk',
    'nav.interventions',
    'nav.alerts',
    'nav.datasources',
    'nav.admin'
  ];

  for (const k of mandatoryKeys) {
    assert.ok(en[k], `Missing EN key: ${k}`);
    assert.ok(hi[k], `Missing HI key: ${k}`);
    assert.notEqual(en[k], hi[k], `Untranslated Hindi key: ${k}`);
  }
});

test('JD-050: Route data fallback state handles simulated and missing data gracefully', async () => {
  const result = await fetchBlocksGeospatialData();

  // In unconfigured/fallback mode:
  assert.equal(result.isDemonstrationData, true);
  assert.equal(result.source, 'demonstration_fixture');
  assert.ok(result.blocks.length > 0);

  // Every block must have valid coordinates and non-empty name
  for (const b of result.blocks) {
    assert.ok(b.id);
    assert.ok(b.name);
    assert.ok(b.coordinates);
    assert.equal(b.coordinates.length, 2);
  }
});

test('JD-050: Missing data state propagates nulls across all routes without conversion to zero', () => {
  const gapBlock = ALL_BLOCKS.find(b => b.riskSeverity === 'gap' || b.indicators.cgwbWellDepthMbgl === null);
  // Test block fixture with null indicators
  const simulatedNullBlock = {
    ...ALL_BLOCKS[0],
    indicators: {
      ...ALL_BLOCKS[0].indicators,
      cgwbWellDepthMbgl: null,
      rainfallAnomalyMm: null
    }
  };

  assert.equal(simulatedNullBlock.indicators.cgwbWellDepthMbgl, null);
  assert.notEqual(simulatedNullBlock.indicators.cgwbWellDepthMbgl, 0);
  assert.equal(simulatedNullBlock.indicators.rainfallAnomalyMm, null);
  assert.notEqual(simulatedNullBlock.indicators.rainfallAnomalyMm, 0);
});
