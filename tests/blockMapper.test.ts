import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePointCoordinates,
  parseGeoJsonGeometry,
  mapDbRowToBlockData,
  hasValidCoordinates
} from '../src/lib/mappers/blockMapper.ts';
import type { AdministrativeUnitRow, DerivedIndicatorRow } from '../src/lib/types/database.ts';

test('parsePointCoordinates returns [lat, lng] for GeoJSON Point [lng, lat]', () => {
  const geojsonPoint = { type: 'Point', coordinates: [78.8311, 24.7456] };
  const res = parsePointCoordinates(geojsonPoint);
  assert.deepEqual(res, [24.7456, 78.8311]);
  assert.equal(hasValidCoordinates(res), true);
});

test('parsePointCoordinates handles valid zero-valued coordinates like [0, 0], [0, 45], [45, 0]', () => {
  assert.deepEqual(parsePointCoordinates({ type: 'Point', coordinates: [0, 0] }), [0, 0]);
  assert.equal(hasValidCoordinates([0, 0]), true);

  assert.deepEqual(parsePointCoordinates({ type: 'Point', coordinates: [45, 0] }), [0, 45]);
  assert.equal(hasValidCoordinates([0, 45]), true);

  assert.deepEqual(parsePointCoordinates({ type: 'Point', coordinates: [0, 45] }), [45, 0]);
  assert.equal(hasValidCoordinates([45, 0]), true);
});

test('parsePointCoordinates handles WKT string POINT(lng lat)', () => {
  const wkt = 'POINT(78.8311 24.7456)';
  const res = parsePointCoordinates(wkt);
  assert.deepEqual(res, [24.7456, 78.8311]);
  assert.equal(hasValidCoordinates(res), true);
});

test('parsePointCoordinates returns null for null, invalid, or out-of-range coordinates', () => {
  assert.equal(parsePointCoordinates(null), null);
  assert.equal(hasValidCoordinates(null), false);
  assert.equal(parsePointCoordinates('INVALID_WKT'), null);
  assert.equal(parsePointCoordinates({ type: 'Point', coordinates: [999, 999] }), null);
});

test('parseGeoJsonGeometry preserves standard GeoJSON Polygon coordinates without reversing', () => {
  const poly = {
    type: 'Polygon',
    coordinates: [
      [
        [78.0, 24.0],
        [79.0, 24.0],
        [79.0, 25.0],
        [78.0, 25.0],
        [78.0, 24.0]
      ]
    ]
  };
  const parsed = parseGeoJsonGeometry(poly);
  assert.ok(parsed);
  assert.equal(parsed?.type, 'Polygon');
  assert.deepEqual((parsed as GeoJSON.Polygon).coordinates[0][0], [78.0, 24.0]); // Preserves GeoJSON [lng, lat]
});

test('parseGeoJsonGeometry returns undefined for malformed geometry objects', () => {
  assert.equal(parseGeoJsonGeometry(null), undefined);
  assert.equal(parseGeoJsonGeometry({ type: 'UnknownType' }), undefined);
  assert.equal(parseGeoJsonGeometry('not_an_object'), undefined);
});

test('mapDbRowToBlockData handles null indicator with gap severity and null confidence interval', () => {
  const unit: AdministrativeUnitRow = {
    unit_id: 'blk_test',
    unit_type: 'block',
    name: 'Test Block',
    district_id: 'dist_test',
    district_name: 'Test District',
    state_name: 'Madhya Pradesh',
    coordinates: { type: 'Point', coordinates: [78.8311, 24.7456] },
    geom: null,
    total_geographic_area_ha: 50000,
    net_sown_area_ha: 30000,
    boundary_version: 'LGD-2024',
    created_at: '2026-10-10T00:00:00Z'
  };

  const blockData = mapDbRowToBlockData(unit, null);

  assert.equal(blockData.id, 'blk_test');
  assert.equal(blockData.riskSeverity, 'gap');
  assert.equal(blockData.indicators.dataQualityFlag, 'missing');
  assert.equal(blockData.primaryCropSeason, 'Unrecorded');
  assert.equal(blockData.assessment.baselineComparison, 'Uncalibrated');
  assert.equal(blockData.assessment.modelMethodologyVersion, 'Unspecified');
  assert.equal(blockData.assessment.confidenceInterval, null);
});

test('mapDbRowToBlockData preserves true indicator data_status provenance', () => {
  const unit: AdministrativeUnitRow = {
    unit_id: 'blk_test',
    unit_type: 'block',
    name: 'Test Block',
    district_id: 'dist_test',
    district_name: 'Test District',
    state_name: 'Madhya Pradesh',
    coordinates: { type: 'Point', coordinates: [78.8311, 24.7456] },
    geom: null,
    total_geographic_area_ha: 50000,
    net_sown_area_ha: 30000,
    boundary_version: 'LGD-2024',
    created_at: '2026-10-10T00:00:00Z'
  };

  const indicator: DerivedIndicatorRow = {
    indicator_id: 'ind_001',
    unit_id: 'blk_test',
    grace_twsa_cm: -6.5,
    rainfall_anomaly_mm: -210,
    spi_3month: -1.5,
    sentinel_ndvi: 0.3,
    sentinel_ndwi: -0.2,
    smap_soil_moisture: 0.12,
    cgwb_well_depth_mbgl: 14.5,
    well_depth_trend_m_per_yr: -0.5,
    descriptive_stress_score: 75,
    risk_severity: 'severe',
    data_status: 'predicted',
    primary_stress_driver: 'Monsoon Deficit',
    safeguard_notice: 'Test Notice',
    assessed_date: '2026-10-01',
    created_at: '2026-10-01T00:00:00Z'
  };

  const blockData = mapDbRowToBlockData(unit, indicator);

  assert.equal(blockData.assessment.dataStatus, 'predicted');
  assert.equal(blockData.riskSeverity, 'severe');
  assert.equal(blockData.indicators.graceTwsaCm, -6.5);
  assert.equal(blockData.assessment.confidenceInterval, null);
});
