# AMRUT DRISHTI — Remote Deployment Runbook: Database Permissions Remediation

**Target Migration:** `supabase/migrations/20261011000002_permissions_remediation.sql`  
**Purpose:** Resolve PostgreSQL `42501 insufficient_privilege` on public geospatial API queries while hardening operational tables against unauthorized cross-district access.  
**Audience:** Database Administrator / Supabase Project Owner.

---

## ⚠️ Important Deployment Constraints

1. **Database Freeze:** Antigravity agents are strictly prohibited from applying migrations or executing SQL against the remote Supabase database. This runbook is prepared for manual or authorized CI/CD execution by the project owner.
2. **Transaction Safety:** The migration is wrapped in `BEGIN; ... COMMIT;`. Any syntax or execution error aborts the transaction cleanly without leaving partial grants or orphaned policies.
3. **Additive & Idempotent:** Safe to run whether or not previous partial grants were applied.
4. **Ledger Integrity:** Because this migration is applied as a forward migration (`20261011000002`), it does not require editing or repairing previous migration entries in `supabase_migrations.schema_migrations`.
5. **Least-Privilege Recovery:** **Do not use a naive rollback that re-introduces broad `USING (true)` public-read policies on operational tables.** If this migration encounters an operational issue, follow the documented Least-Privilege Recovery & Stop Procedure (Phase 5).
6. **Proposal Reference Archive:** The earlier design proposals C03 (`20261011000000_c03_minimum_geospatial_select_grants.sql`) and C04 (`20261011000001_c04_publication_views_and_lifecycle.sql`) are preserved as reference documentation in `docs/database/proposals/`. They are NOT active deployment migrations and must not be executed. Only `20261011000002_permissions_remediation.sql` is active.

---

## 1. Phase 1 — Preflight Verification (Before Applying)

Before running the migration script, connect to the Supabase database via the Supabase SQL Editor or a secure `psql` session and execute these diagnostic checks.

### Preflight Check 1.1: Record Current Grant State
```sql
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```
*Save the output to a secure text file for pre-change audit records.*

### Preflight Check 1.2: Record Current Schema Usage
```sql
SELECT grantee, object_schema, privilege_type
FROM information_schema.usage_privileges
WHERE object_schema = 'public'
  AND grantee IN ('anon', 'authenticated');
```

### Preflight Check 1.3: Verify RLS is Active on All 14 Tables
```sql
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public'
  AND relname IN (
    'profiles', 'administrative_units', 'data_sources', 'ingestion_runs',
    'monitoring_stations', 'station_observations', 'derived_indicators',
    'model_registry', 'model_predictions', 'schemes', 'intervention_proposals',
    'intervention_recommendations', 'notification_records', 'audit_events'
  )
ORDER BY relname;
```
*Expected: All 14 tables must show `rls_enabled = true`.*

### Preflight Check 1.4: List Current Policies and Migration History
```sql
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT version, inserted_at 
FROM supabase_migrations.schema_migrations 
ORDER BY version;
```

---

## 2. Phase 2 — Migration Execution

1. Open the Supabase Project Dashboard → **SQL Editor**.
2. Load the exact file contents of `supabase/migrations/20261011000002_permissions_remediation.sql`.
3. Confirm that the script begins with `BEGIN;` and concludes with `COMMIT;`.
4. Click **Run** to execute the transaction.

---

## 3. Phase 3 — Post-Deployment Verification (Positive & Negative Checks)

Execute the following post-deployment queries immediately after `COMMIT;`.

> **Note on Access Control Layers:** PostgreSQL enforces access control in two distinct stages. A table with no `GRANT SELECT` will raise `ERROR: 42501 (permission denied)`. A table with `GRANT SELECT` but constrained by RLS will return `0 rows` when conditions evaluate to false. Both represent denial, but are distinct layers.

