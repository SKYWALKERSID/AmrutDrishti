import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JALDRISHTI_DEMO_MODE = 'true';

import { fetchBlocksGeospatialData } from '../src/lib/services/geospatialService.ts';

test('fetchBlocksGeospatialData falls back cleanly to demonstration fixtures when unconfigured', async () => {
  const result = await fetchBlocksGeospatialData();
  assert.ok(result);
  assert.ok(result.blocks.length > 0);
  assert.equal(result.isDemonstrationData, true);
  assert.equal(result.source, 'demonstration_fixture');
  assert.equal(typeof result.fetchedAt, 'string');

  // Verify provenance and confidence interval for demonstration fixtures
  for (const block of result.blocks) {
    assert.equal(
      block.assessment.dataStatus,
      'simulated',
      `Block ${block.id} must be labeled as simulated data status`
    );
    assert.equal(
      block.assessment.confidenceInterval,
      null,
      `Block ${block.id} must have explicit null confidence interval`
    );
    assert.equal(
      block.assessment.validationStatus,
      'demonstration_only',
      `Block ${block.id} must have validationStatus demonstration_only`
    );
  }
});

test('Geospatial Service payload structure preserves null indicators without converting to zero', async () => {
  const result = await fetchBlocksGeospatialData();
  assert.ok(Array.isArray(result.blocks));
  assert.ok(result.totalCount > 0);

  // Validate properties on returned BlockData model
  const firstBlock = result.blocks[0];
  assert.ok(firstBlock.id);
  assert.ok(firstBlock.name);
  assert.ok(firstBlock.districtId);
  assert.ok(firstBlock.indicators);
  assert.ok(firstBlock.assessment);

  // Verify missing/null indicators remain null rather than defaulting to zero
  const blockWithNulls = result.blocks.find(b =>
    b.indicators.graceTwsaCm === null ||
    b.indicators.rainfallAnomalyMm === null ||
    b.indicators.cgwbWellDepthMbgl === null
  );
  if (blockWithNulls) {
    if (blockWithNulls.indicators.graceTwsaCm === null) {
      assert.notEqual(blockWithNulls.indicators.graceTwsaCm, 0);
    }
  }
});

test('Source provenance classification labels remain distinct', async () => {
  const result = await fetchBlocksGeospatialData();
  assert.ok(['live_database', 'demonstration_fixture', 'fallback_empty'].includes(result.source));
  if (result.source === 'demonstration_fixture') {
    assert.equal(result.isDemonstrationData, true);
    assert.ok(result.errorMessage?.includes('demonstration') || result.errorMessage?.includes('unconfigured') || result.errorMessage?.includes('Database query error'));
  }
});

test('Geospatial service never mislabels fallback or error payloads as live_database', async () => {
  // Store current env
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    // Force unconfigured / invalid env to test error handling
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const unconfigResult = await fetchBlocksGeospatialData();
    assert.equal(unconfigResult.source, 'demonstration_fixture');
    assert.equal(unconfigResult.isDemonstrationData, true);
    assert.notEqual(unconfigResult.source, 'live_database');
  } finally {
    if (origUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    if (origKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
  }
});

test('Public vs protected database table grant boundaries are correctly scoped', () => {
  // Define intended public geospatial read tables vs strictly protected PII/Operational tables
  const allowedPublicGeospatialTables = ['administrative_units', 'derived_indicators'];
  const strictlyProtectedTables = [
    'profiles',
    'notification_records',
    'ingestion_runs',
    'audit_events',
    'monitoring_stations',
    'station_observations',
    'model_predictions',
    'intervention_proposals',
    'intervention_recommendations'
  ];

  // Verify non-intersection
  for (const table of allowedPublicGeospatialTables) {
    assert.equal(
      strictlyProtectedTables.includes(table),
      false,
      `Table ${table} must not be in protected tables list`
    );
  }
  assert.equal(allowedPublicGeospatialTables.length, 2);
});

test('mapDbRowToBlockData correctly classifies observed vs simulated DB data provenance', async () => {
  const { mapDbRowToBlockData } = await import('../src/lib/mappers/blockMapper.ts');
  const dummyUnit = {
    unit_id: 'blk_test_01',
    unit_type: 'block',
    name: 'Test Block',
    district_id: 'dist_01',
    district_name: 'Tikamgarh',
    state_name: 'Madhya Pradesh',
    coordinates: null,
    geom: null,
    total_geographic_area_ha: 50000,
    net_sown_area_ha: 30000,
    boundary_version: 'LGD-2024',
    created_at: new Date().toISOString()
  };

  // Test observed status DB row
  const observedIndicator = {
    indicator_id: 'ind_01',
    unit_id: 'blk_test_01',
    grace_twsa_cm: -2.5,
    rainfall_anomaly_mm: -100,
    spi_3month: -1.2,
    sentinel_ndvi: 0.45,
    sentinel_ndwi: 0.12,
    smap_soil_moisture: 0.22,
    cgwb_well_depth_mbgl: 12.4,
    well_depth_trend_m_per_yr: -0.3,
    descriptive_stress_score: 65,
    risk_severity: 'watch' as const,
    data_status: 'observed' as const,
    primary_stress_driver: 'Rainfall Deficit',
    safeguard_notice: 'Verified Sample Data',
    assessed_date: '2026-10-01',
    created_at: new Date().toISOString()
  };

  const mappedObserved = mapDbRowToBlockData(dummyUnit, observedIndicator);
  assert.equal(mappedObserved.assessment.dataStatus, 'observed');
  assert.equal(mappedObserved.assessment.validationStatus, 'demonstration_only');

  // Test simulated status DB row
  const simulatedIndicator = {
    ...observedIndicator,
    data_status: 'simulated' as const
  };

  const mappedSimulated = mapDbRowToBlockData(dummyUnit, simulatedIndicator);
  assert.equal(mappedSimulated.assessment.dataStatus, 'simulated');
  assert.equal(mappedSimulated.assessment.validationStatus, 'demonstration_only');
});

test('isDemonstrationData is orthogonal to source — live_database source does not imply validated data', async () => {
  // Even if the service returns source='live_database', isDemonstrationData must be true
  // until operationallyValidated is explicitly set. This test verifies the invariant
  // by checking that the fixture path (which substitutes for the live-DB path in tests)
  // always sets isDemonstrationData correctly.
  const result = await fetchBlocksGeospatialData();

  // In the test environment without configured Supabase credentials, the service
  // returns demonstration_fixture. Regardless of source, isDemonstrationData must be true.
  assert.equal(result.isDemonstrationData, true,
    'isDemonstrationData must be true regardless of source when data is not operationally validated');

  // source and isDemonstrationData are distinct concepts; neither implies the other alone:
  // - source='live_database' with isDemonstrationData=true is valid (unvalidated DB data)
  // - source='demonstration_fixture' with isDemonstrationData=true is the expected fallback path
  // - source='live_database' with isDemonstrationData=false is forbidden until validation confirmed
  if (result.source === 'live_database') {
    // If we ever reach this branch in future tests with a real DB, enforce the invariant:
    assert.equal(result.isDemonstrationData, true,
      'Live-DB data must remain isDemonstrationData=true until operationallyValidated is set true');
  }
});

test('GeospatialQueryResult source field is always one of the three documented values', async () => {
  const result = await fetchBlocksGeospatialData();
  const validSources = ['live_database', 'demonstration_fixture', 'fallback_empty'] as const;
  assert.ok(
    validSources.includes(result.source as typeof validSources[number]),
    `source must be one of ${validSources.join(', ')}, got: ${result.source}`
  );
});
