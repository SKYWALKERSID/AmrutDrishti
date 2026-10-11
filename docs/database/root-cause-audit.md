# JAL DRISHTI — Database Permissions Root-Cause Audit

**Date:** 2026-10-11  
**Status:** Verified locally against repository source code and migrations. Remote database execution pending database-owner approval.

---

## 1. Verified Root Cause

**Error:** `42501 insufficient_privilege` on `SELECT` from `public.administrative_units` and `public.derived_indicators`.

### Failure Path Traced from Code

```
GET /api/geospatial/blocks
  → src/app/api/geospatial/blocks/route.ts (line 8)
    → fetchBlocksGeospatialData()
      → src/lib/services/geospatialService.ts (lines 49–96)
        → createServerClient(supabaseUrl, supabaseAnonKey, { cookies })
        → supabase.from('administrative_units').select('*').eq('unit_type', 'block')
        → supabase.from('derived_indicators').select('*').order('assessed_date', ...)
```

The server client is instantiated with the **anon key** (lines 55–58 of `geospatialService.ts`). When no user session cookie is present, Supabase PostgREST resolves the request as the PostgreSQL `anon` role.

### Why It Fails in PostgreSQL

PostgreSQL evaluates access control in two distinct stages in strict hierarchical sequence:

1. **SQL Privilege Check** (`GRANT SELECT ON table TO role`) — If the role lacks this grant, PostgreSQL immediately raises `42501 insufficient_privilege`. RLS is never reached.
2. **Row Level Security (RLS)** — Evaluated only if the SQL privilege check succeeds.

**In migration `20261010000000_init_schema.sql`:**
- Creates all 14 tables.
- Enables RLS on all 14 tables (lines 290–303).
- Creates `USING (true)` SELECT policies on 9 tables (lines 308–316) — these allow reads once the privilege check passes.
- **Does NOT issue any `GRANT` statements to `anon` or `authenticated` roles.**

**In migration `20261010000001_grant_public_read_permissions.sql`:**
- Issues `GRANT USAGE ON SCHEMA public TO anon, authenticated;` (line 5).
- Issues `GRANT SELECT ON public.administrative_units TO anon, authenticated;` (line 9).
- Issues `GRANT SELECT ON public.derived_indicators TO anon, authenticated;` (line 10).
- Issues `GRANT SELECT ON public.data_sources TO anon, authenticated;` (line 11).
- Issues `GRANT SELECT ON public.schemes TO anon, authenticated;` (line 12).
- Issues `GRANT SELECT` on 5 operational tables to `authenticated` only (lines 16–20).

**Root Cause Conclusion:** If migration `000001` was not applied to the remote database, or was applied before a schema wipe, the `anon` and `authenticated` roles possess zero SQL-level privileges. PostgREST rejects queries before evaluating RLS policies, returning `42501`.

---

## 2. Inferred vs Verified Evidence

| Claim | Status | Basis / Verification Method |
|---|:---:|---|
| Code instantiates anon client for public geospatial data | **Verified** | Inspected `geospatialService.ts` lines 55–58 |
| Code falls back cleanly to demonstration fixtures on DB failure | **Verified** | Inspected `geospatialService.ts` lines 98–117; verified by test `AUTH-040` |
| Fallback data is explicitly labeled as simulated | **Verified** | Verified by test `AUTH-041` |
| Init schema `000000` has RLS enabled on all 14 tables | **Verified** | Inspected `20261010000000_init_schema.sql` lines 290–303 |
| Init schema `000000` lacks SQL-level GRANT statements | **Verified** | Inspected `20261010000000_init_schema.sql` (no `GRANT` statements exist) |
| Migration `000001` contains the required grants | **Verified** | Inspected `20261010000001_grant_public_read_permissions.sql` |
| Remote database currently lacks `000001` grants | **Inferred** | Inferred from reported `42501` runtime error; direct query blocked by DB freeze |
| Remote database migration ledger state | **Requires DB Owner** | Cannot query `supabase_migrations.schema_migrations` under freeze |

---

## 3. Why Applying `000001` Alone is a Security Blocker

Applying `20261010000001_grant_public_read_permissions.sql` without tightening RLS policies creates an immediate security vulnerability:

1. Migration `000000` created `CREATE POLICY "Public Read Interventions" ON public.intervention_proposals FOR SELECT USING (true);`.
2. Migration `000001` contains `GRANT SELECT ON public.intervention_proposals TO authenticated;`.
3. If both are active, any authenticated user from any role or district can read all intervention proposals across all districts, bypassing jurisdiction scoping.
4. Furthermore, migration `000000` created `CREATE POLICY "Public Read Recommendations"` and `"Public Read Model Predictions"` with `USING (true)`.

**Remediation Principle:** Migration `20261011000002_permissions_remediation.sql` supersedes `000001` and `C03` by consolidating both the required grants AND the necessary `DROP POLICY` / `CREATE POLICY` tightening in a single atomic transaction.

---

## 4. Key Table Risk Breakdown

| Table | Sensitive Content | Intended Access Boundary | Threat if Untightened |
|---|---|---|---|
| `administrative_units` | Public boundaries | Public (`anon` + `authenticated`) | None — public GIS reference |
| `derived_indicators` | Aggregated stress scores | Public (via published lifecycle) | Draft/unreviewed scores visible if unconstrained |
| `intervention_proposals` | Budgets, beneficiary counts, review trails | Authenticated + District Scoped | Cross-district leak or arbitrary cross-district creation |
| `monitoring_stations` | Station locations, well depths | Authenticated only | Harvesting of infrastructure telemetry |
| `station_observations` | Well-level time series | Authenticated only | Uncontrolled scraping of groundwater raw points |
| `model_predictions` | Forward stress forecasts | Authenticated only | Uncalibrated predictions presented as official |
| `profiles` | Names, roles, phone numbers, districts | Authenticated + District/Self scoped | PII leak; unauthorized privilege elevation |
| `notification_records` | Phone numbers, advisory dispatches | Authenticated + District/Recipient scoped | PII disclosure (phone numbers) |
| `ingestion_runs` | Telemetry logs, error diagnostics | Authenticated Admin / Analyst only | Internal architecture leakage |
| `audit_events` | Immutable security audit trail | Authenticated Admin / DC read; append-only insert | Tampering or leak of audit history |

---

## 5. Decision & Current Status

- **Architecture:** Forward migration `20261011000002_permissions_remediation.sql` wraps all grants and policy adjustments in a single atomic transaction (`BEGIN ... COMMIT;`).
- **Safety:** Contains an explicit block-to-district integrity check on proposal creation, eliminates `GRANT ALL` and `DELETE` grants, and provides a documented rollback plan.
- **Local Status:** Verified clean locally across 32 authorization contract tests and 85 total repository tests.
- **Remote Status:** Held pending database-owner execution as per the active database freeze.
