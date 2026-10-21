const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) { let v = (m[2] || '').trim(); if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1); env[m[1]] = v; }
});
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const svc = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  for (const t of ['observation_ingestion_batches', 'station_observation_lineage']) {
    for (const [n, c] of [['anon', anon], ['service', svc]]) {
      const { count, error } = await c.from(t).select('*', { count: 'exact', head: true });
      console.log(t.padEnd(34), n.padEnd(8), error ? `DENIED/ERR code=${error.code ?? 'n/a'}` : `OK count=${count}`);
    }
  }
  // Read-only RPC reachability for the two RLS helper functions (no side effects).
  for (const f of ['current_user_role', 'current_user_district']) {
    const { error, data } = await anon.rpc(f);
    console.log('anon rpc', f, error ? `ERR ${error.code}` : `OK -> ${JSON.stringify(data)}`);
  }
})();
