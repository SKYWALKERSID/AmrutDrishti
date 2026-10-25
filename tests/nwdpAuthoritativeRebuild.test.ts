import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../data/derived/nwdp_telemetry_ingestion_manifest.json' with { type: 'json' };
import mapping from '../data/derived/nwdp_station_block_mapping_evidence.json' with { type: 'json' };
import readiness from '../audit/global_model_block_readiness.json' with { type: 'json' };
import blockSeries from '../data/derived/nwdp_block_telemetry_series.json' with { type: 'json' };
import { getTrustedBlockObservations, isNwdpMappingEvidenceRegistry } from '../src/lib/services/trustedObservationProvider.ts';

test('NWDP authoritative rebuild uses exactly 18 retained resources across nine active states', () => {
  assert.equal(manifest.input_resources.length, 18);
  assert.equal(new Set(manifest.input_resources.map((resource) => resource.state)).size, 9);
  assert.equal(manifest.counts.source_rows, manifest.counts.candidate_not_verified + manifest.counts.quarantined);
  assert.ok(!manifest.input_resources.some((resource) => resource.state === 'Assam'));
});

test('legacy/manual artifacts under NWDP paths are not interpreted as NWDP evidence', () => {
  assert.equal(mapping.entries.length, 43);
  assert.equal(isNwdpMappingEvidenceRegistry({
    registry_type: 'nwdp_station_block_mapping_evidence', registry_version: '1.0.0', policy: 'documented policy', entries: [],
  }), true);
  assert.equal(isNwdpMappingEvidenceRegistry({
    source: 'cgwb_manual_quarterly_ground_truth_ingestion', entries: mapping.entries,
  }), false);
  assert.ok(Object.values(blockSeries).every((series) => series.source_type !== 'NWDP_telemetry'));
  assert.equal(readiness.blocks.length, 43);
  assert.ok(readiness.blocks.every((block) => block.operational_eligibility === false && block.accepted_observations === 0));
});

test('trusted provider cannot merge legacy archives into the regenerated NWDP-only series', async () => {
  const result = await getTrustedBlockObservations('blk_karnal_assandh');
  assert.equal(result.availabilityStatus, 'unverified_station_mapping');
  assert.equal(result.observations.length, 0);
  assert.equal(result.provenance.isVerifiedMapping, false);
  assert.equal(result.provenance.sourceOrganization, 'unavailable');
  assert.deepEqual(result.provenance.sourcePaths, []);
});
