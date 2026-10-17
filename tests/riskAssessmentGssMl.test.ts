import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { calculateDescriptiveGss } from '../src/lib/services/scientificEngine.ts';
import { ALL_NATIONWIDE_BLOCKS } from '../src/lib/data/allNationwideBlocks.ts';

test('Risk & Scoring: UI explicitly distinguishes descriptive heuristic GSS baseline from ML physical forecast', () => {
  const riskPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/risk-assessment/page.tsx'),
    'utf-8'
  );

  // 1. Clearly designates GSS as a descriptive heuristic / baseline index, NOT an ML prediction
  assert.match(
    riskPageContent,
    /Descriptive (Heuristic Baseline|Stress Score \(GSS Baseline)/i,
    'Must explicitly state GSS is a descriptive heuristic baseline'
  );
  assert.match(
    riskPageContent,
    /Not an ML model prediction|not a trained ML result/i,
    'Must state GSS is not an ML model prediction'
  );

  // 2. Clearly identifies the ML model target as physical water table depth (m bgl)
  assert.match(
    riskPageContent,
    /Target: Depth \(m bgl\)|physical water table depth below ground level \(m bgl\)/i,
    'Must state ML predicts physical water level depth in m bgl'
  );
  assert.match(
    riskPageContent,
    /does NOT predict a composite stress index|does not predict a composite stress score/i,
    'Must clarify that ML does NOT predict composite GSS scores'
  );

  // 3. Connects live to /api/forecast endpoint
  assert.match(
    riskPageContent,
    /\/api\/forecast\?block=/i,
    'Must fetch predictions from the verified /api/forecast endpoint'
  );
});

test('Risk & Scoring: No misleading calibration claims or fabricated confidence ranges for GSS', () => {
  const riskPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/risk-assessment/page.tsx'),
    'utf-8'
  );

  // Must not claim calibration against CGWB well observations for GSS
  assert.doesNotMatch(riskPageContent, /calibrated against historical CGWB/i);
  assert.doesNotMatch(riskPageContent, /logged to audit trail/i);
  assert.doesNotMatch(riskPageContent, /10-Point Scientific Validation Checklist/i);

  // Confidence interval must explicitly acknowledge uncalibrated state
  assert.match(
    riskPageContent,
    /Uncalibrated descriptive index|Statistical confidence interval/i,
    'Must acknowledge GSS lacks statistical confidence interval without physical well calibration'
  );
});

test('Risk & Scoring: Four-indicator multi-criteria breakdown is preserved with exact weights', () => {
  const riskPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/risk-assessment/page.tsx'),
    'utf-8'
  );

  // All 4 environmental indicators and their canonical weights
  assert.match(riskPageContent, /CGWB Well Water Depth/);
  assert.match(riskPageContent, /35%/);

  assert.match(riskPageContent, /Monsoon Rainfall Deficit/);
  assert.match(riskPageContent, /30%/);

  assert.match(riskPageContent, /Satellite Water Storage \(GRACE-FO\)/);
  assert.match(riskPageContent, /20%/);

  assert.match(riskPageContent, /Vegetation Health \(NDVI\)/);
  assert.match(riskPageContent, /15%/);
});

test('Risk & Scoring: Unsupported geography renders honest unavailable state without fallback to hardcoded score', () => {
  const riskPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/risk-assessment/page.tsx'),
    'utf-8'
  );

  // Unavailable state messaging
  assert.match(
    riskPageContent,
    /ML Depth Forecast Unavailable for this Geography/i,
    'Must render honest unavailable card when ML is not packaged for block'
  );
  assert.match(
    riskPageContent,
    /predictions are not extrapolated to uncalibrated regions|predictions are never extrapolated/i,
    'Must affirm that predictions are not extrapolated to uncalibrated regions'
  );

  // Must not contain hardcoded 49/100 fallback in code
  assert.doesNotMatch(
    riskPageContent,
    /49\s*\/\s*100/,
    'Must not hardcode 49/100 score in component'
  );
});

test('Risk & Scoring: Scientific GSS engine handles missing observations with honest data gap', () => {
  // Test missing data behavior
  const missingResult = calculateDescriptiveGss({
    cgwbWellDepthMbgl: null,
    rainfallAnomalyMm: null,
    graceTwsaCm: null,
    sentinelNdvi: null,
  });

  assert.equal(missingResult.isDataGap, true);
  assert.equal(missingResult.score, null);
  assert.equal(missingResult.severity, 'gap');
  assert.equal(missingResult.confidenceInterval, null);
  assert.match(missingResult.primaryStressDriver, /Data Gap/i);

  // Stale/partial data does not zero out missing signals
  const partialResult = calculateDescriptiveGss({
    cgwbWellDepthMbgl: 18.5,
    rainfallAnomalyMm: null,
    graceTwsaCm: null,
    sentinelNdvi: null,
  });

  assert.equal(partialResult.isDataGap, false);
  assert.ok(partialResult.score! > 0);
  assert.equal(partialResult.normalizationBreakdown.rainDeficitNorm, null);
  assert.ok(partialResult.normalizationBreakdown.wellDepthNorm !== null);
});

test('Risk & Scoring: ML manifest confirms target is water level depth and operational eligibility is false', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'ml/artifacts/manifest.json'), 'utf-8')
  );

  assert.equal(
    manifest.operational_eligibility,
    false,
    'ML models in manifest must have operational_eligibility = false'
  );

  const supportedStates = ['Punjab', 'Haryana', 'Rajasthan', 'Assam', 'Arunachal Pradesh'];
  for (const st of supportedStates) {
    const modelMeta = manifest.models[st];
    assert.ok(modelMeta, `Model metadata for ${st} must exist in manifest`);
    assert.deepEqual(
      modelMeta.features,
      ['wl_origin', 'wl_prev', 'wl_year_before_target', 'drawdown_velocity_q1', 'season_code'],
      `${st} model features must be station water levels and season code`
    );
  }
});
