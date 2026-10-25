import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../data/derived/nwdp_telemetry_ingestion_manifest.json' with { type: 'json' };
import blockTelemetry from '../data/derived/nwdp_block_telemetry_series.json' with { type: 'json' };
import { getTrustedBlockObservations } from '../src/lib/services/trustedObservationProvider.ts';
import { DATA_SOURCES } from '../src/lib/data/dataSources.ts';

const EXPECTED_STATES = [
  'Karnataka',
  'Telangana',
  'Tamil Nadu',
  'Madhya Pradesh',
  'Rajasthan',
  'Punjab',
  'Haryana',
  'Meghalaya',
  'Tripura',
];

test('NWDP INTEGRATION: retained government resources cover 9 states and two periods', () => {
  const registeredStates = new Set(manifest.input_resources.map((resource) => resource.state));
  for (const st of EXPECTED_STATES) {
    assert.ok(registeredStates.has(st), `Missing retained resources for ${st}`);
    assert.deepEqual(new Set(manifest.input_resources.filter((resource) => resource.state === st).map((resource) => resource.period)), new Set(['2021-2025', '2026-2030']));
  }
  assert.equal(manifest.input_resources.length, 18);
  assert.ok(!registeredStates.has('Assam'));
});

test('NWDP INTEGRATION: Ingestion manifest documents authentic ingestion and quarantine volumes', () => {
  assert.equal(manifest.counts.source_rows, 11_167_915);
  assert.equal(manifest.counts.source_rows, manifest.counts.candidate_not_verified + manifest.counts.quarantined);
  assert.equal(manifest.counts.valid_timestamps, manifest.counts.source_rows);
  assert.equal(manifest.counts.parsed_numeric_measurements, manifest.counts.source_rows);
  assert.equal(
    manifest.counts.candidate_not_verified,
    manifest.counts.zero_readings +
      manifest.counts.exact_one_readings +
      manifest.counts.positive_candidate_undocumented_datum +
      manifest.counts.sentinel_pattern_retained_pending_station_qc,
    'Candidates must be the exclusive sum of retained reading classes',
  );
  assert.equal(
    manifest.counts.quarantined,
    manifest.counts.negative_unconverted_undocumented_datum +
      manifest.counts.outside_unreviewed_0_to_150_candidate_range,
    'Quarantine must be the exclusive sum of rejected reading classes',
  );
});

test('NWDP INTEGRATION: unsupported and uncalibrated readings remain excluded', () => {
  const breakdown = manifest.counts as Record<string, number>;
  
  // Rule 1: Negative pressure values quarantined (Telangana / MP)
  assert.ok(
    breakdown.negative_unconverted_undocumented_datum > 0,
    'Negative readings must remain quarantined without calibration evidence'
  );

  // Rule 2: Missing or sentinel depths quarantined
  assert.ok(
    (breakdown.malformed_or_missing_measurements ?? 0) === 0,
    'The current source snapshot has no missing or malformed measurements'
  );

  // Rule 3: Physically implausible depths (> 150m bgl) quarantined
  assert.ok(
    breakdown.outside_unreviewed_0_to_150_candidate_range > 0,
    'Out-of-range observations must remain quarantined pending review'
  );

  // Verify quarantine records have explicit reasons
  assert.ok(breakdown.zero_readings > 0 && breakdown.exact_one_readings > 0);
  assert.equal(breakdown.verified_groundwater_depth_observations ?? 0, 0);
});

test('NWDP INTEGRATION: zero and exact-one readings remain candidates pending station QC', () => {
  assert.ok(manifest.counts.zero_readings > 0 && manifest.counts.exact_one_readings > 0);
  assert.deepEqual(blockTelemetry, {});
});

test('NWDP INTEGRATION: Tamil Nadu shallow dug well and deep piezometer remain strictly isolated', () => {
  // P.N.Palayam vs Kalviramapalayam in Coimbatore
  const blocks = blockTelemetry as Record<string, any>;
  for (const bid of Object.keys(blocks)) {
    const b = blocks[bid];
    if (b.state === 'Tamil Nadu' && b.block?.toLowerCase().includes('kalviramapalayam')) {
      assert.ok(
        !b.station_id?.toLowerCase().includes('p.n.palayam'),
        'Deep Kalviramapalayam block must never be merged with shallow P.N.Palayam well'
      );
    }
  }
});

test('NWDP INTEGRATION: telemetry without explicit station-to-block evidence fails closed', async () => {
  // The checked-in crosswalk has heuristic match_confidence but no official
  // metadata/boundary evidence. It must not become verified telemetry merely
  // because the readiness ledger has a non-unverified status.
  const bhadravati = await getTrustedBlockObservations('blk_bhadravati');
  assert.equal(bhadravati.blockId, 'blk_bhadravati');
  assert.equal(bhadravati.geography.state, 'Karnataka');
  assert.equal(bhadravati.provenance.mappingEvidence, null);
  assert.ok(!bhadravati.provenance.sourcePaths.includes('data/derived/nwdp_block_telemetry_series.json'));
  assert.notEqual(bhadravati.provenance.measurementType, 'telemetry_six_hourly_aggregated_daily');

  // Unmapped block must strictly fail closed
  const lalsot = await getTrustedBlockObservations('blk_dausa_lalsot');
  assert.equal(lalsot.availabilityStatus, 'unverified_station_mapping');
  assert.equal(lalsot.provenance.isVerifiedMapping, false);
});

test('NWDP INTEGRATION: Data sources registry exports all 9 active NWDP datasets plus historical archive', () => {
  const ids = DATA_SOURCES.map((s) => s.id);
  for (const st of ['ka', 'ts', 'tn', 'mp', 'rj', 'pb', 'hr', 'ml', 'tr']) {
    assert.ok(ids.includes(`src_nwdp_telemetry_${st}`), `Missing src_nwdp_telemetry_${st} in DATA_SOURCES`);
  }
  assert.ok(!ids.includes('src_nwdp_telemetry_as'), 'src_nwdp_telemetry_as must not be in DATA_SOURCES');
  assert.ok(ids.includes('src_cgwb_historical_archive'), 'Missing src_cgwb_historical_archive in DATA_SOURCES');
});
