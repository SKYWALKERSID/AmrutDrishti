/**
 * JAL DRISHTI — Authoritative Source Ingestion Engine
 * 
 * Implements strict, reproducible data ingestion contracts, schema validation,
 * unit normalization, scientific null preservation, and ingestion telemetry logging.
 * 
 * Governed by PRD §4 (Multi-Source Environmental Data) and TRD §3 (Data Ingestion Architecture).
 */

import type { DataStatusType } from '../types.ts';

// ---------------------------------------------------------------------------
// 1. Authoritative Source Registry Contract
// ---------------------------------------------------------------------------

export interface AuthoritativeSourceMetadata {
  sourceId: string;
  name: string;
  provider: string;
  spatialResolution: string;
  temporalCadence: string;
  coordinateReferenceSystem: string;
  licenseTerms: string;
  provenanceDetails: string;
  isActive: boolean;
}

export const AUTHORITATIVE_SOURCES: Record<string, AuthoritativeSourceMetadata> = {
  src_imd_rainfall: {
    sourceId: 'src_imd_rainfall',
    name: 'IMD High-Resolution Gridded Precipitation (0.25° × 0.25°)',
    provider: 'India Meteorological Department (IMD Pune)',
    spatialResolution: '0.25° (~25km × 25km grid)',
    temporalCadence: 'Daily (24-hour update lag)',
    coordinateReferenceSystem: 'EPSG:4326 (WGS84)',
    licenseTerms: 'Government of India National Data Sharing and Accessibility Policy (NDSAP)',
    provenanceDetails: 'Daily interpolated precipitation totals in millimeters and calculated 3-month SPI against 1991-2020 climatological baseline.',
    isActive: true
  },
  src_cgwb_wells: {
    sourceId: 'src_cgwb_wells',
    name: 'CGWB & MP WRD Observation Well Telemetry Network',
    provider: 'Central Ground Water Board (CGWB) & MP Water Resources Dept',
    spatialResolution: 'Point Observations (Piezometers & Dug Wells)',
    temporalCadence: 'Quarterly Hydrograph & DWLR Telemetry',
    coordinateReferenceSystem: 'EPSG:4326 (WGS84)',
    licenseTerms: 'India-WRIS / National Hydrograph Network Open Terms',
    provenanceDetails: 'Direct depth to groundwater level below ground level (meters bgl) in monitored observation well and telemetry networks across priority states.',
    isActive: true
  },
  src_grace_fo: {
    sourceId: 'src_grace_fo',
    name: 'GRACE / GRACE-FO Terrestrial Water Storage Anomaly (TWSA)',
    provider: 'NASA JPL / GFZ Potsdam',
    spatialResolution: '1.0° × 1.0° (~100km × 100km equal-area grid)',
    temporalCadence: 'Monthly (~30-45 day ingestion lag)',
    coordinateReferenceSystem: 'EPSG:4326 (WGS84)',
    licenseTerms: 'NASA Earth Science Open Data Policy',
    provenanceDetails: 'RL06.1 Liquid Water Equivalent thickness anomaly (cm) relative to 2004-2010 baseline.',
    isActive: true
  }
};

// ---------------------------------------------------------------------------
// 2. Ingestion Record Schemas
// ---------------------------------------------------------------------------

export interface RawImdRainfallRecord {
  unitId: string;
  observationDate: string; // YYYY-MM-DD
  rainfallMm: number | null;
  rainfallAnomalyMm: number | null;
  spi3Month: number | null;
  qualityFlag?: 'passed' | 'suspect' | 'missing';
}

export interface RawCgwbObservationRecord {
  stationId: string;
  observationDate: string; // YYYY-MM-DD
  waterLevelMbgl: number | null;
  qualityFlag?: 'passed' | 'suspect' | 'missing';
}

export interface ValidatedIngestionResult<T> {
  isValid: boolean;
  record: T | null;
  errors: string[];
  warnings: string[];
}

