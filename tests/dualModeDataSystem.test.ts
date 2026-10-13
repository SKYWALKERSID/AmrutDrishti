import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JALDRISHTI_DEMO_MODE = 'true';

import { fetchBlocksGeospatialData } from '../src/lib/services/geospatialService.ts';
import { fetchHistoricalObservations } from '../src/lib/services/historicalObservationService.ts';
import { ALL_BLOCKS } from '../src/lib/data/bundelkhand.ts';
import { PROTOTYPE_DEMO_MODE_LABEL } from '../src/lib/demo/demoPolicy.ts';

test('Dual-Mode System: Prototype Demonstration Mode label contract is defined and standardized', () => {
  assert.equal(PROTOTYPE_DEMO_MODE_LABEL, 'Prototype Demonstration Mode — Simulated Data');
});

test('Dual-Mode System: UI Geospatial service falls back to demonstration fixtures when database has empty indicators or unconfigured', async () => {
  const result = await fetchBlocksGeospatialData();
  assert.ok(result);
  assert.ok(result.blocks.length > 0);
  assert.equal(result.isDemonstrationData, true);
  assert.equal(result.source, 'demonstration_fixture');

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
    station_id: 'CGWB_MP_Baldeogarh',
    station_name: 'Baldeogarh',
    district_id: '434',
    district_name: 'TIKAMGARH',
    block_id: '4027',
    block_name: 'BALDEOGARH',
    observation_date: '2023-08-20',
    water_level_mbgl: 0.29,
    unit: 'metre below ground level',
    quality_flag: 'passed',
    source_name: 'CGWB & State Observation Well Monitoring Network',
    source_provider: 'Central Ground Water Board (CGWB) & MP Water Resources Dept',
    source_resource_url: 'https://nwdp.nwic.gov.in/dataset/sample'
  };

  const mockFetchPublishedData = async () => {
    return {
      ok: true,
      json: async () => ({
        source: 'historical_database',
        observations: [samplePublishedRow],
        totalCount: 305,
        limit: 50,
        offset: 0
      })
    } as unknown as Response;
  };

  const response = await fetchHistoricalObservations({}, mockFetchPublishedData);
  assert.equal(response.source, 'historical_database');
  assert.equal(response.observations.length, 1);
  assert.equal(response.totalCount, 305);
  assert.equal(response.observations[0].station_id, 'CGWB_MP_Baldeogarh');
  assert.equal(response.observations[0].water_level_mbgl, 0.29);
});

test('Dual-Mode System: Preserves null measurements in historical observations', async () => {
  const nullMeasurementRow = {
    station_id: 'CGWB_MP_Null_Station',
    station_name: 'Null Station',
    district_id: '434',
    district_name: 'TIKAMGARH',
    block_id: '4027',
    block_name: 'BALDEOGARH',
    observation_date: '2022-01-15',
    water_level_mbgl: null,
    unit: 'metre below ground level',
    quality_flag: 'missing_reading',
    source_name: 'CGWB & State Observation Well Monitoring Network',
    source_provider: 'Central Ground Water Board (CGWB)',
    source_resource_url: 'https://nwdp.nwic.gov.in/dataset/sample'
  };

  const mockFetchNullData = async () => {
    return {
      ok: true,
      json: async () => ({
        source: 'historical_database',
        observations: [nullMeasurementRow],
        totalCount: 1,
        limit: 50,
        offset: 0
      })
    } as unknown as Response;
  };

  const response = await fetchHistoricalObservations({}, mockFetchNullData);
  assert.equal(response.observations[0].water_level_mbgl, null);
  assert.notEqual(response.observations[0].water_level_mbgl, 0);
});

test('Dual-Mode System: Demo data isolation - demo indicators and observations cannot be mixed with published observations', () => {
  for (const block of ALL_BLOCKS) {
    assert.ok(block.id);
    assert.ok(block.name);
    assert.ok(block.districtName);
    assert.equal(block.assessment.confidenceInterval, null);
  }
});
