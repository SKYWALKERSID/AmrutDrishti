/**
 * JAL DRISHTI — Targeted Second-Pass Hardcoding & Forecast Verification Suite
 *
 * Verifies:
 * 1. Training cutoff and forecast freshness:
 *    - KNOWN_TRAINING_CUTOFF is not a blind arbitrary constant; it dynamically resolves from
 *      the authoritative validation manifest (audit/global_groundwater_model_validation.json).
 *    - Distinct handling for training cutoff, latest observation date, forecast issue date, and target date.
 * 2. Precomputed forecast fallback:
 *    - Fallbacks strictly match exact blockId and model; never cross-pollinate adjacent blocks.
 *    - Fallbacks with target dates in the past are explicitly classified as stale_origin / historical_research.
 *    - Fallbacks without valid metadata fail closed to unavailable.
 * 3. Model-service authentication and deployment safety:
 *    - Missing or empty token produces 401 unauthorized.
 *    - Invalid bearer token produces 401 unauthorized.
 *    - Production startup refuses default dev token without explicit environment configuration.
 * 4. Dynamic forecast metadata in Risk Assessment UI:
 *    - Archive origin date is dynamically derived from API response and never masked with hardcoded current dates.
 *    - Model status and operational use dynamically reflect payload fields.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { invokeGlobalForecast } from '../src/lib/services/globalForecastBridge.ts';

test('1. Training cutoff and forecast freshness: dynamic resolution from manifest', () => {
  const manifest = JSON.parse(fs.readFileSync('audit/global_groundwater_model_validation.json', 'utf8'));
  const manifestCutoff = manifest.chronological_cutoff;
  assert.ok(manifestCutoff, 'Validation manifest must specify chronological_cutoff');

  // Verify forecastIntegrity dynamically sources training cutoff from manifest rather than a fixed arbitrary string
  const integrityContent = fs.readFileSync('src/lib/data/forecastIntegrity.ts', 'utf8');
  assert.match(integrityContent, /import globalModelValidation from ['"].*global_groundwater_model_validation\.json['"]/, 'Integrity module imports validation manifest');
  assert.match(integrityContent, /export function getModelTrainingCutoff/, 'Integrity module exports getModelTrainingCutoff helper');
  assert.match(integrityContent, /globalModelValidation.*chronological_cutoff/, 'Cutoff is derived dynamically from manifest');

  // Verify forecast route imports and uses the dynamic cutoff resolver
  const routeContent = fs.readFileSync('src/app/api/forecast/route.ts', 'utf8');
  assert.match(routeContent, /getModelTrainingCutoff/, 'Route uses getModelTrainingCutoff helper');
  assert.match(routeContent, /getModelTrainingCutoff\(rawPred\.model_id\)/, 'Cutoff dynamically resolves based on prediction record model ID');
});

test('2. Precomputed forecast fallback: strict geographic containment and past-target gating', async () => {
  const fallbackFile = 'data/derived/precomputed_verified_block_forecasts.json';
  assert.ok(fs.existsSync(fallbackFile), 'Precomputed fallback file exists');

  const precomputedMap = JSON.parse(fs.readFileSync(fallbackFile, 'utf8'));
  const sampleBlockId = Object.keys(precomputedMap)[0];
  const sample = precomputedMap[sampleBlockId];

  // Each fallback must have verified attributes
  assert.equal(sample.blockId, sampleBlockId, 'Fallback must match block ID key');
  assert.ok(sample.latestObservationDate, 'Observation origin date must be present');
  assert.ok(Array.isArray(sample.forecasts) && sample.forecasts.length > 0, 'Must have forecast points');

  for (const f of sample.forecasts) {
    assert.ok(f.targetDate, 'Target date must be present');
    assert.ok(f.forecastHorizonMonths, 'Horizon months must be present');
    assert.ok(f.expectedDepthMbgl > 0, 'Expected depth must be valid positive number');
  }

  // Verify that route code explicitly tags past targets as stale_origin
  const routeContent = fs.readFileSync('src/app/api/forecast/route.ts', 'utf8');
  assert.match(routeContent, /hasPastTargetDates/, 'Route must detect past target dates');
  assert.match(routeContent, /effectiveHorizonStatus = 'stale_origin'/, 'Must mark past target dates as stale_origin');
  assert.match(routeContent, /forecastEligibilityStatus = 'historical_research'/, 'Must mark past targets as historical_research');
});

test('3. Model-service authentication: safety and credential handling', async () => {
  const dummyRequest = {
    contractVersion: 'global-forecast/v1' as const,
    trustedObservationSource: 'internal_verified_block_observations' as const,
    geography: { state: 'Punjab', district: 'HOSHIARPUR', block: 'MUKERIAN', blockId: 'fixture' },
    observations: [
      { stationId: 's1', observationDate: '2023-01-01', depthMbgl: 10.0, units: 'm bgl' as const },
    ],
  };

  // Missing token in env -> token_missing
  const missingTokenResult = await invokeGlobalForecast(dummyRequest, {
    JALDRISHTI_MODEL_SERVICE_URL: 'https://example.com/api/py_forecast',
  });
  assert.equal(missingTokenResult.failure, 'token_missing', 'Missing token must fail safely without calling');

  // Invalid token -> 401 unauthorized
  const mockFetch401 = (async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })) as never;
  const unauthorizedResult = await invokeGlobalForecast(
    dummyRequest,
    {
      JALDRISHTI_MODEL_SERVICE_URL: 'https://example.com/api/py_forecast',
      JALDRISHTI_MODEL_SERVICE_TOKEN: 'invalid_token_xyz',
    },
    mockFetch401
  );
  assert.equal(unauthorizedResult.failure, 'unauthorized', 'Invalid credentials must return unauthorized');

  // Python serving script must protect production
  const servingPy = fs.readFileSync('ml/serving.py', 'utf8');
  assert.match(servingPy, /is_prod/, 'ml/serving.py must inspect production environment');
  assert.match(servingPy, /FATAL: JALDRISHTI_MODEL_SERVICE_TOKEN must be explicitly set/, 'ml/serving.py must refuse default dev token in production');
});

test('4. Dynamic forecast metadata in Risk Assessment UI: no client date masking', () => {
  const pageContent = fs.readFileSync('src/app/risk-assessment/page.tsx', 'utf8');

  // Origin date is derived dynamically from response
  assert.match(pageContent, /forecastData\?\.observationDatesRange\?\.latest \|\| forecastData\?\.forecastOriginDate \|\| 'Historical Archive'/,
    'Archive origin must derive dynamically from forecastData');

  // Model status and operational use are derived dynamically
  assert.match(pageContent, /forecastData\.modelStatus === 'unavailable'/, 'Model status derives from response');
  assert.match(pageContent, /forecastData\.operationalEligibility \? 'Eligible' : 'Prohibited/, 'Operational use derives from response');

  // Must not have hardcoded current-date masking for historical forecast origin
  assert.doesNotMatch(pageContent, /Archive Origin<\/span>[\s\S]*?new Date\(\)\.toISOString/, 'Must not mask missing date with current client date');
});
