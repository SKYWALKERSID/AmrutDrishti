import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  STATION_REGISTRY,
  validateSingleObservation,
  validateObservationSeries,
  type StationQcProfile,
} from '../src/lib/services/cgwbQaQcService.ts';

describe('CGWB High-Frequency QA/QC Guidelines Compliance', () => {
  const sampleProfile: StationQcProfile = {
    stationId: 'nwdp_dwlr::Haryana::ChocftraPz',
    stationName: 'ChocftraPz',
    state: 'Haryana',
    district: 'AMBALA',
    expectedIntervalHours: 6.0,
    minDepthMbgl: 10.0,
    maxDepthMbgl: 60.0,
    maxStepChangeM: 2.0,
    flatlineConsecutiveCount: 4,
    flatlineToleranceM: 0.001,
    allowZeroReading: false,
    datumConvention: 'depth_below_ground_level',
    ruleVersion: 'CGWB-2026-v1.0',
  };

  it('Station Registry contains verified stations with CRS and semantics metadata', () => {
    assert.ok(STATION_REGISTRY.total_stations > 500, 'Expected >500 stations in registry');
    assert.strictEqual(STATION_REGISTRY.standard_reference, 'CGWB Guidelines on High-Frequency Groundwater Data, February 2026');
    assert.ok(STATION_REGISTRY.status_summary.verified > 0, 'Verified stations must be non-zero');

    // Check sample station
    const sampleStation = Object.values(STATION_REGISTRY.stations)[0];
    assert.ok(sampleStation.station_id);
    assert.ok(sampleStation.agency);
    assert.ok(sampleStation.measurement_semantics.units);
    assert.ok(sampleStation.measurement_semantics.datum_convention);
  });

  it('Rejects physically impossible negative values under ground-level depth without sign flipping', () => {
    const res = validateSingleObservation(-12.4, '2025-01-10T06:00:00Z', sampleProfile);
    assert.strictEqual(res.status, 'Invalid');
    assert.strictEqual(res.reasonCode, 'negative_depth_below_ground');
  });

  it('Flags zero readings as Suspect pending calibration check', () => {
    const res = validateSingleObservation(0.0, '2025-01-10T06:00:00Z', sampleProfile);
    assert.strictEqual(res.status, 'Suspect');
    assert.strictEqual(res.reasonCode, 'zero_reading_potential_dry_or_fault');
  });

  it('Rejects future-dated observations', () => {
    const res = validateSingleObservation(25.0, '2099-01-01T00:00:00Z', sampleProfile);
    assert.strictEqual(res.status, 'Invalid');
    assert.strictEqual(res.reasonCode, 'future_dated_timestamp');
  });

  it('Detects duplicate timestamps and flags the second record as Invalid', () => {
    const records = [
      { sourceIndex: 1, timestampIso: '2025-01-10T06:00:00Z', value: 25.1 },
      { sourceIndex: 2, timestampIso: '2025-01-10T06:00:00Z', value: 25.3 }, // Duplicate
      { sourceIndex: 3, timestampIso: '2025-01-10T12:00:00Z', value: 25.2 },
    ];
    const results = validateObservationSeries(records, sampleProfile);
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].status, 'Valid');
    assert.strictEqual(results[1].status, 'Invalid');
    assert.strictEqual(results[1].reasonCode, 'duplicate_timestamp');
    assert.strictEqual(results[2].status, 'Valid');
  });

  it('Detects abrupt spikes / step changes and flags them Suspect', () => {
    const records = [
      { sourceIndex: 1, timestampIso: '2025-01-10T00:00:00Z', value: 25.0 },
      { sourceIndex: 2, timestampIso: '2025-01-10T06:00:00Z', value: 25.1 },
      { sourceIndex: 3, timestampIso: '2025-01-10T12:00:00Z', value: 31.5 }, // 6.4m jump (> 2.0m max)
      { sourceIndex: 4, timestampIso: '2025-01-10T18:00:00Z', value: 25.2 },
    ];
    const results = validateObservationSeries(records, sampleProfile);
    assert.strictEqual(results[2].status, 'Suspect');
    assert.strictEqual(results[2].reasonCode, 'abrupt_step_change_spike');
  });

  it('Detects flatline sensor freeze and flags Suspect', () => {
    const records = [
      { sourceIndex: 1, timestampIso: '2025-01-10T00:00:00Z', value: 24.5 },
      { sourceIndex: 2, timestampIso: '2025-01-10T06:00:00Z', value: 24.5 },
      { sourceIndex: 3, timestampIso: '2025-01-10T12:00:00Z', value: 24.5 },
      { sourceIndex: 4, timestampIso: '2025-01-10T18:00:00Z', value: 24.5 }, // 4th identical triggers
    ];
    const results = validateObservationSeries(records, sampleProfile);
    assert.strictEqual(results[3].status, 'Suspect');
    assert.strictEqual(results[3].reasonCode, 'flatline_stuck_sensor');
  });
});
