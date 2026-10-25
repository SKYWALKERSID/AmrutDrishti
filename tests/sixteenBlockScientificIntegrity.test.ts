import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ALL_NATIONWIDE_BLOCKS } from '../src/lib/data/allNationwideBlocks.ts';
import {
  UNTRACEABLE_ADDED_HYDROGRAPH_BLOCK_IDS,
  historicalSeriesProvenanceFor,
} from '../src/lib/data/historicalSeriesProvenance.ts';

// 11 Assam blocks archived as historical reference (untraceable added series)
const ARCHIVED_UNTRACEABLE_BLOCKS = [
  'blk_kamrup_boko', 'blk_kamrup_hajo', 'blk_kamrup_chaygaon',
  'blk_sonitpur_dhekiajuli', 'blk_sonitpur_tezpur', 'blk_sonitpur_chariduar',
  'blk_dibrugarh_moran', 'blk_dibrugarh_naharkatiya', 'blk_dibrugarh_east',
  'blk_cachar_sonai', 'blk_cachar_silchar',
] as const;

test('16-block integration: canonical registry and geography are exact', () => {
  assert.equal(UNTRACEABLE_ADDED_HYDROGRAPH_BLOCK_IDS.size, 11);
  for (const id of ARCHIVED_UNTRACEABLE_BLOCKS) {
    assert.ok(UNTRACEABLE_ADDED_HYDROGRAPH_BLOCK_IDS.has(id));
  }
});

test('16-block integration: untraceable bundled hydrographs cannot masquerade as observations', () => {
  for (const id of ARCHIVED_UNTRACEABLE_BLOCKS) {
    const provenance = historicalSeriesProvenanceFor(id);
    assert.equal(provenance.kind, 'untraceable_generated');
    assert.equal(provenance.displayableAsObservation, false);
    assert.equal(provenance.source, null);
  }
});

test('16-block integration: stale/unsupported forecasts and legacy files fail closed', () => {
  assert.ok(!fs.existsSync('src/lib/data/contrastProjections.json'), 'Legacy contrastProjections.json must be deleted');
  assert.ok(!fs.existsSync('src/lib/data/contrastHistoricalSeries.json'), 'Legacy contrastHistoricalSeries.json must be deleted');
});

test('16-block integration: monitoring and API enforce provenance and freshness gates', () => {
  const monitoring = fs.readFileSync('src/app/monitoring/page.tsx', 'utf8');
  const route = fs.readFileSync('src/app/api/forecast/route.ts', 'utf8');
  assert.doesNotMatch(monitoring, /contrastHistoricalSeries/i);
  assert.doesNotMatch(route, /contrastProjections/i);
  assert.match(route, /hasFreshTrustedObservationOrigin/);
  assert.match(route, /ordered_uncalibrated/);
  assert.doesNotMatch(route, /calibrated_ordered/);
});
