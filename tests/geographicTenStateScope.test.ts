import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ALL_TARGET_STATES,
  HISTORICAL_REFERENCE_STATES,
  isTargetState,
  TARGET_REGIONS
} from '../src/lib/data/indiaStates.ts';
import {
  ACTIVE_TARGET_DISTRICTS,
  ACTIVE_TARGET_BLOCKS,
  ALL_NATIONWIDE_DISTRICTS,
  ALL_NATIONWIDE_BLOCKS,
  HISTORICAL_REFERENCE_DISTRICTS,
  HISTORICAL_REFERENCE_BLOCKS
} from '../src/lib/data/allNationwideBlocks.ts';

test('Nine State Active Scope: Exactly 9 Active Target States across 4 geographic regions (Assam moved to historical reference)', () => {
  assert.equal(ALL_TARGET_STATES.length, 9, 'Must have exactly 9 active target states');

  const activeNames = ALL_TARGET_STATES.map(s => s.name);

  // South (3)
  assert.ok(activeNames.includes('Karnataka'), 'Karnataka in active target states');
  assert.ok(activeNames.includes('Telangana'), 'Telangana in active target states');
  assert.ok(activeNames.includes('Tamil Nadu'), 'Tamil Nadu in active target states');

  // Central (1)
  assert.ok(activeNames.includes('Madhya Pradesh'), 'Madhya Pradesh in active target states');

  // North (3)
  assert.ok(activeNames.includes('Rajasthan'), 'Rajasthan in active target states');
  assert.ok(activeNames.includes('Haryana'), 'Haryana in active target states');
  assert.ok(activeNames.includes('Punjab'), 'Punjab in active target states');

  // Northeast (2 active: Meghalaya, Tripura; Assam moved to historical reference)
  assert.ok(activeNames.includes('Meghalaya'), 'Meghalaya in active target states');
  assert.ok(activeNames.includes('Tripura'), 'Tripura in active target states');
  assert.ok(!activeNames.includes('Assam'), 'Assam must NOT be in active target states');

  // Check regions
  const regions = [...new Set(ALL_TARGET_STATES.map(s => s.region))];
  assert.equal(regions.length, 4, 'Must span exactly 4 regions');
  assert.deepEqual(TARGET_REGIONS, ['South India', 'Central India', 'North India', 'Northeast India']);
});

test('Scope Safeguards: Out-of-scope and historical states are strictly identified and excluded from active scope', () => {
  const outOfScopeNames = ['Assam', 'Uttar Pradesh', 'Sikkim', 'Arunachal Pradesh'];

  for (const name of outOfScopeNames) {
    assert.equal(isTargetState(name), false, `${name} must not be an active target state`);
    assert.ok(
      !ALL_TARGET_STATES.some(s => s.name === name),
      `${name} must not be in ALL_TARGET_STATES`
    );
  }

  // Verify historical reference states
  const refNames = HISTORICAL_REFERENCE_STATES.map(s => s.name);
  assert.ok(refNames.includes('Assam'));
  assert.ok(refNames.includes('Uttar Pradesh'));
  assert.ok(refNames.includes('Sikkim'));
  assert.ok(refNames.includes('Arunachal Pradesh'));
  assert.equal(HISTORICAL_REFERENCE_STATES.every(s => s.isTargetScope === false), true);
});

