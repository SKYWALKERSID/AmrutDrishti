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

async function check() {
  const rAnon = await fetch(url + '/rest/v1/v_published_historical_observations?select=*&limit=2', {
    headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey }
  });
  console.log('v_published_historical_observations (Anon): HTTP ' + rAnon.status);
  if (!rAnon.ok) console.log('  Anon error: ' + (await rAnon.text()));

  const rSvc = await fetch(url + '/rest/v1/v_published_historical_observations?select=*&limit=2', {
    headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey }
  });
  console.log('v_published_historical_observations (Service): HTTP ' + rSvc.status);
  if (rSvc.ok) {
    const d = await rSvc.json();
    console.log('  Count returned: ' + d.length);
  } else {
    console.log('  Service error: ' + (await rSvc.text()));
  }
}
check();
