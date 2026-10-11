import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync('src/components/HistoricalObservationsPanel.tsx', 'utf8');

test('historical panel is opt-in and has explicit empty/error states', () => {
  assert.match(panel, /enabled = false/);
  assert.match(panel, /No approved historical observations/);
  assert.match(panel, /Historical observations are unavailable/);
  assert.match(panel, /No measurement/);
  assert.match(panel, /not live readings/);
});

test('historical panel never imports demonstration fixtures', () => {
  assert.doesNotMatch(panel, /ALL_BLOCKS|demonstration_fixture|fallback_fixture/);
});
