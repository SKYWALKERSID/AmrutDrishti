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
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];

console.log('Supabase URL:', url ? 'Present (' + url.slice(0, 25) + '...)' : 'Missing');
console.log('Anon Key:', anonKey ? 'Present (' + anonKey.slice(0, 10) + '...)' : 'Missing');
console.log('Service Key:', serviceKey ? 'Present (' + serviceKey.slice(0, 10) + '...)' : 'Missing');

async function testFetchWithKey(keyName, key) {
  const targetUrl = url + '/rest/v1/model_predictions?select=unit_id,model_id,target_date,predicted_gwl_mbgl,uncertainty_lower_mbgl,uncertainty_upper_mbgl,created_at&limit=10';
  const res = await fetch(targetUrl, {
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key
    }
  });
  console.log(`HTTP Status (${keyName}):`, res.status);
  if (res.ok) {
    const data = await res.json();
    console.log(`Rows returned (${keyName}):`, data.length);
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`Error (${keyName}):`, await res.text());
  }
}

async function run() {
  await testFetchWithKey('Service Role Key', serviceKey);
}

run();
