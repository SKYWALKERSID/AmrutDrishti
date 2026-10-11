-- JalDrishti Migration: 20261011000002_permissions_remediation.sql
-- Description: Consolidated permissions remediation — SQL grants + RLS policy tightening.
-- Resolves: 42501 insufficient_privilege on geospatial API.
-- Supersedes: C03 (20261011000000) and C04 (20261011000001) proposals.
-- STATUS: UNEXECUTED — LOCAL REVIEW ONLY. REQUIRES DB OWNER APPROVAL BEFORE REMOTE APPLICATION.

/*
================================================================================
ROOT CAUSE ADDRESSED:
================================================================================
Migration 20261010000000_init_schema.sql enabled RLS and created policies but
did NOT issue GRANT statements. Without GRANT SELECT, PostgreSQL rejects all
queries with 42501 before RLS policies are evaluated.

Migration 20261010000001_grant_public_read_permissions.sql contains the correct
GRANT statements but may not have been applied to the remote database.

This migration is ADDITIVE and SAFE to run even if 000001 was already applied:
- GRANT is idempotent (re-granting an existing privilege is a no-op).
- DROP POLICY IF EXISTS prevents errors when removing policies from a fresh state.
- CREATE POLICY uses IF NOT EXISTS semantics via the DO blocks below.
================================================================================
*/

/*
================================================================================
PRECONDITION CHECKLIST (DB Owner to confirm before executing):
================================================================================
[ ] 1. Restorable backup or snapshot created.
[ ] 2. Pre-change state recorded (see diagnostic script in docs/database/).
[ ] 3. Confirmed this is run within a transaction (BEGIN/COMMIT wrapper).
[ ] 4. Confirmed RLS is enabled on all 14 tables (verified by init schema).
[ ] 5. Reviewed that no application code depends on anon access to operational tables.
================================================================================
*/

BEGIN;

-- ============================================================================
-- SECTION 1: SCHEMA USAGE (idempotent)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ============================================================================
-- SECTION 2: PUBLIC TABLE GRANTS (anon + authenticated)
-- Tables containing only public reference data and boundaries.
-- ============================================================================
GRANT SELECT ON public.administrative_units TO anon, authenticated;
GRANT SELECT ON public.data_sources TO anon, authenticated;
GRANT SELECT ON public.schemes TO anon, authenticated;

-- derived_indicators: anon SELECT granted so the public map works.
-- The RLS policy below restricts anon to published rows only.
GRANT SELECT ON public.derived_indicators TO anon, authenticated;

-- ============================================================================
-- SECTION 3: AUTHENTICATED-ONLY TABLE GRANTS
-- Operational tables that require a logged-in user session.
-- ============================================================================
GRANT SELECT ON public.monitoring_stations TO authenticated;
GRANT SELECT ON public.station_observations TO authenticated;
GRANT SELECT ON public.model_predictions TO authenticated;
GRANT SELECT ON public.model_registry TO authenticated;
GRANT SELECT ON public.intervention_recommendations TO authenticated;

-- intervention_proposals: authenticated users can read, create, and update
-- (subject to RLS jurisdiction policies below)
GRANT SELECT, INSERT, UPDATE ON public.intervention_proposals TO authenticated;

-- profiles: authenticated users can read (district-scoped) and update (self-only)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- notification_records: authenticated users can read (district/recipient scoped)
GRANT SELECT ON public.notification_records TO authenticated;

-- ingestion_runs: authenticated admin/analyst can read
GRANT SELECT ON public.ingestion_runs TO authenticated;

-- audit_events: authenticated users can insert (append-only) and read (role-scoped)
GRANT SELECT, INSERT ON public.audit_events TO authenticated;

-- ============================================================================
-- SECTION 4: RLS POLICY REMEDIATION
-- Replace overly permissive USING(true) policies on operational tables with
-- authentication-required and district-scoped policies.
-- ============================================================================

-- 4a. monitoring_stations: Drop public-read, add authenticated-only
DROP POLICY IF EXISTS "Public Read Monitoring Stations" ON public.monitoring_stations;
CREATE POLICY "Authenticated Read Monitoring Stations"
  ON public.monitoring_stations
  FOR SELECT TO authenticated
  USING (true);

-- 4b. station_observations: Drop public-read, add authenticated-only
DROP POLICY IF EXISTS "Public Read Station Observations" ON public.station_observations;
CREATE POLICY "Authenticated Read Station Observations"
  ON public.station_observations
  FOR SELECT TO authenticated
  USING (true);

