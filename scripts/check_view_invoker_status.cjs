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
  for (const t of ['v_published_historical_observations', 'station_observation_lineage', 'station_observations', 'monitoring_stations']) {
    for (const [n, c] of [['anon', anon], ['service', svc]]) {
      const { count, error } = await c.from(t).select('*', { count: 'exact', head: true });
      console.log(t.padEnd(40), n.padEnd(8), error ? `ERR ${error.code} ${error.message}` : `OK count=${count}`);
    }
  }
  const { data, error } = await anon.from('v_published_historical_observations')
    .select('publication_status,data_status').limit(200);
  if (!error) {
    const s = new Set((data || []).map(r => `${r.publication_status}/${r.data_status}`));
    console.log('anon view distinct publication/data_status:', [...s]);
  }
})();
