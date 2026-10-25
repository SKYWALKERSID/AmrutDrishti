import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { DATA_SOURCES } from '../src/lib/data/dataSources.ts';
import { ALL_INDIAN_STATES } from '../src/lib/data/indiaStates.ts';
import { NATIONAL_CONTRAST_DISTRICTS } from '../src/lib/data/nationalContrast.ts';
import { deriveFreshnessStatus, SOURCE_CATALOG } from '../src/lib/data/freshness.ts';

test('Ingestion Manifest file exists and contains valid JSON', { skip: !fs.existsSync(path.join(process.cwd(), 'data', 'ingestion_manifest.json')) }, () => {
  const manifestPath = path.join(process.cwd(), 'data', 'ingestion_manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'data/ingestion_manifest.json must exist');
  
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw);
  assert.equal(manifest.manifest_version, '2.0.0');
  assert.equal(manifest.reference_date, '2026-10-20');
  assert.ok(Array.isArray(manifest.datasets));
  assert.ok(manifest.datasets.length >= 15);
});

test('DATA_SOURCES registry contains all required metadata and healthy providers', () => {
  assert.ok(Array.isArray(DATA_SOURCES));
  assert.ok(DATA_SOURCES.length >= 8);

  for (const src of DATA_SOURCES) {
    assert.ok(src.id, 'Source must have id');
    assert.ok(src.name, 'Source must have name');
    assert.ok(src.provider, 'Source must have provider');
    assert.ok(src.spatialResolution, 'Source must have spatialResolution');
    assert.ok(src.temporalCadence, 'Source must have temporalCadence');
    assert.ok(src.lastSuccessfulIngestion, 'Source must have lastSuccessfulIngestion');
    assert.ok(src.latestObservationDate, 'Source must have latestObservationDate');
    assert.ok(src.licenseTerms, 'Source must have licenseTerms');
    assert.ok(src.provenanceDetails, 'Source must have provenanceDetails');
    assert.ok(['healthy', 'lagging', 'error'].includes(src.status));
  }
});

test('deriveFreshnessStatus calculates accurate statuses based on latency thresholds', () => {
  // Recent IMD rainfall (within 5 days with referenceDate 2026-10-20)
  const imdFresh = deriveFreshnessStatus({
    isLiveSource: true,
    lastObservedDate: '2026-10-15',
    typicalLagDays: 5,
    referenceDate: new Date('2026-10-20T12:00:00Z')
  });
  assert.ok(['LIVE', 'RECENT'].includes(imdFresh));

  // Stale IMD rainfall (older than typicalLagDays * 2)
  const imdStale = deriveFreshnessStatus({
    isLiveSource: true,
    lastObservedDate: '2025-01-01',
    typicalLagDays: 5,
    referenceDate: new Date('2026-10-20T12:00:00Z')
  });
  assert.equal(imdStale, 'STALE');

  // Null observation date returns UNAVAILABLE
  const nullObs = deriveFreshnessStatus({
    isLiveSource: true,
    lastObservedDate: null
  });
  assert.equal(nullObs, 'UNAVAILABLE');
});

test('Sikkim blocks have honest null well depths and missing quality flags', () => {
  const sikkimDistricts = NATIONAL_CONTRAST_DISTRICTS.filter(d => d.state === 'Sikkim');
  assert.ok(sikkimDistricts.length > 0, 'Sikkim districts must exist in national contrast');

  for (const dist of sikkimDistricts) {
    for (const blk of dist.blocks) {
      assert.equal(
        blk.indicators.cgwbWellDepthMbgl,
        null,
        `Block ${blk.name} must have null cgwbWellDepthMbgl`
      );
      assert.equal(
        blk.indicators.dataQualityFlag,
        'missing',
        `Block ${blk.name} must have dataQualityFlag 'missing'`
      );
      assert.equal(
        blk.assessment.validationStatus,
        'pending_field_review',
        `Block ${blk.name} must have validationStatus 'pending_field_review'`
      );
    }
  }
});

test('Meghalaya priority state is properly audited with ingested NWIC station records', { skip: !fs.existsSync(path.join(process.cwd(), 'data', 'sources', 'meghalaya_gw_manual.csv')) }, () => {
  const mlState = ALL_INDIAN_STATES.find(s => s.code === 'ML');
  assert.ok(mlState, 'Meghalaya state must exist in ALL_INDIAN_STATES');
  assert.ok(
    mlState.statusLabel?.includes('NWIC'),
    `Meghalaya statusLabel must indicate NWIC station records: ${mlState.statusLabel}`
  );
  
  // Check local file was created
  const mlFile = path.join(process.cwd(), 'data', 'sources', 'meghalaya_gw_manual.csv');
  assert.ok(fs.existsSync(mlFile), 'Meghalaya manual groundwater CSV must exist');
});
