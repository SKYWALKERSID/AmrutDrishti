const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.trim().split('=');
  if (parts.length >= 2 && !line.startsWith('#')) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});
const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function run() {
  const res = await fetch(url + '/rest/v1/derived_indicators?select=*', {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey }
  });
  const rows = await res.json();
  console.log('Total derived_indicators:', rows.length);
  for (const r of rows) {
    console.log(r.unit_id, {
      assessed_date: r.assessed_date,
      data_status: r.data_status,
      cgwb_well_depth_mbgl: r.cgwb_well_depth_mbgl,
      grace_twsa_cm: r.grace_twsa_cm,
      rainfall_anomaly_mm: r.rainfall_anomaly_mm,
      sentinel_ndvi: r.sentinel_ndvi,
      smap_soil_moisture: r.smap_soil_moisture,
      score: r.descriptive_stress_score
    });
  }
}
run();
