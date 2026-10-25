/**
 * JAL DRISHTI — Authoritative State and Region Registry
 * 
 * Defines the authoritative nine-state geographic scope grouped into four project regions:
 * 1. South India (3 states): Karnataka, Telangana, Tamil Nadu
 * 2. Central India (1 state): Madhya Pradesh
 * 3. North India (3 states): Rajasthan, Haryana, Punjab
 * 4. Northeast India (2 states): Meghalaya, Tripura
 * 
 * Note: Assam, Uttar Pradesh, Sikkim, and Arunachal Pradesh are strictly outside active scope.
 */

export type ProjectRegion = 'South India' | 'Central India' | 'North India' | 'Northeast India';

export const TARGET_REGIONS: ProjectRegion[] = [
  'South India',
  'Central India',
  'North India',
  'Northeast India'
];

export interface TargetStateMetadata {
  id: string;
  code: string;
  name: string;
  displayName: string;
  region: ProjectRegion;
  isTargetScope: true;
  readinessStatus: 'fully_implemented' | 'partially_implemented' | 'ingestion_pending' | 'historical_baseline';
  districtsCount: number;
  monitoredDistrictsCount: number;
  blocksCount: number;
  stationsCount: number;
  availableSources: string[];
  latestObservationDate: string | null;
  lastIngestionTime: string | null;
  temporalResolution: string;
  freshnessStatus: 'CURRENT' | 'STALE' | 'HISTORICAL' | 'PARTIAL' | 'UNAVAILABLE';
  dataQualityStatus: 'good' | 'mixed' | 'missing' | 'pending_field_review';
  supportedIndicators: string[];
  forecastAvailability: 'packaged_ml' | 'empirical_baseline' | 'unavailable';
  modelStatus: 'calibrated_operational' | 'research_prototype' | 'unavailable';
  sourceAttribution: string;
  knownLimitations: string;
}

export interface IndianStateMeta {
  code: string;
  name: string;
  id: string;
  hasData: boolean;
  isTargetScope: boolean;
  region?: ProjectRegion;
  statusLabel?: string;
  districtsCount?: number;
  targetMetadata?: TargetStateMetadata;
}

/**
 * Authoritative Initial Ten-State Target Scope Metadata.
 */
