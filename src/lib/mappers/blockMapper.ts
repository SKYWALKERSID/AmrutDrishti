import type { BlockData, RiskSeverity, DataStatusType } from '../types.ts';
import type { AdministrativeUnitRow, DerivedIndicatorRow } from '../types/database.ts';

export interface MapBlockOptions {
  activeInterventionsCount?: number;
  openAlertsCount?: number;
}

/**
 * Validates latitude and longitude ranges.
 * Latitude must be in [-90, 90], Longitude in [-180, 180].
 */
export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Checks if coordinates represent a valid, non-null coordinate tuple.
 */
export function hasValidCoordinates(coordinates: [number, number] | null): coordinates is [number, number] {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) return false;
  const [lat, lng] = coordinates;
  return isValidLatLng(lat, lng);
}

/**
 * Parses raw PostGIS / GeoJSON point geometries into a Leaflet [latitude, longitude] tuple.
 * PostGIS and GeoJSON use [longitude, latitude] ordering.
 * Leaflet requires [latitude, longitude] ordering.
 * 
 * Returns null if coordinates are missing, malformed, or out of valid geographic range.
 * Valid zero-valued coordinates (e.g. [0, 0], [0, 45], [45, 0]) remain valid.
 */
export function parsePointCoordinates(raw: unknown): [number, number] | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  // 1. GeoJSON Point Object { type: "Point", coordinates: [lng, lat] }
  if (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { type?: string }).type === 'Point' &&
    Array.isArray((raw as { coordinates?: unknown }).coordinates)
  ) {
    const coords = (raw as { coordinates: unknown[] }).coordinates;
    if (coords.length >= 2) {
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (isValidLatLng(lat, lng)) {
        return [lat, lng];
      }
    }
    return null;
  }

  // 2. PostGIS WKT String (e.g. "POINT(78.8311 24.7456)")
  if (typeof raw === 'string') {
    const wktMatch = raw.match(/^POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)$/i);
    if (wktMatch) {
      const lng = Number(wktMatch[1]);
      const lat = Number(wktMatch[2]);
      if (isValidLatLng(lat, lng)) {
        return [lat, lng];
      }
    }
    return null;
  }

  // 3. Array [val1, val2]
  if (Array.isArray(raw) && raw.length >= 2) {
    const v1 = Number(raw[0]);
    const v2 = Number(raw[1]);

    // Check if input is GeoJSON [lng, lat] (where lng is first, e.g. 78.8, 24.7 for India)
    if (isValidLatLng(v2, v1) && (v1 > 50 || v2 < 35)) {
      return [v2, v1];
    }
    // Check if input is already Leaflet [lat, lng]
    if (isValidLatLng(v1, v2)) {
      return [v1, v2];
    }
  }

  return null;
}

/**
 * Safely parses raw GeoJSON geometry objects for polygon boundaries without altering coordinate order.
 * GeoJSON layers in Leaflet expect standard GeoJSON [longitude, latitude] arrays.
 */
export function parseGeoJsonGeometry(raw: unknown): GeoJSON.Geometry | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const obj = raw as { type?: string; coordinates?: unknown };
  if (
    typeof obj.type === 'string' &&
    Array.isArray(obj.coordinates) &&
    ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'].includes(obj.type)
  ) {
    return raw as GeoJSON.Geometry;
  }

  return undefined;
}

const UNIT_ID_TO_SLUG: Record<string, string> = {
  '3783': 'blk_bijawar',
  '3788': 'blk_rajnagar',
  '4027': 'blk_baldeogarh',
  '4028': 'blk_jatara',
  '4030': 'blk_palera',
  '4032': 'blk_tikamgarh_main',
};

/**
 * Maps PostgreSQL Database rows (AdministrativeUnitRow & DerivedIndicatorRow)
 * to the frontend BlockData UI model with honest missing-value and provenance handling.
 */
