import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORITATIVE_OFFICIAL_SOURCES, RETAINED_NWDP_RAW_RESOURCES } from '../src/lib/data/unifiedSourceManifest.ts';

test('retained NWDP registry exposes exactly the hashed raw resources without unit interpretation', () => {
  assert.equal(RETAINED_NWDP_RAW_RESOURCES.length, 18);
  assert.equal(new Set(RETAINED_NWDP_RAW_RESOURCES.map((item) => item.filename)).size, 18);
  for (const resource of RETAINED_NWDP_RAW_RESOURCES) {
    assert.match(resource.relative_path, /^data\/sources\/nwdp_telemetry_raw\/[^/]+\.csv$/);
    assert.match(resource.sha256, /^[a-f0-9]{64}$/);
    assert.equal(resource.data_quality_status, 'raw_integrity_valid; candidate telemetry not verified groundwater depth');
  }
});

test('UNIFIED-SOURCE-MANIFEST: contains exactly 27 approved URLs across 9 retained states', () => {
  assert.equal(AUTHORITATIVE_OFFICIAL_SOURCES.length, 27, 'Must have exactly 27 source entries');

  const expectedStates = [
    'Karnataka', 'Telangana', 'Tamil Nadu', 'Madhya Pradesh',
    'Rajasthan', 'Punjab', 'Haryana', 'Meghalaya', 'Tripura'
  ];

  for (const st of expectedStates) {
    const entries = AUTHORITATIVE_OFFICIAL_SOURCES.filter(s => s.state === st);
    assert.equal(entries.length, 3, `State ${st} must have exactly 3 entries`);

    const p2021 = entries.find(e => e.period === '2021-2025');
    const p2026 = entries.find(e => e.period === '2026-2030');
    const pCat = entries.find(e => e.period === 'state_catalogue');

    assert.ok(p2021, `${st} missing 2021-2025 entry`);
    assert.ok(p2026, `${st} missing 2026-2030 entry`);
    assert.ok(pCat, `${st} missing state_catalogue entry`);

    assert.match(p2021!.url, /^https?:\/\/nwdp\.nwic\.gov\.in/);
    assert.match(p2026!.url, /^https?:\/\/nwdp\.nwic\.gov\.in/);
    assert.match(pCat!.url, /^https?:\/\/nwdp\.nwic\.gov\.in/);

    assert.equal(p2021!.accessMethod, 'direct_csv_download');
    assert.equal(p2026!.accessMethod, 'direct_csv_download');
    assert.equal(pCat!.accessMethod, 'ckan_catalogue_metadata');
  }
});

test('UNIFIED-SOURCE-MANIFEST: excludes Assam and non-target states from active official registry', () => {
  const assamEntries = AUTHORITATIVE_OFFICIAL_SOURCES.filter(s => s.state.toLowerCase() === 'assam');
  assert.equal(assamEntries.length, 0, 'Assam must not be in the active 9-state official source manifest');
  const upEntries = AUTHORITATIVE_OFFICIAL_SOURCES.filter(s => s.state.toLowerCase() === 'uttar pradesh');
  assert.equal(upEntries.length, 0, 'Uttar Pradesh must not be in the active 9-state official source manifest');
});
