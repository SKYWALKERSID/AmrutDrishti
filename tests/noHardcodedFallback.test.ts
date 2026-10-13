/**
 * JAL DRISHTI — No Hardcoded Fallback & Live Wiring Regression Suite
 *
 * Validates that:
 * 1. No fixture data or static arrays silently reappear when requests are pending, empty, or failed.
 * 2. Real data is validated and null measurements are strictly preserved (never converted to 0).
 * 3. Empty API responses produce honest empty states, not mock series.
 * 4. Failed queries produce fail-closed error states, not fabricated success payloads.
 * 5. GSS scores remain null when required inputs are missing (no default 'safe' or '0' score).
 * 6. Partial data preserves observed fields without populating missing environmental fields.
 * 7. Forecast provenance and horizon checks fail closed when input conditions are not met.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { mapDbRowToBlockData } from '../src/lib/mappers/blockMapper.ts';
import { calculateDescriptiveGss } from '../src/lib/services/scientificEngine.ts';
import { fetchBlocksGeospatialData } from '../src/lib/services/geospatialService.ts';
import { fetchHistoricalObservations } from '../src/lib/services/historicalObservationService.ts';
import type { AdministrativeUnitRow, DerivedIndicatorRow } from '../src/lib/types/database.ts';

// ---------------------------------------------------------------------------
// 1. FAIL-CLOSED GEOSPATIAL DATA ACCESS
// ---------------------------------------------------------------------------

test('NO-FALLBACK: Geospatial service without JALDRISHTI_DEMO_MODE fails closed with 0 blocks', async () => {
  const origDemo = process.env.JALDRISHTI_DEMO_MODE;
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    delete process.env.JALDRISHTI_DEMO_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const result = await fetchBlocksGeospatialData();

    // Must return fallback_empty with exactly 0 blocks, never fabricated demo fixtures
    assert.equal(result.source, 'fallback_empty');
    assert.equal(result.blocks.length, 0);
    assert.equal(result.totalCount, 0);
    assert.ok(result.errorMessage?.includes('unconfigured') || result.errorMessage?.includes('unavailable'));
  } finally {
    if (origDemo) process.env.JALDRISHTI_DEMO_MODE = origDemo;
    if (origUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    if (origKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
  }
});

test('NO-FALLBACK: Geospatial service query error returns fallback_empty, not simulated blocks', async () => {
  const origDemo = process.env.JALDRISHTI_DEMO_MODE;
  try {
    delete process.env.JALDRISHTI_DEMO_MODE;

    // Simulate an unreachable Supabase client
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://nonexistent-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'invalid-key';

    const result = await fetchBlocksGeospatialData();
    assert.equal(result.source, 'fallback_empty');
    assert.equal(result.blocks.length, 0);
    assert.equal(result.totalCount, 0);
  } finally {
    if (origDemo) process.env.JALDRISHTI_DEMO_MODE = origDemo;
    else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
  }
});

// ---------------------------------------------------------------------------
// 2. NULL PRESERVATION & NO FABRICATED ZEROS
// ---------------------------------------------------------------------------

test('NO-FALLBACK: mapDbRowToBlockData preserves null indicators without converting to zero', () => {
  const mockUnit: AdministrativeUnitRow = {
    unit_id: 'unit_test_001',
    unit_name: 'Test Block',
    unit_type: 'block',
    parent_id: 'dist_test',
    district_name: 'Test District',
    state_name: 'Madhya Pradesh',
    area_hectares: 45000,
    centroid: { type: 'Point', coordinates: [78.8, 24.7] },
    boundary_geojson: null,
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockIndicatorWithNulls: DerivedIndicatorRow = {
    indicator_id: 'ind_001',
    unit_id: 'unit_test_001',
    assessed_date: '2026-03-01',
    grace_twsa_cm: null,
    rainfall_anomaly_mm: null,
    cgwb_well_depth_mbgl: null,
    sentinel_ndvi: null,
    smap_soil_moisture_m3m3: null,
    spi_3month: null,
    water_stress_index: null,
    risk_level: null,
    primary_stress_driver: null,
    confidence_interval: null,
    data_quality_flag: 'provisional',
    created_at: '2026-03-01T00:00:00Z',
  };

  const mapped = mapDbRowToBlockData(mockUnit, mockIndicatorWithNulls);

  // Measurements MUST be strictly null, never coerced to 0
  assert.equal(mapped.indicators.graceTwsaCm, null);
  assert.notEqual(mapped.indicators.graceTwsaCm, 0);
  assert.equal(mapped.indicators.rainfallAnomalyMm, null);
  assert.notEqual(mapped.indicators.rainfallAnomalyMm, 0);
  assert.equal(mapped.indicators.cgwbWellDepthMbgl, null);
  assert.notEqual(mapped.indicators.cgwbWellDepthMbgl, 0);
  assert.equal(mapped.indicators.sentinelNdvi, null);
  assert.notEqual(mapped.indicators.sentinelNdvi, 0);

  // Score must be null and severity must be 'gap'
  assert.equal(mapped.assessment.descriptiveStressScore, null);
  assert.equal(mapped.riskSeverity, 'gap');
});

test('NO-FALLBACK: Missing indicators object creates honest gap block with null stress score', () => {
  const mockUnit: AdministrativeUnitRow = {
    unit_id: 'unit_gap_001',
    unit_name: 'Data Gap Block',
    unit_type: 'block',
    parent_id: 'dist_gap',
    district_name: 'Gap District',
    state_name: 'Madhya Pradesh',
    area_hectares: 50000,
    centroid: { type: 'Point', coordinates: [78.9, 24.8] },
    boundary_geojson: null,
    created_at: '2026-01-01T00:00:00Z',
  };

  const mapped = mapDbRowToBlockData(mockUnit, null);

  assert.equal(mapped.indicators.graceTwsaCm, null);
  assert.equal(mapped.indicators.rainfallAnomalyMm, null);
  assert.equal(mapped.indicators.cgwbWellDepthMbgl, null);
  assert.equal(mapped.assessment.descriptiveStressScore, null);
  assert.equal(mapped.riskSeverity, 'gap');
  assert.ok(mapped.assessment.validationStatus === 'pending_field_review' || mapped.assessment.validationStatus === 'unvalidated_gap');
});

// ---------------------------------------------------------------------------
// 3. SCIENTIFIC ENGINE FAIL-CLOSED CONTRACT
// ---------------------------------------------------------------------------

test('NO-FALLBACK: calculateDescriptiveGss returns null score when required inputs are missing', () => {
  const emptyIndicators = {
    graceTwsaCm: null,
    rainfallAnomalyMm: null,
    cgwbWellDepthMbgl: null,
    sentinelNdvi: null,
    smapSoilMoisture: null,
    spi3Month: null,
    wellDepthTrendMperYr: null,
    dataQualityFlag: 'missing' as const,
  };

  const gss = calculateDescriptiveGss(emptyIndicators);

  assert.equal(gss.score, null, 'GSS score must be strictly null when inputs are missing');
  assert.equal(gss.severity, 'gap', 'Severity must be gap when inputs are missing');
  assert.equal(gss.confidenceInterval, null, 'Confidence interval must be null');
  assert.ok(gss.safeguardNotice.toLowerCase().includes('data gap') || gss.safeguardNotice.toLowerCase().includes('missing'));
  assert.equal(gss.normalizationBreakdown.wellDepthNorm, null);
  assert.equal(gss.normalizationBreakdown.rainDeficitNorm, null);
  assert.equal(gss.normalizationBreakdown.graceTwsaNorm, null);
});

test('NO-FALLBACK: Partial observation does not fabricate values for missing signals', () => {
  const partialIndicators = {
    graceTwsaCm: null,
    rainfallAnomalyMm: -250, // Only rainfall is available
    cgwbWellDepthMbgl: null,
    sentinelNdvi: null,
    smapSoilMoisture: null,
    spi3Month: -1.8,
    wellDepthTrendMperYr: null,
    dataQualityFlag: 'provisional' as const,
  };

  const gss = calculateDescriptiveGss(partialIndicators);

  // Missing signals must remain null in breakdown
  assert.equal(gss.normalizationBreakdown.wellDepthNorm, null);
  assert.equal(gss.normalizationBreakdown.graceTwsaNorm, null);
  assert.equal(gss.normalizationBreakdown.ndviNorm, null);
  assert.notEqual(gss.normalizationBreakdown.rainDeficitNorm, null);
});

// ---------------------------------------------------------------------------
// 4. HISTORICAL OBSERVATION API FAIL-CLOSED BEHAVIOR
// ---------------------------------------------------------------------------

test('NO-FALLBACK: Empty historical API response produces empty array, never a mock series', async () => {
  const mockFetchEmpty = async () => ({
    ok: true,
    json: async () => ({
      source: 'historical_database',
      observations: [],
      totalCount: 0,
      limit: 50,
      offset: 0,
    }),
  } as unknown as Response);

  const result = await fetchHistoricalObservations({ block: 'tikamgarh' }, mockFetchEmpty);

  assert.equal(result.source, 'historical_database');
  assert.equal(result.observations.length, 0);
  assert.equal(result.totalCount, 0);
  assert.equal(Array.isArray(result.observations), true);
});

test('NO-FALLBACK: Failed historical API response throws error and never fabricates success records', async () => {
  const mockFetchError = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: 'Database connection failed' }),
  } as unknown as Response);

  await assert.rejects(
    async () => fetchHistoricalObservations({ block: 'tikamgarh' }, mockFetchError),
    /Database connection failed|Failed to fetch/
  );
});

// ---------------------------------------------------------------------------
// 5. ROUTE INTEGRITY & NO SILENT FALLBACK CHECKS
// ---------------------------------------------------------------------------

test('NO-FALLBACK: Forecast route does not fall back to demo fixtures and enforces 4-quarter cap', () => {
  const forecastRoute = fs.readFileSync('src/app/api/forecast/route.ts', 'utf8');

  // Verify does not silently fall back to ALL_BLOCKS[0]
  assert.doesNotMatch(forecastRoute, /targetBlock\s*=\s*ALL_BLOCKS\[0\]/);
  assert.doesNotMatch(forecastRoute, /GENERATE_MOCK_FORECASTS/);
  assert.doesNotMatch(forecastRoute, /MOCK_FORECASTS/);

  // Verify honest unavailable response when predictions are not found or unverifiable
  assert.match(forecastRoute, /modelStatus:\s*'unavailable'/);
  assert.match(forecastRoute, /forecasts:\s*\[\]/);

  // Verify database query limits horizon to 4 quarters
  assert.match(forecastRoute, /limit=4/);
});

test('NO-FALLBACK: Geospatial blocks route catch block fails closed without demo fixtures', () => {
  const blocksRoute = fs.readFileSync('src/app/api/geospatial/blocks/route.ts', 'utf8');

  assert.match(blocksRoute, /blocks:\s*\[\]/);
  assert.match(blocksRoute, /source:\s*'fallback_empty'/);
  assert.match(blocksRoute, /status: 500/);
  assert.doesNotMatch(blocksRoute, /ALL_BLOCKS/);
});

test('NO-FALLBACK: Monitoring page contains no hardcoded HISTORICAL_TIMESERIES array', () => {
  const monitoringPage = fs.readFileSync('src/app/monitoring/page.tsx', 'utf8');

  assert.doesNotMatch(monitoringPage, /const\s+HISTORICAL_TIMESERIES/);
  assert.doesNotMatch(monitoringPage, /HISTORICAL_TIMESERIES/);
  assert.doesNotMatch(monitoringPage, /graceTwsa:\s*Number\(-5\.0/);
});
