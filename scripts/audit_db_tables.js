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
const svcKey = env['SUPABASE_SERVICE_ROLE_KEY'];

async function testTables(keyName, key) {
  const tables = [
    'administrative_units',
    'derived_indicators',
    'groundwater_observations',
    'imd_rainfall_observations',
    'model_predictions',
    'model_registry',
    'water_stress_indicators'
  ];
  console.log('Testing with ' + keyName + ':');
  for (const t of tables) {
    try {
      const res = await fetch(url + '/rest/v1/' + t + '?select=*&limit=5', {
        headers: { apikey: key, Authorization: 'Bearer ' + key }
      });
      console.log('  ' + t + ': HTTP ' + res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('    count returned: ' + data.length);
        if (data.length > 0) {
          console.log('    sample record keys: ' + Object.keys(data[0]).join(', '));
        }
      } else {
        const errText = await res.text();
        console.log('    error: ' + errText.slice(0, 100));
      }
    } catch (e) {
      console.log('  ' + t + ' fetch exception:', e.message);
    }
  }
}

async function run() {
  await testTables('Anon Key', anonKey);
  console.log('--------------------------------------------------');
  await testTables('Service Role Key', svcKey);
}
run();
