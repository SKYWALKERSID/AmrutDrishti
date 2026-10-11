import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBlocksGeospatialData } from '../src/lib/services/geospatialService.ts';
import { fetchHistoricalObservations } from '../src/lib/services/historicalObservationService.ts';
import { ALL_BLOCKS } from '../src/lib/data/bundelkhand.ts';
import { PROTOTYPE_DEMO_MODE_LABEL } from '../src/lib/demo/demoPolicy.ts';

test('Dual-Mode System: Prototype Demonstration Mode label contract is defined and standardized', () => {
  assert.equal(PROTOTYPE_DEMO_MODE_LABEL, 'Prototype Demonstration Mode — Simulated Data');
});

test('Dual-Mode System: UI Geospatial service falls back to demonstration fixtures when database has empty indicators or unconfigured', async () => {
  // Test with current environment (whether live DB is empty or unconfigured)
  const result = await fetchBlocksGeospatialData();
  assert.ok(result);
  assert.ok(result.blocks.length > 0);
  assert.equal(result.isDemonstrationData, true);
  assert.equal(result.source, 'demonstration_fixture');

  // Verify that all blocks in fallback mode are explicitly tagged as simulated
  for (const block of result.blocks) {
    assert.equal(block.assessment.dataStatus, 'simulated');
    assert.equal(block.assessment.validationStatus, 'demonstration_only');
    assert.equal(block.assessment.confidenceInterval, null);
  }
});

test('Dual-Mode System: Missing Supabase configuration falls back gracefully to demo fixtures without throwing', async () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const result = await fetchBlocksGeospatialData();
    assert.ok(result);
    assert.equal(result.source, 'demonstration_fixture');
    assert.equal(result.isDemonstrationData, true);
    assert.equal(result.blocks.length, ALL_BLOCKS.length);
  } finally {
    if (origUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    if (origKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
  }
});

test('Dual-Mode System: Fail-Closed Historical API contract never returns demo fixtures', async () => {
  // Mock fetch that simulates empty published view response (current real DB state)
  const mockFetchEmptyPublished = async () => {
    return {
      ok: true,
      json: async () => ({
        source: 'historical_database',
        observations: [],
        totalCount: 0,
        limit: 50,
        offset: 0
      })
    } as unknown as Response;
  };

  const response = await fetchHistoricalObservations({}, mockFetchEmptyPublished);
  assert.equal(response.source, 'historical_database');
  assert.equal(response.observations.length, 0);
  assert.equal(response.totalCount, 0);

  // Assert that it never returns demo fixtures or alters the source identifier
  assert.notEqual(response.source as string, 'demonstration_fixture');
});

test('Dual-Mode System: Historical API fails-closed on API error or 503 instead of falling back to demo fixtures', async () => {
  const mockFetch503 = async () => {
    return {
      ok: false,
      json: async () => ({ error: 'Historical observations unavailable' })
    } as unknown as Response;
  };

  await assert.rejects(
    async () => {
      await fetchHistoricalObservations({}, mockFetch503);
    },
    /Historical observations unavailable/
  );
});

test('Dual-Mode System: Published data returns genuine source when published records exist', async () => {
  const samplePublishedRow = {
    station_id: 'CGWB_MP_TIK_01',
    station_name: 'Tikamgarh Town Well',
    district_id: 'tikamgarh',
    district_name: 'Tikamgarh',
    block_id: 'tikamgarh_rural',
    block_name: 'Tikamgarh',
    observation_date: '2023-05-15',
    water_level_mbgl: 12.45,
    unit: 'm_bgl',
    quality_flag: 'good',
    source_name: 'CGWB Groundwater Yearbook',
    source_provider: 'Central Ground Water Board',
    source_resource_url: 'https://cgwb.gov.in'
  };

  const mockFetchPublishedData = async () => {
    return {
      ok: true,
      json: async () => ({
        source: 'historical_database',
        observations: [samplePublishedRow],
        totalCount: 1,
        limit: 50,
        offset: 0
      })
    } as unknown as Response;
  };

  const response = await fetchHistoricalObservations({}, mockFetchPublishedData);
  assert.equal(response.source, 'historical_database');
  assert.equal(response.observations.length, 1);
  assert.equal(response.observations[0].station_id, 'CGWB_MP_TIK_01');
  assert.equal(response.observations[0].water_level_mbgl, 12.45);
});

test('Dual-Mode System: Demo data isolation - demo indicators and observations cannot be mixed with published observations', () => {
  // Ensure ALL_BLOCKS contains exclusively simulated test data
  for (const block of ALL_BLOCKS) {
    assert.ok(block.id);
    assert.ok(block.name);
    assert.ok(block.districtName);
    // Confidence intervals must not be claimed on demo fixtures
    assert.equal(block.assessment.confidenceInterval, null);
  }
});
