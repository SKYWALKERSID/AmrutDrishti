/**
 * JalDrishti Database Row Types
 * Source of Truth: supabase/migrations/20261010000000_init_schema.sql
 * 
 * Strict 1-to-1 TypeScript representations of PostgreSQL tables and enums.
 * Do not add frontend-only properties to these database row models.
 */

// 1. PostgreSQL Enumeration Types
export type UserRoleEnum =
  | 'district_collector'
  | 'bdo'
  | 'gram_pradhan'
  | 'jal_samiti'
  | 'environmental_analyst'
  | 'admin';

export type RiskSeverityEnum = 'normal' | 'watch' | 'severe' | 'gap';

export type DataStatusEnum = 'observed' | 'derived' | 'simulated' | 'predicted';

export type ProposalStatusEnum =
  | 'draft'
  | 'under_review'
  | 'field_verification_requested'
  | 'approved'
  | 'rejected'
  | 'in_execution';

// 2. Table: public.administrative_units
export interface AdministrativeUnitRow {
  unit_id: string;
  unit_type: 'state' | 'district' | 'block';
  name: string;
  district_id: string;
  district_name: string;
  state_name: string;
  coordinates: unknown | null; // PostGIS Geometry(Point, 4326)
  geom: unknown | null;        // PostGIS Geometry(MultiPolygon, 4326)
  total_geographic_area_ha: number | null;
  net_sown_area_ha: number | null;
  boundary_version: string;
  created_at: string;          // TIMESTAMPTZ ISO string
}

// 3. Table: public.derived_indicators
export interface DerivedIndicatorRow {
  indicator_id: string;        // UUID
  unit_id: string;             // FK to administrative_units.unit_id
  grace_twsa_cm: number | null;
  rainfall_anomaly_mm: number | null;
  spi_3month: number | null;
  sentinel_ndvi: number | null;
  sentinel_ndwi: number | null;
  smap_soil_moisture: number | null;
  cgwb_well_depth_mbgl: number | null;
  well_depth_trend_m_per_yr: number | null;
  descriptive_stress_score: number | null; // 0 to 100
  risk_severity: RiskSeverityEnum;
  data_status: DataStatusEnum;
  primary_stress_driver: string | null;
  safeguard_notice: string | null;
  assessed_date: string;       // DATE (YYYY-MM-DD)
  created_at: string;          // TIMESTAMPTZ ISO string
}

// 4. Table: public.monitoring_stations
export interface MonitoringStationRow {
  station_id: string;          // e.g. 'CGWB_MP_TIK_001'
  station_name: string;
  district_id: string;
  block_id: string | null;     // FK to administrative_units.unit_id
  coordinates: unknown;        // PostGIS Geometry(Point, 4326) NOT NULL
  well_depth_mbgl: number | null;
  aquifer_type: string | null;
  agency: string;              // Default 'CGWB'
  is_telemetric: boolean;
  created_at: string;          // TIMESTAMPTZ ISO string
}

// 5. Table: public.station_observations
export interface StationObservationRow {
  observation_id: string;      // UUID
  station_id: string;          // FK to monitoring_stations.station_id
  observation_date: string;    // DATE (YYYY-MM-DD)
  water_level_mbgl: number;
  data_status: DataStatusEnum;
  quality_flag: string;        // Default 'passed'
  created_at: string;          // TIMESTAMPTZ ISO string
}

// 6. Table: public.model_predictions
export interface ModelPredictionRow {
  prediction_id: string;       // UUID
  unit_id: string;             // FK to administrative_units.unit_id
  model_id: string;            // FK to model_registry.model_id
  target_date: string;         // DATE (YYYY-MM-DD)
  predicted_gwl_mbgl: number;
  uncertainty_lower_mbgl: number | null;
  uncertainty_upper_mbgl: number | null;
  predicted_risk_severity: RiskSeverityEnum;
  created_at: string;          // TIMESTAMPTZ ISO string
}
