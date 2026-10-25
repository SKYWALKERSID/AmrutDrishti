import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processImdRainfallBatch,
  validateImdRainfallRecord,
  validateCgwbObservationRecord,
  AUTHORITATIVE_SOURCES,
} from '../src/lib/services/ingestionEngine.ts';
import {
  getTrustedBlockObservations,
  buildExperimentalDemoGlobalModelRequest,
  buildTrustedGlobalModelRequest,
  validateObservationRecord,
} from '../src/lib/services/trustedObservationProvider.ts';
import {
  calculateDescriptiveGss,
  evaluateGroundwaterIntelligence,
  matchInterventionRecommendations,
} from '../src/lib/services/scientificEngine.ts';
import {
  selectHistoricalObservationSource,
  mayPublishLocalHistoricalFallback,
} from '../src/lib/services/historicalObservationSource.ts';
import { ALL_NATIONWIDE_BLOCKS } from '../src/lib/data/allNationwideBlocks.ts';
import type { BlockData } from '../src/lib/types.ts';

test('PIPELINE-E2E: 1. Authoritative Ingestion & Idempotent Preprocessing', () => {
  // 1. Verify schema registry definitions
  assert.ok(AUTHORITATIVE_SOURCES.src_imd_rainfall);
  assert.ok(AUTHORITATIVE_SOURCES.src_cgwb_wells);
  assert.ok(AUTHORITATIVE_SOURCES.src_grace_fo);

  // 2. Validate scientific null handling (never convert missing to 0)
  const nullObs = validateCgwbObservationRecord({
    stationId: 'TEST_STN_001',
    observationDate: '2026-10-15',
    waterLevelMbgl: null,
  });
  assert.equal(nullObs.isValid, true);
  assert.equal(nullObs.record?.waterLevelMbgl, null);
  assert.equal(nullObs.record?.qualityFlag, 'missing');

  // 3. Reject invalid non-numeric water level and bad date
  const nanObs = validateCgwbObservationRecord({
    stationId: 'TEST_STN_001',
    observationDate: '2026-10-15',
    waterLevelMbgl: 'not-a-number' as any,
  });
  assert.equal(nanObs.isValid, false);

  // 4. Batch deduplication idempotency
  const batch = [
    { unitId: 'blk_tikamgarh_main', observationDate: '2026-10-01', rainfallMm: 12.0, rainfallAnomalyMm: -5.0, spi3Month: -0.4 },
    { unitId: 'blk_tikamgarh_main', observationDate: '2026-10-01', rainfallMm: 12.0, rainfallAnomalyMm: -5.0, spi3Month: -0.4 }, // duplicate
    { unitId: 'blk_baldeogarh', observationDate: '2026-10-01', rainfallMm: 8.5, rainfallAnomalyMm: -10.0, spi3Month: -0.8 },
  ];
  const processed1 = processImdRainfallBatch(batch);
  assert.equal(processed1.validRecords.length, 2);
  assert.equal(processed1.telemetryLog.qaSummary.duplicateCount, 1);
  assert.equal(processed1.telemetryLog.recordsIngested, 2);

  // Re-running same batch produces identical counts (Idempotency)
  const processed2 = processImdRainfallBatch(batch);
  assert.equal(processed2.validRecords.length, 2);
  assert.equal(processed2.telemetryLog.qaSummary.duplicateCount, 1);
});

test('PIPELINE-E2E: 2. Storage & Canonical Observation Provider Integration', async () => {
  // Test local fallback decision mechanism
  const decision = await selectHistoricalObservationSource({
    queryDatabase: async () => ({
      data: null,
      error: new Error('Supabase permission denied or offline in local test'),
      count: null,
    }),
    loadLocal: async () => {
      const trusted = await getTrustedBlockObservations('blk_tikamgarh_main', { includeHistoricalCgwb: true });
      if (!mayPublishLocalHistoricalFallback({
        readinessStatus: trusted.availabilityStatus,
        mappingVerified: trusted.provenance.isVerifiedMapping,
        observationCount: trusted.observations.length,
      })) {
        return { status: 'unverified' as const };
      }
      return {
        status: 'observations' as const,
        value: {
          source: 'local_processed_observation_archive',
          provenance: trusted.provenance,
          observations: trusted.observations,
          totalCount: trusted.observations.length,
          limit: 50,
          offset: 0,
        },
      };
    },
  });

  assert.equal(decision.source, 'local_processed_observation_archive');
  if (decision.source === 'local_processed_observation_archive') {
    assert.equal(decision.databaseStatus, 'error');
    assert.ok(decision.value.observations.length >= 10);
    assert.equal(decision.value.provenance.units, 'm bgl');
  }
});

