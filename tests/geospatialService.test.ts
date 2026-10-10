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