### Check 3.1: Verify Anonymous Public Read Access (Positive Check)
```sql
SET ROLE anon;
-- These must SUCCEED with positive row counts:
SELECT count(*) AS admin_units_count FROM public.administrative_units;
SELECT count(*) AS derived_indicators_count FROM public.derived_indicators;
SELECT count(*) AS data_sources_count FROM public.data_sources;
SELECT count(*) AS schemes_count FROM public.schemes;
RESET ROLE;
```
*Expected: Queries succeed and return counts corresponding to seeded or active rows.*

### Check 3.2: Verify Anonymous Operational Read Denial (Negative Check)
```sql
SET ROLE anon;
-- These must FAIL with PostgreSQL ERROR: 42501 (insufficient_privilege)
-- because anon has NO SQL-level SELECT grant on operational tables:
SELECT count(*) FROM public.monitoring_stations;        -- Expected: 42501 permission denied
SELECT count(*) FROM public.station_observations;       -- Expected: 42501 permission denied
SELECT count(*) FROM public.intervention_proposals;     -- Expected: 42501 permission denied
SELECT count(*) FROM public.audit_events;               -- Expected: 42501 permission denied
RESET ROLE;
```
*Expected: Every query in 3.2 raises `ERROR: 42501 (insufficient privilege)`. If any query returns rows or 0 rows without an error, anon has an unauthorized table grant.*

### Check 3.3: Verify District Scoping on Proposals (Positive & Negative Check)

```sql
-- Step A: Set up or verify a realistic test profile in Tikamgarh
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'::uuid) THEN
    INSERT INTO public.profiles (id, full_name, role, jurisdiction_district_id, phone_number)
    VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Test DC Tikamgarh', 'district_collector', 'Tikamgarh', '+919425100001');
  END IF;
END $$;

-- Step B: Simulate session as Tikamgarh District Collector
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Positive Check: Tikamgarh proposals ARE visible
SELECT count(*) AS tikamgarh_visible_count
FROM public.intervention_proposals
WHERE district_name = 'Tikamgarh';

-- Negative Check: Chhatarpur proposals MUST NOT be visible (0 rows returned)
SELECT count(*) AS chhatarpur_leak_count
FROM public.intervention_proposals
WHERE district_name = 'Chhatarpur';
-- Expected: chhatarpur_leak_count = 0.

RESET ROLE;
```

### Check 3.4: Verify Proposal Mutation Jurisdiction Enforcement (Allowed & Denied Paths)

```sql
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Negative Check: Cross-district proposal insertion MUST be rejected by RLS
-- Attempting to insert a proposal for 'Chhatarpur' while user is Tikamgarh DC:
DO $$
BEGIN
  BEGIN
    INSERT INTO public.intervention_proposals (
      proposal_id, block_id, block_name, district_name, scheme_id, scheme_name,
      title, target_village, estimated_cost_inr, beneficiaries_count, evidence_rationale,
      proposed_by_role, proposed_by_name, review_owner_role, review_owner_name
    ) VALUES (
      'prop_test_cross_district', 'blk_chhatarpur_main', 'Chhatarpur Main', 'Chhatarpur',
      'SCH_MGNREGA', 'MGNREGA', 'Unauthorized Cross District Check', 'Village A',
      500000, 120, 'Test rationale', 'district_collector', 'Test DC', 'district_collector', 'Test DC'
    );
    RAISE EXCEPTION 'SECURITY FLAW: Cross-district insertion succeeded!';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    -- Expected: Insertion blocked by RLS WITH CHECK policy
    RAISE NOTICE 'SUCCESS: Cross-district insertion blocked as expected.';
  END;
END $$;

-- Negative Check: Relational Block Integrity Check
-- Attempting to insert Tikamgarh district with a block belonging to another district:
DO $$
BEGIN
  BEGIN
    INSERT INTO public.intervention_proposals (
      proposal_id, block_id, block_name, district_name, scheme_id, scheme_name,
      title, target_village, estimated_cost_inr, beneficiaries_count, evidence_rationale,
      proposed_by_role, proposed_by_name, review_owner_role, review_owner_name
    ) VALUES (
      'prop_test_bad_block', 'blk_chhatarpur_main', 'Chhatarpur Main', 'Tikamgarh',
      'SCH_MGNREGA', 'MGNREGA', 'Mismatched Block Check', 'Village B',
      500000, 120, 'Test rationale', 'district_collector', 'Test DC', 'district_collector', 'Test DC'
    );
    RAISE EXCEPTION 'SECURITY FLAW: Mismatched block_id insertion succeeded!';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    -- Expected: Block integrity check blocked mismatched block_id
    RAISE NOTICE 'SUCCESS: Mismatched block_id insertion blocked as expected.';
  END;
END $$;

RESET ROLE;
```

