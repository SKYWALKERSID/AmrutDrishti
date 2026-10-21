-- ============================================================================
-- JAL DRISHTI: 20261021000000_least_privilege_remediation.sql  (REVISION 2)
-- Target project : gejsibmhqwqrqukewqpi
-- STATUS         : PROPOSED. NOT EXECUTED. Requires explicit owner approval of THIS revision.
--
-- Scope: table-level privileges of anon/authenticated on the 14 init-schema tables
--        (+ revoke-only on station_observation_lineage if it exists).
-- Out of scope (deliberately untouched):
--   * RLS policies (no CREATE/DROP/ALTER POLICY, no ENABLE/DISABLE RLS)
--   * v_published_historical_observations grants (anon read already works; the view
--     runs with owner rights remotely, so it needs no underlying-table grants)
--   * PostGIS objects: spatial_ref_sys, geometry_columns, geography_columns
--   * Sequences (schema defines none: all keys are TEXT or uuid DEFAULT gen_random_uuid())
--   * Functions and function default privileges (RLS helper functions need EXECUTE)
--   * service_role, ownership, data
-- Default-privilege changes are NOT active here; see the gated block at the bottom.
-- ============================================================================

BEGIN;

-- Pre-flight: abort the whole transaction if an expected table is missing.
DO $$
DECLARE
  t text;
  expected text[] := ARRAY[
    'administrative_units','data_sources','schemes','derived_indicators',
    'monitoring_stations','station_observations','model_predictions','model_registry',
    'intervention_recommendations','intervention_proposals','profiles',
    'notification_records','ingestion_runs','audit_events'];
BEGIN
  FOREACH t IN ARRAY expected LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'Pre-flight failed: public.% does not exist', t;
    END IF;
  END LOOP;
END $$;

-- 1. Remove every table-level privilege from the two API roles on the 14 tables.
--    (REVOKE ALL is version-safe: it also covers MAINTAIN on PG17+ without naming it.)
--    Note: this does not remove column-level grants; those are checked in verification.
REVOKE ALL ON TABLE
  public.administrative_units, public.data_sources, public.schemes,
  public.derived_indicators, public.monitoring_stations, public.station_observations,
  public.model_predictions, public.model_registry, public.intervention_recommendations,
  public.intervention_proposals, public.profiles, public.notification_records,
  public.ingestion_runs, public.audit_events
FROM anon, authenticated;

-- 2. Revoke-only hardening of the two un-migrated remote tables (present in the PostgREST
--    schema, absent from every local migration). No grants are added; both are used by no
--    application code and are read only via the owner-rights published view / service role.
--    Each is skipped if absent.
DO $$
BEGIN
  IF to_regclass('public.station_observation_lineage') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.station_observation_lineage FROM anon, authenticated;
  END IF;
  IF to_regclass('public.observation_ingestion_batches') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.observation_ingestion_batches FROM anon, authenticated;
  END IF;
END $$;

-- 3. Public catalogue reads (anon + authenticated). SELECT only.
GRANT SELECT ON TABLE
  public.administrative_units, public.data_sources, public.schemes, public.derived_indicators
TO anon, authenticated;

-- 4. Authenticated-only read access (matches 20261011000002).
GRANT SELECT ON TABLE
  public.monitoring_stations, public.station_observations, public.model_predictions,
  public.model_registry, public.intervention_recommendations,
  public.notification_records, public.ingestion_runs
TO authenticated;

-- 5. Authenticated writes, each bounded by existing RLS (policies unchanged):
--    intervention_proposals: no DELETE; district/role scoping via RLS.
GRANT SELECT, INSERT, UPDATE ON TABLE public.intervention_proposals TO authenticated;
--    profiles: no INSERT (handle_new_user() is SECURITY DEFINER) and no DELETE.
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
--    audit_events: append-only (no UPDATE/DELETE).
GRANT SELECT, INSERT ON TABLE public.audit_events TO authenticated;

-- Schema USAGE is already required and held by both roles; re-stating is a no-op.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

COMMIT;

-- ============================================================================
-- GATED (NOT EXECUTED, NOT PART OF THIS APPROVAL): default privileges.
-- Enable only after the owner supplies pg_default_acl output proving which defaults
-- are excessive. Tables only; never touch function defaults (RLS helpers need EXECUTE).
-- FOR ROLE postgres is permitted for the postgres role. FOR ROLE supabase_admin
-- requires membership in that role and will error from the SQL editor otherwise;
-- run it only if the evidence shows supabase_admin creates application objects.
--
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--   REVOKE ALL ON TABLES FROM anon, authenticated;
-- -- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
-- --   REVOKE ALL ON TABLES FROM anon, authenticated;
-- Consequence: every future table needs explicit GRANTs in its own migration.
-- ============================================================================