export const TARGET_STATES_METADATA: Record<string, TargetStateMetadata> = {
  // -------------------------------------------------------------
  // SOUTH INDIA (3 States)
  // -------------------------------------------------------------
  KA: {
    id: 'karnataka',
    code: 'KA',
    name: 'Karnataka',
    displayName: 'Karnataka',
    region: 'South India',
    isTargetScope: true,
    readinessStatus: 'ingestion_pending',
    districtsCount: 31,
    monitoredDistrictsCount: 2,
    blocksCount: 3,
    stationsCount: 36,
    availableSources: ['src_karnataka_dwlr_telemetry', 'src_karnataka_gwd_monthly', 'src_imd_rainfall', 'src_grace_fo', 'src_sentinel2_sr'],
    latestObservationDate: '2023-12-31',
    lastIngestionTime: '2026-10-20T13:30:00Z',
    temporalResolution: '6-Hourly DWLR Telemetry & Monthly Manual',
    freshnessStatus: 'HISTORICAL',
    dataQualityStatus: 'pending_field_review',
    supportedIndicators: ['cgwbWellDepthMbgl', 'rainfallAnomalyMm', 'graceTwsaCm', 'sentinelNdvi', 'smapSoilMoisture'],
    forecastAvailability: 'unavailable',
    modelStatus: 'unavailable',
    sourceAttribution: 'Karnataka Ground Water Department / National Water Informatics Centre (NWIC)',
    knownLimitations: 'Observational baseline defined from NWIC monthly manual monitoring (https://nwdp.nwic.gov.in/dataset/1cbc78e5-42e2-4140-a584-ec752c994955). Full local CSV ingestion pending; ML forecasting models currently unavailable pending local hydrologic calibration.'
  },
  TG: {
    id: 'telangana',
    code: 'TG',
    name: 'Telangana',
    displayName: 'Telangana',
    region: 'South India',
    isTargetScope: true,
    readinessStatus: 'ingestion_pending',
    districtsCount: 33,
    monitoredDistrictsCount: 3,
    blocksCount: 3,
    stationsCount: 888,
    availableSources: ['src_telangana_gw_manual', 'src_imd_rainfall', 'src_grace_fo', 'src_sentinel2_sr'],
    latestObservationDate: '2023-07-25',
    lastIngestionTime: '2026-10-20T13:30:00Z',
    temporalResolution: 'Quarterly Manual Monitoring',
    freshnessStatus: 'HISTORICAL',
    dataQualityStatus: 'pending_field_review',
    supportedIndicators: ['cgwbWellDepthMbgl', 'rainfallAnomalyMm', 'graceTwsaCm', 'sentinelNdvi', 'smapSoilMoisture'],
    forecastAvailability: 'unavailable',
    modelStatus: 'unavailable',
    sourceAttribution: 'Telangana Ground Water Department / NWIC',
    knownLimitations: 'Observational baseline defined from NWIC monthly manual records (https://nwdp.nwic.gov.in/dataset/0000396f-0381-4154-923e-86c8e23c5f5f). Full raw CSV ingestion pending; hard-rock granitic aquifers exhibit sharp drawdown response during pre-monsoon pumping.'
  },
  TN: {
    id: 'tamil_nadu',
    code: 'TN',
    name: 'Tamil Nadu',
    displayName: 'Tamil Nadu',
    region: 'South India',
    isTargetScope: true,
    readinessStatus: 'ingestion_pending',
    districtsCount: 38,
    monitoredDistrictsCount: 3,
    blocksCount: 3,
    stationsCount: 313,
    availableSources: ['src_tamilnadu_gw_telemetry', 'src_imd_rainfall', 'src_grace_fo', 'src_sentinel2_sr'],
    latestObservationDate: '2024-03-15',
    lastIngestionTime: '2026-10-20T13:30:00Z',
    temporalResolution: 'Monthly Telemetry & Periodic Manual',
    freshnessStatus: 'HISTORICAL',
    dataQualityStatus: 'pending_field_review',
    supportedIndicators: ['cgwbWellDepthMbgl', 'rainfallAnomalyMm', 'graceTwsaCm', 'sentinelNdvi', 'smapSoilMoisture'],
    forecastAvailability: 'unavailable',
    modelStatus: 'unavailable',
    sourceAttribution: 'Tamil Nadu Surface Water and Ground Water Departments / NWIC',
    knownLimitations: 'Observational baseline defined from NWIC 6-hourly telemetry series (https://nwdp.nwic.gov.in/dataset/16efa917-4b91-473b-969d-57d1bcd11924). Full raw CSV ingestion pending; bimodal precipitation regime dominated by Northeast Monsoon (Oct-Dec).'
  },

  // -------------------------------------------------------------
  // CENTRAL INDIA (1 State)
  // -------------------------------------------------------------
  MP: {
    id: 'madhya_pradesh',
    code: 'MP',
    name: 'Madhya Pradesh',
    displayName: 'Madhya Pradesh',
    region: 'Central India',
    isTargetScope: true,
    readinessStatus: 'fully_implemented',
    districtsCount: 52,
    monitoredDistrictsCount: 3,
    blocksCount: 9,
    stationsCount: 590112,
    availableSources: ['src_mp_gwd_monthly', 'src_imd_rainfall', 'src_grace_fo', 'src_sentinel2_sr', 'src_smap_sm'],
    latestObservationDate: '2025-11-30',
    lastIngestionTime: '2026-10-20T13:00:00Z',
    temporalResolution: 'Monthly Manual & High-Frequency Satellite Telemetry',
    freshnessStatus: 'CURRENT',
    dataQualityStatus: 'good',
    supportedIndicators: ['cgwbWellDepthMbgl', 'rainfallAnomalyMm', 'graceTwsaCm', 'sentinelNdvi', 'smapSoilMoisture'],
    forecastAvailability: 'packaged_ml',
    modelStatus: 'research_prototype',
    sourceAttribution: 'MP Ground Water Department / CGWB / NWIC',
    knownLimitations: 'Hard-rock basalt and granitic aquifers exhibit localized fracture anisotropy; models are research prototypes (operational_eligibility: false).'
  },

  // -------------------------------------------------------------
  // NORTH INDIA (3 States)
  // -------------------------------------------------------------
  RJ: {
    id: 'rajasthan',
    code: 'RJ',
    name: 'Rajasthan',
    displayName: 'Rajasthan',
    region: 'North India',
    isTargetScope: true,
    readinessStatus: 'fully_implemented',
    districtsCount: 33,
    monitoredDistrictsCount: 5,
    blocksCount: 13,
    stationsCount: 7414,
    availableSources: ['src_rajasthan_gw_manual_2021_2025', 'src_cgwb_contrast_rj', 'src_imd_rainfall', 'src_grace_fo', 'src_sentinel2_sr'],
    latestObservationDate: '2024-08-30',
    lastIngestionTime: '2026-10-20T13:18:45Z',
    temporalResolution: 'Quarterly Manual & CGWB Telemetry',
    freshnessStatus: 'CURRENT',
    dataQualityStatus: 'good',
    supportedIndicators: ['cgwbWellDepthMbgl', 'rainfallAnomalyMm', 'graceTwsaCm', 'sentinelNdvi', 'smapSoilMoisture'],
    forecastAvailability: 'packaged_ml',
    modelStatus: 'research_prototype',
    sourceAttribution: 'Rajasthan Ground Water Department / CGWB / NWIC',
    knownLimitations: 'Critical arid aquifers with water tables exceeding 40m bgl; deep capillary fringes increase measurement uncertainty.'
  },
  HR: {
    id: 'haryana',
    code: 'HR',
    name: 'Haryana',
    displayName: 'Haryana',
    region: 'North India',
    isTargetScope: true,
    readinessStatus: 'fully_implemented',
    districtsCount: 22,
    monitoredDistrictsCount: 4,
    blocksCount: 4,
    stationsCount: 505,
    availableSources: ['src_haryana_gw_manual_2021_2025', 'src_cgwb_contrast_hr', 'src_imd_rainfall', 'src_grace_fo', 'src_sentinel2_sr'],
    latestObservationDate: '2024-01-01',
    lastIngestionTime: '2026-10-20T13:18:45Z',
    temporalResolution: 'Quarterly Manual Monitoring',
    freshnessStatus: 'CURRENT',
    dataQualityStatus: 'good',
    supportedIndicators: ['cgwbWellDepthMbgl', 'rainfallAnomalyMm', 'graceTwsaCm', 'sentinelNdvi', 'smapSoilMoisture'],
    forecastAvailability: 'packaged_ml',
    modelStatus: 'research_prototype',
    sourceAttribution: 'Haryana Ground Water Department / CGWB / NWIC',
    knownLimitations: 'Intense agricultural draft during Paddy-Wheat rotation causes severe seasonal drawdown in unconfined alluvial layers.'
  },
  PB: {
    id: 'punjab',
    code: 'PB',
    name: 'Punjab',
    displayName: 'Punjab',
    region: 'North India',
    isTargetScope: true,
    readinessStatus: 'fully_implemented',
    districtsCount: 23,
    monitoredDistrictsCount: 4,
    blocksCount: 4,
    stationsCount: 1074,
    availableSources: ['src_cgwb_contrast_pb', 'src_imd_rainfall', 'src_grace_fo', 'src_sentinel2_sr'],
    latestObservationDate: '2024-01-01',
    lastIngestionTime: '2026-10-20T13:00:00Z',
    temporalResolution: 'Quarterly Piezometer Monitoring',
    freshnessStatus: 'CURRENT',
    dataQualityStatus: 'good',
    supportedIndicators: ['cgwbWellDepthMbgl', 'rainfallAnomalyMm', 'graceTwsaCm', 'sentinelNdvi', 'smapSoilMoisture'],
    forecastAvailability: 'packaged_ml',
    modelStatus: 'research_prototype',
    sourceAttribution: 'Central Ground Water Board (CGWB) / NWIC',
    knownLimitations: 'Over-exploited regional multi-layer alluvial aquifer system; state-level extraction ratio exceeds 150%.'
  },

  // -------------------------------------------------------------
  // NORTHEAST INDIA (3 States)
  // -------------------------------------------------------------
  ML: {
    id: 'meghalaya',
    code: 'ML',
    name: 'Meghalaya',
    displayName: 'Meghalaya',
    region: 'Northeast India',
    isTargetScope: true,
    readinessStatus: 'fully_implemented',
    districtsCount: 12,
    monitoredDistrictsCount: 3,
    blocksCount: 3,
    stationsCount: 7,
    availableSources: ['src_meghalaya_gw_manual', 'src_meghalaya_dwlr_historical', 'src_imd_rainfall', 'src_grace_fo', 'src_sentinel2_sr'],
    latestObservationDate: '2023-04-10',
    lastIngestionTime: '2026-10-20T13:18:25Z',
    temporalResolution: 'Quarterly Manual Monitoring',
    freshnessStatus: 'CURRENT',
    dataQualityStatus: 'good',
    supportedIndicators: ['cgwbWellDepthMbgl', 'rainfallAnomalyMm', 'graceTwsaCm', 'sentinelNdvi', 'smapSoilMoisture'],
    forecastAvailability: 'unavailable',
    modelStatus: 'unavailable',
    sourceAttribution: 'Meghalaya Ground Water Department / NWIC',
    knownLimitations: 'Hilly karst and fractured sandstone plateau; heavy orographic precipitation is offset by steep topographic runoff.'
  },
  TR: {
    id: 'tripura',
    code: 'TR',
    name: 'Tripura',
    displayName: 'Tripura',
    region: 'Northeast India',
    isTargetScope: true,
    readinessStatus: 'ingestion_pending',
    districtsCount: 8,
    monitoredDistrictsCount: 3,
    blocksCount: 3,
    stationsCount: 16,
    availableSources: ['src_tripura_gw_telemetry', 'src_imd_rainfall', 'src_grace_fo', 'src_sentinel2_sr'],
    latestObservationDate: '2024-05-15',
    lastIngestionTime: '2026-10-20T13:30:00Z',
    temporalResolution: '6-Hourly Automated Telemetry',
    freshnessStatus: 'HISTORICAL',
    dataQualityStatus: 'pending_field_review',
    supportedIndicators: ['cgwbWellDepthMbgl', 'rainfallAnomalyMm', 'graceTwsaCm', 'sentinelNdvi', 'smapSoilMoisture'],
    forecastAvailability: 'unavailable',
    modelStatus: 'unavailable',
    sourceAttribution: 'Tripura Water Resources Department / NWIC',
    knownLimitations: 'Observational baseline defined from NWIC 6-hourly automated telemetry series (https://nwdp.nwic.gov.in/dataset/b126fbb8-0ab5-4d81-8cbc-93c170807f53). Full local raw CSV ingestion pending; synclinal valley alluvium with high baseflow.'
  }
};

