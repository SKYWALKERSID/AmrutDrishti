const https = require('https');

function probeUrl(path) {
  return new Promise((resolve) => {
    const fullUrl = `https://jal-drishti-tau.vercel.app${path}`;
    https.get(fullUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          contentType: res.headers['content-type'],
          length: data.length,
          title: data.match(/<title>([^<]*)<\/title>/i)?.[1] || null,
          bodySnippet: data.slice(0, 150).replace(/\s+/g, ' ')
        });
      });
    }).on('error', (err) => {
      resolve({ path, error: err.message });
    });
  });
}

async function run() {
  console.log('--- Probing Live Vercel Deployment (https://jal-drishti-tau.vercel.app/) ---');
  const paths = [
    '/',
    '/overview',
    '/explorer',
    '/risk-assessment',
    '/monitoring',
    '/data-sources',
    '/interventions',
    '/alerts',
    '/api/geospatial/blocks?state=Karnataka',
    '/api/historical-observations?limit=5'
  ];

  for (const p of paths) {
    const res = await probeUrl(p);
    console.log(p.padEnd(40), res.status ? `HTTP ${res.status}` : `ERR: ${res.error}`, res.title ? `| ${res.title}` : (res.contentType || ''));
  }
}

run();