export function mapDbRowToBlockData(
  unit: AdministrativeUnitRow,
  indicator: DerivedIndicatorRow | null,
  options: MapBlockOptions = {}
): BlockData {
  const coordinates = parsePointCoordinates(unit.coordinates);
  const geojsonGeometry = parseGeoJsonGeometry(unit.geom);
  const blockSlugId = UNIT_ID_TO_SLUG[unit.unit_id] || unit.unit_id;

  // Missing Indicator Fallback Handling
  if (!indicator) {
    return {
      id: blockSlugId,
      name: unit.name,
      districtId: unit.district_id,
      districtName: unit.district_name,
      state: unit.state_name,
      coordinates,
      populationEst: 0, // DDL schema does not contain population_est column
      totalGeographicAreaHa: unit.total_geographic_area_ha ?? 0,
      netSownAreaHa: unit.net_sown_area_ha ?? 0,
      primaryCropSeason: 'Unrecorded',
      riskSeverity: 'gap' as RiskSeverity,
      indicators: {
        graceTwsaCm: null,
        rainfallAnomalyMm: null,
        spi3Month: null,
        sentinelNdvi: null,
        sentinelNdwi: null,
        smapSoilMoisture: null,
        cgwbWellDepthMbgl: null,
        wellDepthTrendMperYr: null,
        lastUpdatedDate: unit.created_at ? new Date(unit.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        dataQualityFlag: 'missing'
      },
      assessment: {
        descriptiveStressScore: 0,
        confidenceInterval: null, // Explicit null for uncalibrated confidence interval
        dataStatus: 'simulated' as DataStatusType,
        validationStatus: 'pending_field_review',
        primaryStressDriver: 'Data Gap — No environmental indicators recorded for this administrative unit.',
        safeguardNotice: 'Data Gap Notice — Field measurements pending. Do not perform risk scoring without observed indicators.',
        baselineComparison: 'Uncalibrated',
        modelMethodologyVersion: 'Unspecified',
        lastAssessedDate: unit.created_at ? new Date(unit.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      },
      activeInterventionsCount: options.activeInterventionsCount ?? 0,
      openAlertsCount: options.openAlertsCount ?? 0,
      geojsonGeometry
    };
  }

  // Populate from valid DerivedIndicatorRow preserving true data provenance
  const score = indicator.descriptive_stress_score ?? 0;
  const isDataMissing = indicator.grace_twsa_cm === null && indicator.cgwb_well_depth_mbgl === null;

  return {
    id: blockSlugId,
    name: unit.name,
    districtId: unit.district_id === '398' || unit.district_id === 'dist_chhatarpur'
      ? 'dist_chhatarpur'
      : (unit.district_id === '434' || unit.district_id === 'dist_tikamgarh' ? 'dist_tikamgarh' : unit.district_id),
    districtName: unit.district_name,
    state: unit.state_name,
    coordinates,
    populationEst: 0, // DDL schema does not contain population_est column
    totalGeographicAreaHa: unit.total_geographic_area_ha ?? 0,
    netSownAreaHa: unit.net_sown_area_ha ?? 0,
    primaryCropSeason: 'Unrecorded',
    riskSeverity: (indicator.risk_severity || 'normal') as RiskSeverity,
    indicators: {
      graceTwsaCm: indicator.grace_twsa_cm,
      rainfallAnomalyMm: indicator.rainfall_anomaly_mm,
      spi3Month: indicator.spi_3month,
      sentinelNdvi: indicator.sentinel_ndvi,
      sentinelNdwi: indicator.sentinel_ndwi,
      smapSoilMoisture: indicator.smap_soil_moisture,
      cgwbWellDepthMbgl: indicator.cgwb_well_depth_mbgl,
      wellDepthTrendMperYr: indicator.well_depth_trend_m_per_yr,
      lastUpdatedDate: indicator.assessed_date || (unit.created_at ? new Date(unit.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      dataQualityFlag: isDataMissing ? 'missing' : 'good'
    },
    assessment: {
      descriptiveStressScore: score,
      confidenceInterval: null, // Explicit null for uncalibrated confidence interval
      dataStatus: (indicator.data_status || 'observed') as DataStatusType,
      validationStatus: 'demonstration_only',
      primaryStressDriver: indicator.primary_stress_driver || 'Environmental Stress Analysis Pending',
      safeguardNotice: indicator.safeguard_notice || 'Demonstration Data — Subject to field verification.',
      baselineComparison: 'Uncalibrated',
      modelMethodologyVersion: 'Unspecified',
      lastAssessedDate: indicator.assessed_date || (unit.created_at ? new Date(unit.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
    },
    activeInterventionsCount: options.activeInterventionsCount ?? 0,
    openAlertsCount: options.openAlertsCount ?? 0,
    geojsonGeometry
  };
}
