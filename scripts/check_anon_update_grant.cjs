// Resolves the ambiguous HTTP 204 on PATCH with an empty body. Uses a real column and an impossible key,
// so zero rows can match even if UPDATE were granted. 42501 => no UPDATE grant; 204 => UPDATE granted.
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) { let v = (m[2] || '').trim(); if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1); env[m[1]] = v; }
});
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const ak = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: ak, Authorization: 'Bearer ' + ak, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
const NIL = '00000000-0000-0000-0000-000000000000';
const cases = [
  ['administrative_units', 'unit_id', '__no_such_unit__', { name: 'x' }],
  ['data_sources', 'source_id', '__no_such_src__', { name: 'x' }],
  ['schemes', 'scheme_id', '__no_such_scheme__', { name: 'x' }],
  ['derived_indicators', 'indicator_id', NIL, { primary_stress_driver: 'x' }],
];
(async () => {
  for (const [t, k, v, body] of cases) {
    const r = await fetch(`${url}/rest/v1/${t}?${k}=eq.${v}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) });
    let code = '';
    try { code = (await r.json()).code || ''; } catch {}
    console.log(t.padEnd(24), 'anon PATCH(real column, zero-row key):', r.status, code);
  }
})();