### Check 3.5: Verify Geospatial API Route from Application
1. Trigger `GET https://<your-project>.supabase.co/rest/v1/administrative_units?unit_type=eq.block&select=*` using the anon key in the `apikey` and `Authorization: Bearer <anon_key>` headers.
2. Verify HTTP response is `200 OK` (no `42501`).

---

## 4. Phase 4 — Failure & Stop Conditions

If any of the following occur during or immediately following deployment, **stop immediately and engage recovery**:

| Condition | Observation | Action |
|---|---|---|
| DDL Error during execution | Transaction aborted with PostgreSQL error | Do NOT commit. Address error, rerun inside fresh transaction. |
| Anon can read `intervention_proposals` | Check 3.2 returns rows or 0 rows without 42501 error | Run `REVOKE SELECT ON public.intervention_proposals FROM anon;`. |
| Cross-district read leak | Check 3.3 returns `chhatarpur_leak_count > 0` | Policy check failure; verify `District Scoped Read Proposals` policy is active. |
| Mismatched block accepted | Check 3.4 succeeds on mismatched block insert | Verify block integrity `EXISTS` clause on `Jurisdiction Scoped Proposal Creation`. |
| Application crashes on block retrieval | API returns HTTP 500 | Refresh PostgREST cache (`NOTIFY pgrst, 'reload config'`). |

---

## 5. Phase 5 — Least-Privilege Recovery & Stop Procedure

> ⚠️ **CRITICAL SECURITY DIRECTIVE:** **Never roll back by recreating broad `USING (true)` public-read policies on operational tables.** Doing so re-exposes sensitive draft budgets, raw station records, and internal recommendations to anonymous users.

If unexpected regression occurs, execute this **Least-Privilege Recovery Script**, which restores necessary application read access while maintaining the hardened security perimeter:

```sql
BEGIN;

-- 1. If geospatial API still fails, re-verify minimum public grants:
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.administrative_units TO anon, authenticated;
GRANT SELECT ON public.derived_indicators TO anon, authenticated;
GRANT SELECT ON public.data_sources TO anon, authenticated;
GRANT SELECT ON public.schemes TO anon, authenticated;

-- 2. If authenticated users cannot perform their operations, ensure authenticated grants are present:
GRANT SELECT ON public.monitoring_stations TO authenticated;
GRANT SELECT ON public.station_observations TO authenticated;
GRANT SELECT ON public.model_predictions TO authenticated;
GRANT SELECT ON public.model_registry TO authenticated;
GRANT SELECT ON public.intervention_recommendations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.intervention_proposals TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.notification_records TO authenticated;
GRANT SELECT ON public.ingestion_runs TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;

-- 3. If a specific policy is syntax-broken, drop and re-create ONLY that policy.
-- NEVER recreate "Public Read Interventions" with USING (true).
-- If urgent DC access to all proposals is temporarily required during an incident:
-- Revert District Scoped Read Proposals ONLY to authenticated role (never anon):
-- CREATE POLICY "Authenticated Read Proposals Temporary" ON public.intervention_proposals
--   FOR SELECT TO authenticated USING (true);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload config';

COMMIT;
```
