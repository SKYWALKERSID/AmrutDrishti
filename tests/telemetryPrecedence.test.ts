import test from 'node:test';
import assert from 'node:assert/strict';
import { getTrustedBlockObservations } from '../src/lib/services/trustedObservationProvider.ts';
import nwdpBlockTelemetry from '../data/derived/nwdp_block_telemetry_series.json' with { type: 'json' };

test('TELEMETRY-PRECEDENCE: heuristic NWDP crosswalks cannot take precedence', async () => {
  // This artifact has no mapping_evidence field, so it must remain excluded.
  const res = await getTrustedBlockObservations('blk_periyanaickenpalayam');
  assert.equal(res.blockId, 'blk_periyanaickenpalayam');
  assert.equal(res.availabilityStatus, 'unverified_station_mapping');
  const tEntry = (nwdpBlockTelemetry as Record<string, any>)['blk_periyanaickenpalayam'];
  assert.equal(tEntry, undefined, 'No unmapped station may be published in the block series');
  assert.equal(res.provenance.mappingEvidence, null);
  assert.notEqual(res.provenance.measurementType, 'telemetry_six_hourly_aggregated_daily');
});

test('TELEMETRY-PRECEDENCE: Invalid, missing, unmapped, or stale observations cannot masquerade as current data', async () => {
  // 1. Unmapped block strictly fails closed
  const unmapped = await getTrustedBlockObservations('blk_dausa_lalsot');
  assert.equal(unmapped.availabilityStatus, 'unverified_station_mapping');
  assert.equal(unmapped.provenance.isVerifiedMapping, false);
  assert.equal(unmapped.dataAvailabilityMode, 'unavailable');

  // 2. Stale blocks (>400 days old) report actual observation dates, not fabricated dates
  const staleBlock = await getTrustedBlockObservations('blk_ludhiana_khanna');
  assert.equal(staleBlock.latestObservationDate, null);
  assert.equal(staleBlock.observations.length, 0);
});

test('TELEMETRY-PRECEDENCE: unproven Karnataka and Telangana telemetry remains unavailable to provider', async () => {
  const dav = await getTrustedBlockObservations('blk_davanagere_main');
  assert.equal(dav.blockId, 'blk_davanagere_main');
  assert.notEqual(dav.provenance.sourceOrganization, 'NWDP/NWIC');
  assert.equal(dav.provenance.mappingEvidence, null);
  assert.notEqual(dav.provenance.measurementType, 'telemetry_six_hourly_aggregated_daily');
});

test('WELL-IDENTITY-INTEGRITY: unproven station cross-district mapping is not reported verified', async () => {
  // Sagar block must match Khajuria in Sagar district, NOT Barod in Agar Malwa district
  const sagar = await getTrustedBlockObservations('blk_sagar_main');
  assert.equal(sagar.blockId, 'blk_sagar_main');
  assert.equal(sagar.geography.district, 'Sagar');
  assert.equal(sagar.provenance.isVerifiedMapping, false);
  assert.equal(sagar.provenance.mappingEvidence, null);
});

test('MP-STATE-GWD: Dedicated state groundwater well records resolve through Nov 2025 with explicit provenance', async () => {
  // When preferStateGwd is requested, Sagar resolves the SGWO bore well SAGAR014-PZ through November 2025
  const sagarState = await getTrustedBlockObservations('blk_sagar_main', { preferStateGwd: true });
  assert.equal(sagarState.blockId, 'blk_sagar_main');
  assert.equal(sagarState.stationId, null);
  assert.equal(sagarState.latestObservationDate, null);
  assert.equal(sagarState.observations.length, 0);

  // Tikamgarh resolves Tikm016-PZ through November 2025
  const tikamState = await getTrustedBlockObservations('blk_tikamgarh_main', { preferStateGwd: true });
  assert.equal(tikamState.stationId, null);
  assert.equal(tikamState.latestObservationDate, null);

  // Well types and identities are distinct (no artificial merging of dug wells and bore wells)
  const nowgaonState = await getTrustedBlockObservations('blk_chhatarpur_nowgaon', { preferStateGwd: true });
  assert.equal(nowgaonState.stationId, null);
  assert.equal(nowgaonState.latestObservationDate, null);
});

