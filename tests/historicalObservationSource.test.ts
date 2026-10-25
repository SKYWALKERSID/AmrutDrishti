import test from 'node:test';
import assert from 'node:assert/strict';
import { isSourceResourceConsistent, mayPublishLocalHistoricalFallback, selectHistoricalObservationSource } from '../src/lib/services/historicalObservationSource.ts';

test('source provenance rejects NWIC telemetry labels paired with a CGWB manual-quarterly resource', () => {
  assert.equal(isSourceResourceConsistent({
    source_name: 'NWIC telemetry',
    source_provider: 'NWDP/NWIC',
    source_resource_url: 'https://example.gov/data/cgwb_manual_quarterly.csv',
  }), false);
  assert.equal(isSourceResourceConsistent({
    source_name: 'NWDP telemetry',
    source_provider: 'NWIC',
    source_resource_url: 'https://nwdp.nwic.gov.in/resource/gwl_tel_state_2026_2030.csv',
  }), true);
  assert.equal(isSourceResourceConsistent({
    source_name: 'CGWB manual quarterly',
    source_provider: 'CGWB',
    source_resource_url: 'https://example.gov/cgwb_manual_quarterly.csv',
  }), true);
  assert.equal(isSourceResourceConsistent({
    source_name: 'unattributed',
    source_provider: 'unknown',
  }), false);
});

test('local historical fallback requires verified mapping, observations, and non-stale readiness', () => {
  assert.equal(mayPublishLocalHistoricalFallback({ readinessStatus: 'eligible_for_research_prediction', mappingVerified: true, observationCount: 2 }), true);
  assert.equal(mayPublishLocalHistoricalFallback({ readinessStatus: 'stale', mappingVerified: true, observationCount: 2 }), false);
  assert.equal(mayPublishLocalHistoricalFallback({ readinessStatus: 'unverified_station_mapping', mappingVerified: false, observationCount: 2 }), false);
  assert.equal(mayPublishLocalHistoricalFallback({ readinessStatus: 'available', mappingVerified: true, observationCount: 0 }), false);
});

test('published Supabase rows take precedence and local fallback is not called', async () => {
  let fallbackCalled = false;
  const result = await selectHistoricalObservationSource({
    queryDatabase: async () => ({ data: [{ id: 'db-row' }], count: 4, error: null }),
    loadLocal: async () => { fallbackCalled = true; return { status: 'observations', value: ['local'] }; },
  });
  assert.deepEqual(result, { source: 'historical_database', observations: [{ id: 'db-row' }], totalCount: 4, fallbackStatus: 'not_requested' });
  assert.equal(fallbackCalled, false);
});

test('empty database result falls back to validated local observations and identifies both sources', async () => {
  const result = await selectHistoricalObservationSource({
    queryDatabase: async () => ({ data: [], count: 0, error: null }),
    loadLocal: async () => ({ status: 'observations', value: { observations: ['local-row'], mappingVerified: true } }),
  });
  assert.deepEqual(result, {
    source: 'local_processed_observation_archive',
    value: { observations: ['local-row'], mappingVerified: true },
    databaseStatus: 'empty',
  });
});

test('database errors are not turned into successful empty results', async () => {
  const result = await selectHistoricalObservationSource({
    queryDatabase: async () => ({ data: null, count: null, error: new Error('database unavailable') }),
    loadLocal: async () => ({ status: 'empty' }),
  });
  assert.deepEqual(result, { source: 'unavailable', status: 503, databaseStatus: 'error', fallbackStatus: 'empty' });
});

test('a validated local fallback remains explicitly identified when Supabase errors', async () => {
  const result = await selectHistoricalObservationSource({
    queryDatabase: async () => { throw new Error('network failure'); },
    loadLocal: async () => ({ status: 'observations', value: { source: 'NWDP/NWIC', observations: [] } }),
  });
  assert.deepEqual(result, {
    source: 'local_processed_observation_archive',
    value: { source: 'NWDP/NWIC', observations: [] },
    databaseStatus: 'error',
  });
});

test('unverified, empty, or missing local artifacts never become published observations', async () => {
  const unverified = await selectHistoricalObservationSource({
    queryDatabase: async () => ({ data: [], count: 0, error: null }),
    loadLocal: async () => ({ status: 'unverified' }),
  });
  assert.equal(unverified.source, 'historical_database');
  assert.deepEqual(unverified.observations, []);
  assert.equal(unverified.fallbackStatus, 'unverified');

  const malformedDerived = await selectHistoricalObservationSource({
    queryDatabase: async () => ({ data: null, count: null, error: new Error('database unavailable') }),
    loadLocal: async () => { throw new Error('derived JSON could not be loaded'); },
  });
  assert.deepEqual(malformedDerived, { source: 'unavailable', status: 503, databaseStatus: 'error', fallbackStatus: 'unavailable' });
});

test('database empty plus unavailable local artifacts is distinguishable from database failure', async () => {
  const result = await selectHistoricalObservationSource({
    queryDatabase: async () => ({ data: [], count: 0, error: null }),
    loadLocal: async () => { throw new Error('missing derived JSON'); },
  });
  assert.deepEqual(result, { source: 'historical_database', observations: [], totalCount: 0, fallbackStatus: 'unavailable' });
});
