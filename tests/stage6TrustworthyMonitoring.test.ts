import test from 'node:test';
import assert from 'node:assert/strict';

import { mapDbRowToBlockData } from '../src/lib/mappers/blockMapper.ts';
import type { AdministrativeUnitRow, DerivedIndicatorRow } from '../src/lib/types/database.ts';

test('mapDbRowToBlockData preserves null indicators without converting to zero', () => {
  const unit: AdministrativeUnitRow = {
    unit_id: 'blk_test_null',
    unit_type: 'block',
    name: 'Null Test Block',
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

  const indicatorWithNulls: DerivedIndicatorRow = {
    indicator_id: 'ind_null_001',
    unit_id: 'blk_test_null',
    grace_twsa_cm: null,
    rainfall_anomaly_mm: null,
    spi_3month: null,
    sentinel_ndvi: null,
    sentinel_ndwi: null,
    smap_soil_moisture: null,
    cgwb_well_depth_mbgl: null,
    well_depth_trend_m_per_yr: null,
    descriptive_stress_score: null,
    risk_severity: 'gap',
    data_status: 'simulated',
    primary_stress_driver: 'Data Gap',
    safeguard_notice: 'Notice',   // snake_case matches DerivedIndicatorRow interface and DB column
    assessed_date: '2026-10-01',
    created_at: '2026-10-01T00:00:00Z'
  };

  const blockData = mapDbRowToBlockData(unit, indicatorWithNulls);

  assert.equal(blockData.indicators.graceTwsaCm, null);
  assert.equal(blockData.indicators.rainfallAnomalyMm, null);
  assert.equal(blockData.indicators.spi3Month, null);
  assert.equal(blockData.indicators.cgwbWellDepthMbgl, null);
  assert.equal(blockData.indicators.dataQualityFlag, 'missing');
});
