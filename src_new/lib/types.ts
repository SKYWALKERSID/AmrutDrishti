export type UserRole = 
  | 'district_collector' 
  | 'bdo' 
  | 'gram_pradhan' 
  | 'jal_samiti' 
  | 'environmental_analyst' 
  | 'admin';

export type RiskSeverity = 'normal' | 'watch' | 'severe' | 'gap';

export type DataStatusType = 'observed' | 'derived' | 'simulated' | 'predicted';

export interface EnvironmentalIndicators {
  graceTwsaCm: number;             // GRACE Terrestrial Water Storage Anomaly (cm)
  rainfallAnomalyMm: number;      // IMD Rainfall Anomaly vs 30-yr mean (mm)
  spi3Month: number;               // 3-Month Standardized Precipitation Index
  sentinelNdvi: number;            // Sentinel-2 NDVI (0 to 1)
  sentinelNdwi: number;            // Sentinel-2 NDWI (-1 to 1)
  smapSoilMoisture: number;        // SMAP Surface Soil Moisture (m³/m³)
  cgwbWellDepthMbgl: number;      // CGWB Observation Well depth to water level (m bgl)
  wellDepthTrendMperYr: number;    // Multi-year trend (m/yr change)
  lastUpdatedDate: string;         // ISO Date string
  dataQualityFlag: 'good' | 'suspect' | 'missing';
}

export interface RiskAssessmentDetails {
  descriptiveStressScore: number;  // 0 - 100 transparent aggregated score
  confidenceInterval: [number, number]; // [lower, upper] bounds
  dataStatus: DataStatusType;
  validationStatus: 'validated' | 'demonstration_only' | 'pending_field_review';
  primaryStressDriver: string;
  safeguardNotice: string;
  baselineComparison: string;
  modelMethodologyVersion: string;
  lastAssessedDate: string;
}

export interface BlockData {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  state: string;
  coordinates: [number, number];   // Center [lat, lng]
  populationEst: number;
  totalGeographicAreaHa: number;
  netSownAreaHa: number;
  primaryCropSeason: string;
  riskSeverity: RiskSeverity;
  indicators: EnvironmentalIndicators;
  assessment: RiskAssessmentDetails;
  activeInterventionsCount: number;
  openAlertsCount: number;
}

export interface DistrictData {
  id: string;
  name: string;
  state: string;
  centerCoordinates: [number, number];
  blocksCount: number;
  overallSeverity: RiskSeverity;
  avgGraceTwsaCm: number;
  avgRainfallAnomalyMm: number;
  blocks: BlockData[];
}

export interface SchemeItem {
  id: string;
  code: string;
  name: string;
  description: string;
  primaryFocus: string;
  fundingStructure: string;
  eligibleTargetConditions: string[];
  maxSanctionUnitAmountInr: number;
  implementingAgency: string;
  officialGuidanceUrl: string;
}

export interface InterventionProposal {
  id: string;
  title: string;
  blockId: string;
  blockName: string;
  districtName: string;
  schemeId: string;
  schemeName: string;
  proposedByRole: UserRole;
  proposedByName: string;
  targetVillage: string;
  estimatedCostInr: number;
  beneficiariesCount: number;
  evidenceRationale: string;
  missingEvidenceNotes?: string;
  reviewOwnerRole: UserRole;
  reviewOwnerName: string;
  status: 'draft' | 'under_review' | 'field_verification_requested' | 'approved' | 'rejected' | 'in_execution';
  createdDate: string;
  lastUpdatedDate: string;
  comments: Array<{
    authorName: string;
    authorRole: UserRole;
    date: string;
    text: string;
  }>;
}

export interface AlertTemplate {
  id: string;
  title: string;
  hindiText: string;
  englishText: string;
  targetRole: UserRole;
  severity: RiskSeverity;
}

export interface NotificationRecord {
  id: string;
  recipientName: string;
  recipientRole: UserRole;
  recipientPhone: string;
  districtName: string;
  blockName: string;
  severity: RiskSeverity;
  channel: 'SMS' | 'WhatsApp' | 'In-App';
  messageHindi: string;
  messageEnglish: string;
  sentTimestamp: string;
  deliveryStatus: 'delivered' | 'pending' | 'failed' | 'simulated';
  confidenceScore: number;
  dataFreshnessDate: string;
}

export interface DataSourceStatus {
  id: string;
  name: string;
  provider: string;
  spatialResolution: string;
  temporalCadence: string;
  lastSuccessfulIngestion: string;
  latestObservationDate: string;
  status: 'healthy' | 'lagging' | 'error' | 'pending_credentials';
  missingDataRatePct: number;
  licenseTerms: string;
  provenanceDetails: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: UserRole;
  userName: string;
  action: string;
  details: string;
  targetResource: string;
}
