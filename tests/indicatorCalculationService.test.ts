import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBlockIndicatorsFromObservations,
  buildDerivedIndicatorRows,
  type PublishedObservationRecord
} from '../src/lib/services/indicatorCalculationService.ts';

const SAMPLE_OBSERVATIONS: PublishedObservationRecord[] = [
  {
    station_id: 'ST_01',
    station_name: 'Station 1',
    district_id: '434',
    district_name: 'TIKAMGARH',
    block_id: '4032',
    block_name: 'TIKAMGARH',
    observation_date: '2021-01-10',
    water_level_mbgl: 5.0,
    unit: 'metre below ground level',
    quality_flag: 'passed',
    source_name: 'CGWB',
    source_provider: 'CGWB',
    source_resource_url: 'https://example.com'
  },
  {
    station_id: 'ST_01',
    station_name: 'Station 1',
    district_id: '434',
    district_name: 'TIKAMGARH',
    block_id: '4032',
    block_name: 'TIKAMGARH',
    observation_date: '2022-01-10',
    water_level_mbgl: 6.0,
    unit: 'metre below ground level',
    quality_flag: 'passed',
    source_name: 'CGWB',
    source_provider: 'CGWB',
    source_resource_url: 'https://example.com'
  },
  {
    station_id: 'ST_02',
    station_name: 'Station 2',
    district_id: '434',
    district_name: 'TIKAMGARH',
    block_id: '4032',
    block_name: 'TIKAMGARH',
    observation_date: '2023-01-10',
    water_level_mbgl: 7.0,
    unit: 'metre below ground level',
    quality_flag: 'passed',
    source_name: 'CGWB',
    source_provider: 'CGWB',
    source_resource_url: 'https://example.com'
  },
  {
    station_id: 'ST_03',
    station_name: 'Station 3',
    district_id: '434',
    district_name: 'TIKAMGARH',
    block_id: '4032',
    block_name: 'TIKAMGARH',
    observation_date: '2023-01-10',
    water_level_mbgl: null, // Null measurement
    unit: 'metre below ground level',
    quality_flag: 'missing_reading',
    source_name: 'CGWB',
    source_provider: 'CGWB',
    source_resource_url: 'https://example.com'
  }
];

test('Indicator Calculation: Computes latest mean depth without converting null to zero', () => {
  const result = calculateBlockIndicatorsFromObservations(SAMPLE_OBSERVATIONS);
  assert.equal(result.has('4032'), true);

  const tikamgarh = result.get('4032')!;
  assert.equal(tikamgarh.total_observations, 4);
  assert.equal(tikamgarh.valid_observations, 3);
  assert.equal(tikamgarh.null_observations, 1);
  assert.equal(tikamgarh.latest_observation_date, '2023-01-10');
  // On 2023-01-10: ST_02 has 7.0, ST_03 has null -> mean is 7.0 (not (7+0)/2 = 3.5)
  assert.equal(tikamgarh.cgwb_well_depth_mbgl, 7.0);
  assert.equal(tikamgarh.risk_severity, 'severe'); // trend >= 0.5 m/yr (1.0 m/yr) triggers 'severe'
});

test('Indicator Calculation: Computes OLS trend accurately', () => {
  const result = calculateBlockIndicatorsFromObservations(SAMPLE_OBSERVATIONS);
  const tikamgarh = result.get('4032')!;
  assert.ok(tikamgarh.well_depth_trend_m_per_yr !== null);
  // Groundwater depth is increasing (5.0 -> 6.0 -> 7.0) by ~1.0 m/yr drawdown
  assert.ok(tikamgarh.well_depth_trend_m_per_yr > 0.9 && tikamgarh.well_depth_trend_m_per_yr < 1.1);
});

test('Indicator Calculation: Insufficient data yields gap severity', () => {
  const gapObs: PublishedObservationRecord[] = [
    {
      station_id: 'GAP_01',
      station_name: 'Gap Station',
      district_id: '999',
      district_name: 'UNKNOWN',
      block_id: 'GAP_BLOCK',
      block_name: 'GAP_BLOCK',
      observation_date: '2023-01-10',
      water_level_mbgl: null,
      unit: 'metre below ground level',
      quality_flag: 'failed',
      source_name: 'CGWB',
      source_provider: 'CGWB',
      source_resource_url: 'https://example.com'
    }
  ];

  const result = calculateBlockIndicatorsFromObservations(gapObs);
  const gap = result.get('GAP_BLOCK')!;
  assert.equal(gap.risk_severity, 'gap');
  assert.equal(gap.cgwb_well_depth_mbgl, null);
  assert.equal(gap.well_depth_trend_m_per_yr, null);
  assert.equal(gap.valid_observations, 0);
  assert.equal(gap.null_observations, 1);
});

test('Indicator Calculation: Database rows preserve unmeasured parameters as SQL null', () => {
  const calculated = calculateBlockIndicatorsFromObservations(SAMPLE_OBSERVATIONS);
  const rows = buildDerivedIndicatorRows(calculated);
  assert.equal(rows.length, 1);
  const row = rows[0];

  assert.equal(row.unit_id, '4032');
  assert.equal(row.data_status, 'observed');
  assert.equal(row.grace_twsa_cm, null);
  assert.equal(row.rainfall_anomaly_mm, null);
  assert.equal(row.spi_3month, null);
  assert.equal(row.sentinel_ndvi, null);
  assert.equal(row.sentinel_ndwi, null);
  assert.equal(row.smap_soil_moisture, null);
  assert.equal(row.cgwb_well_depth_mbgl, 7.0);
  assert.ok(row.well_depth_trend_m_per_yr !== null);
});