/**
 * The Authoritative Ten Target States Array.
 */
export const ALL_TARGET_STATES: IndianStateMeta[] = [
  // South India (3 states)
  {
    code: 'KA',
    name: 'Karnataka',
    id: 'karnataka',
    hasData: true,
    isTargetScope: true,
    region: 'South India',
    statusLabel: 'South India — Hard-Rock & Peripheral Western Ghats Basins (NWIC Telemetry)',
    districtsCount: 31,
    targetMetadata: TARGET_STATES_METADATA.KA
  },
  {
    code: 'TG',
    name: 'Telangana',
    id: 'telangana',
    hasData: true,
    isTargetScope: true,
    region: 'South India',
    statusLabel: 'South India — Godavari/Krishna Basalt & Granitic Plateau (NWIC Quarterly)',
    districtsCount: 33,
    targetMetadata: TARGET_STATES_METADATA.TG
  },
  {
    code: 'TN',
    name: 'Tamil Nadu',
    id: 'tamil_nadu',
    hasData: true,
    isTargetScope: true,
    region: 'South India',
    statusLabel: 'South India — Coastal Alluvium & Noyyal Hard-Rock Basins (NWIC Telemetry)',
    districtsCount: 38,
    targetMetadata: TARGET_STATES_METADATA.TN
  },

  // Central India (1 state)
  {
    code: 'MP',
    name: 'Madhya Pradesh',
    id: 'madhya_pradesh',
    hasData: true,
    isTargetScope: true,
    region: 'Central India',
    statusLabel: 'Central India — Bundelkhand Hard-Rock Basins (Live Telemetry & ML v2.0)',
    districtsCount: 52,
    targetMetadata: TARGET_STATES_METADATA.MP
  },

  // North India (3 states)
  {
    code: 'RJ',
    name: 'Rajasthan',
    id: 'rajasthan',
    hasData: true,
    isTargetScope: true,
    region: 'North India',
    statusLabel: 'North India — Critical Arid & Deep Sandstone Aquifers (CGWB / State GWD & ML v2.0)',
    districtsCount: 33,
    targetMetadata: TARGET_STATES_METADATA.RJ
  },
  {
    code: 'HR',
    name: 'Haryana',
    id: 'haryana',
    hasData: true,
    isTargetScope: true,
    region: 'North India',
    statusLabel: 'North India — High Agricultural Extraction Alluvium (CGWB / State GWD & ML v2.0)',
    districtsCount: 22,
    targetMetadata: TARGET_STATES_METADATA.HR
  },
  {
    code: 'PB',
    name: 'Punjab',
    id: 'punjab',
    hasData: true,
    isTargetScope: true,
    region: 'North India',
    statusLabel: 'North India — Over-Exploited Alluvial Red Zone (CGWB Network & ML v2.0)',
    districtsCount: 23,
    targetMetadata: TARGET_STATES_METADATA.PB
  },

  // Northeast India (3 states)
  {
    code: 'ML',
    name: 'Meghalaya',
    id: 'meghalaya',
    hasData: true,
    isTargetScope: true,
    region: 'Northeast India',
    statusLabel: 'Northeast India — High-Precipitation Karst & Springshed Plateau (NWIC Station Records)',
    districtsCount: 12,
    targetMetadata: TARGET_STATES_METADATA.ML
  },
  {
    code: 'TR',
    name: 'Tripura',
    id: 'tripura',
    hasData: true,
    isTargetScope: true,
    region: 'Northeast India',
    statusLabel: 'Northeast India — Synclinal Valley Alluvium (Tripura Telemetry Network)',
    districtsCount: 8,
    targetMetadata: TARGET_STATES_METADATA.TR
  }
];

