-- JalDrishti Migration 20261010000001_grant_public_read_permissions.sql
-- Description: Minimal, secure SELECT privilege grants to anon and authenticated roles for public geospatial layers.

-- 1. Schema Usage Privilege
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Public Read Access for Essential Base Geospatial Layers & Master Reference Catalogs
-- (Publicly visible on map dashboards; RLS remains enabled)
GRANT SELECT ON public.administrative_units TO anon, authenticated;
GRANT SELECT ON public.derived_indicators TO anon, authenticated;
GRANT SELECT ON public.data_sources TO anon, authenticated;
GRANT SELECT ON public.schemes TO anon, authenticated;

-- 3. Authenticated-Only Read Access for Operational Data & Decision Support Layers
-- (Restricted from anonymous access to prevent unauthorized harvesting of operational data)
GRANT SELECT ON public.monitoring_stations TO authenticated;
GRANT SELECT ON public.station_observations TO authenticated;
GRANT SELECT ON public.model_predictions TO authenticated;
GRANT SELECT ON public.intervention_proposals TO authenticated;
GRANT SELECT ON public.intervention_recommendations TO authenticated;

-- Note: PII & Administrative Log Tables (profiles, notification_records, ingestion_runs, audit_events)
-- are strictly excluded from public grants and evaluated under role-specific RLS policies.

