import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchHistoricalObservations } from '../src/lib/services/historicalObservationService.ts';

const row = {
  station_id: 'CGWB-1', station_name: 'Station 1', district_id: '398', district_name: 'Chhatarpur',
  block_id: '3783', block_name: 'Bijawar', observation_date: '2021-01-10',
  water_level_mbgl: null, unit: 'metre below ground level', quality_flag: 'passed',
  source_name: 'CGWB MP manual quarterly', source_provider: 'CGWB', source_resource_url: 'https://example.invalid/source'
};

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('historical client returns published records and preserves null measurements', async () => {
  const result = await fetchHistoricalObservations({ limit: 10, district: '398' }, async (url) => {
    assert.match(String(url), /limit=10/);
    assert.match(String(url), /district=398/);
    return response(200, { source: 'historical_database', observations: [row], totalCount: 1, limit: 10, offset: 0 });
  });
  assert.equal(result.observations[0].water_level_mbgl, null);
  assert.equal(result.observations[0].observation_date, '2021-01-10');
});

test('historical client accepts an explicit empty result', async () => {
  const result = await fetchHistoricalObservations({}, async () => response(200, {
    source: 'historical_database', observations: [], totalCount: 0, limit: 50, offset: 0
  }));
  assert.deepEqual(result.observations, []);
});

test('historical client surfaces invalid-filter and database failures', async () => {
  await assert.rejects(() => fetchHistoricalObservations({}, async () => response(400, { error: 'invalid filter' })), /invalid filter/);
  await assert.rejects(() => fetchHistoricalObservations({}, async () => response(503, { error: 'Historical observations unavailable' })), /unavailable/);
});

test('historical client rejects malformed success responses instead of substituting fixtures', async () => {
  await assert.rejects(() => fetchHistoricalObservations({}, async () => response(200, { source: 'demonstration_fixture', observations: [] })), /Unexpected/);
});
