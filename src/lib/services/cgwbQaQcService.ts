/**
 * AMRUT DRISHTI — CGWB High-Frequency QA/QC Validation & Taxonomy Definitions
 * =========================================================================
 * TypeScript implementation matching the Python engine in ml/qa_qc/validator.py
 * and complying with Central Ground Water Board (CGWB) Guidelines (February 2026).
 *
 * References:
 * - Table 8: 5-Status Taxonomy (Valid, Suspect, Invalid, Missing, Replaced)
 * - Table 9: Missing Value Handling Flags (M, F, I, N, C)
 * - Table 13: QA-QC Schedule & Standard Operating Procedures
 */

import stationRegistryData from '../../../data/derived/cgwb_station_registry.json' with { type: 'json' };

export type CgwbValidationStatus = 'Valid' | 'Suspect' | 'Invalid' | 'Missing' | 'Replaced';

export type ImputationStrategyFlag = '' | 'M' | 'F' | 'I' | 'N' | 'C';

export interface StationQcProfile {
  stationId: string;
  stationName: string;
  state: string;
  district: string;
  block?: string | null;
  expectedIntervalHours: number;
  minDepthMbgl: number;
  maxDepthMbgl: number;
  maxStepChangeM: number;
  flatlineConsecutiveCount: number;
  flatlineToleranceM: number;
  allowZeroReading: boolean;
  datumConvention: 'depth_below_ground_level' | 'elevation_above_msl' | 'undocumented_negative_datum';
  ruleVersion: string;
}

export interface ValidationResult {
  sourceIndex: number;
  stationId: string;
  timestamp: string; // ISO-8601
  originalValue: number | null;
  validatedValue: number | null;
  status: CgwbValidationStatus;
  reasonCode: string;
  reasonDetails: string;
  imputationFlag: ImputationStrategyFlag;
  checkBoolean: boolean;
  ruleVersion: string;
  validatedAt: string;
}

export interface StationRegistryEntry {
  station_id: string;
  canonical_name: string;
  agency: string;
  station_type: string;
  state: string;
  district: string;
  block_id: string | null;
  block_name: string | null;
  village: string | null;
  coordinates: {
    latitude: number | null;
    longitude: number | null;
    crs: string;
    coordinates_verification: string;
  };
  elevation_rl_msl: number | null;
  measurement_semantics: {
    parameter: string;
    units: string;
    datum_convention: string;
    sign_convention: string;
    semantics_verified: boolean;
  };
  verification_status: 'verified' | 'candidate' | 'unresolved';
  mapping_evidence: string;
  source_files: string[];
}

export interface StationRegistryPayload {
  generated_at: string;
  registry_version: string;
  standard_reference: string;
  total_stations: number;
  status_summary: {
    verified: number;
    candidate: number;
    unresolved: number;
  };
  station_type_summary: {
    manual_piezometer_quarterly: number;
    dwlr_telemetry_6_hourly: number;
  };
  stations: Record<string, StationRegistryEntry>;
}

export const STATION_REGISTRY: StationRegistryPayload = stationRegistryData as StationRegistryPayload;

/**
 * Validates a single reading against CGWB preliminary requirements.
 */
export function validateSingleObservation(
  value: number | null | undefined,
  timestampIso: string | null | undefined,
  profile: StationQcProfile,
  referenceTime = new Date(),
): { status: CgwbValidationStatus; reasonCode: string; reasonDetails: string } {
  // 1. Timestamp validation
  if (!timestampIso) {
    return {
      status: 'Invalid',
      reasonCode: 'invalid_timestamp',
      reasonDetails: 'Missing or null timestamp',
    };
  }

  const dt = new Date(timestampIso);
  if (Number.isNaN(dt.getTime())) {
    return {
      status: 'Invalid',
      reasonCode: 'invalid_timestamp',
      reasonDetails: `Unparseable datetime string: ${timestampIso}`,
    };
  }

  if (dt.getTime() > referenceTime.getTime()) {
    return {
      status: 'Invalid',
      reasonCode: 'future_dated_timestamp',
      reasonDetails: `Timestamp ${timestampIso} exceeds current reference time ${referenceTime.toISOString()}`,
    };
  }

  // 2. Missing value check
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return {
      status: 'Missing',
      reasonCode: 'missing_observation',
      reasonDetails: 'No measurement recorded during telemetry interval',
    };
  }

  // 3. Negative value check (Mandatory Rule 5)
  if (value < 0) {
    return {
      status: 'Invalid',
      reasonCode: 'negative_depth_below_ground',
      reasonDetails: `Negative depth ${value} m bgl is physically impossible under standard ground-level datum`,
    };
  }

  // 4. Zero value check (Step 8: Zero readings flagged for verification)
  if (value === 0 && !profile.allowZeroReading) {
    return {
      status: 'Suspect',
      reasonCode: 'zero_reading_potential_dry_or_fault',
      reasonDetails: 'Zero reading recorded; flagged as suspect pending station calibration',
    };
  }

  // 5. Sentinel values check
  if ([99.0, 99.99, 999.0, 999.99, 9999.0].includes(value)) {
    return {
      status: 'Invalid',
      reasonCode: 'sensor_sentinel_fault_pattern',
      reasonDetails: `Reading ${value} matches standard RTDAS hardware error sentinel`,
    };
  }

  // 6. Range bounds check (Step 9)
  if (value < profile.minDepthMbgl || value > profile.maxDepthMbgl) {
    return {
      status: 'Invalid',
      reasonCode: 'out_of_expected_range',
      reasonDetails: `Reading ${value} m bgl outside station range [${profile.minDepthMbgl}, ${profile.maxDepthMbgl}]`,
    };
  }

  return {
    status: 'Valid',
    reasonCode: 'passed_preliminary_checks',
    reasonDetails: 'Value within range and format bounds',
  };
}

