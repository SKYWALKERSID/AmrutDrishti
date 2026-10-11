import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateImdRainfallRecord,
  validateCgwbObservationRecord,
  processImdRainfallBatch,
  AUTHORITATIVE_SOURCES
} from '../src/lib/services/ingestionEngine.ts';

test('Authoritative Sources registry contains IMD, CGWB, and GRACE metadata', () => {
  assert.ok(AUTHORITATIVE_SOURCES.src_imd_rainfall);
  assert.ok(AUTHORITATIVE_SOURCES.src_cgwb_wells);
  assert.ok(AUTHORITATIVE_SOURCES.src_grace_fo);

  assert.equal(AUTHORITATIVE_SOURCES.src_imd_rainfall.coordinateReferenceSystem, 'EPSG:4326 (WGS84)');
  assert.equal(AUTHORITATIVE_SOURCES.src_cgwb_wells.coordinateReferenceSystem, 'EPSG:4326 (WGS84)');
  assert.equal(AUTHORITATIVE_SOURCES.src_grace_fo.coordinateReferenceSystem, 'EPSG:4326 (WGS84)');
});

test('validateImdRainfallRecord preserves null values and never converts missing to zero', () => {
  const recordWithNulls = {
    unitId: 'blk_tikamgarh_main',
    observationDate: '2026-10-08',
    rainfallMm: null,
    rainfallAnomalyMm: null,
    spi3Month: null
  };

  const result = validateImdRainfallRecord(recordWithNulls);
  assert.equal(result.isValid, true);
  assert.ok(result.record);
  assert.equal(result.record.rainfallMm, null, 'rainfallMm must remain null');
  assert.equal(result.record.rainfallAnomalyMm, null, 'rainfallAnomalyMm must remain null');
  assert.equal(result.record.spi3Month, null, 'spi3Month must remain null');
  assert.equal(result.record.qualityFlag, 'missing');
});

test('validateImdRainfallRecord rejects negative rainfall and malformed dates', () => {
  const negativeRain = {
    unitId: 'blk_tikamgarh_main',
    observationDate: '2026-10-08',
    rainfallMm: -15.4
  };

  const badDate = {
    unitId: 'blk_tikamgarh_main',
    observationDate: 'invalid-date',
    rainfallMm: 22.0
  };

  const resNeg = validateImdRainfallRecord(negativeRain);
  assert.equal(resNeg.isValid, false);
  assert.ok(resNeg.errors.some(e => e.includes('cannot be negative')));

  const resDate = validateImdRainfallRecord(badDate);
  assert.equal(resDate.isValid, false);
  assert.ok(resDate.errors.some(e => e.includes('Invalid observationDate format')));

  const impossibleCalendarDate = {
    unitId: 'blk_tikamgarh_main',
    observationDate: '2026-02-30', // Feb 30 does not exist
    rainfallMm: 12.0
  };
  const resImpDate = validateImdRainfallRecord(impossibleCalendarDate);
  assert.equal(resImpDate.isValid, false);
  assert.ok(resImpDate.errors.some(e => e.includes('Invalid observationDate format')));
});

test('validateCgwbObservationRecord preserves null water level and validates bounds', () => {
  const validWell = {
    stationId: 'CGWB_MP_TIK_001',
    observationDate: '2026-09-28',
    waterLevelMbgl: 12.4
  };

  const nullWell = {
    stationId: 'CGWB_MP_TIK_002',
    observationDate: '2026-09-28',
    waterLevelMbgl: null
  };

  const resValid = validateCgwbObservationRecord(validWell);
  assert.equal(resValid.isValid, true);
  assert.equal(resValid.record?.waterLevelMbgl, 12.4);
  assert.equal(resValid.record?.qualityFlag, 'passed');

  const resNull = validateCgwbObservationRecord(nullWell);
  assert.equal(resNull.isValid, true);
  assert.equal(resNull.record?.waterLevelMbgl, null, 'waterLevelMbgl must remain null');
  assert.equal(resNull.record?.qualityFlag, 'missing');
});

test('processImdRainfallBatch deduplicates idempotently and logs accurate telemetry', () => {
  const batch = [
    { unitId: 'blk_tikamgarh_main', observationDate: '2026-10-08', rainfallMm: 12.0, rainfallAnomalyMm: -5.0, spi3Month: -0.4 },
    // Duplicate entry (same unitId and date)
    { unitId: 'blk_tikamgarh_main', observationDate: '2026-10-08', rainfallMm: 14.0, rainfallAnomalyMm: -4.0, spi3Month: -0.3 },
    // Second block
    { unitId: 'blk_jatara', observationDate: '2026-10-08', rainfallMm: 0.0, rainfallAnomalyMm: -18.0, spi3Month: -1.2 },
    // Invalid entry
    { unitId: '', observationDate: 'bad-date', rainfallMm: -5.0 }
  ];

  const summary = processImdRainfallBatch(batch, 'run_test_01');

  assert.equal(summary.totalRecords, 4);
  assert.equal(summary.validRecords.length, 2, 'Must have 2 unique valid blocks after deduplication');
  assert.equal(summary.duplicateRecordsCount, 1, 'Must detect 1 duplicate record');
  assert.equal(summary.rejectedRecordsCount, 1, 'Must reject 1 invalid record');

  // Verify telemetry log
  assert.equal(summary.telemetryLog.runId, 'run_test_01');
  assert.equal(summary.telemetryLog.sourceId, 'src_imd_rainfall');
  assert.equal(summary.telemetryLog.recordsIngested, 2);
  assert.equal(summary.telemetryLog.recordsRejected, 1);
  assert.equal(summary.telemetryLog.status, 'lagging'); // partial success with rejections
});