/**
 * Historical Reference / Out-of-Scope States preserved for scientific provenance and regression fixtures.
 */
export const HISTORICAL_REFERENCE_STATES: IndianStateMeta[] = [
  {
    code: 'AS',
    name: 'Assam',
    id: 'assam',
    hasData: false,
    isTargetScope: false,
    region: 'Northeast India',
    statusLabel: 'Historical Baseline Reference — Brahmaputra Valley Alluvial Recharge (Outside Active 43-Block Scope)',
    districtsCount: 35
  },
  {
    code: 'UP',
    name: 'Uttar Pradesh',
    id: 'uttar_pradesh',
    hasData: false,
    isTargetScope: false,
    region: 'Central India',
    statusLabel: 'Historical Pilot Reference — Alluvial Basin (Outside Active Scope)',
    districtsCount: 75
  },
  {
    code: 'SK',
    name: 'Sikkim',
    id: 'sikkim',
    hasData: false,
    isTargetScope: false,
    region: 'Northeast India',
    statusLabel: 'Scientific Reference — Mountain Springshed Contrast (Outside Active Scope)',
    districtsCount: 6
  },
  {
    code: 'AR',
    name: 'Arunachal Pradesh',
    id: 'arunachal_pradesh',
    hasData: false,
    isTargetScope: false,
    region: 'Northeast India',
    statusLabel: 'Scientific Reference — Surplus Basin Benchmark (Outside Active Scope)',
    districtsCount: 26
  }
];

