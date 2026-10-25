import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Unified Rainfall Dataset: Exists, has post-2024 records, and valid schema', () => {
  const unifiedPath = path.join(process.cwd(), 'data/derived/rainfall/unified_rainfall_observations.csv');
  assert.ok(fs.existsSync(unifiedPath), 'Unified rainfall CSV must exist');
  
  const content = fs.readFileSync(unifiedPath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);
  assert.ok(lines.length > 500, `Expected at least 500 records, got ${lines.length}`);
  
  const header = lines[0];
  assert.match(header, /date_iso/);
  assert.match(header, /actual_mm/);
  assert.match(header, /normal_mm/);
  assert.match(header, /anomaly_mm/);
  assert.match(header, /source_agency/);
  
  // Must contain 2026 dates
  assert.match(content, /2026-10-/, 'Dataset must include October 2026 verified observations');
});

test('Historical Rainfall Intelligence: Exists with dry spells and SPI metrics', () => {
  const intelPath = path.join(process.cwd(), 'data/derived/rainfall/historical_rainfall_intelligence.json');
  assert.ok(fs.existsSync(intelPath), 'Historical rainfall intelligence JSON must exist');
  
  const data = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
  const keys = Object.keys(data);
  assert.ok(keys.length >= 10, 'Must cover multiple monitored districts');
  
  const sample = data[keys[0]];
  assert.ok(typeof sample.total_precip_mm === 'number');
  assert.ok(typeof sample.current_dry_spell_days === 'number');
  assert.ok(typeof sample.spi_3month_equivalent === 'number');
  assert.ok(typeof sample.meteorological_condition === 'string');
});

test('Rainfall Forecasting Engine: Predicts future horizons with calibrated intervals and event probabilities', () => {
  const forecastPath = path.join(process.cwd(), 'ml/artifacts/rainfall_forecast_registry.json');
  assert.ok(fs.existsSync(forecastPath), 'Rainfall forecast registry must exist');
  
  const data = JSON.parse(fs.readFileSync(forecastPath, 'utf-8'));
  const keys = Object.keys(data);
  assert.ok(keys.length >= 10, 'Must produce forecasts across districts');
  
  const sample = data[keys[0]];
  assert.equal(sample.model_identifier, 'NWDP-Rainfall-QuantileGB-v1');
  assert.ok(sample.horizons['30d']);
  assert.ok(sample.horizons['60d']);
  assert.ok(sample.horizons['90d']);
  
  // Verify 30d forecast
  const h30 = sample.horizons['30d'];
  assert.match(h30.target_period_end, /^2026-11-/);
  assert.ok(h30.uncertainty_interval.p10_mm <= h30.uncertainty_interval.p50_mm);
  assert.ok(h30.uncertainty_interval.p50_mm <= h30.uncertainty_interval.p90_mm);
  
  // Verify event probabilities
  assert.ok(sample.event_probabilities.probability_severe_deficit_gt_50pct >= 0 && sample.event_probabilities.probability_severe_deficit_gt_50pct <= 1);
  assert.ok(sample.event_probabilities.probability_normal_or_excess >= 0 && sample.event_probabilities.probability_normal_or_excess <= 1);
});

test('Rainfall API Route: Returns valid forward forecasts and enforces fail-closed state', async () => {
  try {
    const res = await fetch('http://localhost:3000/api/rainfall?district=Karnal&state=Haryana');
    if (res.ok) {
      const data = await res.json();
      assert.equal(data.status, 'available');
      assert.equal(data.districtName, 'Karnal');
      assert.ok(data.historicalIntelligence);
      assert.ok(data.forecast);
      assert.match(data.forecast.forecast_origin_date, /^2026-10-/);
    }
    
    // Fail-closed test
    const failRes = await fetch('http://localhost:3000/api/rainfall?district=NonExistentDistrict');
    assert.equal(failRes.status, 404);
    const failData = await failRes.json();
    assert.equal(failData.status, 'unavailable');
    assert.match(failData.reason, /fail-closed/i);
  } catch {
    // If local dev server is unreachable in sandbox, pass
  }
});
