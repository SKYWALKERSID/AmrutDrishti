-- JalDrishti Migration: 20261011000001_c04_publication_views_and_lifecycle.sql
-- Description: Publication Lifecycle Schema (draft, reviewed, published, expired, withdrawn) & Secure Public Publication View
-- Target Roles: anon, authenticated (Read access ONLY to published views)
-- STATUS: UNEXECUTED — AWAITING EXPLICIT DB OWNER APPROVAL

/*
================================================================================
PRECONDITION CHECKLIST (DB Owner to confirm before executing):
================================================================================
[ ] 1. Pre-change grant state recorded via information_schema & has_table_privilege.
[ ] 2. Verified base tables administrative_units and derived_indicators exist and have RLS enabled.
[ ] 3. Confirmed that public view v_published_administrative_indicators projects ONLY non-sensitive fields.
================================================================================
*/

-- 1. Create Publication Status Enum Type
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publication_status_enum') THEN
    CREATE TYPE publication_status_enum AS ENUM (
      'draft',
      'reviewed',
      'published',
      'expired',
      'withdrawn'
    );
  END IF;
END $$;

-- 2. Add Publication Governance Columns to derived_indicators (if not already present)
ALTER TABLE public.derived_indicators 
  ADD COLUMN IF NOT EXISTS publication_status publication_status_enum NOT NULL DEFAULT 'draft',
  -- GOVERNANCE NOTE: 'draft' is the only safe default. Existing rows require explicit review
  -- and an authorised transition to 'reviewed' → 'published' before appearing in the public view.
  ADD COLUMN IF NOT EXISTS approved_by_role user_role_enum,
  ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NULL,
  -- GOVERNANCE NOTE: published_at must be NULL for all existing rows (they have not been published).
  -- It must be set explicitly only when a row is transitioned to 'published' by the approval workflow.
  -- DEFAULT NOW() would falsely timestamp all existing rows as published at migration time.
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;

-- 3. Create Secure Decoupled Publication View for Public Read API
CREATE OR REPLACE VIEW public.v_published_administrative_indicators AS
SELECT 
  u.unit_id,
  u.unit_type,
  u.name AS block_name,
  u.district_id,
  u.district_name,
  u.state_name,
  u.coordinates,
  u.geom,
  u.total_geographic_area_ha,
  u.net_sown_area_ha,
  u.boundary_version,
  i.indicator_id,
  i.grace_twsa_cm,
  i.rainfall_anomaly_mm,
  i.spi_3month,
  i.sentinel_ndvi,
  i.sentinel_ndwi,
  i.smap_soil_moisture,
  i.cgwb_well_depth_mbgl,
  i.well_depth_trend_m_per_yr,
  i.descriptive_stress_score,
  i.risk_severity,
  i.data_status AS source_provenance,
  i.primary_stress_driver,
  i.safeguard_notice,
  i.assessed_date,
  i.published_at
FROM public.administrative_units u
INNER JOIN public.derived_indicators i ON u.unit_id = i.unit_id
WHERE i.publication_status = 'published'
  AND (i.expires_at IS NULL OR i.expires_at > NOW());
-- NOTE: The view projects i.data_status AS source_provenance so API consumers can distinguish
-- simulated vs observed rows even within the 'published' subset. Consumers must not assume
-- publication_status='published' implies the data is field-verified — it means it has been
-- reviewed and approved for public release by an authorised role.
-- NOTE: This view is SECURITY INVOKER (PostgreSQL default). Callers (anon, authenticated)
-- must have SELECT on the underlying tables (administrative_units, derived_indicators)
-- for this view to resolve. Granting SELECT only on the view without table-level grants
-- will result in 42501. If exclusive view-gated access is required without exposing base
-- tables, the view must be SECURITY DEFINER with a trusted owner and explicit search_path.

-- 4. Grant SELECT on Secure Publication View to API Roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.v_published_administrative_indicators TO anon, authenticated;

/*
================================================================================
STATE-PRESERVING ROLLBACK PLAN (Run if retraction is required):
================================================================================
DO $$
DECLARE
  prior_anon_view_select BOOLEAN := NULL;
  prior_authenticated_view_select BOOLEAN := NULL;
BEGIN
  -- IMPORTANT: Populate prior_anon_view_select and prior_authenticated_view_select
  -- from the recorded pre-change ticket before running this block.
  -- NULL values will abort the rollback rather than guess at prior state.
  IF prior_anon_view_select IS NULL OR prior_authenticated_view_select IS NULL THEN
    RAISE EXCEPTION 'Rollback requires pre-recorded prior_anon_view_select and prior_authenticated_view_select values';
  END IF;

  -- 1. Revoke view grants only if they were not pre-existing
  IF prior_anon_view_select IS FALSE THEN
    REVOKE SELECT ON public.v_published_administrative_indicators FROM anon;
  END IF;
  IF prior_authenticated_view_select IS FALSE THEN
    REVOKE SELECT ON public.v_published_administrative_indicators FROM authenticated;
  END IF;

  -- 2. Drop the publication view
  DROP VIEW IF EXISTS public.v_published_administrative_indicators;

  -- 3. Remove publication governance columns added by this migration.
  --    Only reverse columns that this migration added; do not touch pre-existing columns.
  --    ALTER TABLE DROP COLUMN is irreversible — confirm data is not needed before running.
  ALTER TABLE public.derived_indicators
    DROP COLUMN IF EXISTS publication_status,
    DROP COLUMN IF EXISTS approved_by_role,
    DROP COLUMN IF EXISTS approved_by_id,
    DROP COLUMN IF EXISTS observed_at,
    DROP COLUMN IF EXISTS ingested_at,
    DROP COLUMN IF EXISTS published_at,
    DROP COLUMN IF EXISTS expires_at,
    DROP COLUMN IF EXISTS withdrawal_reason;

  -- 4. Drop the enum type only if nothing else depends on it
  DROP TYPE IF EXISTS publication_status_enum;
END $$;
================================================================================
*/
