import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Website-wide ML: Map Explorer integrates ML groundwater depth forecast and honest unavailable states', () => {
  const explorerContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/MapExplorer.tsx'),
    'utf-8'
  );

  // 1. Must NOT import legacy contrast projections data
  assert.doesNotMatch(
    explorerContent,
    /import contrastProjectionsData from '@\/lib\/data\/contrastProjections\.json'/i,
    'MapExplorer must NOT import legacy contrastProjectionsData'
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

  // 1. Must NOT import legacy contrast projections
  assert.doesNotMatch(
    overviewContent,
    /import contrastProjectionsData from '@\/lib\/data\/contrastProjections\.json'/i,
    'Overview must NOT import legacy contrastProjectionsData'
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
  // Verify that the legacy hardcoded artifacts are completely removed
  assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/lib/data/contrastProjections.json')));
  assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/lib/data/contrastHistoricalSeries.json')));

  // Verify that active readiness ledger covers exactly 43 blocks
  const readiness = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'audit/global_model_block_readiness.json'), 'utf-8')
  );
  assert.equal(readiness.blocks.length, 43, 'Readiness ledger must cover exactly 43 canonical blocks');
  for (const block of readiness.blocks) {
    assert.equal(block.operational_eligibility, false, 'Operational eligibility must remain false');
  }
});
