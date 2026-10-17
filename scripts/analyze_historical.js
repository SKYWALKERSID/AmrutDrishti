import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    envVars[key] = val;
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

async function analyzeHistoricalData() {
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`
  };

  let offset = 0;
  const pageSize = 1000;
  let allRows = [];
  while (true) {
    const res = await fetch(`${supabaseUrl}/rest/v1/v_published_historical_observations?select=source_name,source_provider,data_status,quality_flag,district_name,block_name,observation_date,station_id&offset=${offset}&limit=${pageSize}`, { headers });
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    allRows = allRows.concat(batch);
    offset += pageSize;
    if (batch.length < pageSize) break;
  }

  console.log('Total verified records:', allRows.length);

  const sources = {};
  const qualityFlags = {};
  const dataStatuses = {};
  const districts = {};
  const blocks = {};
  const stations = new Set();
  let minDate = '9999-99-99';
  let maxDate = '0000-00-00';

  for (const r of allRows) {
    sources[r.source_name] = (sources[r.source_name] || 0) + 1;
    qualityFlags[r.quality_flag] = (qualityFlags[r.quality_flag] || 0) + 1;
    dataStatuses[r.data_status] = (dataStatuses[r.data_status] || 0) + 1;
    districts[r.district_name] = (districts[r.district_name] || 0) + 1;
    blocks[r.block_name] = (blocks[r.block_name] || 0) + 1;
    stations.add(r.station_id);
    if (r.observation_date && r.observation_date < minDate) minDate = r.observation_date;
    if (r.observation_date && r.observation_date > maxDate) maxDate = r.observation_date;
  }

  console.log('Breakdown by Source Name:', sources);
  console.log('Breakdown by Quality Flag:', qualityFlags);
  console.log('Breakdown by Data Status:', dataStatuses);
  console.log('Districts breakdown:', districts);
  console.log('Blocks count:', Object.keys(blocks).length, 'list:', Object.keys(blocks));
  console.log('Unique stations count:', stations.size);
  console.log('Exact Date Range:', minDate, 'to', maxDate);
}

analyzeHistoricalData().catch(console.error);
