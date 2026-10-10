-- JalDrishti Migration 20261010000000_init_schema.sql
-- Description: Complete Hardened TRD DDL Schema for PostGIS, Auth Profiles, Jurisdiction Scoping, RLS Security, Observations, Proposals, Alerts & Audit Events

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Enumerations
CREATE TYPE user_role_enum AS ENUM (
  'district_collector',
  'bdo',
  'gram_pradhan',
  'jal_samiti',
  'environmental_analyst',
  'admin'
);

CREATE TYPE risk_severity_enum AS ENUM (
  'normal',
  'watch',
  'severe',
  'gap'
);

CREATE TYPE data_status_enum AS ENUM (
  'observed',
  'derived',
  'simulated',
  'predicted'
);

CREATE TYPE proposal_status_enum AS ENUM (
  'draft',
  'under_review',
  'field_verification_requested',
  'approved',
  'rejected',
  'in_execution'
);

-- 3. Profiles & Jurisdiction Authorization Table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'bdo',
  jurisdiction_district_id TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Security Helper Functions for RLS Evaluation (Explicit search_path set for SECURITY DEFINER protection)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role_enum AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.current_user_district()
RETURNS TEXT AS $$
  SELECT jurisdiction_district_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public;

-- Trigger function for automatic profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    'bdo',
    NEW.phone
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Trigger execution on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Administrative Units Table (State, District, Block Polygons & Centroids)
CREATE TABLE public.administrative_units (
  unit_id TEXT PRIMARY KEY, -- e.g. 'blk_tikamgarh_main'
  unit_type TEXT NOT NULL CHECK (unit_type IN ('state', 'district', 'block')),
  name TEXT NOT NULL,
  district_id TEXT NOT NULL,
  district_name TEXT NOT NULL,
  state_name TEXT NOT NULL,
  coordinates Geometry(Point, 4326),
  geom Geometry(MultiPolygon, 4326),
  total_geographic_area_ha NUMERIC,
  net_sown_area_ha NUMERIC,
  boundary_version TEXT NOT NULL DEFAULT 'LGD-2024',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial Indexes for administrative units
CREATE INDEX idx_admin_units_coords ON public.administrative_units USING GIST(coordinates);
CREATE INDEX idx_admin_units_geom ON public.administrative_units USING GIST(geom);
CREATE INDEX idx_admin_units_district ON public.administrative_units(district_id);

-- 5. Data Sources Registry Table
CREATE TABLE public.data_sources (
  source_id TEXT PRIMARY KEY, -- e.g. 'src_grace_fo'
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  spatial_resolution TEXT NOT NULL,
  temporal_cadence TEXT NOT NULL,
  license_terms TEXT NOT NULL,
  provenance_details TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Ingestion Runs Log Table
CREATE TABLE public.ingestion_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES public.data_sources(source_id),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'lagging', 'error')),
  records_ingested INTEGER DEFAULT 0,
  qa_summary JSONB,
  error_message TEXT
);