test('Geographic Hierarchy: Active scope totals exactly 28 districts and 43 blocks', () => {
  assert.equal(ACTIVE_TARGET_DISTRICTS.length, 28, 'Must have exactly 28 monitored active districts');
  assert.equal(ACTIVE_TARGET_BLOCKS.length, 43, 'Must have exactly 43 monitored active blocks');

  // Ensure every active district and block belongs to one of the 9 active target states
  for (const dist of ACTIVE_TARGET_DISTRICTS) {
    assert.ok(isTargetState(dist.state), `District ${dist.name} (${dist.state}) must belong to an active target state`);
    assert.ok(dist.blocks.length > 0, `District ${dist.name} must have at least one monitored block`);
  }

  for (const blk of ACTIVE_TARGET_BLOCKS) {
    assert.ok(isTargetState(blk.state), `Block ${blk.name} (${blk.state}) must belong to an active target state`);
    assert.ok(blk.districtName, `Block ${blk.name} must have a districtName`);
    assert.ok(blk.districtId, `Block ${blk.name} must have a districtId`);
  }

  // Ensure excluded blocks are strictly absent from active scope
  const activeBlockIds = new Set(ACTIVE_TARGET_BLOCKS.map(b => b.id));
  assert.ok(!activeBlockIds.has('blk_mahendragarh_narnaul'), 'Narnaul must be absent from active blocks');
  assert.ok(!activeBlockIds.has('blk_dhalai_salema'), 'Salema must be absent from active blocks');
  const assamBlocks = ACTIVE_TARGET_BLOCKS.filter(b => b.state === 'Assam');
  assert.equal(assamBlocks.length, 0, 'No Assam block may appear in active blocks');

  // Breakdown by state verification
  const blocksByState = ACTIVE_TARGET_BLOCKS.reduce((acc, b) => {
    acc[b.state] = (acc[b.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  assert.equal(blocksByState['Madhya Pradesh'], 9);
  assert.equal(blocksByState['Punjab'], 4);
  assert.equal(blocksByState['Rajasthan'], 13);
  assert.equal(blocksByState['Haryana'], 3);
  assert.equal(blocksByState['Karnataka'], 3);
  assert.equal(blocksByState['Telangana'], 3);
  assert.equal(blocksByState['Tamil Nadu'], 3);
  assert.equal(blocksByState['Meghalaya'], 3);
  assert.equal(blocksByState['Tripura'], 2);
  assert.equal(blocksByState['Assam'] || 0, 0);
});

test('Parent-Child Relationships: Every active block maps to an active district in the same state', () => {
  const districtMap = new Map(ACTIVE_TARGET_DISTRICTS.map(d => [d.id, d]));

  for (const blk of ACTIVE_TARGET_BLOCKS) {
    const parentDist = districtMap.get(blk.districtId);
    assert.ok(parentDist, `Block ${blk.id} (${blk.name}) must have parent district in ACTIVE_TARGET_DISTRICTS`);
    assert.equal(parentDist.state, blk.state, `Block ${blk.name} state (${blk.state}) must match parent district state (${parentDist.state})`);
    assert.equal(parentDist.name, blk.districtName, `Block districtName (${blk.districtName}) must match parent district name (${parentDist.name})`);
  }
});

test('Graph Integrity: All 43 active canonical blocks have valid data structures for monitoring graphs', () => {
  for (const blk of ACTIVE_TARGET_BLOCKS) {
    // Graph 1: Well depth (direct observation or telemetry)
    assert.ok(blk.indicators, `Block ${blk.id} must have indicators object`);
    assert.ok(
      blk.indicators.cgwbWellDepthMbgl !== undefined,
      `Block ${blk.id} must define cgwbWellDepthMbgl (even if null for genuine data gaps)`
    );

    // Graph 1 Satellite: GRACE TWSA
    assert.ok(
      blk.indicators.graceTwsaCm !== undefined,
      `Block ${blk.id} must define graceTwsaCm (even if null for genuine data gaps)`
    );

    // Graph 2: Rainfall anomaly and IMD baseline
    assert.ok(
      blk.indicators.rainfallAnomalyMm !== undefined,
      `Block ${blk.id} must define rainfallAnomalyMm`
    );

    // Verify coordinates for GIS Map
    assert.ok(Array.isArray(blk.coordinates), `Block ${blk.id} must have coordinates array`);
    assert.equal(blk.coordinates.length, 2, `Block ${blk.id} must have [lat, lon]`);
    const [lat, lon] = blk.coordinates;
    assert.ok(lat >= 6 && lat <= 38, `Block ${blk.id} latitude ${lat} must be within India bounds`);
    assert.ok(lon >= 68 && lon <= 98, `Block ${blk.id} longitude ${lon} must be within India bounds`);
  }
});

test('Active scope copy consistently describes nine approved states and excludes Assam from active coverage', () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const footer = read('src/components/Footer.tsx');
  const overview = read('src/app/page.tsx');
  const interventions = read('src/app/interventions/page.tsx');
  const risk = read('src/app/risk-assessment/page.tsx');

  const translations = read('src/lib/data/translations.ts');
  const footerAndTranslations = footer + translations;

  assert.match(footerAndTranslations, /KA, TG, TN, MP, RJ, HR, PB, ML, TR \(9 States/);
  assert.match(footerAndTranslations, /9 approved states/);
  assert.doesNotMatch(footer, /across 10 priority focus states|KA, TG, TN, MP, RJ, HR, PB, ML, AS, TR/);
  for (const page of [overview, interventions, risk]) {
    assert.match(page, /All 9 Active Target States/);
    assert.doesNotMatch(page, /All 10 Target States/);
  }
});

test('Unspecified telemetry lab is absent from active navigation and Next.js product routes', () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const navigation = read('src/components/Navigation.tsx');
  assert.doesNotMatch(navigation, /Telemetry Lab|\/experimental-telemetry/);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src/app/experimental-telemetry/page.tsx')), false);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src/app/api/experimental-station-forecast/route.ts')), false);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src/lib/services/nwdpStationForecastBridge.ts')), false);

  // The experimental model's inference contract and scientific safeguard tests remain maintained.
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src/lib/services/nwdpStationForecastContract.ts')), true);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'tests/nwdpStationForecast.test.ts')), true);
});
