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
const anonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const ALL_ENTITIES = [
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
  'v_published_historical_observations',
  'supabase_migrations'
];

async function checkEntity(entityName, key, roleName) {
  const url = `${supabaseUrl}/rest/v1/${entityName}?select=*&limit=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Range': '0-0',
        'Prefer': 'count=exact'
      }
    });

    const contentRange = res.headers.get('content-range');
    const totalCount = contentRange ? contentRange.split('/')[1] : 'unknown';
    let body = null;
    try {
      body = await res.json();
    } catch {}

    return {
      entity: entityName,
      role: roleName,
      status: res.status,
      totalCount,
      errorCode: body?.code || null,
      errorMessage: body?.message || null,
      sample: Array.isArray(body) && body.length > 0 ? body[0] : null
    };
  } catch (err) {
    return {
      entity: entityName,
      role: roleName,
      status: 'FETCH_ERROR',
      error: err.message
    };
  }
}

async function runSecurityAudit() {
  console.log('Auditing Supabase Project:', supabaseUrl);
  console.log('Comparing ANONYMOUS vs SERVICE_ROLE access...');

  const results = [];
  for (const entity of ALL_ENTITIES) {
    const anonRes = await checkEntity(entity, anonKey, 'anon');
    const serviceRes = await checkEntity(entity, serviceKey, 'service_role');
    results.push({ entity, anon: anonRes, service: serviceRes });
  }

  console.log(JSON.stringify(results, null, 2));
}

runSecurityAudit();
