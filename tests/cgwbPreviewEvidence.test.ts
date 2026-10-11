import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('CGWB preview evidence preserves snapshot identity and safety gates', () => {
  const evidence = JSON.parse(fs.readFileSync('docs/data/cgwb_mp_2021_2025_xlsx_preview.json', 'utf8'));
  assert.equal(evidence.inputSnapshot.sha256, '645343BA1C31993CF44B8D3BE48C986CBA46D17707A6F3B8FA0322E982AF3C10');
  assert.equal(evidence.inputSnapshot.byteIdenticalToRecordedCsv, false);
  assert.equal(evidence.preview.totalRows, evidence.inputSnapshot.dataRows);
  assert.equal(evidence.preview.acceptedRows + evidence.preview.rejectedRows, evidence.preview.totalRows);
  assert.equal(evidence.preview.niwariOrPrithvipurMappedToTikamgarh, false);
  assert.equal(evidence.productionImportAuthorized, false);
});
