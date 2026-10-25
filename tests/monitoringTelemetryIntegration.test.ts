import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('TELEMETRY-INTEGRATION: 18 Telemetry datasets and normalized station series are available', () => {
  // Check existence of inventory and normalized series
  assert.ok(
    fs.existsSync('data/derived/nwdp_coverage_inventory.json'),
    'Coverage inventory must exist'
  );
  assert.ok(
    fs.existsSync('data/derived/nwdp_trained_station_series.json'),
    'Trained station telemetry series must exist'
  );

  const inventory = JSON.parse(
    fs.readFileSync('data/derived/nwdp_coverage_inventory.json', 'utf8')
  );
  assert.ok(Array.isArray(inventory) && inventory.length >= 120, 'Must cover trained stations catalog');

  const states = Array.from(new Set(inventory.map((st: { state: string }) => st.state)));
  assert.ok(states.length >= 9, 'Must cover all 9 NWDP states');

  // Check 18 datasets are referenced in raw directory
  const rawFiles = fs.readdirSync('data/sources/nwdp_telemetry_raw');
  const telFiles = rawFiles.filter(f => f.startsWith('gwl_tel_6_hourly_cgwb_') && f.endsWith('.csv'));
  assert.strictEqual(telFiles.length, 18, 'Exactly 18 raw telemetry datasets must be present in repository');
});

test('TELEMETRY-INTEGRATION: Telemetry API route exposes observations and metadata', () => {
  const routeCode = fs.readFileSync('src/app/api/telemetry-observations/route.ts', 'utf8');
  assert.match(routeCode, /nwdp_trained_station_series\.json/, 'Must load normalized telemetry series');
  assert.match(routeCode, /source:\s*'nwdp_telemetry_dwlr_automated'/, 'Must state exact source');
  assert.match(routeCode, /provenance/, 'Must include provenance metadata');
  assert.match(routeCode, /NWDP Automated Telemetry/, 'Must state exact provenance name');
});