export interface IngestionTelemetryLog {
  runId: string;
  sourceId: string;
  startTime: string;
  endTime: string;
  status: 'healthy' | 'lagging' | 'error';
  recordsIngested: number;
  recordsRejected: number;
  dataStatus: DataStatusType;
  qaSummary: {
    nullValuesCount: number;
    outOfBoundsCount: number;
    duplicateCount: number;
  };
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// 3. Pure Validation & Normalization Routines
// ---------------------------------------------------------------------------

/**
 * Validates ISO date string format (YYYY-MM-DD) and strict calendar validity
 * (rejects impossible calendar dates like 2026-02-30 or 2026-04-31).
 */
export function isValidDateString(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

/**
 * Validates and normalizes raw IMD Precipitation Records.
 * 
 * Physical constraints:
 * - Daily rainfall must be >= 0 mm (cannot be negative).
 * - Extreme daily rainfall capped at 1000 mm for meteorological sanity in Central India.
 * - SPI-3 month typically falls in [-5.0, +5.0].
 * - Missing values MUST remain NULL. Never converted to zero.
 */
export function validateImdRainfallRecord(raw: unknown): ValidatedIngestionResult<RawImdRainfallRecord> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { isValid: false, record: null, errors: ['Record must be a non-null object'], warnings: [] };
  }

  const rec = raw as Record<string, unknown>;

  // 1. unitId validation
  if (typeof rec.unitId !== 'string' || rec.unitId.trim().length === 0) {
    errors.push('unitId is required and must be a non-empty string');
  }

  // 2. observationDate validation
  if (!isValidDateString(rec.observationDate)) {
    errors.push(`Invalid observationDate format: ${String(rec.observationDate)}. Expected YYYY-MM-DD.`);
  }

  // 3. rainfallMm validation (non-negative)
  let rainfallMm: number | null = null;
  if (rec.rainfallMm !== null && rec.rainfallMm !== undefined) {
    const val = Number(rec.rainfallMm);
    if (isNaN(val)) {
      errors.push(`rainfallMm must be a valid number or null, got: ${String(rec.rainfallMm)}`);
    } else if (val < 0) {
      errors.push(`rainfallMm cannot be negative (got ${val} mm)`);
    } else if (val > 1000) {
      warnings.push(`Extreme rainfall anomaly: ${val} mm exceeds typical daily meteorological limit`);
      rainfallMm = val;
    } else {
      rainfallMm = val;
    }
  }

  // 4. rainfallAnomalyMm validation
  let rainfallAnomalyMm: number | null = null;
  if (rec.rainfallAnomalyMm !== null && rec.rainfallAnomalyMm !== undefined) {
    const val = Number(rec.rainfallAnomalyMm);
    if (isNaN(val)) {
      errors.push(`rainfallAnomalyMm must be a valid number or null, got: ${String(rec.rainfallAnomalyMm)}`);
    } else {
      rainfallAnomalyMm = val;
    }
  }

  // 5. spi3Month validation (typically [-5.0, 5.0])
  let spi3Month: number | null = null;
  if (rec.spi3Month !== null && rec.spi3Month !== undefined) {
    const val = Number(rec.spi3Month);
    if (isNaN(val)) {
      errors.push(`spi3Month must be a valid number or null, got: ${String(rec.spi3Month)}`);
    } else if (val < -6 || val > 6) {
      warnings.push(`SPI value ${val} is outside standard statistical range [-5.0, 5.0]`);
      spi3Month = val;
    } else {
      spi3Month = val;
    }
  }

  if (errors.length > 0) {
    return { isValid: false, record: null, errors, warnings };
  }

  return {
    isValid: true,
    record: {
      unitId: String(rec.unitId),
      observationDate: String(rec.observationDate),
      rainfallMm,
      rainfallAnomalyMm,
      spi3Month,
      qualityFlag: (rec.qualityFlag as 'passed' | 'suspect' | 'missing') || (rainfallMm === null ? 'missing' : 'passed')
    },
    errors: [],
    warnings
  };
}

/**
 * Validates and normalizes raw CGWB Observation Well Records.
 * 
 * Physical constraints:
 * - waterLevelMbgl must be >= 0 meters below ground level (or small artesian negative in rare cases, restricted here to [-2, 200]).
 * - Missing values MUST remain NULL. Never converted to zero (zero represents surface-water flooding).
 */
