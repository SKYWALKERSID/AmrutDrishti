async function run() {
  const { calculateDescriptiveGss } = await import('../src/lib/services/scientificEngine.ts');

  console.log('--- GSS REFERENCE CASES ---');
  const cases = [
    { name: 'Max Stress', inputs: { cgwbWellDepthMbgl: 25, rainfallAnomalyMm: -400, graceTwsaCm: -10, sentinelNdvi: 0.15 } },
    { name: 'Min Stress', inputs: { cgwbWellDepthMbgl: 4, rainfallAnomalyMm: 100, graceTwsaCm: 5, sentinelNdvi: 0.70 } },
    { name: 'Moderate Watch', inputs: { cgwbWellDepthMbgl: 14, rainfallAnomalyMm: -180, graceTwsaCm: -4, sentinelNdvi: 0.38 } },
    { name: 'Severe Boundary', inputs: { cgwbWellDepthMbgl: 19, rainfallAnomalyMm: -280, graceTwsaCm: -7, sentinelNdvi: 0.28 } },
    { name: 'Missing Well Only', inputs: { cgwbWellDepthMbgl: null, rainfallAnomalyMm: -200, graceTwsaCm: -5, sentinelNdvi: 0.35 } },
    { name: 'Missing Rain Only', inputs: { cgwbWellDepthMbgl: 15, rainfallAnomalyMm: null, graceTwsaCm: -5, sentinelNdvi: 0.35 } },
    { name: 'Missing Satellite Only', inputs: { cgwbWellDepthMbgl: 15, rainfallAnomalyMm: -200, graceTwsaCm: null, sentinelNdvi: null } },
    { name: 'Complete Data Gap', inputs: { cgwbWellDepthMbgl: null, rainfallAnomalyMm: null, graceTwsaCm: null, sentinelNdvi: 0.20 } }
  ];

  for (const c of cases) {
    const res = calculateDescriptiveGss(c.inputs);
    console.log(
      c.name.padEnd(24),
      '| Score:', String(res.score).padEnd(5),
      '| Severity:', res.severity.padEnd(7),
      '| Active:', res.activeIndicatorsCount,
      '| Driver:', res.primaryStressDriver
    );
  }

  console.log('\n--- SENSITIVITY GRADIENT ANALYSIS ---');
  // Baseline: well 10m, rain -100mm, grace -2cm, ndvi 0.45
  const base = { cgwbWellDepthMbgl: 10, rainfallAnomalyMm: -100, graceTwsaCm: -2, sentinelNdvi: 0.45 };
  const baseRes = calculateDescriptiveGss(base);
  console.log('Base condition score:', baseRes.score);

  const deltaWell = calculateDescriptiveGss({ ...base, cgwbWellDepthMbgl: 11 });
  console.log('Delta +1m well depth: score ->', deltaWell.score, `(diff: +${(deltaWell.score - baseRes.score).toFixed(2)})`);

  const deltaRain = calculateDescriptiveGss({ ...base, rainfallAnomalyMm: -150 });
  console.log('Delta -50mm rain deficit: score ->', deltaRain.score, `(diff: +${(deltaRain.score - baseRes.score).toFixed(2)})`);

  const deltaGrace = calculateDescriptiveGss({ ...base, graceTwsaCm: -3 });
  console.log('Delta -1cm GRACE depletion: score ->', deltaGrace.score, `(diff: +${(deltaGrace.score - baseRes.score).toFixed(2)})`);

  const deltaNdvi = calculateDescriptiveGss({ ...base, sentinelNdvi: 0.35 });
  console.log('Delta -0.10 NDVI canopy stress: score ->', deltaNdvi.score, `(diff: +${(deltaNdvi.score - baseRes.score).toFixed(2)})`);
}

run();
