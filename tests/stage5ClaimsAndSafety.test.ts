import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ALL_BLOCKS } from '../src/lib/data/bundelkhand.ts';
import { INITIAL_NOTIFICATIONS } from '../src/lib/data/alerts.ts';
import {
  summarizeBlocks,
  canDispatchAdvisory,
  canMutateDemoWorkflows,
  displayDeliveryStatus,
  buildAdvisoryMessages,
  ADVISORY_DISCLAIMER_EN,
  ADVISORY_DISCLAIMER_HI
} from '../src/lib/demo/demoPolicy.ts';

test('summarizeBlocks derives counts accurately from the fixture dataset', () => {
  const summary = summarizeBlocks(ALL_BLOCKS);
  assert.equal(summary.total, ALL_BLOCKS.length);
  assert.equal(summary.severe, ALL_BLOCKS.filter(b => b.riskSeverity === 'severe').length);
  assert.equal(summary.watch, ALL_BLOCKS.filter(b => b.riskSeverity === 'watch').length);
  assert.equal(summary.normal, ALL_BLOCKS.filter(b => b.riskSeverity === 'normal').length);

  // Severe count must reflect all severe blocks in data (5, not hard-coded 2)
  assert.equal(summary.severe, 5);
  assert.equal(summary.total, 12);
  assert.equal(summary.districtCount, 5);
});

test('canDispatchAdvisory blocks dispatch for Normal-severity blocks', () => {
  const severeBlock = ALL_BLOCKS.find(b => b.riskSeverity === 'severe')!;
  const watchBlock = ALL_BLOCKS.find(b => b.riskSeverity === 'watch')!;
  const normalBlock = ALL_BLOCKS.find(b => b.riskSeverity === 'normal')!;

  assert.equal(canDispatchAdvisory(severeBlock).allowed, true);
  assert.equal(canDispatchAdvisory(watchBlock).allowed, true);

  const normalDecision = canDispatchAdvisory(normalBlock);
  assert.equal(normalDecision.allowed, false);
  assert.match(normalDecision.reason || '', /normal/i);
});

test('buildAdvisoryMessages includes safety disclaimer and simulated prefix', () => {
  const severeBlock = ALL_BLOCKS.find(b => b.riskSeverity === 'severe')!;
  const msgs = buildAdvisoryMessages(severeBlock);

  assert.match(msgs.english, /SIMULATED - NOT SENT/);
  assert.match(msgs.hindi, /सिम्युलेटेड - भेजा नहीं गया/);
  assert.ok(msgs.english.includes(ADVISORY_DISCLAIMER_EN));
  assert.ok(msgs.hindi.includes(ADVISORY_DISCLAIMER_HI));
  assert.match(msgs.english, /fixture value/i);
});

test('initial notifications and delivery helper always return SIMULATED status', () => {
  assert.equal(displayDeliveryStatus(), 'SIMULATED');
  for (const n of INITIAL_NOTIFICATIONS) {
    assert.equal(n.deliveryStatus, 'simulated');
    assert.equal(n.confidenceScore, null, 'Initial notifications must have confidenceScore: null');
    assert.ok(n.messageEnglish.includes(ADVISORY_DISCLAIMER_EN));
  }
});

test('canMutateDemoWorkflows restricts general_public, gram_pradhan, and jal_samiti', () => {
  assert.equal(canMutateDemoWorkflows('general_public'), false);
  assert.equal(canMutateDemoWorkflows('gram_pradhan'), false);
  assert.equal(canMutateDemoWorkflows('jal_samiti'), false);

  assert.equal(canMutateDemoWorkflows('system_admin'), true);
  assert.equal(canMutateDemoWorkflows('district_collector'), true);
  assert.equal(canMutateDemoWorkflows('bdo'), true);
  assert.equal(canMutateDemoWorkflows('environment_analyst'), true);
});

test('Risk Assessment view does not claim calibration against CGWB piezometer observations', () => {
  const riskPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/risk-assessment/page.tsx'),
    'utf-8'
  );
  assert.doesNotMatch(riskPageContent, /calibrated against historical CGWB/i);
  assert.doesNotMatch(riskPageContent, /logged to audit trail/i);
  assert.doesNotMatch(riskPageContent, /10-Point Scientific Validation Checklist/i);
});

test('Alerts view explicitly states no real message is sent', () => {
  const alertsPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/alerts/page.tsx'),
    'utf-8'
  );
  assert.match(alertsPageContent, /No real SMS or WhatsApp message is sent/i);
  assert.doesNotMatch(alertsPageContent, /DELIVERED/);
  // Verify no fabricated confidence score
  assert.doesNotMatch(alertsPageContent, /confidenceScore:\s*0\.89/);
});
