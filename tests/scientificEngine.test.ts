import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDescriptiveGss,
  matchInterventionRecommendations
} from '../src/lib/services/scientificEngine.ts';
import { ALL_BLOCKS } from '../src/lib/data/bundelkhand.ts';

test('calculateDescriptiveGss returns null score and gap severity when indicators are missing', () => {
  const result = calculateDescriptiveGss({
    cgwbWellDepthMbgl: null,
    rainfallAnomalyMm: null,
    graceTwsaCm: null,
    sentinelNdvi: null
  });

  assert.equal(result.isDataGap, true);
  assert.equal(result.score, null);
  assert.equal(result.severity, 'gap');
  assert.equal(result.confidenceInterval, null);
  assert.match(result.primaryStressDriver, /Data Gap/i);
});

test('calculateDescriptiveGss preserves nulls without converting to zero', () => {
  // If rainfall anomaly is null, it should NOT be treated as 0mm anomaly
  const res1 = calculateDescriptiveGss({
    cgwbWellDepthMbgl: 20, // High depth
    rainfallAnomalyMm: null, // Missing!
    graceTwsaCm: null,
    sentinelNdvi: null
  });

  assert.equal(res1.isDataGap, false);
  assert.ok(res1.score! > 0);
  assert.equal(res1.normalizationBreakdown.rainDeficitNorm, null);
  assert.ok(res1.normalizationBreakdown.wellDepthNorm !== null);
  assert.equal(res1.confidenceInterval, null);
});

test('calculateDescriptiveGss accurately computes severe stress when multi-criteria indicators align', () => {
  const result = calculateDescriptiveGss({
    cgwbWellDepthMbgl: 22.0, // critical depth
    rainfallAnomalyMm: -350, // critical deficit
    graceTwsaCm: -8.0,      // high TWSA deficit
    sentinelNdvi: 0.20       // dry canopy
  });

  assert.equal(result.isDataGap, false);
  assert.ok(result.score! >= 70);
  assert.equal(result.severity, 'severe');
  assert.ok(result.primaryStressDriver.length > 0);
  assert.equal(result.confidenceInterval, null);
});

test('calculateDescriptiveGss returns normal severity for favorable indicators', () => {
  const result = calculateDescriptiveGss({
    cgwbWellDepthMbgl: 4.0,  // shallow water table
    rainfallAnomalyMm: 50,   // positive rainfall
    graceTwsaCm: 2.0,        // positive TWSA
    sentinelNdvi: 0.65       // healthy vegetation
  });

  assert.equal(result.isDataGap, false);
  assert.equal(result.score, 0);
  assert.equal(result.severity, 'normal');
});

test('matchInterventionRecommendations returns rule-based matches with clear safeguards', () => {
  const severeBlock = ALL_BLOCKS.find(b => b.riskSeverity === 'severe')!;
  const matches = matchInterventionRecommendations(severeBlock);

  assert.ok(matches.length > 0);
  for (const m of matches) {
    assert.ok(m.safeguardNotice.includes('Rule-Based Pre-feasibility Suggestion'));
    assert.ok(m.estimatedSanctionRangeInr[0] > 0);
    assert.ok(m.estimatedSanctionRangeInr[1] >= m.estimatedSanctionRangeInr[0]);
    if (m.eligible) {
      assert.ok(m.matchReason.length > 0);
    }
  }
});

test('matchInterventionRecommendations handles missing indicators and gap blocks gracefully', () => {
  const gapBlock: any = {
    id: 'blk_test_gap',
    name: 'Gap Test Block',
    districtId: 'dst_test',
    districtName: 'Test District',
    state: 'Madhya Pradesh',
    riskSeverity: 'gap',
    indicators: {
      cgwbWellDepthMbgl: null,
      rainfallAnomalyMm: null,
      wellDepthTrendMperYr: null,
      sentinelNdwi: null,
      smapSoilMoisture: null,
      graceTwsaCm: null,
      sentinelNdvi: null,
      lastUpdatedDate: '2026-10-01'
    }
  };

  const matches = matchInterventionRecommendations(gapBlock);
  assert.equal(matches.length, 4);

  // When indicators are missing, eligibility fails closed with clear reason
  const atalBhujal = matches.find(m => m.scheme.id === 'sch_atal_bhujal')!;
  assert.equal(atalBhujal.eligible, false);
  assert.match(atalBhujal.matchReason, /Missing groundwater level/i);

  const jjm = matches.find(m => m.scheme.id === 'sch_jjm')!;
  assert.equal(jjm.eligible, false);
  assert.match(jjm.matchReason, /Missing groundwater well depth/i);
});
