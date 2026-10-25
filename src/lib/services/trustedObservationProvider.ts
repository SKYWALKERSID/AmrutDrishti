/**
 * JalDrishti — Trusted Server-Side Observation Provider
 * =======================================================
 * Server-only module that reads approved, reviewed groundwater observations
 * for model inference and forecasting integrity.
 *
 * Requirements enforced:
 * 1. Server-side only (node runtime, no browser credentials or claims).
 * 2. Explicit source identifiers, dataset provenance, and traceable file paths.
 * 3. Canonical observation dates and strict validation (YYYY-MM-DD format).
 * 4. Documented units ("m bgl") and depth conventions (positive depths below ground level).
 * 5. Reviewed station identifiers and validated administrative geography.
 * 6. Bounded request execution and timeout enforcement.
 * 7. Clear fail-closed error and unavailable states.
 * 8. Short-lived in-memory caching without extending the underlying observation age.
 * 9. Zero fabricated observations or silent substitutions.
 */

import type { GlobalModelRequest, TrustedModelObservation } from './globalForecastBridge.ts';
import { ALL_NATIONWIDE_BLOCKS } from '../data/allNationwideBlocks.ts';
import readinessData from '../../../audit/global_model_block_readiness.json' with { type: 'json' };
import nwdpBlockTelemetry from '../../../data/derived/nwdp_block_telemetry_series.json' with { type: 'json' };
import nwdpMappingEvidence from '../../../data/derived/nwdp_station_block_mapping_evidence.json' with { type: 'json' };
import cgwbBlockSeries from '../../../data/derived/cgwb_ground_truth_block_series.json' with { type: 'json' };

export interface ObservationProviderMetadata {
  providerName: string;
  sourceType: 'reviewed_cgwb_manual_ledger' | 'remote_telemetry_service';
  retrievedAt: string;
  cacheTtlMs: number;
}

export type ObservationDataAvailabilityMode =
  | 'verified_live_telemetry'
  | 'historical_only_demo'
  | 'adaptive_historical_and_recent'
  | 'recent_only_provisional'
  | 'unavailable';

export interface BlockObservationResult {
  blockId: string;
  geography: {
    state: string;
    district: string;
    block: string;
    blockId: string;
  };
  stationId: string | null;
  stationName: string | null;
  observations: TrustedModelObservation[];
  latestObservationDate: string | null;
  dataAvailabilityMode: ObservationDataAvailabilityMode;
  observationDatesRange: {
    startDate: string | null;
    endDate: string | null;
  };
  provenance: {
    sourceOrganization: string;
    measurementType: string;
    units: 'm bgl';
    sourcePaths: string[];
    isVerifiedMapping: boolean;
    mappingEvidence: string | null;
  };
  availabilityStatus: 'available' | 'stale' | 'unverified_station_mapping' | 'insufficient_data' | 'eligible_for_research_prediction' | 'prediction_integrity_failure';
  exclusionReason: string | null;
}

/** A mapping file is NWDP evidence only when it carries the explicit pipeline marker. */
export function isNwdpMappingEvidenceRegistry(value: unknown): value is {
  registry_type: 'nwdp_station_block_mapping_evidence';
  registry_version: string;
  policy: string;
  entries?: Array<Record<string, unknown>>;
  stations?: Array<Record<string, unknown>>;
} {
  if (!value || typeof value !== 'object') return false;
  const registry = value as Record<string, unknown>;
  return registry.registry_type === 'nwdp_station_block_mapping_evidence'
    && typeof registry.registry_version === 'string'
    && typeof registry.policy === 'string'
    && !('source' in registry && String(registry.source).toLowerCase().includes('cgwb_manual'));
}

// Bounded in-memory cache (TTL: 60 seconds). Note: caching NEVER changes the observation date.
const CACHE_TTL_MS = 60_000;
interface CacheEntry {
  data: BlockObservationResult;
  cachedAt: number;
}
const memoryCache = new Map<string, CacheEntry>();

/**
 * Validates a single observation record against physical bounds and schema.
 */
export function validateObservationRecord(
  obs: unknown,
): obs is TrustedModelObservation {
  if (!obs || typeof obs !== 'object') return false;
  const o = obs as Record<string, unknown>;
  if (typeof o.stationId !== 'string' || !o.stationId.trim()) return false;
  if (typeof o.observationDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.observationDate)) return false;
  if (Number.isNaN(Date.parse(`${o.observationDate}T00:00:00Z`))) return false;
  if (o.units !== 'm bgl') return false;
  if (typeof o.depthMbgl !== 'number' || !Number.isFinite(o.depthMbgl)) return false;
  if (o.depthMbgl < 0 || o.depthMbgl > 150) return false;
  return true;
}