/**
 * Expansion Phase States & Union Territories (Telemetry Ingestion Pending).
 */
export const EXPANSION_INDIAN_STATES: IndianStateMeta[] = [
  { code: 'AN', name: 'Andaman and Nicobar Islands', id: 'andaman_and_nicobar_islands', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'AP', name: 'Andhra Pradesh', id: 'andhra_pradesh', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'BR', name: 'Bihar', id: 'bihar', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'CH', name: 'Chandigarh', id: 'chandigarh', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'CT', name: 'Chhattisgarh', id: 'chhattisgarh', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'DH', name: 'Dadra and Nagar Haveli and Daman and Diu', id: 'dadra_and_nagar_haveli_and_daman_and_diu', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'DL', name: 'Delhi', id: 'delhi', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'GA', name: 'Goa', id: 'goa', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'GJ', name: 'Gujarat', id: 'gujarat', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'HP', name: 'Himachal Pradesh', id: 'himachal_pradesh', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'JK', name: 'Jammu and Kashmir', id: 'jammu_and_kashmir', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'JH', name: 'Jharkhand', id: 'jharkhand', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'KL', name: 'Kerala', id: 'kerala', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'LA', name: 'Ladakh', id: 'ladakh', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'LD', name: 'Lakshadweep', id: 'lakshadweep', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'MH', name: 'Maharashtra', id: 'maharashtra', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'MN', name: 'Manipur', id: 'manipur', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'MZ', name: 'Mizoram', id: 'mizoram', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'NL', name: 'Nagaland', id: 'nagaland', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'OR', name: 'Odisha', id: 'odisha', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'PY', name: 'Puducherry', id: 'puducherry', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'UT', name: 'Uttarakhand', id: 'uttarakhand', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' },
  { code: 'WB', name: 'West Bengal', id: 'west_bengal', hasData: false, isTargetScope: false, statusLabel: 'Expansion Phase (Telemetry Ingestion Pending)' }
];

/**
 * Unified Canonical List of all 36 Indian States and Union Territories.
 * Target states are listed with hasData: true and isTargetScope: true.
 */
export const ALL_INDIAN_STATES: IndianStateMeta[] = [
  ...ALL_TARGET_STATES,
  ...HISTORICAL_REFERENCE_STATES,
  ...EXPANSION_INDIAN_STATES
];

/**
 * Returns all nine target states.
 */
export function getTargetStates(): IndianStateMeta[] {
  return ALL_TARGET_STATES;
}

/**
 * Returns target states in a given region.
 */
export function getTargetStatesByRegion(region: ProjectRegion): IndianStateMeta[] {
  return ALL_TARGET_STATES.filter(s => s.region === region);
}

/**
 * Checks if a state name or code is in the authoritative ten-state target scope.
 */
export function isTargetState(nameOrCode: string): boolean {
  if (!nameOrCode) return false;
  const lower = nameOrCode.toLowerCase().trim();
  return ALL_TARGET_STATES.some(
    s => s.code.toLowerCase() === lower || s.name.toLowerCase() === lower || s.id.toLowerCase() === lower
  );
}

/**
 * Retrieves metadata for a target state by code or ID.
 */
export function getTargetStateMetadata(codeOrId: string): TargetStateMetadata | null {
  if (!codeOrId) return null;
  const upper = codeOrId.toUpperCase().trim();
  if (TARGET_STATES_METADATA[upper]) return TARGET_STATES_METADATA[upper];
  const found = Object.values(TARGET_STATES_METADATA).find(
    m => m.id.toLowerCase() === codeOrId.toLowerCase() || m.name.toLowerCase() === codeOrId.toLowerCase()
  );
  return found || null;
}