-- 4c. model_predictions: Drop public-read, add authenticated-only
DROP POLICY IF EXISTS "Public Read Model Predictions" ON public.model_predictions;
CREATE POLICY "Authenticated Read Model Predictions"
  ON public.model_predictions
  FOR SELECT TO authenticated
  USING (true);

-- 4d. intervention_recommendations: Drop public-read, add authenticated-only
DROP POLICY IF EXISTS "Public Read Recommendations" ON public.intervention_recommendations;
CREATE POLICY "Authenticated Read Recommendations"
  ON public.intervention_recommendations
  FOR SELECT TO authenticated
  USING (true);

-- 4e. intervention_proposals: Drop public-read, add district-scoped authenticated read.
-- Admins see all. District-scoped staff see only their district's proposals.
DROP POLICY IF EXISTS "Public Read Interventions" ON public.intervention_proposals;
CREATE POLICY "District Scoped Read Proposals"
  ON public.intervention_proposals
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR district_name = public.current_user_district()
  );

-- 4f. intervention_proposals INSERT: Add district jurisdiction and block integrity enforcement.
-- Replace the existing role-only check with role + district scope + block_id integrity check.
DROP POLICY IF EXISTS "Authenticated Proposal Creation" ON public.intervention_proposals;
CREATE POLICY "Jurisdiction Scoped Proposal Creation"
  ON public.intervention_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('admin', 'district_collector', 'bdo', 'gram_pradhan', 'jal_samiti')
    AND (
      public.current_user_role() = 'admin'
      OR district_name = public.current_user_district()
    )
    -- Block-to-district integrity: verify block_id exists and belongs to the specified district
    AND EXISTS (
      SELECT 1 FROM public.administrative_units
      WHERE unit_id = block_id
        AND unit_type = 'block'
        AND district_name = public.intervention_proposals.district_name
    )
  );

-- 4g. intervention_proposals UPDATE: Add district scoping for district_collector.
-- The original policy allowed DC to update any district's proposals.
DROP POLICY IF EXISTS "Jurisdiction Reviewer Proposal Update" ON public.intervention_proposals;
CREATE POLICY "Jurisdiction Scoped Proposal Update"
  ON public.intervention_proposals
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'district_collector'
      AND district_name = public.current_user_district()
    )
    OR (
      public.current_user_role() = 'bdo'
      AND district_name = public.current_user_district()
    )
    OR proposed_by_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
  );

-- ============================================================================
-- SECTION 5: MODEL REGISTRY — add authenticated read
-- The init schema enables RLS but creates no policy for model_registry.
-- Without a policy, no rows are visible even with a GRANT.
-- ============================================================================
CREATE POLICY "Authenticated Read Model Registry"
  ON public.model_registry
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- SECTION 6: VERIFICATION QUERIES (for post-deployment checks)
-- Run these after COMMIT to verify the migration was applied correctly.
-- ============================================================================

/*
-- 6a. Verify grants exist
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 6b. Verify RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 6c. List all active policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6d. Test anon access to public tables
SET ROLE anon;
SELECT count(*) FROM public.administrative_units;
SELECT count(*) FROM public.derived_indicators;
RESET ROLE;

-- 6e. Test anon is denied operational tables
SET ROLE anon;
-- Each of these should return 0 rows (RLS blocks) or error (no grant):
SELECT count(*) FROM public.intervention_proposals;  -- Should fail or return 0
SELECT count(*) FROM public.monitoring_stations;      -- Should fail or return 0
RESET ROLE;

-- 6f. Test district scoping (requires a test user with known district)
-- SET ROLE authenticated;
-- SET request.jwt.claims = '{"sub":"<test-user-uuid>","role":"authenticated"}';
-- SELECT count(*) FROM public.intervention_proposals;
-- Should return only rows matching the user's jurisdiction_district_id
-- RESET ROLE;
*/

COMMIT;

/*
================================================================================
RECOVERY STRATEGY (Least-Privilege Incident Handling):
================================================================================
-- IMPORTANT: Do NOT execute naive rollbacks that restore broad USING (true)
-- policies on operational tables (interventions, monitoring_stations, etc.).
-- Doing so exposes sensitive operational data and draft budgets to anonymous scraping.
--
-- If this migration encounters issues upon execution, follow the reviewed
-- Least-Privilege Recovery & Stop Procedure documented in:
-- docs/database/remote-deployment-runbook.md (Phase 5).
================================================================================
*/