-- 7. CGWB / State Monitoring Stations Table
CREATE TABLE public.monitoring_stations (
  station_id TEXT PRIMARY KEY, -- e.g. 'CGWB_MP_TIK_001'
  station_name TEXT NOT NULL,
  district_id TEXT NOT NULL,
  block_id TEXT REFERENCES public.administrative_units(unit_id),
  coordinates Geometry(Point, 4326) NOT NULL,
  well_depth_mbgl NUMERIC,
  aquifer_type TEXT,
  agency TEXT NOT NULL DEFAULT 'CGWB',
  is_telemetric BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stations_coords ON public.monitoring_stations USING GIST(coordinates);
CREATE INDEX idx_stations_block ON public.monitoring_stations(block_id);

-- 8. Raw Station Observation Time-Series
CREATE TABLE public.station_observations (
  observation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT NOT NULL REFERENCES public.monitoring_stations(station_id) ON DELETE CASCADE,
  observation_date DATE NOT NULL,
  water_level_mbgl NUMERIC NOT NULL,
  data_status data_status_enum NOT NULL DEFAULT 'observed',
  quality_flag TEXT NOT NULL DEFAULT 'passed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_obs_station_date ON public.station_observations(station_id, observation_date DESC);

-- 9. Environmental Indicators Table (Per-Block & Per-Grid Derived Metrics)
CREATE TABLE public.derived_indicators (
  indicator_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id TEXT NOT NULL REFERENCES public.administrative_units(unit_id) ON DELETE CASCADE,
  grace_twsa_cm NUMERIC,
  rainfall_anomaly_mm NUMERIC,
  spi_3month NUMERIC,
  sentinel_ndvi NUMERIC,
  sentinel_ndwi NUMERIC,
  smap_soil_moisture NUMERIC,
  cgwb_well_depth_mbgl NUMERIC,
  well_depth_trend_m_per_yr NUMERIC,
  descriptive_stress_score INTEGER CHECK (descriptive_stress_score BETWEEN 0 AND 100),
  risk_severity risk_severity_enum NOT NULL DEFAULT 'normal',
  data_status data_status_enum NOT NULL DEFAULT 'observed',
  primary_stress_driver TEXT,
  safeguard_notice TEXT,
  assessed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_derived_indicators_unit_date ON public.derived_indicators(unit_id, assessed_date DESC);

-- 10. AI / ML Model Registry
CREATE TABLE public.model_registry (
  model_id TEXT PRIMARY KEY, -- e.g. 'lstm_gwl_v1.2'
  model_name TEXT NOT NULL,
  version TEXT NOT NULL,
  architecture TEXT NOT NULL,
  target_variable TEXT NOT NULL,
  trained_at TIMESTAMPTZ NOT NULL,
  performance_metrics JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Model Predictions Table
CREATE TABLE public.model_predictions (
  prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id TEXT NOT NULL REFERENCES public.administrative_units(unit_id),
  model_id TEXT NOT NULL REFERENCES public.model_registry(model_id),
  target_date DATE NOT NULL,
  predicted_gwl_mbgl NUMERIC NOT NULL,
  uncertainty_lower_mbgl NUMERIC,
  uncertainty_upper_mbgl NUMERIC,
  predicted_risk_severity risk_severity_enum NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_unit_date ON public.model_predictions(unit_id, target_date DESC);

-- 12. Master Scheme Catalogue Table
CREATE TABLE public.schemes (
  scheme_id TEXT PRIMARY KEY, -- e.g. 'SCH_MGNREGA'
  name TEXT NOT NULL,
  agency TEXT NOT NULL,
  description TEXT NOT NULL,
  target_intervention_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Government Intervention Proposals Table
CREATE TABLE public.intervention_proposals (
  proposal_id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES public.administrative_units(unit_id),
  block_name TEXT NOT NULL,
  district_name TEXT NOT NULL,
  scheme_id TEXT NOT NULL REFERENCES public.schemes(scheme_id),
  scheme_name TEXT NOT NULL,
  title TEXT NOT NULL,
  target_village TEXT NOT NULL,
  estimated_cost_inr NUMERIC NOT NULL,
  beneficiaries_count INTEGER NOT NULL,
  evidence_rationale TEXT NOT NULL,
  missing_evidence_notes TEXT,
  status proposal_status_enum NOT NULL DEFAULT 'under_review',
  proposed_by_role user_role_enum NOT NULL,
  proposed_by_name TEXT NOT NULL,
  review_owner_role user_role_enum NOT NULL,
  review_owner_name TEXT NOT NULL,
  comments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interventions_block ON public.intervention_proposals(block_id);
CREATE INDEX idx_interventions_status ON public.intervention_proposals(status);

-- 14. Automated / Expert Intervention Recommendations
CREATE TABLE public.intervention_recommendations (
  recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id TEXT NOT NULL REFERENCES public.administrative_units(unit_id),
  scheme_id TEXT NOT NULL REFERENCES public.schemes(scheme_id),
  recommended_action TEXT NOT NULL,
  rationale_text TEXT NOT NULL,
  confidence_score NUMERIC DEFAULT 0.85,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'converted_to_proposal', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Notification & Advisory Records Table (PII Protected)
CREATE TABLE public.notification_records (
  alert_id TEXT PRIMARY KEY,
  proposal_id TEXT REFERENCES public.intervention_proposals(proposal_id),
  recipient_name TEXT NOT NULL,
  recipient_role user_role_enum NOT NULL,
  recipient_phone TEXT NOT NULL,
  district_name TEXT NOT NULL,
  block_name TEXT NOT NULL,
  severity risk_severity_enum NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('SMS', 'WhatsApp')),
  message_hindi TEXT NOT NULL,
  message_english TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'simulated',
  confidence_score NUMERIC DEFAULT 0.89,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Append-Only Audit Events Table
CREATE TABLE public.audit_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_role user_role_enum NOT NULL,
  action TEXT NOT NULL,
  resource_target TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Row Level Security (RLS) Enablement
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrative_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.derived_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 18. RLS Policies

-- A. Public Read Policies for Non-Sensitive GIS & Aggregated Data Layers (Anonymous + Authenticated)
CREATE POLICY "Public Read Administrative Units" ON public.administrative_units FOR SELECT USING (true);
CREATE POLICY "Public Read Data Sources" ON public.data_sources FOR SELECT USING (true);
CREATE POLICY "Public Read Monitoring Stations" ON public.monitoring_stations FOR SELECT USING (true);
CREATE POLICY "Public Read Station Observations" ON public.station_observations FOR SELECT USING (true);
CREATE POLICY "Public Read Indicators" ON public.derived_indicators FOR SELECT USING (true);
CREATE POLICY "Public Read Model Predictions" ON public.model_predictions FOR SELECT USING (true);
CREATE POLICY "Public Read Schemes" ON public.schemes FOR SELECT USING (true);
CREATE POLICY "Public Read Interventions" ON public.intervention_proposals FOR SELECT USING (true);
CREATE POLICY "Public Read Recommendations" ON public.intervention_recommendations FOR SELECT USING (true);

-- B. User Profile Security Policies (Jurisdiction Scoped & Prevents Role Elevation)
CREATE POLICY "User View Profiles in Jurisdiction" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id OR
    public.current_user_role() = 'admin' OR
    (public.current_user_district() IS NOT NULL AND jurisdiction_district_id = public.current_user_district())
  );

CREATE POLICY "User Update Self Profile Non Privileged" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    (
      public.current_user_role() = 'admin' OR
      (
        role = public.current_user_role() AND
        COALESCE(jurisdiction_district_id, '') = COALESCE(public.current_user_district(), '')
      )
    )
  );

-- C. Notification & Advisory Records Policies (PII Protection)
CREATE POLICY "Recipient or Officer Read Notifications" ON public.notification_records
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'admin' OR
    (public.current_user_district() IS NOT NULL AND district_name = public.current_user_district()) OR
    recipient_phone = (SELECT phone_number FROM public.profiles WHERE id = auth.uid())
  );

-- D. Intervention Proposals Mutation Policies (Role & Jurisdiction Scoped)
CREATE POLICY "Authenticated Proposal Creation" ON public.intervention_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('admin', 'district_collector', 'bdo', 'gram_pradhan', 'jal_samiti')
  );

CREATE POLICY "Jurisdiction Reviewer Proposal Update" ON public.intervention_proposals
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'district_collector') OR
    (public.current_user_role() = 'bdo' AND (public.current_user_district() IS NULL OR district_name = public.current_user_district())) OR
    proposed_by_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
  );

-- E. Ingestion Runs Log (Admin / Analyst Only)
CREATE POLICY "Analyst Read Ingestion Runs" ON public.ingestion_runs
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'environmental_analyst'));

-- F. Append-Only Audit Log Policies (STRICTLY NO UPDATE or DELETE)
CREATE POLICY "Authenticated Insert Audit Event" ON public.audit_events
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Officer Read Audit Events" ON public.audit_events
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'district_collector') OR
    actor_id = auth.uid()
  );