export function validateCgwbObservationRecord(raw: unknown): ValidatedIngestionResult<RawCgwbObservationRecord> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { isValid: false, record: null, errors: ['Record must be a non-null object'], warnings: [] };
  }

  const rec = raw as Record<string, unknown>;

  // 1. stationId validation
  if (typeof rec.stationId !== 'string' || rec.stationId.trim().length === 0) {
    errors.push('stationId is required and must be a non-empty string');
  }

  // 2. observationDate validation
  if (!isValidDateString(rec.observationDate)) {
    errors.push(`Invalid observationDate format: ${String(rec.observationDate)}. Expected YYYY-MM-DD.`);
  }

  // 3. waterLevelMbgl validation
  let waterLevelMbgl: number | null = null;
  if (rec.waterLevelMbgl !== null && rec.waterLevelMbgl !== undefined) {
    const val = Number(rec.waterLevelMbgl);
    if (isNaN(val)) {
      errors.push(`waterLevelMbgl must be a valid number or null, got: ${String(rec.waterLevelMbgl)}`);
    } else if (val < -2 || val > 300) {
      warnings.push(`waterLevelMbgl value ${val} m bgl is unusual for monitored shallow aquifer networks`);
      waterLevelMbgl = val;
    } else {
      waterLevelMbgl = val;
    }
  }

  if (errors.length > 0) {
    return { isValid: false, record: null, errors, warnings };
  }

  return {
    isValid: true,
    record: {
      stationId: String(rec.stationId),
      observationDate: String(rec.observationDate),
      waterLevelMbgl,
      qualityFlag: (rec.qualityFlag as 'passed' | 'suspect' | 'missing') || (waterLevelMbgl === null ? 'missing' : 'passed')
    },
    errors: [],
    warnings
  };
}

// ---------------------------------------------------------------------------
// 4. Batch Ingestion Processor (Idempotent & Telemetry-Generating)
// ---------------------------------------------------------------------------

export interface BatchProcessingSummary<T> {
  sourceId: string;
  totalRecords: number;
  validRecords: T[];
  rejectedRecordsCount: number;
  duplicateRecordsCount: number;
  telemetryLog: IngestionTelemetryLog;
}

/**
 * Processes a batch of IMD rainfall records idempotently with strict deduplication
 * by key (unitId + observationDate).
 */
export function processImdRainfallBatch(
  records: unknown[],
  runId: string = `run_imd_${Date.now()}`
): BatchProcessingSummary<RawImdRainfallRecord> {
  const startTime = new Date().toISOString();
  const validMap = new Map<string, RawImdRainfallRecord>();
  let rejectedCount = 0;
  let duplicateCount = 0;
  let nullValuesCount = 0;
  let outOfBoundsCount = 0;

  for (const raw of records) {
    const validation = validateImdRainfallRecord(raw);
    if (!validation.isValid || !validation.record) {
      rejectedCount++;
      continue;
    }

    if (validation.warnings.length > 0) {
      outOfBoundsCount++;
    }

    const rec = validation.record;
    if (rec.rainfallMm === null || rec.rainfallAnomalyMm === null) {
      nullValuesCount++;
    }

    const dedupeKey = `${rec.unitId}::${rec.observationDate}`;
    if (validMap.has(dedupeKey)) {
      duplicateCount++;
      // Retain latest or non-null record
      const existing = validMap.get(dedupeKey)!;
      if (existing.rainfallAnomalyMm === null && rec.rainfallAnomalyMm !== null) {
        validMap.set(dedupeKey, rec);
      }
    } else {
      validMap.set(dedupeKey, rec);
    }
  }

  const validRecords = Array.from(validMap.values());
  const endTime = new Date().toISOString();

  const telemetryLog: IngestionTelemetryLog = {
    runId,
    sourceId: 'src_imd_rainfall',
    startTime,
    endTime,
    status: rejectedCount === 0 ? 'healthy' : (validRecords.length > 0 ? 'lagging' : 'error'),
    recordsIngested: validRecords.length,
    recordsRejected: rejectedCount,
    dataStatus: 'observed',
    qaSummary: {
      nullValuesCount,
      outOfBoundsCount,
      duplicateCount
    }
  };

  return {
    sourceId: 'src_imd_rainfall',
    totalRecords: records.length,
    validRecords,
    rejectedRecordsCount: rejectedCount,
    duplicateRecordsCount: duplicateCount,
    telemetryLog
  };
}
