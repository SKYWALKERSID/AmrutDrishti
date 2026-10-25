import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const monitoringCode = fs.readFileSync('src/app/monitoring/page.tsx', 'utf8');

test('GROUNDWATER-TREND: Module header and positioning before forecast projections', () => {
  assert.match(
    monitoringCode,
    /id="historical-trend-analysis"/,
    'Historical trend module must have dedicated id'
  );
  assert.match(
    monitoringCode,
    /Groundwater Historical Trend &amp; Forecast Context \(2021–2026\)/,
    'Module title must match exact specification'
  );
  
  // Verify it appears before the forecast projection module
  const trendIndex = monitoringCode.indexOf('id="historical-trend-analysis"');
  const forecastIndex = monitoringCode.indexOf('id="forecast"');
  assert.ok(trendIndex > 0 && forecastIndex > 0, 'Both modules must exist in page.tsx');
  assert.ok(trendIndex < forecastIndex, 'Historical trend must be placed immediately before forecast projections');
});

test('GROUNDWATER-TREND: Station filtering, chronological ordering, and duplicate handling', () => {
  assert.match(
    monitoringCode,
    /selectedStationId/,
    'Must provide station filtering state'
  );
  assert.match(
    monitoringCode,
    /availableStations/,
    'Must derive available stations from raw observations'
  );
  assert.match(
    monitoringCode,
    /obs\.observation_date < '2021-01-01' \|\| obs\.observation_date > '2026-12-31'/,
    'Must bound observations within 2021-2026 date range'
  );
  assert.match(
    monitoringCode,
    /sort\(\(a,\s*b\)\s*=>\s*a\.date\.localeCompare\(b\.date\)\)/,
    'Must sort observations chronologically'
  );
  assert.match(
    monitoringCode,
    /dateMap\.get\(obs\.observation_date\)/,
    'Must group and deduplicate observations by date'
  );
});

test('GROUNDWATER-TREND: Summary metrics, net change calculation, and limitation handling', () => {
  assert.match(
    monitoringCode,
    /netChangeM = firstObs && lastObs \? Number\(\(lastObs\.depthMbgl - firstObs\.depthMbgl\)\.toFixed\(2\)\) : null/,
    'Net change must be calculated strictly as latest depth minus earliest depth'
  );
  assert.match(
    monitoringCode,
    /canComputeTrend = validCount >= 3 && spanYears >= 0\.5/,
    'Statistical trend requires >= 3 valid observations across >= 0.5 years'
  );
  assert.match(
    monitoringCode,
    /Trend Estimation Limitation:/,
    'Must display honest notice when insufficient points exist for trend'
  );
  assert.match(
    monitoringCode,
    /Earliest Record[\s\S]*?Latest Record[\s\S]*?Observed Net Change[\s\S]*?Annualized Rate &amp; Data Span/,
    'Must render compact summary metrics bar'
  );
});

test('GROUNDWATER-TREND: Visual distinction of forecast targets and no fabricated curves', () => {
  // Verified observed depth uses line
  assert.match(
    monitoringCode,
    /name="Verified Observed Depth \(m bgl\)"[\s\S]*?connectNulls=\{false\}/,
    'Historical observation line must not interpolate across missing gaps'
  );
  // Real 90d/180d Forecast Target uses strokeWidth=0 with dots (isolated points)
  assert.match(
    monitoringCode,
    /name="ML Forecast Target \[90d & 180d\] \(m bgl\)"[\s\S]*?strokeWidth=\{0\}[\s\S]*?connectNulls=\{false\}/,
    'Forecast targets must be isolated points without fabricated continuous curves'
  );
  // Statistical trend is labeled statistical
  assert.match(
    monitoringCode,
    /name="Statistical Historical Trend \(m bgl\)"[\s\S]*?strokeDasharray="4 4"/,
    'Trend line must be explicitly labeled as statistical trend'
  );
  // P10/P90 interval lines
  assert.match(
    monitoringCode,
    /name="P10 Lower Bound \(m bgl\)"/,
    'Must include P10 lower bound line'
  );
  assert.match(
    monitoringCode,
    /name="P90 Upper Bound \(m bgl\)"/,
    'Must include P90 upper bound line'
  );
});