test('PIPELINE-E2E: 3. Scientific Engine, Heuristic GSS & Drought Intelligence', () => {
  // Test GSS computation: ensures null propagation and data gap detection
  const gapGss = calculateDescriptiveGss({
    cgwbWellDepthMbgl: null,
    rainfallAnomalyMm: null,
    graceTwsaCm: null,
    sentinelNdvi: null,
  });
  assert.equal(gapGss.isDataGap, true);
  assert.equal(gapGss.severity, 'gap');
  assert.equal(gapGss.score, null);

  // Valid non-gap GSS calculation
  const validGss = calculateDescriptiveGss({
    cgwbWellDepthMbgl: 18.5,
    rainfallAnomalyMm: -220,
    graceTwsaCm: -6.5,
    sentinelNdvi: 0.28,
  });
  assert.equal(validGss.isDataGap, false);
  assert.ok(typeof validGss.score === 'number' && validGss.score >= 0 && validGss.score <= 100);
  assert.ok(['normal', 'watch', 'severe'].includes(validGss.severity));
  assert.equal(validGss.confidenceInterval, null, 'Must remain uncalibrated null');

  // Drought intelligence evaluation
  const drought = evaluateGroundwaterIntelligence({
    cgwbWellDepthMbgl: 18.5,
    rainfallAnomalyMm: -260,
    graceTwsaCm: -6.5,
    sentinelNdvi: 0.28,
    spi3Month: -1.8,
  });
  assert.equal(drought.droughtRisk.category, 'Severe Drought Watch');
  assert.ok(drought.droughtRisk.basis.includes('-260 mm'));
  assert.equal(drought.waterAvailability.status, 'qualitative_trend_only');
});

test('PIPELINE-E2E: 4. Intervention Recommendation Matching with Traceable Evidence', () => {
  const dummyBlock: BlockData = {
    id: 'blk_tikamgarh_main',
    name: 'Tikamgarh',
    districtId: 'dst_tikamgarh',
    districtName: 'Tikamgarh',
    state: 'Madhya Pradesh',
    coordinates: [24.7436, 78.8315],
    riskSeverity: 'severe',
    indicators: {
      cgwbWellDepthMbgl: 22.4,
      rainfallAnomalyMm: -280,
      wellDepthTrendMperYr: -0.65,
      graceTwsaCm: -6.5,
      sentinelNdvi: 0.28,
      sentinelNdwi: -0.32,
      smapSoilMoisture: 0.12,
      spi3Month: -1.8,
      descriptiveStressScore: 78,
    },
    lastUpdated: '2026-10-25',
  };

  const recommendations = matchInterventionRecommendations(dummyBlock);

  assert.ok(recommendations.length > 0);
  for (const rec of recommendations) {
    assert.ok(rec.scheme.id.startsWith('sch_'));
    assert.ok(rec.recommendedInterventionType.length > 5);
    assert.ok(rec.matchReason.length > 10);
    assert.ok(['high', 'medium', 'low'].includes(rec.matchConfidence));
    assert.ok(rec.estimatedSanctionRangeInr[0] > 0);
  }
});

test('PIPELINE-E2E: 5. ML Model Bridge & Target Forecast Integrity (90d / 180d)', async () => {
  // Verify demo request builder retrieves actual chronological observations
  const demoRequest = await buildExperimentalDemoGlobalModelRequest('blk_tikamgarh_main');
  assert.ok(demoRequest !== null);
  assert.ok(demoRequest.request.observations.length >= 10);
  assert.equal(demoRequest.dataAvailabilityMode, 'historical_only_demo');

  // Verify dates are chronological and strictly formatted
  for (let i = 1; i < demoRequest.request.observations.length; i++) {
    const prev = demoRequest.request.observations[i - 1].observationDate;
    const curr = demoRequest.request.observations[i].observationDate;
    assert.ok(curr >= prev, `Observations must be chronologically ordered: ${prev} vs ${curr}`);
  }

  // Verify that an unmapped or unverified block fails closed
  const unverified = await buildExperimentalDemoGlobalModelRequest('blk_dausa_lalsot');
  assert.equal(unverified, null);

  // Verify operational request fails closed for historical-only block
  const opRequest = await buildTrustedGlobalModelRequest('blk_tikamgarh_main');
  assert.equal(opRequest, null);
});
