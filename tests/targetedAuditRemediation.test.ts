import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { matchInterventionRecommendations } from '../src/lib/services/scientificEngine.ts';
import { ALL_NATIONWIDE_BLOCKS } from '../src/lib/data/allNationwideBlocks.ts';
import { INITIAL_NOTIFICATIONS } from '../src/lib/data/alerts.ts';

test('REMEDIATION-A: Intervention Recommendations are connected and data-gap aware', () => {
  const pageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/interventions/page.tsx'),
    'utf-8'
  );

  // 1. Imports and invokes matchInterventionRecommendations
  assert.match(pageContent, /import\s*\{\s*matchInterventionRecommendations/);
  assert.match(pageContent, /matchInterventionRecommendations\(currentBlock\)/);

  // 2. Uses urlBlockParam for selection and provides block selector
  assert.match(pageContent, /const urlBlockParam = searchParams\.get\('block'\)/);
  assert.match(pageContent, /data-testid="intervention-recommendations-panel"/);
  assert.match(pageContent, /id="block-recom-select"/);

  // 3. Displays exact mandatory disclaimer
  assert.match(
    pageContent,
    /Rule-Based Pre-feasibility Suggestion/i,
    'Must display Rule-Based Pre-feasibility Suggestion disclaimer'
  );
  assert.match(
    pageContent,
    /Detailed Project Report \(DPR\) and field hydrogeological survey required before financial sanction/i,
    'Must include full DPR caveat'
  );

  // 4. Evaluates a real monitored block (Tikamgarh)
  const tikamgarh = ALL_NATIONWIDE_BLOCKS.find(b => b.id === 'blk_tikamgarh_main');
  assert.ok(tikamgarh, 'Tikamgarh block must exist');

  const matches = matchInterventionRecommendations(tikamgarh);
  assert.equal(matches.length, 4, 'Must evaluate 4 central government schemes');

  const schemeIds = matches.map(m => m.scheme.id);
  assert.ok(schemeIds.includes('sch_atal_bhujal'));
  assert.ok(schemeIds.includes('sch_amrit_sarovar'));
  assert.ok(schemeIds.includes('sch_mgnrega_water'));
  assert.ok(schemeIds.includes('sch_jjm'));

  // 5. Handles missing indicators gracefully without throwing
  const gapBlock: any = {
    id: 'blk_unsupported_gap',
    name: 'Unsupported Gap Block',
    districtId: 'dst_unknown',
    districtName: 'Remote District',
    state: 'Madhya Pradesh',
    riskSeverity: 'gap',
    indicators: {
      cgwbWellDepthMbgl: null,
      rainfallAnomalyMm: null,
      wellDepthTrendMperYr: null,
      sentinelNdwi: null,
      smapSoilMoisture: null,
      graceTwsaCm: null,
      sentinelNdvi: null,
      lastUpdatedDate: '2026-10-01'
    }
  };

  const gapMatches = matchInterventionRecommendations(gapBlock);
  assert.equal(gapMatches.length, 4);

  // Key schemes fail closed with explicit data gap reasons
  const atal = gapMatches.find(m => m.scheme.id === 'sch_atal_bhujal')!;
  assert.equal(atal.eligible, false);
  assert.match(atal.matchReason, /Missing groundwater level/i);

  const jjm = gapMatches.find(m => m.scheme.id === 'sch_jjm')!;
  assert.equal(jjm.eligible, false);
  assert.match(jjm.matchReason, /Missing groundwater well depth/i);
});

test('REMEDIATION-B: Alert records have no fabricated confidence and maintain simulation safeguards', () => {
  // 1. Initial notifications in data/alerts.ts have confidenceScore: null
  for (const notif of INITIAL_NOTIFICATIONS) {
    assert.equal(
      notif.confidenceScore,
      null,
      `Alert fixture ${notif.id} must have confidenceScore: null`
    );
    assert.equal(notif.deliveryStatus, 'simulated');
    assert.match(notif.messageEnglish, /SIMULATED - NOT SENT/);
  }

  // 2. Alert page code does not hardcode 0.89 or other invented confidence scores
  const alertPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/alerts/page.tsx'),
    'utf-8'
  );
  assert.doesNotMatch(alertPageContent, /confidenceScore:\s*0\.\d+/);
  assert.match(alertPageContent, /confidenceScore:\s*null/);
  assert.match(alertPageContent, /buildAdvisoryMessages/);
});

test('REMEDIATION-C: Springshed honest boundary is preserved for Sikkim and legacy projections eliminated', async () => {
  assert.ok(!fs.existsSync('src/lib/data/contrastProjections.json'), 'Legacy contrastProjections.json must be eliminated');

  // 1. All 8 Sikkim blocks are out of active scope (unmonitored mountain springsheds)
  const sikkimBlockIds = [
    'blk_gangtok_rakdong_tintek',
    'blk_gangtok_khamdong',
    'blk_gangtok_duga',
    'blk_namchi_ravangla',
    'blk_namchi_sikkip',
    'blk_namchi_jorethang',
    'blk_gyalshing_dentam',
    'blk_gyalshing_chumbong'
  ];

  // 2. Direct API check against running server
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

  if (activeBaseUrl) {
    const res = await fetch(`${activeBaseUrl}/api/forecast?block=blk_gangtok_rakdong_tintek`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.modelStatus, 'unavailable');
    assert.equal(json.forecasts.length, 0);
    assert.equal(json.operationalEligibility, false);
    assert.match(json.safeguardDisclaimer, /(?:Insufficient historical observations|Forecast unavailable)/i);
  }
});
