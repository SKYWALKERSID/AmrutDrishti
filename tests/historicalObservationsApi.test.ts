import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync('src/app/api/historical-observations/route.ts', 'utf8');
const proposal = fs.readFileSync('docs/database/proposals/historical_observations_schema_and_api.md', 'utf8');

test('historical API is separate, bounded, and publication-gated', () => {
  assert.match(route, /v_published_historical_observations/);
  assert.match(route, /publication_status.*published/);
  assert.match(route, /data_status.*observed/);
  assert.match(route, /MAX_LIMIT = 100/);
  assert.match(route, /Historical observations unavailable/);
  assert.doesNotMatch(route, /ALL_BLOCKS|demonstration_fixture|service_role/i);
  assert.match(route, /status: 400/);
  assert.match(route, /status: 503/);
  assert.match(route, /limit.*offset/);
});

test('historical API proposal requires private raw storage and nullable lineage', () => {
  assert.match(proposal, /nullable/);
  assert.match(proposal, /private/);
  assert.match(proposal, /idempoten/i);
  assert.match(proposal, /v_published_historical_observations/);
  assert.match(proposal, /No fixture fallback/);
});

test('proposed SQL is explicitly non-executable until reviewed', () => {
  const sql = fs.readFileSync('docs/database/proposals/202610_historical_observations_proposed.sql', 'utf8');
  assert.match(sql, /PROPOSAL ONLY/);
  assert.match(sql, /alter column water_level_mbgl drop not null/i);
  assert.match(sql, /rollback;/i);
  assert.doesNotMatch(sql, /grant all|grant select on public\.station_observations to anon/i);
});

test('publication view proposal is invoker-secure and excludes raw-table grants', () => {
  const sql = fs.readFileSync('docs/database/proposals/202610_historical_observation_publication_view.sql', 'utf8');
  assert.match(sql, /PROPOSAL ONLY/);
  assert.match(sql, /security_invoker/);
  assert.match(sql, /validation_status = 'accepted'/);
  assert.match(sql, /publication_status = 'published'/);
  assert.match(sql, /rollback;/i);
  assert.doesNotMatch(sql, /GRANT SELECT ON public\.(station_observations|monitoring_stations) TO anon/i);
});
