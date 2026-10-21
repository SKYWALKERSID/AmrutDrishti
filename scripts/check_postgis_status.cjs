const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const client = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, anonKey);

async function checkPostgis() {
  console.log('Testing PostGIS and spatial metadata via service role:');
  const { data: geom, error: e1 } = await client.from('geometry_columns').select('*').limit(5);
  console.log('geometry_columns (service):', { count: geom ? geom.length : 0, error: e1 ? e1.message : null });

  const { data: geog, error: e2 } = await client.from('geography_columns').select('*').limit(5);
  console.log('geography_columns (service):', { count: geog ? geog.length : 0, error: e2 ? e2.message : null });

  const { data: srs, error: e3 } = await client.from('spatial_ref_sys').select('srid, auth_name, auth_srid').eq('srid', 4326);
  console.log('spatial_ref_sys (4326) (service):', { data: srs, error: e3 ? e3.message : null });

  console.log('Testing PostGIS and spatial metadata via anon:');
  const { data: geomA, error: e1A } = await anonClient.from('geometry_columns').select('*').limit(5);
  console.log('geometry_columns (anon):', { count: geomA ? geomA.length : 0, error: e1A ? e1A.message : null });

  const { data: geogA, error: e2A } = await anonClient.from('geography_columns').select('*').limit(5);
  console.log('geography_columns (anon):', { count: geogA ? geogA.length : 0, error: e2A ? e2A.message : null });

  const { data: srsA, error: e3A } = await anonClient.from('spatial_ref_sys').select('srid, auth_name, auth_srid').eq('srid', 4326);
  console.log('spatial_ref_sys (4326) (anon):', { data: srsA, error: e3A ? e3A.message : null });
}

checkPostgis();
