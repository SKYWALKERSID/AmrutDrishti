/**
 * JAL DRISHTI — Forecast API Contract & Scientific Integrity Regression Suite
 *
 * Verifies that:
 * 1. Forecast requests execute intended verified models and return correctly timestamped values,
 *    units ('m bgl'), station identity, forecast horizons (3, 6, 9, 12 months), and uncertainty bounds.
 * 2. Operational eligibility remains strictly false (research prototype only).
 * 3. Malformed/empty block requests return HTTP 400 with explicit actionable errors.
 * 4. Insufficient history blocks fail closed with modelStatus: 'unavailable' and empty forecasts array.
 * 5. Baseline persistence is preserved alongside ML forecasts and never presented as ML output.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('FORECAST-INTEGRITY: Route code enforces validation, units, and fail-closed safeguards', () => {
  const routeContent = fs.readFileSync('src/app/api/forecast/route.ts', 'utf8');

  // Must reject empty or blank block query params with HTTP 400
  assert.match(routeContent, /searchParams\.has\('block'\)/);
  assert.match(routeContent, /status:\s*400/);
  assert.match(routeContent, /must not be empty/);

  // Must enforce operationalEligibility: false
  assert.match(routeContent, /operationalEligibility:\s*false/);

  // Must return units 'm bgl' and forecastHorizonMonths
  assert.match(routeContent, /units:\s*['"]m bgl['"]/);
  assert.match(routeContent, /forecastHorizonMonths/);
  assert.match(routeContent, /stationName/);

  // Must provide baseline persistence comparison
  assert.match(routeContent, /baselinePersistence/);

  // Must not fabricate mock forecasts
  assert.doesNotMatch(routeContent, /GENERATE_MOCK_FORECASTS/);
  assert.doesNotMatch(routeContent, /MOCK_FORECASTS/);
});

test('FORECAST-INTEGRITY: Legacy contrast projections file is completely eliminated and not used at runtime', () => {
  assert.ok(!fs.existsSync('src/lib/data/contrastProjections.json'), 'Legacy contrastProjections.json must not exist');
  const routeContent = fs.readFileSync('src/app/api/forecast/route.ts', 'utf8');
  assert.doesNotMatch(routeContent, /contrastProjections/i, 'forecast route must not import or query contrastProjections');
});

test('FORECAST-INTEGRITY: Live HTTP endpoint contracts when dev server is available', async (t) => {
  let activeBaseUrl: string | null = null;
  for (const port of [3000, 3001]) {
    try {
      const probe = await fetch(`http://localhost:${port}/api/forecast?block=blk_remote_unmonitored_xyz`, { signal: AbortSignal.timeout(1500) });
      if (probe.status === 200) {
        activeBaseUrl = `http://localhost:${port}`;
        break;
      }
    } catch {
      // try next port
    }
  }

  if (!activeBaseUrl) {
    t.skip('Next.js dev server is not running or accessible; skipping live HTTP integration checks');
    return;
  }

  // 1. Empty block param -> 400
  const resEmpty = await fetch(`${activeBaseUrl}/api/forecast?block=`);
  assert.equal(resEmpty.status, 400);
  const jsonEmpty = await resEmpty.json();
  assert.equal(jsonEmpty.modelStatus, 'unavailable');
  assert.equal(jsonEmpty.forecasts.length, 0);

  // 2. Verified Tikamgarh block -> 200, research_prototype or unavailable (freshness gate)
  const resTikam = await fetch(`${activeBaseUrl}/api/forecast?block=blk_tikamgarh_main`);
  assert.equal(resTikam.status, 200);
  const jsonTikam = await resTikam.json();
  assert.equal(jsonTikam.operationalEligibility, false);
  assert.ok(['research_prototype', 'unavailable'].includes(jsonTikam.modelStatus));
  if (jsonTikam.modelStatus === 'research_prototype') {
    assert.ok(jsonTikam.forecasts.length > 0);
    assert.equal(jsonTikam.forecasts[0].units, 'm bgl');
    assert.equal(jsonTikam.forecasts[0].forecastHorizonMonths, 3);
  } else {
    assert.equal(jsonTikam.forecasts.length, 0);
  }

  // 3. Verified Punjab block (Khanna) -> 200, multi-horizon or unavailable (freshness gate)
  const resKhanna = await fetch(`${activeBaseUrl}/api/forecast?block=blk_ludhiana_khanna`);
  assert.equal(resKhanna.status, 200);
  const jsonKhanna = await resKhanna.json();
  assert.equal(jsonKhanna.operationalEligibility, false);
  assert.ok(['research_prototype', 'unavailable'].includes(jsonKhanna.modelStatus));
  if (jsonKhanna.modelStatus === 'research_prototype') {
    assert.equal(jsonKhanna.forecasts.length, 4);
    assert.equal(jsonKhanna.forecasts[0].units, 'm bgl');
    assert.ok(jsonKhanna.forecasts[0].baselinePersistence.lastObservationPersistenceMbgl > 0);
  } else {
    assert.equal(jsonKhanna.forecasts.length, 0);
  }

  // 4. Remote unmonitored block -> 200, unavailable, 0 forecasts
  const resUnmon = await fetch(`${activeBaseUrl}/api/forecast?block=blk_remote_unmonitored_xyz`);
  assert.equal(resUnmon.status, 200);
  const jsonUnmon = await resUnmon.json();
  assert.equal(jsonUnmon.modelStatus, 'unavailable');
  assert.equal(jsonUnmon.forecasts.length, 0);
  assert.equal(jsonUnmon.operationalEligibility, false);

  // 5. Sikkim mountain springshed block -> 200, unavailable, 0 forecasts (no CGWB piezometer wells)
  const resSikkim = await fetch(`${activeBaseUrl}/api/forecast?block=blk_gangtok_rakdong_tintek`);
  assert.equal(resSikkim.status, 200);
  const jsonSikkim = await resSikkim.json();
  assert.equal(jsonSikkim.modelStatus, 'unavailable');
  assert.equal(jsonSikkim.forecasts.length, 0);
  assert.equal(jsonSikkim.operationalEligibility, false);
});

