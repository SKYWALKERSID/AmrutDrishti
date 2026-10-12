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
const key = env['SUPABASE_SERVICE_ROLE_KEY'];

async function inspectRegistry() {
  const res = await fetch(url + '/rest/v1/model_registry?select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  console.log('--- MODEL REGISTRY (HTTP ' + res.status + ') ---');
  if (res.ok) console.log(JSON.stringify(await res.json(), null, 2));
}

async function inspectPredictions() {
  const res = await fetch(url + '/rest/v1/model_predictions?select=*&order=created_at.desc', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  console.log('--- MODEL PREDICTIONS (HTTP ' + res.status + ') ---');
  if (res.ok) console.log(JSON.stringify(await res.json(), null, 2));
}

async function run() {
  await inspectRegistry();
  await inspectPredictions();
}

run();
