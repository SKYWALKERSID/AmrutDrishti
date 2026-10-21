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

async function testMutation() {
  console.log('--- TESTING ANONYMOUS MUTATIONS (MUST ALL FAIL 401/403) ---');
  const payload = {
    unit_id: 'test_blk',
    unit_type: 'block',
    name: 'Test',
    district_id: 'test',
    district_name: 'Test',
    state_name: 'Test'
  };

  const res = await fetch(url + '/rest/v1/administrative_units', {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log('POST /administrative_units (Anon): Status', res.status);
  if (!res.ok) {
    console.log('Error text:', await res.text());
  }
}

testMutation();
