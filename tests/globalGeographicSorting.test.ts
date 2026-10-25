import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTargetStatesAlphabetically, ALL_TARGET_STATES } from '../src/lib/data/indiaStates.ts';
import {
  ACTIVE_TARGET_BLOCKS,
  ACTIVE_TARGET_DISTRICTS,
  CANONICAL_43_BLOCKS,
  normalizeStateName
} from '../src/lib/data/allNationwideBlocks.ts';
import {
  compareGeoNames,
  sortStatesAlphabetically,
  sortDistrictsAlphabetically,
  sortBlocksHierarchy,
  sortBlocksByName
} from '../src/lib/data/geographicSorting.ts';
import type { BlockData } from '../src/lib/types.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Global Geographical Sorting & Default Selection Suite', () => {
  it('1. States are sorted A-Z using case-insensitive, locale-aware sorting', () => {
    const states = getTargetStatesAlphabetically();
    assert.strictEqual(states.length, 9, 'Must have exactly 9 active target states');

    const stateNames = states.map(s => s.name);
    const expected = [...stateNames].sort((a, b) =>
      new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare(a.trim(), b.trim())
    );

    assert.deepStrictEqual(stateNames, expected, 'States must be sorted strictly A-Z');
    assert.strictEqual(stateNames[0], 'Haryana', 'First alphabetical state must be Haryana');
  });

  it('2. Districts are sorted A-Z within each state', () => {
    const states = getTargetStatesAlphabetically();

    for (const st of states) {
      const districtsInState = ACTIVE_TARGET_DISTRICTS.filter(
        d => normalizeStateName(d.state) === st.name
      );
      if (districtsInState.length === 0) continue;

      const sortedDistricts = sortDistrictsAlphabetically(districtsInState);
      const districtNames = sortedDistricts.map(d => d.name);
      const expected = [...districtNames].sort((a, b) => compareGeoNames(a, b));

      assert.deepStrictEqual(
        districtNames,
        expected,
        `Districts in state ${st.name} must be sorted A-Z`
      );
    }
  });

  it('3. Blocks are sorted A-Z within each district', () => {
    for (const dist of ACTIVE_TARGET_DISTRICTS) {
      const blocksInDist = ACTIVE_TARGET_BLOCKS.filter(b => b.districtId === dist.id);
      if (blocksInDist.length === 0) continue;

      const sorted = sortBlocksByName(blocksInDist);
      const blockNames = sorted.map(b => b.name);
      const expected = [...blockNames].sort((a, b) => compareGeoNames(a, b));

      assert.deepStrictEqual(
        blockNames,
        expected,
        `Blocks in district ${dist.name} must be sorted A-Z`
      );
    }
  });

  it('4. sortBlocksHierarchy enforces State (A-Z) -> District (A-Z) -> Block (A-Z)', () => {
    const hierarchySorted = sortBlocksHierarchy(ACTIVE_TARGET_BLOCKS);
    assert.strictEqual(hierarchySorted.length, ACTIVE_TARGET_BLOCKS.length);

    for (let i = 0; i < hierarchySorted.length - 1; i++) {
      const curr = hierarchySorted[i];
      const next = hierarchySorted[i + 1];

      const sComp = compareGeoNames(curr.state, next.state);
      assert.ok(sComp <= 0, `State order violation between ${curr.state} and ${next.state}`);

      if (sComp === 0) {
        const dComp = compareGeoNames(curr.districtName, next.districtName);
        assert.ok(
          dComp <= 0,
          `District order violation within ${curr.state}: ${curr.districtName} vs ${next.districtName}`
        );

        if (dComp === 0) {
          const bComp = compareGeoNames(curr.name, next.name);
          assert.ok(
            bComp <= 0,
            `Block order violation within ${curr.districtName}: ${curr.name} vs ${next.name}`
          );
        }
      }
    }
  });

  it('5. First canonical block is NOT Tikamgarh', () => {
    assert.notStrictEqual(
      CANONICAL_43_BLOCKS[0].id,
      'blk_tikamgarh_main',
      'First canonical block should not be Tikamgarh'
    );
    assert.strictEqual(CANONICAL_43_BLOCKS[0].state, 'Haryana');
    assert.strictEqual(CANONICAL_43_BLOCKS[0].districtName, 'Kaithal');
    assert.strictEqual(CANONICAL_43_BLOCKS[0].name, 'Rajound');
  });

  it('6. Sorting does not mutate original arrays and preserves all geographic properties', () => {
    const original = [...ACTIVE_TARGET_BLOCKS];
    const originalIds = original.map(b => b.id);

    const sorted = sortBlocksHierarchy(ACTIVE_TARGET_BLOCKS);
    const sortedIds = sorted.map(b => b.id);

    // Verify all original IDs still exist
    assert.strictEqual(sorted.length, original.length);
    for (const b of original) {
      const match = sorted.find(s => s.id === b.id);
      assert.ok(match, `Block ${b.id} missing in sorted array`);
      assert.deepStrictEqual(
        match.coordinates,
        b.coordinates,
        `Coordinates altered for ${b.id}`
      );
      assert.strictEqual(match.districtId, b.districtId, `District ID altered for ${b.id}`);
      assert.strictEqual(match.state, b.state, `State altered for ${b.id}`);
    }
  });

  it('7. Monitoring page code does not automatically select Tikamgarh or hardcode Tikamgarh default', () => {
    const monitoringContent = fs.readFileSync(
      path.resolve(__dirname, '../src/app/monitoring/page.tsx'),
      'utf8'
    );

    // Verify it doesn't do setSelectedBlockId(merged[0].id) or blk_tikamgarh_main
    assert.ok(
      !monitoringContent.includes("setSelectedBlockId('blk_tikamgarh_main')"),
      'Monitoring must not hardcode setSelectedBlockId to blk_tikamgarh_main'
    );
    assert.ok(
      !monitoringContent.includes("setSelectedBlockId(merged[0].id)"),
      'Monitoring must not default to merged[0].id without explicit user choice'
    );
    assert.ok(
      monitoringContent.includes('Select a district and block to view location-specific data'),
      'Monitoring must render the prompt when no block is selected'
    );
  });

  it('8. Forecast API route does not hardcode blk_tikamgarh_main as arbitrary fallback', () => {
    const forecastRouteContent = fs.readFileSync(
      path.resolve(__dirname, '../src/app/api/forecast/route.ts'),
      'utf8'
    );

    assert.ok(
      !forecastRouteContent.includes("searchParams.get('block') || 'blk_tikamgarh_main'"),
      'Forecast route must not hardcode blk_tikamgarh_main as query fallback'
    );
  });

  it('9. Interventions page does not send hardcoded Tikamgarh header', () => {
    const interventionsContent = fs.readFileSync(
      path.resolve(__dirname, '../src/app/interventions/page.tsx'),
      'utf8'
    );

    assert.ok(
      !interventionsContent.includes("'x-jaldrishti-district': 'Tikamgarh'"),
      'Interventions page must not send hardcoded Tikamgarh header'
    );
  });

  it('10. compareGeoNames safely handles whitespace and case-insensitivity', () => {
    assert.strictEqual(compareGeoNames('  karnataka  ', 'Karnataka'), 0);
    assert.strictEqual(compareGeoNames('MADHYA PRADESH', 'madhya pradesh'), 0);
    assert.ok(compareGeoNames('Haryana', 'Punjab') < 0);
    assert.ok(compareGeoNames('Punjab', 'Haryana') > 0);
    assert.strictEqual(compareGeoNames('', null), 0);
  });
});
