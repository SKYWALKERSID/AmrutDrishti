/**
 * JalDrishti — Seed Master Scheme Catalogue
 * Seeds official government water schemes into public.schemes in Supabase.
 */

import fs from 'node:fs';
import { INTERVENTION_SCHEMES } from '../src/lib/data/schemes.ts';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)[1].trim();
const key = (env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/))[1].trim();

async function seedSchemes() {
  console.log('--- Seeding Government Schemes Catalogue (JD-043) ---');
  for (const s of INTERVENTION_SCHEMES) {
    const payload = {
      scheme_id: s.id,
      name: s.name,
      agency: s.implementingAgency,
      description: s.description,
      target_intervention_types: s.eligibleTargetConditions,
      is_active: true
    };

    const res = await fetch(`${url}/rest/v1/schemes`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload)
    });

    console.log(`Scheme: ${s.name} (${s.id}) -> HTTP ${res.status}`);
    if (!res.ok) {
      console.log('Error details:', await res.text());
    }
  }
}

seedSchemes().then(() => console.log('Seeding script finished.'));
