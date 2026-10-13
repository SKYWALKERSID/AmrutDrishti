const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const p = l.trim().split('=');
  if (p.length >= 2 && !l.startsWith('#')) env[p[0].trim()] = p.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
});
const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['SUPABASE_SERVICE_ROLE_KEY'];
const candidateTables = [
  'administrative_units',
  'derived_indicators',
  'monitoring_stations',
  'station_observations',
  'groundwater_observations',
  'groundwater_telemetry',
  'imd_rainfall_observations',
  'water_stress_indicators',
  'model_predictions',
  'model_registry',
  'interventions',
  'alerts'
];
async function check() {
  for (const t of candidateTables) {
    try {
      const res = await fetch(url + '/rest/v1/' + t + '?select=count', {
        headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact' }
      });
      console.log(t, res.status, res.headers.get('content-range') || 'no range');
    } catch (e) {
      console.log(t, 'err', e.message);
    }
  }
}
check();