test('TELEMETRY-INTEGRATION: Monitoring page implements dual-source selection and 4-module hierarchy', () => {
  const monitoringCode = fs.readFileSync('src/app/monitoring/page.tsx', 'utf8');

  // Module hierarchy
  const mod1 = monitoringCode.indexOf('1. Groundwater Historical Trend &amp; Forecast Context (2021–2026)');
  const mod2 = monitoringCode.indexOf('2. IMD Rainfall Trends &amp; Annual Differences (mm)');
  const mod3 = monitoringCode.indexOf('3. Groundwater Monitoring Well Depth vs Satellite Water Storage');
  const mod4 = monitoringCode.indexOf('Integrated Groundwater Intelligence &amp; Drought Risk Summary');

  assert.ok(mod1 > 0, 'Module 1 must exist');
  assert.ok(mod2 > 0, 'Module 2 must exist');
  assert.ok(mod3 > 0, 'Module 3 must exist');
  assert.ok(mod4 > 0, 'Module 4 must exist');

  assert.ok(mod1 < mod2, 'Module 1 must precede Module 2');
  assert.ok(mod2 < mod3, 'Module 2 must precede Module 3');
  assert.ok(mod3 < mod4, 'Module 3 must precede Module 4');

  // Source selection controls
  assert.match(monitoringCode, /selectedDataSource === 'telemetry'/, 'Must support automated telemetry source');
  assert.match(monitoringCode, /selectedDataSource === 'cgwb_manual'/, 'Must support CGWB manual source separately');
  assert.match(monitoringCode, /Automated Telemetry \(18 Datasets\)/, 'Must display explicit telemetry source label');
  assert.match(monitoringCode, /CGWB Manual Archive/, 'Must display explicit CGWB manual source label');

  // Zero hex literals check in page.tsx
  const hexMatches = monitoringCode.match(/#[0-9a-fA-F]{3,8}\b/g);
  assert.strictEqual(hexMatches, null, 'Monitoring page must contain zero hex literals');
});

test('TELEMETRY-FORECAST: Primary 90-day & 180-day forecast panel uses live telemetry station model', () => {
  const monitoringCode = fs.readFileSync('src/app/monitoring/page.tsx', 'utf8');

  // Verify forecast panel exists with id="forecast"
  const forecastIndex = monitoringCode.indexOf('id="forecast"');
  assert.ok(forecastIndex > 0, 'id="forecast" must exist');

  // Verify fetch of live telemetry station forecasts
  assert.match(
    monitoringCode,
    /\/api\/station-forecast\?stationId=\$\{encodeURIComponent\(selectedTelemetryStationId\)\}&horizonDays=90/,
    'Must fetch 90-day horizon from /api/station-forecast using selectedTelemetryStationId'
  );
  assert.match(
    monitoringCode,
    /\/api\/station-forecast\?stationId=\$\{encodeURIComponent\(selectedTelemetryStationId\)\}&horizonDays=180/,
    'Must fetch 180-day horizon from /api/station-forecast using selectedTelemetryStationId'
  );

  // Verify primary panel displays live telemetry station model when telemetry source is active
  assert.match(
    monitoringCode,
    /Live Telemetry Station Model · Experimental/,
    'Must display Live Telemetry Station Model badge'
  );
  assert.match(
    monitoringCode,
    /NWDP-Station-Experimental/,
    'Must specify NWDP-Station-Experimental model'
  );

  // Verify forecast origin comes dynamically from model data or telemetry metadata, not hardcoded 2023-11-01
  assert.match(
    monitoringCode,
    /telemetryStationForecast\?\.fc90\?\.originDate \|\| telemetryMetadata\?\.latestDate/,
    'Forecast origin must come dynamically from model data or latest telemetry observation'
  );

  // Verify forward-looking 90-day and 180-day target dates
  assert.match(
    monitoringCode,
    /fc\.targetDate/,
    'Forecast target date must be rendered dynamically from fc.targetDate'
  );
  assert.match(
    monitoringCode,
    /fc\.forecastHorizonDays/,
    'Must display horizon days relative to origin'
  );

  // Verify P10, P50, P90 quantiles and interval width
  assert.match(monitoringCode, /p50\.toFixed\(3\)/, 'Must display P50 expected depth');
  assert.match(monitoringCode, /p10\.toFixed\(3\)/, 'Must display P10 lower bound');
  assert.match(monitoringCode, /p90\.toFixed\(3\)/, 'Must display P90 upper bound');
  assert.match(monitoringCode, /intervalWidth\.toFixed\(3\)/, 'Must display empirical interval width');

  // Verify latest observed comparison
  assert.match(
    monitoringCode,
    /latestObs\.water_level_mbgl\.toFixed\(2\)/,
    'Must display latest observed depth for comparison'
  );

  // Verify honest uncalibrated limitation notice
  assert.match(
    monitoringCode,
    /ordered_uncalibrated/,
    'Must show interval status ordered_uncalibrated'
  );
  assert.match(
    monitoringCode,
    /Intervals reflect empirical uncalibrated quantiles/,
    'Must include honest uncalibrated limitation disclaimer'
  );

  // Verify retrospective CGWB manual archive model is separated under manual mode
  assert.match(
    monitoringCode,
    /CGWB Manual Archive: Retrospective Quarterly Research Forecasts/,
    'CGWB manual archive predictions must be distinctly labeled retrospective'
  );
  assert.match(
    monitoringCode,
    /Historical Quarterly Model · 2023 Origin/,
    'CGWB manual archive must explicitly note historical quarterly 2023 origin'
  );

  // Verify duplicate panel component was removed from page
  assert.doesNotMatch(
    monitoringCode,
    /<NwdpStationForecastPanel/,
    'Duplicate NwdpStationForecastPanel component must be removed from page'
  );
});
