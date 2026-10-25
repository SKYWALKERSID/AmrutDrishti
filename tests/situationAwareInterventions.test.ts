import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectIntegratedSituation,
  generateSituationAwareInterventions
} from '../src/lib/services/situationAwareInterventionEngine.ts';
import type { IntegratedSituationAssessment } from '../src/lib/services/situationAwareInterventionEngine.ts';
import type { BlockData } from '../src/lib/types.ts';

const createMockBlock = (overrides: Partial<BlockData> = {}): BlockData => ({
  id: 'blk_test_01',
  name: 'Test Block',
  districtId: 'dist_test',
  districtName: 'Test District',
  state: 'Madhya Pradesh',
  coordinates: [24.5, 78.5],
  populationEst: 100000,
  totalGeographicAreaHa: 20000,
  netSownAreaHa: 15000,
  primaryCropSeason: 'Kharif',
  riskSeverity: 'severe',
  indicators: {
    graceTwsaCm: -8.0,
    rainfallAnomalyMm: -180,
    spi3Month: -1.6,
    sentinelNdvi: 0.45,
    sentinelNdwi: -0.35,
    smapSoilMoisture: 0.12,
    cgwbWellDepthMbgl: 16.5,
    wellDepthTrendMperYr: -0.75,
    lastUpdatedDate: '2026-10-22',
    dataQualityFlag: 'good'
  },
  assessment: {
    descriptiveStressScore: 78,
    confidenceInterval: null,
    dataStatus: 'observed',
    validationStatus: 'cgwb_verified',
    primaryStressDriver: 'Drought and Pumping',
    safeguardNotice: 'Official observation',
    baselineComparison: 'Normal',
    modelMethodologyVersion: 'v1',
    lastAssessedDate: '2026-10-22'
  },
  activeInterventionsCount: 2,
  openAlertsCount: 1,
  ...overrides
});

test('Situation Engine: Compounding Drought & Drawdown Trigger', () => {
  const block = createMockBlock();
  const situation = detectIntegratedSituation(block);

  assert.equal(situation.situationType, 'compounding_drought_and_rapid_drawdown');
  assert.equal(situation.severityLevel, 'critical');
  assert.equal(situation.urgency, 'immediate');

  const recs = generateSituationAwareInterventions(situation);
  assert.ok(recs.length > 0);
  assert.equal(recs[0].schemeId, 'sch_atal_bhujal');
  assert.equal(recs[0].priorityScore, 95);
  assert.equal(recs[0].urgency, 'immediate');
});

test('Situation Engine: Anthropogenic Over-Draft with Stable Rainfall', () => {
  const block = createMockBlock({
    indicators: {
      graceTwsaCm: -2.0,
      rainfallAnomalyMm: 15,
      spi3Month: 0.2,
      sentinelNdvi: 0.6,
      sentinelNdwi: -0.1,
      smapSoilMoisture: 0.22,
      cgwbWellDepthMbgl: 18.2,
      wellDepthTrendMperYr: -0.85,
      lastUpdatedDate: '2026-10-22',
      dataQualityFlag: 'good'
    }
  });

  const situation = detectIntegratedSituation(block);
  assert.equal(situation.situationType, 'severe_groundwater_drawdown_stable_rain');
  assert.equal(situation.severityLevel, 'high');

  const recs = generateSituationAwareInterventions(situation);
  const atalRec = recs.find(r => r.schemeId === 'sch_atal_bhujal');
  assert.ok(atalRec);
  assert.equal(atalRec.eligible, true);
  assert.match(atalRec.interventionType, /Demand-Side Irrigation Water Budgeting/);
});

test('Situation Engine: Fail-Closed on Insufficient Evidence', () => {
  const block = createMockBlock({
    indicators: {
      graceTwsaCm: null,
      rainfallAnomalyMm: null,
      spi3Month: null,
      sentinelNdvi: null,
      sentinelNdwi: null,
      smapSoilMoisture: null,
      cgwbWellDepthMbgl: null,
      wellDepthTrendMperYr: null,
      lastUpdatedDate: '2026-10-22',
      dataQualityFlag: 'missing'
    }
  });

  const situation = detectIntegratedSituation(block);
  assert.equal(situation.situationType, 'conflicting_or_insufficient_evidence');
  assert.equal(situation.severityLevel, 'data_gap');
  assert.equal(situation.urgency, 'monitoring_only');

  const recs = generateSituationAwareInterventions(situation);
  const atalRec = recs.find(r => r.schemeId === 'sch_atal_bhujal');
  assert.ok(atalRec);
  assert.equal(atalRec.eligible, false);
  assert.match(atalRec.interventionType, /Telemetry Installation/);
});
