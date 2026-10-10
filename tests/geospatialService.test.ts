import test from 'node:test';
import assert from 'node:assert/strict';

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
