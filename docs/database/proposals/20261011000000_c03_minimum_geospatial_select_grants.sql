-- JalDrishti Migration: 20261011000000_c03_minimum_geospatial_select_grants.sql
-- Description: Minimum-grant SELECT privileges for public geospatial layers (administrative_units, derived_indicators)
-- Target Roles: anon, authenticated
-- Scope: ONLY public.administrative_units and public.derived_indicators (read-only geospatial API layer)
-- STATUS: UNEXECUTED — AWAITING EXPLICIT DB OWNER APPROVAL AND PRE-CHANGE EVIDENCE

/*
================================================================================
PRECONDITION CHECKLIST (DB Owner to confirm before executing):
================================================================================
[ ] 1. Pre-change grant state recorded via information_schema.role_table_grants.
[ ] 2. Verified that public.administrative_units contains ONLY approved public boundary metadata/polygons.
[ ] 3. Verified that public.derived_indicators contains ONLY aggregated block-level metrics & scientific disclaimers (NO PII, NO well-owner records).
[ ] 4. Verified RLS is ENABLED on both public.administrative_units and public.derived_indicators.
[ ] 5. Verified active RLS policies on both tables permit SELECT for intended roles.
[ ] 6. Verified API table dependency: ONLY administrative_units and derived_indicators are required.
================================================================================
*/

-- 1. Ensure schema USAGE privilege for API client roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Minimum-grant SELECT permission on public boundary reference table
GRANT SELECT ON public.administrative_units TO anon, authenticated;

-- 3. Minimum-grant SELECT permission on aggregated environmental indicator table
GRANT SELECT ON public.derived_indicators TO anon, authenticated;

/*
================================================================================
PRE-CHANGE STATE RECORDING SCRIPT (Run before applying migration):
================================================================================
-- Capture table grants for target roles
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name IN ('administrative_units', 'derived_indicators')
  AND grantee IN ('anon', 'authenticated');

-- Capture schema USAGE privileges
SELECT grantee, object_schema, privilege_type
FROM information_schema.usage_privileges
WHERE object_schema = 'public'
  AND grantee IN ('anon', 'authenticated');

-- Record these six booleans verbatim in the approved change ticket. They are
-- the inputs required by the rollback block below.
SELECT
  has_table_privilege('anon', 'public.administrative_units', 'SELECT') AS prior_anon_admin_select,
  has_table_privilege('authenticated', 'public.administrative_units', 'SELECT') AS prior_authenticated_admin_select,
  has_table_privilege('anon', 'public.derived_indicators', 'SELECT') AS prior_anon_indicator_select,
  has_table_privilege('authenticated', 'public.derived_indicators', 'SELECT') AS prior_authenticated_indicator_select,
  has_schema_privilege('anon', 'public', 'USAGE') AS prior_anon_public_usage,
  has_schema_privilege('authenticated', 'public', 'USAGE') AS prior_authenticated_public_usage;

-- Capture RLS status and policies
SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public' AND relname IN ('administrative_units', 'derived_indicators');

SELECT tablename, policyname, roles, cmd, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('administrative_units', 'derived_indicators');
================================================================================
*/

/*
================================================================================
PRE-MIGRATION STATE PRESERVING ROLLBACK PLAN:
================================================================================
-- Never run an unconditional REVOKE. Before the change, copy the six boolean
-- values below from the recorded, approved change ticket. Use TRUE when the
-- named role already had that effective privilege; use FALSE when it did not.
-- A NULL value deliberately aborts the rollback rather than guessing.
--
-- REVOKE removes only the direct grant made by this migration. If a role had
-- equivalent access through PUBLIC or membership before the migration, that
-- access remains, restoring the recorded effective privilege state.
DO $$
DECLARE
  prior_anon_admin_select BOOLEAN := NULL;
  prior_authenticated_admin_select BOOLEAN := NULL;
  prior_anon_indicator_select BOOLEAN := NULL;
  prior_authenticated_indicator_select BOOLEAN := NULL;
  prior_anon_public_usage BOOLEAN := NULL;
  prior_authenticated_public_usage BOOLEAN := NULL;
BEGIN
  IF prior_anon_admin_select IS NULL
     OR prior_authenticated_admin_select IS NULL
     OR prior_anon_indicator_select IS NULL
     OR prior_authenticated_indicator_select IS NULL
     OR prior_anon_public_usage IS NULL
     OR prior_authenticated_public_usage IS NULL THEN
    RAISE EXCEPTION 'Rollback requires the six recorded pre-change privilege values';
  END IF;

  IF prior_anon_admin_select IS FALSE THEN
    REVOKE SELECT ON public.administrative_units FROM anon;
  END IF;
  IF prior_authenticated_admin_select IS FALSE THEN
    REVOKE SELECT ON public.administrative_units FROM authenticated;
  END IF;
  IF prior_anon_indicator_select IS FALSE THEN
    REVOKE SELECT ON public.derived_indicators FROM anon;
  END IF;
  IF prior_authenticated_indicator_select IS FALSE THEN
    REVOKE SELECT ON public.derived_indicators FROM authenticated;
  END IF;
  IF prior_anon_public_usage IS FALSE THEN
    REVOKE USAGE ON SCHEMA public FROM anon;
  END IF;
  IF prior_authenticated_public_usage IS FALSE THEN
    REVOKE USAGE ON SCHEMA public FROM authenticated;
  END IF;
END $$;
================================================================================
*/
