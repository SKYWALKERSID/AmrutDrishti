-- ============================================================================
-- JalDrishti: Grant Schema Privileges to service_role
-- Allows backend administrative jobs (crons, seeds, audit log, interventions)
-- to operate with standard Supabase service_role credentials.
-- Safe, standard, and idempotent.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