/**
 * Validates a chronological observation sequence against CGWB Part B Step 1 to Step 16 checks.
 */
export function validateObservationSeries(
  records: Array<{ sourceIndex: number; timestampIso: string; value: number | null }>,
  profile: StationQcProfile,
  referenceTime = new Date(),
): ValidationResult[] {
  if (!records || records.length === 0) return [];

  // Chronological sort (Step 4)
  const sorted = [...records].sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime());

  const results: ValidationResult[] = [];
  const seenTimestamps = new Set<string>();
  let lastValidValue: number | null = null;
  const flatlineBuffer: number[] = [];

  for (const rec of sorted) {
    // Duplicate check (Step 5)
    if (seenTimestamps.has(rec.timestampIso)) {
      results.push({
        sourceIndex: rec.sourceIndex,
        stationId: profile.stationId,
        timestamp: rec.timestampIso,
        originalValue: rec.value,
        validatedValue: null,
        status: 'Invalid',
        reasonCode: 'duplicate_timestamp',
        reasonDetails: `Duplicate observation timestamp ${rec.timestampIso} already processed`,
        imputationFlag: '',
        checkBoolean: true,
        ruleVersion: profile.ruleVersion,
        validatedAt: new Date().toISOString(),
      });
      continue;
    }
    seenTimestamps.add(rec.timestampIso);

    const preliminary = validateSingleObservation(rec.value, rec.timestampIso, profile, referenceTime);
    let finalStatus = preliminary.status;
    let finalReason = preliminary.reasonCode;
    let finalDetails = preliminary.reasonDetails;

    // Temporal checks if preliminarily valid
    if (finalStatus === 'Valid' && rec.value !== null) {
      // Spike / abrupt step change check (Step 11)
      if (lastValidValue !== null) {
        const step = Math.abs(rec.value - lastValidValue);
        if (step > profile.maxStepChangeM) {
          finalStatus = 'Suspect';
          finalReason = 'abrupt_step_change_spike';
          finalDetails = `Abrupt level change ${step.toFixed(3)} m exceeds max allowable step ${profile.maxStepChangeM} m`;
        }
      }

      // Flatline check (Step 12)
      flatlineBuffer.push(rec.value);
      if (flatlineBuffer.length > profile.flatlineConsecutiveCount) {
        flatlineBuffer.shift();
      }
      if (flatlineBuffer.length === profile.flatlineConsecutiveCount) {
        const minVal = Math.min(...flatlineBuffer);
        const maxVal = Math.max(...flatlineBuffer);
        if ((maxVal - minVal) <= profile.flatlineToleranceM) {
          finalStatus = 'Suspect';
          finalReason = 'flatline_stuck_sensor';
          finalDetails = `Zero or negligible variance across ${profile.flatlineConsecutiveCount} consecutive readings indicates stuck float or dead sensor`;
        }
      }

      // Advance tracking so single spikes don't lock future readings
      lastValidValue = rec.value;
    }

    results.push({
      sourceIndex: rec.sourceIndex,
      stationId: profile.stationId,
      timestamp: rec.timestampIso,
      originalValue: rec.value,
      validatedValue: (finalStatus === 'Valid' || finalStatus === 'Replaced') ? rec.value : null,
      status: finalStatus,
      reasonCode: finalReason,
      reasonDetails: finalDetails,
      imputationFlag: finalStatus === 'Missing' ? 'M' : '',
      checkBoolean: true,
      ruleVersion: profile.ruleVersion,
      validatedAt: new Date().toISOString(),
    });
  }

  return results;
}
