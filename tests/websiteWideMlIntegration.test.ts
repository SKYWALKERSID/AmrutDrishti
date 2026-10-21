import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Website-wide ML: Map Explorer integrates ML groundwater depth forecast and honest unavailable states', () => {
  const explorerContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/MapExplorer.tsx'),
    'utf-8'
  );

  // 1. Imports verified contrast projections data
  assert.match(
    explorerContent,
    /import contrastProjectionsData from '@\/lib\/data\/contrastProjections\.json'/i,
    'MapExplorer must import contrastProjectionsData'
  );

  // 2. Contains dedicated ML Depth Forecast section with QuantileGB-v2.0 label
  assert.match(
    explorerContent,
    /ML Depth Forecast \(Q1\):/i,
    'MapExplorer sidebar must have an ML Depth Forecast (Q1) section'
  );
  assert.match(
    explorerContent,
    /QuantileGB-v2\.0/i,
    'MapExplorer must identify the ML model as QuantileGB-v2.0'
  );

  // 3. Displays target as physical water depth in m bgl
  assert.match(
    explorerContent,
    /Target \(Water Depth\):/i,
    'MapExplorer must clearly state target is physical water depth'
  );
  assert.match(
    explorerContent,
    /m bgl/i,
    'Units must be m bgl'
  );

  // 4. Displays P10-P90 uncertainty intervals
  assert.match(
    explorerContent,
    /P10–P90 Uncertainty:/i,
    'Must display P10-P90 uncertainty bounds'
  );

  // 5. Handles unsupported geography with an explicit unavailable state
  assert.match(
    explorerContent,
    /Forecast Model: Unavailable for this geography \(Historical telemetry only\)/i,
    'Must show honest unavailable state for unmodeled geography'
  );

  // 6. Includes a link to full multi-horizon monitoring
  assert.match(
    explorerContent,
    /\/monitoring\?block=\$\{selectedBlock\.id\}/i,
    'Must provide a direct link to multi-horizon monitoring for the selected block'
  );
});

test('Website-wide ML: Overview page integrates ML forecast column alongside observed telemetry without replacement', () => {
  const overviewContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/overview/page.tsx'),
    'utf-8'
  );

  // 1. Imports contrast projections
  assert.match(
    overviewContent,
    /import contrastProjectionsData from '@\/lib\/data\/contrastProjections\.json'/i,
    'Overview must import contrastProjectionsData'
  );

  // 2. Contains distinct column headers for Observed Well Depth and Projected Depth Q1
  assert.match(
    overviewContent,
    /<th[^>]*>[\s\S]*?Well Depth \(m bgl\)[\s\S]*?<\/th>/i,
    'Must have a dedicated column for observed Well Depth (m bgl)'
  );
  assert.match(
    overviewContent,
    /<th[^>]*>[\s\S]*?(Projected Depth Q1|ML Forecast Q1) \(m bgl\)[\s\S]*?<\/th>/i,
    'Must have a dedicated column for Projected Depth Q1 (m bgl)'
  );
  assert.match(
    overviewContent,
    /<th[^>]*>[\s\S]*?Descriptive GSS[\s\S]*?<\/th>/i,
    'Must preserve Descriptive GSS column clearly identified as non-ML'
  );

  // 3. Explains data provenance in directory header subtitle
  assert.match(
    overviewContent,
    /Displays verified CGWB\/NWIC observed telemetry, descriptive GSS heuristic baseline, and QuantileGB-v2\.0 statistical (groundwater depth forecasts|forecasts or empirical projections) where available/i,
    'Directory header must explain observed telemetry vs GSS heuristic vs QuantileGB-v2.0 statistical forecast or empirical projection'
  );

  // 4. Displays honest fallback dash for unmodeled blocks
  assert.match(
    overviewContent,
    /Model unavailable for this block geography/i,
    'Must have tooltip/state explaining model unavailability'
  );
});

test('Website-wide ML: Risk Assessment page connects to live forecast API and preserves heuristic GSS separation', () => {
  const riskPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/risk-assessment/page.tsx'),
    'utf-8'
  );

  // 1. GSS is documented as descriptive heuristic
  assert.match(
    riskPageContent,
    /Descriptive (Heuristic Baseline|Stress Score \(GSS Baseline\))/i,
    'Risk page must label GSS as descriptive heuristic baseline'
  );

  // 2. ML forecast is fetched from /api/forecast
  assert.match(
    riskPageContent,
    /\/api\/forecast\?block=/i,
    'Risk page must query /api/forecast'
  );

  // 3. Target is physical depth in m bgl, not composite GSS
  assert.match(
    riskPageContent,
    /Target: Depth \(m bgl\)/i,
    'ML target must be physical depth'
  );
  assert.match(
    riskPageContent,
    /does NOT predict a composite stress index/i,
    'Must explicitly state ML does not predict composite GSS'
  );
});

test('Website-wide ML: Data integrity and safety across all modules', () => {
  // Check contrast projections structure
  const contrastProjections = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'src/lib/data/contrastProjections.json'),
      'utf-8'
    )
  );

  const blockKeys = Object.keys(contrastProjections);
  assert.ok(blockKeys.length >= 60, 'Must have at least 60 nationwide blocks covered');

  // Verify that unavailable blocks have modelStatus === "unavailable" and empty forecasts
  const unavailKeys = blockKeys.filter(
    (k) => contrastProjections[k].modelStatus === 'unavailable'
  );
  assert.ok(unavailKeys.length > 0, 'Must have explicitly identified unavailable blocks');

  for (const k of unavailKeys) {
    const entry = contrastProjections[k];
    assert.equal(entry.forecasts.length, 0, `Unavailable block ${k} must not have fabricated forecast points`);
    assert.equal(entry.operationalEligibility, false, `Unavailable block ${k} must not be operationally eligible`);
  }

  // Verify that available blocks have properly ordered quantiles
  const availKeys = blockKeys.filter(
    (k) => contrastProjections[k].modelStatus !== 'unavailable'
  );
  assert.ok(availKeys.length > 0, 'Must have available modeled blocks');

  for (const k of availKeys) {
    const entry = contrastProjections[k];
    assert.equal(entry.operationalEligibility, false, 'Research models must not claim operational eligibility');
    for (const f of entry.forecasts) {
      assert.equal(f.units, 'm bgl', 'Forecast units must be m bgl');
      if (
        f.uncertaintyInterval?.lowerBoundP10Mbgl !== null &&
        f.uncertaintyInterval?.upperBoundP90Mbgl !== null
      ) {
        assert.ok(
          f.uncertaintyInterval.lowerBoundP10Mbgl <= f.uncertaintyInterval.upperBoundP90Mbgl,
          `Lower bound P10 (${f.uncertaintyInterval.lowerBoundP10Mbgl}) must be <= Upper bound P90 (${f.uncertaintyInterval.upperBoundP90Mbgl}) in block ${k}`
        );
      }
    }
  }
});
