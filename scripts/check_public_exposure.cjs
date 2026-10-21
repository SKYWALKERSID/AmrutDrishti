// Read-only / no-op-safe public-exposure probes. Prints statuses and error codes only; no secrets.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) { let v = (m[2] || '').trim(); if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1); env[m[1]] = v; }
});
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const ak = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: ak, Authorization: 'Bearer ' + ak, 'Content-Type': 'application/json' };
const pk = {
  administrative_units: 'unit_id', data_sources: 'source_id', schemes: 'scheme_id', derived_indicators: 'indicator_id',
  monitoring_stations: 'station_id', station_observations: 'observation_id', model_predictions: 'prediction_id',
  model_registry: 'model_id', intervention_recommendations: 'recommendation_id', intervention_proposals: 'proposal_id',
  profiles: 'id', notification_records: 'alert_id', ingestion_runs: 'run_id', audit_events: 'event_id',
};
const NIL = '00000000-0000-0000-0000-000000000000';
async function code(r) { try { const j = await r.json(); return j.code || ''; } catch { return ''; } }
(async () => {
  // 1. Anonymous write attempts. POST {} violates NOT NULL on every listed table if privileged,
  //    PATCH/DELETE use an impossible key so they can affect zero rows.
  console.log('table'.padEnd(30), 'POST{}   PATCH    DELETE   (HTTP/code; 401+42501 = no grant)');
  for (const [t, k] of Object.entries(pk)) {
    const out = [];
    const post = await fetch(`${url}/rest/v1/${t}`, { method: 'POST', headers: H, body: '{}' });
    out.push(`${post.status}/${await code(post)}`);
    const patch = await fetch(`${url}/rest/v1/${t}?${k}=eq.${NIL}`, { method: 'PATCH', headers: H, body: '{}' });
    out.push(`${patch.status}/${await code(patch)}`);
    const del = await fetch(`${url}/rest/v1/${t}?${k}=eq.${NIL}`, { method: 'DELETE', headers: H });
    out.push(`${del.status}/${await code(del)}`);
    console.log(t.padEnd(30), out.join('  '));
  }
  // 2. Public auth settings (read-only, public endpoint).
  const s = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: ak } });
  const sj = await s.json();
  const ext = sj.external || {};
  console.log('auth settings HTTP', s.status, '| disable_signup =', sj.disable_signup,
    '| mailer_autoconfirm =', sj.mailer_autoconfirm, '| phone_autoconfirm =', sj.phone_autoconfirm,
    '| enabled providers:', Object.keys(ext).filter(x => ext[x]).join(','));
  // 3. Read-only PostGIS RPC callable behaviour (version string only).
  const v = await fetch(`${url}/rest/v1/rpc/postgis_version`, { method: 'POST', headers: H, body: '{}' });
  console.log('anon rpc postgis_version HTTP', v.status, (await v.text()).slice(0, 60));
})();
