const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const parts = line.trim().split('=');
  if (parts.length >= 2 && !line.startsWith('#')) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const svcKey = env['SUPABASE_SERVICE_ROLE_KEY'];

async function check() {
  const tables = [
    'administrative_units',
    'derived_indicators',
    'data_sources',
    'schemes',
    'monitoring_stations',
    'station_observations',
    'model_predictions',
    'model_registry',
    'intervention_proposals',
    'intervention_recommendations',
    'notification_records',
    'ingestion_runs',
    'audit_events',
    'profiles',
    'v_published_historical_observations'
  ];

  console.log('--- TABLE PERMISSION MATRIX (Target: gejsibmhqwqrqukewqpi) ---');
  for (const t of tables) {
    try {
      const rAnon = await fetch(url + '/rest/v1/' + t + '?select=*&limit=1', {
        headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey }
      });
      const rSvc = await fetch(url + '/rest/v1/' + t + '?select=*&limit=1', {
        headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey }
      });
      console.log(`${t.padEnd(36)} | Anon: ${rAnon.status} | ServiceRole: ${rSvc.status}`);
    } catch (e) {
      console.log(`${t.padEnd(36)} | Error: ${e.message}`);
    }
  }
}

check();
