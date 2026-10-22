const https = require('https');

function fetchJson(path) {
  return new Promise((resolve) => {
    https.get(`https://jal-drishti-tau.vercel.app${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Failed to parse JSON', raw: data.slice(0, 200) });
        }
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function run() {
  console.log('--- Inspecting Live Vercel APIs ---');
  const geo = await fetchJson('/api/geospatial/blocks?state=Karnataka');
  console.log('Geospatial Blocks API:');
  console.log('  source:', geo.source);
  console.log('  totalCount:', geo.totalCount);
  console.log('  isDemonstrationData:', geo.isDemonstrationData);
  if (geo.blocks && geo.blocks.length > 0) {
    console.log('  sample block state:', geo.blocks[0].state);
    console.log('  sample block name:', geo.blocks[0].name);
  }

  const hist = await fetchJson('/api/historical-observations?limit=3');
  console.log('Historical Observations API:');
  console.log('  source:', hist.source);
  console.log('  totalCount:', hist.totalCount);
  if (hist.observations && hist.observations.length > 0) {
    console.log('  sample station:', hist.observations[0].station_name, '| date:', hist.observations[0].observation_date);
  }
}

run();
