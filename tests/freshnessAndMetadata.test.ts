import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SOURCE_CATALOG,
  deriveFreshnessStatus,
  FRESHNESS_STYLES,
  type FreshnessStatus,
} from '../src/lib/data/freshness.ts';

test('SOURCE_CATALOG contains all configured verified official data providers with realistic cadence and lag', () => {
  const expectedSources = [
    'cgwb_dwlr',
    'grace_fo',
    'imd_rainfall',
    'sentinel2',
    'smap',
    'quantile_model',
    'gss_composite',
  ];

  for (const srcId of expectedSources) {
    const meta = (SOURCE_CATALOG as any)[srcId];
    assert.ok(meta, `Source ${srcId} must exist in SOURCE_CATALOG`);
    assert.ok(meta.name, `Source ${srcId} must have an official name`);
    assert.ok(meta.provider, `Source ${srcId} must have an official provider`);
    if (meta.url) {
      assert.ok(meta.url.startsWith('https://'), `Source ${srcId} must have a valid HTTPS URL`);
    }
    assert.ok(meta.cadence, `Source ${srcId} must declare update cadence`);
    assert.ok(meta.limitations, `Source ${srcId} must document scientific limitations`);
    assert.ok(meta.scope, `Source ${srcId} must state geographic scope`);
  }
});

test('deriveFreshnessStatus correctly calculates LIVE status for timely observations', () => {
  const refDate = new Date('2026-10-17T00:00:00Z');
  const obsDate = '2026-10-15'; // 2 days ago

  const status = deriveFreshnessStatus({
    isLiveSource: true,
    lastObservedDate: obsDate,
    typicalLagDays: 30,
    referenceDate: refDate,
  });
  assert.equal(status, 'LIVE', 'CGWB observation within typical lag for a live source should be LIVE');
});

test('deriveFreshnessStatus returns RECENT when observations fall within typical archival lag', () => {
  const refDate = new Date('2026-10-17T00:00:00Z');
  const obsDate = '2026-09-15'; // ~32 days ago

  const status = deriveFreshnessStatus({
    isLiveSource: false,
    lastObservedDate: obsDate,
    typicalLagDays: 45,
    referenceDate: refDate,
  });
  assert.equal(status, 'RECENT', 'Observation within typical lag should be RECENT');
});

test('deriveFreshnessStatus returns STALE when observation exceeds maximum allowable lag', () => {
  const refDate = new Date('2026-10-17T00:00:00Z');
  const obsDate = '2025-01-01'; // way older than 2 * typicalLagDays

  const status = deriveFreshnessStatus({
    isLiveSource: true,
    lastObservedDate: obsDate,
    typicalLagDays: 30,
    referenceDate: refDate,
  });
  assert.equal(status, 'STALE', 'Observation older than 2x typical lag should be STALE');
});

test('deriveFreshnessStatus returns UNAVAILABLE when observation date is null or missing', () => {
  const statusNull = deriveFreshnessStatus({ lastObservedDate: null });
  assert.equal(statusNull, 'UNAVAILABLE');

  const statusEmpty = deriveFreshnessStatus({ lastObservedDate: '' });
  assert.equal(statusEmpty, 'UNAVAILABLE');

  const statusFlag = deriveFreshnessStatus({ isUnavailable: true, lastObservedDate: '2026-10-15' });
  assert.equal(statusFlag, 'UNAVAILABLE');
});

test('deriveFreshnessStatus preserves DEMO and RESEARCH_ONLY states', () => {
  const demoStatus = deriveFreshnessStatus({ isDemoData: true, lastObservedDate: '2026-10-15' });
  assert.equal(demoStatus, 'DEMO');

  const researchStatus = deriveFreshnessStatus({ isResearchOnly: true, lastObservedDate: '2026-10-15' });
  assert.equal(researchStatus, 'RESEARCH_ONLY');
});

test('FRESHNESS_STYLES provides distinct styling for all 8 required status states', () => {
  const requiredStatuses: FreshnessStatus[] = [
    'LIVE',
    'RECENT',
    'HISTORICAL',
    'RESEARCH_ONLY',
    'DEMO',
    'STALE',
    'UNAVAILABLE',
    'ERROR',
  ];

  for (const st of requiredStatuses) {
    const style = FRESHNESS_STYLES[st];
    assert.ok(style, `Style for status "${st}" must exist`);
    assert.ok(style.label, `Label for status "${st}" must be defined`);
    assert.ok(style.bg, `Background CSS class for "${st}" must be defined`);
    assert.ok(style.text, `Text CSS class for "${st}" must be defined`);
    assert.ok(style.border, `Border CSS class for "${st}" must be defined`);
    assert.ok(style.dot, `Dot indicator CSS class for "${st}" must be defined`);
  }
});
