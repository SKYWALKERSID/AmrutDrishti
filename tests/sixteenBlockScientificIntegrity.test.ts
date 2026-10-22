import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ALL_NATIONWIDE_BLOCKS } from '../src/lib/data/allNationwideBlocks.ts';
import contrastHistoricalSeries from '../src/lib/data/contrastHistoricalSeries.json' with { type: 'json' };
import contrastProjections from '../src/lib/data/contrastProjections.json' with { type: 'json' };
import {
  UNTRACEABLE_ADDED_HYDROGRAPH_BLOCK_IDS,
  historicalSeriesProvenanceFor,
} from '../src/lib/data/historicalSeriesProvenance.ts';

const ADDED_BLOCKS = [
  ['blk_chhatarpur_main', 'Madhya Pradesh'],
  ['blk_shivamogga_main', 'Karnataka'], ['blk_bhadravati', 'Karnataka'], ['blk_davanagere_main', 'Karnataka'],
  ['blk_adilabad_main', 'Telangana'], ['blk_nandipet', 'Telangana'], ['blk_rajendranagar', 'Telangana'],
  ['blk_ottapidaram', 'Tamil Nadu'], ['blk_st_thomas_mount', 'Tamil Nadu'], ['blk_periyanaickenpalayam', 'Tamil Nadu'],
  ['blk_thadlaskein', 'Meghalaya'], ['blk_umling', 'Meghalaya'], ['blk_mylliem', 'Meghalaya'],
  ['blk_amarpur', 'Tripura'], ['blk_dukli', 'Tripura'], ['blk_ambassa', 'Tripura'],
] as const;

test('16-block integration: canonical registry and geography are exact', () => {
  assert.equal(UNTRACEABLE_ADDED_HYDROGRAPH_BLOCK_IDS.size, 16);
  for (const [id, state] of ADDED_BLOCKS) {
    const block = ALL_NATIONWIDE_BLOCKS.find((candidate) => candidate.id === id);
    assert.ok(block, `${id} must be in the canonical registry`);
    assert.equal(block.state, state, `${id} must retain its canonical state`);
    assert.ok(block.districtId && block.districtName);
    assert.equal(block.coordinates.length, 2);
  }
});

test('16-block integration: untraceable bundled hydrographs cannot masquerade as observations', () => {
  for (const [id] of ADDED_BLOCKS) {
    assert.ok(Array.isArray(contrastHistoricalSeries[id]) && contrastHistoricalSeries[id].length >= 2);
    const provenance = historicalSeriesProvenanceFor(id);
    assert.equal(provenance.kind, 'untraceable_generated');
    assert.equal(provenance.displayableAsObservation, false);
    assert.equal(provenance.source, null);
  }
});

test('16-block integration: stale/unsupported forecasts fail closed with no fabricated horizons', () => {
  for (const [id] of ADDED_BLOCKS) {
    const projection = contrastProjections[id];
    assert.ok(projection, `${id} must have an explicit forecast status record`);
    assert.equal(projection.modelStatus, 'unavailable');
    assert.equal(projection.horizonStatus, 'stale_origin');
    assert.equal(projection.provenanceStatus, 'stale_observation');
    assert.equal(projection.operationalEligibility, false);
    assert.deepEqual(projection.forecasts, []);
  }
});

test('16-block integration: monitoring and API enforce provenance and freshness gates', () => {
  const monitoring = fs.readFileSync('src/app/monitoring/page.tsx', 'utf8');
  const route = fs.readFileSync('src/app/api/forecast/route.ts', 'utf8');
  assert.match(monitoring, /historicalSeriesProvenanceFor/);
  assert.match(monitoring, /provenance\.displayableAsObservation/);
  assert.match(route, /hasCurrentForecastWindow/);
  assert.match(route, /ordered_uncalibrated/);
  assert.doesNotMatch(route, /calibrated_ordered/);
});
