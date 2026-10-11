import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCgwbImportPreview } from '../src/lib/services/cgwbAdapter.ts';

const header = 'Station,Agency,District LGD Code,District,Block,Latitude,Longitude,Data Acquisition Time,Groundwater Level Quarterly Manual (meter)';
const row = (station: string, date = '10-01-2021', level = '12.4', block = 'Block A') =>
  `${station},CGWB,434,Tikamgarh,${block},24.7,78.8,${date} 00:00,${level}`;

test('CGWB preview accepts only records with an approved LGD crosswalk and preserves provenance', () => {
  const preview = buildCgwbImportPreview(`${header}\n${row('W1')}`, [
    { districtLgdCode: '434', sourceBlock: 'Block A', applicationUnitId: 'unit-1' }
  ]);
  assert.equal(preview.acceptedRows, 1);
  assert.equal(preview.accepted[0].waterLevelMbgl, 12.4);
  assert.equal(preview.accepted[0].observationDate, '2021-01-10');
  assert.equal(preview.accepted[0].applicationUnitId, 'unit-1');
  assert.match(preview.accepted[0].sourceResourceUrl, /gwl_manual_quarterly_cgwb_mp_2021_2025\.csv$/);
});

test('CGWB preview rejects missing crosswalks, malformed coordinates/dates, and duplicates', () => {
  const csv = [header, row('W1'), row('W1'), row('W2', '31-02-2021'), row('W3', '10-01-2021', '12', 'Unknown')].join('\n');
  const preview = buildCgwbImportPreview(csv, [
    { districtLgdCode: '434', sourceBlock: 'Block A', applicationUnitId: 'unit-1' }
  ]);
  assert.equal(preview.totalRows, 4);
  assert.equal(preview.acceptedRows, 1);
  assert.equal(preview.rejectionReasons.duplicate_station_date, 1);
  assert.equal(preview.rejectionReasons.invalid_date, 1);
  assert.equal(preview.rejectionReasons.missing_approved_crosswalk, 1);
});

test('CGWB preview preserves missing groundwater levels as null', () => {
  const preview = buildCgwbImportPreview(`${header}\n${row('W1', '10-04-2021', '', 'Block A')}`, [
    { districtLgdCode: '434', sourceBlock: 'Block A', applicationUnitId: 'unit-1' }
  ]);
  assert.equal(preview.acceptedRows, 1);
  assert.equal(preview.accepted[0].waterLevelMbgl, null);
});