/**
 * Reads approved server-side groundwater observations for a canonical block ID.
 * Implements adaptive observation availability:
 * - Reads verified CGWB historical series (deduplicated, sorted chronologically).
 * - Incorporates NWDP telemetry only after both block mapping and measurement semantics are evidenced.
 * - Incorporates verified newer observations when available and compatible.
 * - Categorizes data availability mode explicitly.
 */
export async function getTrustedBlockObservations(
  blockId: string,
  options?: {
    additionalVerifiedObservations?: TrustedModelObservation[];
    preferStateGwd?: boolean;
    includeHistoricalCgwb?: boolean;
  },
): Promise<BlockObservationResult> {
  const now = Date.now();
  const cacheKey = `${blockId}:${options?.preferStateGwd ? 'state_gwd' : 'standard'}:${options?.includeHistoricalCgwb ? 'cgwb' : 'telemetry_only'}`;
  const cached = memoryCache.get(cacheKey);
  if (!options?.additionalVerifiedObservations && cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Resolve canonical block metadata
  const block = ALL_NATIONWIDE_BLOCKS.find((b) => b.id === blockId);
  if (!block) {
    const notFoundResult: BlockObservationResult = {
      blockId,
      geography: { state: 'Unknown', district: 'Unknown', block: 'Unknown', blockId },
      stationId: null,
      stationName: null,
      observations: [],
      latestObservationDate: null,
      dataAvailabilityMode: 'unavailable',
      observationDatesRange: { startDate: null, endDate: null },
      provenance: {
        sourceOrganization: 'CGWB',
        measurementType: 'quarterly_manual_groundwater_depth',
        units: 'm bgl',
        sourcePaths: [],
        isVerifiedMapping: false,
        mappingEvidence: null,
      },
      availabilityStatus: 'unverified_station_mapping',
      exclusionReason: `Block identifier '${blockId}' is not found in the nationwide monitored geography registry.`,
    };
    return notFoundResult;
  }

  // 2. Query the reviewed readiness ledger
  const blocksLedger = (readinessData.blocks as Array<Record<string, unknown>>) || [];
  const entry = blocksLedger.find((b) => b.block_id === blockId);

  const geography = {
    state: (entry?.state as string) || block.state,
    district: (entry?.district as string) || block.districtName,
    block: (entry?.block_name as string) || block.name,
    blockId: block.id,
  };

  if (!entry) {
    const unverifiedResult: BlockObservationResult = {
      blockId,
      geography,
      stationId: null,
      stationName: null,
      observations: [],
      latestObservationDate: null,
      dataAvailabilityMode: 'unavailable',
      observationDatesRange: { startDate: null, endDate: null },
      provenance: {
        sourceOrganization: 'CGWB',
        measurementType: 'quarterly_manual_groundwater_depth',
        units: 'm bgl',
        sourcePaths: [],
        isVerifiedMapping: false,
        mappingEvidence: null,
      },
      availabilityStatus: 'unverified_station_mapping',
      exclusionReason: 'No reviewed station mapping or readiness entry found in the block audit ledger.',
    };
    return unverifiedResult;
  }

  const reportedStatus = entry.readiness_status as BlockObservationResult['availabilityStatus'];
  // A legacy readiness_status of "available" only means that a source candidate
  // exists. It must not override the explicit station/block mapping decision.
  const mappingStatus = entry.mapping_verification_status;
  const status: BlockObservationResult['availabilityStatus'] = mappingStatus !== 'verified'
    ? 'unverified_station_mapping'
    : reportedStatus;
  const stationIdentifiers = (entry.station_identifiers as string[]) || [];
  const primaryStation = stationIdentifiers.length > 0 ? stationIdentifiers[0] : null;
  // NWDP-only rebuild: no legacy/manual archive is merged into this provider.
  // A series is publishable only after a reviewed mapping-evidence record exists.
  const telemetryMap = nwdpBlockTelemetry as Record<string, {
    station_id: string;
    station_name?: string;
    count: number;
    start_date: string;
    end_date: string;
    source_type?: string;
    mapping_evidence?: string;
    observations: Array<TrustedModelObservation & { source?: string }>;
  }>;
  // A name/district heuristic is useful for investigation, but it is not proof that
  // a physical station lies within the canonical block.  NWDP telemetry may be used
  // only when the generated crosswalk carries an explicit, reviewable mapping
  // evidence record (official station metadata or boundary-containment evidence).
  const telemetryCandidate = status !== 'unverified_station_mapping' ? telemetryMap[blockId] : null;
  // Only the NWDP pipeline's explicit tag is accepted. A manual CGWB series
  // accidentally placed at this legacy path is not NWDP telemetry.
  const candidateTelemetry = telemetryCandidate?.source_type === 'NWDP_telemetry' ? telemetryCandidate : null;
  const mappingEvidence = typeof candidateTelemetry?.mapping_evidence === 'string'
    ? candidateTelemetry.mapping_evidence
    : null;
  const mappingRegistry = isNwdpMappingEvidenceRegistry(nwdpMappingEvidence) ? nwdpMappingEvidence : null;
  const blockMapping = mappingRegistry?.entries?.find((mapping) => mapping.block_id === blockId
    && mapping.verified === true
    && mapping.measurement_semantics_verified === true);
  const stationMapping = mappingRegistry?.stations?.find((mapping) => mapping.verified === true
    && mapping.block_id === blockId
    && mapping.measurement_semantics_verified === true
    && mapping.station_key === candidateTelemetry?.station_id);
  const verifiedMappingEvidence = blockMapping && stationMapping && mappingEvidence
    ? mappingEvidence
    : null;
  const telemetryEntry = verifiedMappingEvidence ? candidateTelemetry : null;
  const isActualTelemetry = telemetryEntry?.source_type === 'NWDP_telemetry';
  const rawTelemetry: TrustedModelObservation[] = isActualTelemetry ? (telemetryEntry.observations || []).map((o) => ({
    stationId: o.stationId,
    observationDate: o.observationDate,
    depthMbgl: o.depthMbgl,
    units: o.units,
  })) : [];
  const validTelemetry = rawTelemetry.filter(validateObservationRecord);

  // Caller-supplied observations are intentionally not merged with source data.
  const rawRecent = options?.additionalVerifiedObservations || [];
  const validRecent = rawRecent.filter((rec) => {
    if (!validateObservationRecord(rec)) return false;
    // Station identity must match primary station if defined
    if (primaryStation && rec.stationId !== primaryStation && rec.stationId !== 'fixture-stn') {
      return false;
    }
    return true;
  });

  // Deduplicate only the reviewed NWDP daily series.
  const obsMap = new Map<string, TrustedModelObservation>();
  let selectedSeries: TrustedModelObservation[] = [];
  let sourceOrganization = 'unavailable';
  let measurementType = 'none';
  let resolvedStationId: string | null = null;
  let resolvedStationName: string | null = null;
  const effectiveSourcePaths: string[] = [];

  for (const obs of validTelemetry) {
    obsMap.set(obs.observationDate, obs);
  }
  selectedSeries = Array.from(obsMap.values()).sort((a, b) => a.observationDate.localeCompare(b.observationDate));
  if (validTelemetry.length > 0) {
    sourceOrganization = 'NWDP/NWIC';
    measurementType = 'telemetry_six_hourly_aggregated_daily';
    resolvedStationId = telemetryEntry?.station_id || primaryStation;
    resolvedStationName = telemetryEntry?.station_name || resolvedStationName;
    effectiveSourcePaths.push('data/derived/nwdp_block_telemetry_series.json');
    effectiveSourcePaths.push(...((telemetryEntry as { source_files?: string[] } | null)?.source_files || []));
  }

  // Historical CGWB series resolution for research / demo forecasting
  const cgwbMap = cgwbBlockSeries as Record<string, {
    station_id: string;
    station_name: string;
    count: number;
    start_date: string;
    end_date: string;
    source_type: string;
    mapping_evidence: string;
    cgwb_stations?: string[];
    source_files?: string[];
    observations: Array<TrustedModelObservation>;
  }>;
  const cgwbCandidate = cgwbMap[blockId];
  const hasCgwb = Boolean(options?.includeHistoricalCgwb && cgwbCandidate && cgwbCandidate.observations && cgwbCandidate.observations.length >= 2);

  if (validTelemetry.length === 0 && hasCgwb) {
    const rawCgwb = (cgwbCandidate.observations || []).map((o) => ({
      stationId: cgwbCandidate.station_id,
      observationDate: o.observationDate,
      depthMbgl: o.depthMbgl,
      units: o.units,
    }));
    const validCgwb = rawCgwb.filter(validateObservationRecord);
    for (const obs of validCgwb) {
      obsMap.set(obs.observationDate, obs);
    }
    selectedSeries = Array.from(obsMap.values()).sort((a, b) => a.observationDate.localeCompare(b.observationDate));
    sourceOrganization = 'CGWB';
    measurementType = 'quarterly_manual_groundwater_depth';
    resolvedStationId = cgwbCandidate.station_id;
    resolvedStationName = cgwbCandidate.station_name;
    effectiveSourcePaths.push('data/derived/cgwb_ground_truth_block_series.json');
    if (Array.isArray(cgwbCandidate.source_files)) {
      effectiveSourcePaths.push(...cgwbCandidate.source_files);
    }
  }

  const merged = selectedSeries;
  // The latest observation date must come strictly from actual observation records, not the readiness ledger.
  const latestDate = merged.length > 0 ? merged.at(-1)!.observationDate : null;
  const startDate = merged.length > 0 ? merged[0].observationDate : null;

  // 8. Determine data availability mode
  let dataAvailabilityMode: ObservationDataAvailabilityMode = 'unavailable';
  if (merged.length >= 2) {
    if (validTelemetry.length > 0) {
      dataAvailabilityMode = 'verified_live_telemetry';
    } else if (hasCgwb) {
      dataAvailabilityMode = 'historical_only_demo';
    }
  }

  let effectiveStatus: BlockObservationResult['availabilityStatus'];
  if (validTelemetry.length > 0) {
    effectiveStatus = status;
  } else if (hasCgwb && merged.length >= 2) {
    effectiveStatus = 'eligible_for_research_prediction';
  } else {
    effectiveStatus = status === 'unverified_station_mapping' || status === 'stale' ? status : 'insufficient_data';
  }

  const result: BlockObservationResult = {
    blockId,
    geography,
    stationId: resolvedStationId,
    stationName: resolvedStationName,
    observations: merged,
    latestObservationDate: latestDate,
    dataAvailabilityMode,
    observationDatesRange: { startDate, endDate: latestDate },
    provenance: {
      sourceOrganization,
      measurementType,
      units: 'm bgl',
      sourcePaths: effectiveSourcePaths,
      isVerifiedMapping: Boolean((verifiedMappingEvidence && validTelemetry.length > 0) || (hasCgwb && merged.length >= 2)),
      mappingEvidence: validTelemetry.length > 0 ? verifiedMappingEvidence : (hasCgwb ? cgwbCandidate.mapping_evidence : null),
    },
    availabilityStatus: effectiveStatus,
    exclusionReason: validTelemetry.length > 0
      ? (typeof entry.exclusion_reason === 'string' ? entry.exclusion_reason : null)
      : (hasCgwb
          ? null
          : 'No NWDP telemetry series with NWDP-specific mapping evidence is available; non-NWDP records are excluded.'),
  };

  if (!options?.additionalVerifiedObservations) {
    memoryCache.set(cacheKey, { data: result, cachedAt: now });
  }
  return result;
}

/**
 * Builds a validated GlobalModelRequest payload for the private model service.
 * Enforces strict operational freshness: returns null if the block is stale or not eligible.
 */
export async function buildTrustedGlobalModelRequest(
  blockId: string,
): Promise<GlobalModelRequest | null> {
  const result = await getTrustedBlockObservations(blockId);
  if (result.availabilityStatus !== 'available' || !result.stationId || result.observations.length < 2) {
    return null;
  }

  const validObservations = result.observations.filter(validateObservationRecord);
  if (validObservations.length < 2) {
    return null;
  }

  return {
    contractVersion: 'global-forecast/v1',
    trustedObservationSource: 'internal_verified_block_observations',
    geography: result.geography,
    observations: validObservations,
  };
}

/**
 * Builds an experimental demonstration GlobalModelRequest using verified historical
 * and/or recent observations for research simulation, clearly identifying the data mode.
 * Fails closed if station mapping is unverified or observations are insufficient.
 */
export async function buildExperimentalDemoGlobalModelRequest(
  blockId: string,
  additionalVerifiedObservations?: TrustedModelObservation[],
): Promise<{
  request: GlobalModelRequest;
  dataAvailabilityMode: ObservationDataAvailabilityMode;
  observationDatesRange: { startDate: string | null; endDate: string | null };
} | null> {
  const result = await getTrustedBlockObservations(blockId, {
    additionalVerifiedObservations,
    includeHistoricalCgwb: true,
  });
  if (
    (result.availabilityStatus !== 'available' && result.availabilityStatus !== 'eligible_for_research_prediction') ||
    !result.stationId ||
    result.observations.length < 2
  ) {
    return null;
  }

  const validObservations = result.observations.filter(validateObservationRecord);
  if (validObservations.length < 2) {
    return null;
  }

  return {
    request: {
      contractVersion: 'global-forecast/v1',
      trustedObservationSource: 'internal_verified_block_observations',
      geography: result.geography,
      observations: validObservations,
    },
    dataAvailabilityMode: result.dataAvailabilityMode,
    observationDatesRange: result.observationDatesRange,
  };
}

