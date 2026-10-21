// Prints ONLY the variable names present in .env.local and (for pg-metadata discovery) whether
// the PostgREST schema exposes catalog objects. Never prints values.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) { let v = (m[2] || '').trim(); if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1); env[m[1]] = v; }
});
console.log('env names:', Object.keys(env).join(', '));
console.log('project ref in URL:', (env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]);
(async () => {
  const base = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/';
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { apikey: key, Authorization: 'Bearer ' + key };
  // OpenAPI listing shows which relations/functions PostgREST exposes (names only).
  const r = await fetch(base, { headers: h });
  const j = await r.json();
  const paths = Object.keys(j.paths || {});
  console.log('exposed paths:', paths.join(' '));
  for (const rel of ['pg_policies', 'pg_class', 'pg_default_acl']) {
    const rr = await fetch(base + rel + '?limit=1', { headers: h });
    console.log(rel, 'HTTP', rr.status);
  }
})();
