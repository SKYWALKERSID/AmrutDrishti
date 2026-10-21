import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Monitoring Visualizations: Chart 1 (Well Depth vs Satellite TWSA) Configuration & Integrity', () => {
  const monitoringPage = fs.readFileSync('src/app/monitoring/page.tsx', 'utf8');

  // 1. Dual Y-axes for incompatible units (m bgl vs cm)
  assert.match(
    monitoringPage,
    /yAxisId="left"[\s\S]*?orientation="left"[\s\S]*?Well Depth \(m bgl\)/,
    'Left axis must measure well depth in meters below ground level (m bgl)'
  );
  assert.match(
    monitoringPage,
    /yAxisId="right"[\s\S]*?orientation="right"[\s\S]*?GRACE TWSA \(cm\)/,
    'Right axis must measure regional GRACE terrestrial water storage anomaly in cm'
  );

  // 2. Lines correctly bound to their respective axes
  assert.match(
    monitoringPage,
    /<Line[\s\S]*?yAxisId="left"[\s\S]*?dataKey="wellDepth"[\s\S]*?Observed Well Depth \(m bgl\)/,
    'Observed well depth line must bind to left axis (m bgl)'
  );
  assert.match(
    monitoringPage,
    /<Line[\s\S]*?yAxisId="left"[\s\S]*?dataKey="modelDepth"[\s\S]*?ML Projected Depth \(m bgl\)/,
    'ML projection line must bind to left axis (m bgl)'
  );
  assert.match(
    monitoringPage,
    /<Line[\s\S]*?yAxisId="right"[\s\S]*?dataKey="graceTwsa"[\s\S]*?Regional Satellite TWSA \(cm\)/,
    'Satellite TWSA line must bind to right axis (cm)'
  );

  // 3. Date alignment of GRACE TWSA with lastUpdatedDate without synthetic dates
  assert.match(
    monitoringPage,
    /selectedBlock\.indicators\.lastUpdatedDate/,
    'Satellite TWSA must be mapped to the actual lastUpdatedDate indicator'
  );
  assert.match(
    monitoringPage,
    /existing\.graceTwsa\s*=\s*selectedBlock\.indicators\.graceTwsaCm/,
    'Satellite TWSA must align with existing timestamp if present'
  );

  // 4. Uncertainty interval lines (P10 & P90)
  assert.match(monitoringPage, /dataKey="lowerBoundP10"/, 'Chart must support P10 lower bound');
  assert.match(monitoringPage, /dataKey="upperBoundP90"/, 'Chart must support P90 upper bound');

  // 5. Scientific disclaimer: Coarse satellite resolution (~100 km) vs localized well depth
  assert.match(
    monitoringPage,
    /GRACE-FO TWSA represents coarse regional water-storage mass changes \(~100 km grid\)/,
    'Must explicitly state GRACE ~100 km grid resolution'
  );
  assert.match(
    monitoringPage,
    /not a direct localized measurement of individual village wells/,
    'Must explicitly state satellite anomalies are not direct well measurements'
  );

  // 6. Honest empty state
  assert.match(
    monitoringPage,
    /No Published Observations Available/,
    'Must display honest empty state when observation series is unpopulated'
  );
});

test('Monitoring Visualizations: Chart 2 (Seasonal Monsoon Rainfall & Deviation) Configuration & Integrity', async () => {
  const monitoringPage = fs.readFileSync('src/app/monitoring/page.tsx', 'utf8');

  // 1. ComposedChart with dual axes (Rainfall Total mm and Deviation mm)
  assert.match(monitoringPage, /<ComposedChart/, 'Must render ComposedChart for rainfall');
  assert.match(
    monitoringPage,
    /yAxisId="left"[\s\S]*?Rainfall \(mm\)/,
    'Left axis must display rainfall in mm'
  );
  assert.match(
    monitoringPage,
    /yAxisId="right"[\s\S]*?Deviation \(mm\)/,
    'Right axis must display deviation in mm'
  );

  // 2. ReferenceLine at zero for deviation
  assert.match(
    monitoringPage,
    /<ReferenceLine\s+yAxisId="right"\s+y=\{0\}/,
    'Must render reference line at y=0 on right axis'
  );

  // 3. Observed total, 30-year normal LPA, and deviation bars
  assert.match(
    monitoringPage,
    /<Bar[\s\S]*?yAxisId="left"[\s\S]*?dataKey="observedMm"[\s\S]*?Observed Monsoon Total \(mm\)/,
    'Must display observed total bar on left axis'
  );
  assert.match(
    monitoringPage,
    /<Bar[\s\S]*?yAxisId="left"[\s\S]*?dataKey="normalLpaMm"[\s\S]*?30-Yr Normal LPA \(mm\)/,
    'Must display 30-yr LPA bar on left axis'
  );
  assert.match(
    monitoringPage,
    /<Bar[\s\S]*?yAxisId="right"[\s\S]*?dataKey="deviationMm"[\s\S]*?Deviation from LPA \(mm\)/,
    'Must display deviation bar on right axis'
  );

  // 4. Color-coded deviation: deficit (< 0) receives error token, surplus (>= 0) receives success token
  assert.match(
    monitoringPage,
    /fill=\{deviationColor\(rainfallChartData\[0\]\.deviationMm\)\}/,
    'Deviation bar must call deviationColor with observed deviation'
  );
  assert.match(
    monitoringPage,
    /import\s*\{[^}]*deviationColor[^}]*\}\s*from\s*['"]@\/lib\/design\/chartPalette['"]/,
    'Monitoring page must import deviationColor from centralized chartPalette'
  );

  // Behavioral test for deviationColor logic
  const { deviationColor, CHART_COLORS } = await import('../src/lib/design/chartPalette.ts');
  assert.equal(
    deviationColor(-15),
    CHART_COLORS.deviationDeficit,
    'Negative deviation (deficit) must map to deficit semantic token'
  );
  assert.equal(
    deviationColor(0),
    CHART_COLORS.deviationSurplus,
    'Zero deviation must map to surplus semantic token'
  );
  assert.equal(
    deviationColor(42),
    CHART_COLORS.deviationSurplus,
    'Positive deviation (surplus) must map to surplus semantic token'
  );

  // 5. State-specific 30-year Long Period Average (LPA, 1991–2020) baselines
  assert.match(monitoringPage, /lpaByState/, 'Must contain state-specific LPA lookup table');
  assert.match(monitoringPage, /'Punjab':\s*480/, 'Must specify Punjab LPA ~480 mm');
  assert.match(monitoringPage, /'Rajasthan':\s*420/, 'Must specify Rajasthan LPA ~420 mm');
  assert.match(monitoringPage, /'Madhya Pradesh':\s*850/, 'Must specify MP LPA ~850 mm');
  assert.match(monitoringPage, /'Karnataka':\s*860/, 'Must specify Karnataka LPA ~860 mm');

  // 6. Fail-closed empty state when rainfall anomaly is missing/null
  assert.match(
    monitoringPage,
    /selectedBlock\.indicators\.rainfallAnomalyMm\s*===\s*null/,
    'Must check for null rainfallAnomalyMm'
  );
  assert.match(
    monitoringPage,
    /No Published IMD Gridded Rainfall Records Available/,
    'Must show honest empty state when gridded rainfall records are unpopulated'
  );

  // 7. No fabricated fallback data
  assert.doesNotMatch(monitoringPage, /const\s+HISTORICAL_TIMESERIES/);
  assert.doesNotMatch(monitoringPage, /rainfall:\s*\[\s*120,\s*140/);
});
