import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Rainfall Visualization: Dynamic latest available data year and data-gap transparency', () => {
  const monitoringPage = fs.readFileSync('src/app/monitoring/page.tsx', 'utf8');

  // 1. Dynamic extraction of year and date from selectedBlock indicators
  assert.match(
    monitoringPage,
    /const\s+date\s*=\s*selectedBlock\.indicators\.lastUpdatedDate\s*\|\|\s*'2024-09-30';/,
    'Date must dynamically derive from selectedBlock.indicators.lastUpdatedDate with honest fallback'
  );
  assert.match(
    monitoringPage,
    /const\s+year\s*=\s*date\.split\('-'\)\[0\]\s*\|\|\s*'2024';/,
    'Year must derive dynamically from date string'
  );
  assert.match(
    monitoringPage,
    /period:\s*`Monsoon \$\{year\}`/,
    'Period must dynamically reflect Monsoon ${year}'
  );

  // 2. Clear banner rendering "Latest available data: [Year]" when data is historical (< 2026)
  assert.match(
    monitoringPage,
    /Latest available data:\s*\{obsYear\}/,
    'Must explicitly state "Latest available data: {obsYear}"'
  );
  assert.match(
    monitoringPage,
    /Official IMD gridded daily precipitation bundles for this block are archived through/,
    'Must identify the actual official IMD archive status'
  );
  assert.match(
    monitoringPage,
    /subsequent seasons are preserved as unmeasured data gaps/,
    'Must explicitly state that subsequent seasons are preserved as unmeasured data gaps rather than fabricated'
  );
  assert.match(
    monitoringPage,
    /LATEST:\s*\{obsYear\}/,
    'Must display dynamic latest year badge'
  );

  // 3. Transparent distinction between Estimated Total, 30-Yr LPA Normal, and Stored Anomaly
  assert.match(
    monitoringPage,
    /Estimated Total/,
    'Must label the combined total as Estimated Total'
  );
  assert.match(
    monitoringPage,
    /30-Yr LPA Normal/,
    'Must label climatological normal as 30-Yr LPA Normal'
  );
  assert.match(
    monitoringPage,
    /Stored Anomaly/,
    'Must label anomaly distinctly from measured rainfall'
  );
  assert.match(
    monitoringPage,
    /The &quot;Estimated Total&quot;.*is derived by combining the state normal with the block anomaly; direct raingauge daily accumulation is aggregated separately/,
    'Must include scientific disclaimer that Estimated Total is derived from anomaly + normal'
  );
});

test('Rainfall Visualization: Target block dataset date distribution inspection', () => {
  const canonicalPath = 'src/lib/data/canonical43Blocks.json';
  assert.ok(fs.existsSync(canonicalPath), 'canonical43Blocks.json must exist');

  const blocks = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
  assert.equal(blocks.length, 43, 'Must contain all 43 canonical blocks');

  // Group blocks by lastUpdatedDate year
  const yearCounts: Record<string, number> = {};
  for (const block of blocks) {
    const yr = block.indicators.lastUpdatedDate ? block.indicators.lastUpdatedDate.split('-')[0] : 'unknown';
    yearCounts[yr] = (yearCounts[yr] || 0) + 1;
  }

  // Verify that historical years (2024, 2023, 2025) exist authentically in the canonical dataset
  assert.ok((yearCounts['2024'] || 0) > 0, '2024 blocks must be present in canonical blocks (e.g. Rajasthan/Karnataka)');
  assert.ok((yearCounts['2023'] || 0) > 0, '2023 blocks must be present in canonical blocks');

  // Verify specific blocks that genuinely have 2024 observations
  const amerBlock = blocks.find((b: any) => b.name === 'Amer');
  assert.ok(amerBlock, 'Amer block must exist');
  assert.match(amerBlock.indicators.lastUpdatedDate, /^2024-/, 'Amer must have authentic 2024 observation date');

  const shimogaBlock = blocks.find((b: any) => b.name === 'Shimoga');
  assert.ok(shimogaBlock, 'Shimoga block must exist');
  assert.match(shimogaBlock.indicators.lastUpdatedDate, /^2024-/, 'Shimoga must have authentic 2024 observation date');
});
