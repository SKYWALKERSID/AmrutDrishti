import { NextRequest, NextResponse } from 'next/server';
import { ALL_NATIONWIDE_BLOCKS, CANONICAL_43_BLOCKS } from '@/lib/data/allNationwideBlocks';
import readinessLedger from '../../../../audit/global_model_block_readiness.json';
import { getObservationAgeInfo, isValidGlobalForecastResponse, invokeGlobalForecast, type GlobalModelRequest, type ModelInvocationFailure } from '@/lib/services/globalForecastBridge';
import { computeObservationAge, getModelTrainingCutoff, KNOWN_TRAINING_CUTOFF, type DataFreshnessStatus } from '@/lib/data/forecastIntegrity';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export interface ForecastPoint {
  horizonQuarter: number;
  forecastHorizonMonths?: number;
  forecastHorizonDays?: number;
  horizonDays?: number;
  targetSeason: string;
  targetDate?: string;
  expectedDepthMbgl: number;
  uncertaintyInterval: {
    lowerBoundP10Mbgl: number | null;
    upperBoundP90Mbgl: number | null;
    intervalWidthM?: number | null;
    isIntervalCalibrated: boolean;
    intervalStatus: 'uncalibrated' | 'ordered_uncalibrated' | 'invalid_crossing' | 'calibrated';
  };
  baselinePersistence?: {
    lastObservationPersistenceMbgl?: number | null;
    seasonalPersistenceMbgl?: number | null;
  };
  stressRiskCategory: 'normal' | 'watch' | 'severe';
  units?: string;
}

export interface BlockForecastResponse {
  blockId: string;
  blockName: string;
  districtName: string;
  stationName?: string;
  modelIdentifier: string;
  modelVersion: string;
  modelStatus: 'research_prototype' | 'calibrated_operational' | 'unavailable';
  provenanceStatus: 'verified' | 'unverifiable' | 'unverified' | 'stale_observation';
  horizonStatus: 'valid' | 'inconsistent_origin' | 'unverified' | 'stale_origin';
  operationalEligibility: boolean;
  baselineHistoricalDepthMbgl: number | null;
  baselinePersistenceComparison?: {
    lastObservationPersistenceMbgl?: number | null;
    seasonalPersistenceMbgl?: number | null;
  };
  forecasts: ForecastPoint[];
  safeguardDisclaimer: string;
  generatedAt: string;
  isDemonstrationData?: boolean;
  dataAvailabilityMode?: 'historical_only_demo' | 'adaptive_historical_and_recent' | 'real_time_operational' | 'verified_live_telemetry' | 'unavailable';
  observationDatesRange?: { earliest?: string; latest?: string; startDate?: string | null; endDate?: string | null };
  scientificAuditNotice?: string;
  error?: string;
  inputObservationDate?: string | null;
  inputObservationAgeDays?: number | null;
  forecastOriginDate?: string | null;
  forecastEligibilityStatus?: 'operational' | 'research' | 'historical_research' | 'unavailable';
  dataFreshnessStatus?: DataFreshnessStatus;
  limitations?: string[];
  /** How this forecast was produced. Precomputed output is never live inference. */
  forecastServingMode?: 'live_inference' | 'precomputed_fallback' | 'unavailable';
  liveInferenceFailure?: ModelInvocationFailure | 'invalid_response' | null;
  inferenceLatencyMs?: number | null;
}

const BLOCK_SLUG_TO_UNIT_ID: Record<string, string> = {
  'blk_bijawar': '3783',
  'blk_rajnagar': '3788',
  'blk_baldeogarh': '4027',
  'blk_jatara': '4028',
  'blk_palera': '4030',
  'blk_tikamgarh_main': '4032',
  '3783': '3783',
  '3788': '3788',
  '4027': '4027',
  '4028': '4028',
  '4030': '4030',
  '4032': '4032'
};



type ReadinessRow = {
  block_id: string;
  readiness_status: string;
  freshness_status?: string;
  latest_verified_observation_date: string | null;
  operational_eligibility: boolean;
  exclusion_reason?: string | null;
  blocking_reason?: string | null;
};

import { buildExperimentalDemoGlobalModelRequest, buildTrustedGlobalModelRequest } from '@/lib/services/trustedObservationProvider';

/**
 * Resolves verified observations using the server-side trusted observation provider.
 * Fails closed if the block is not verified, stale, or lacks eligible historical observations.
 */
async function resolveTrustedObservationsForInference(blockId: string): Promise<GlobalModelRequest | null> {
  return buildTrustedGlobalModelRequest(blockId);
}

/**
 * Route: GET /api/forecast?block=blk_tikamgarh_main
 * Audits and serves verified groundwater depth predictions.
 * Rigorously validates provenance, forecast origin, horizon plausibility, uncertainty calibration,
 * and explicit non-fabricated error states.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Validation: empty or blank block query parameter
  if (searchParams.has('block')) {
    const rawVal = searchParams.get('block');
    if (!rawVal || !rawVal.trim()) {
      return NextResponse.json({
        error: 'Missing or invalid block parameter: block parameter must not be empty.',
        modelStatus: 'unavailable',
        forecasts: [],
        operationalEligibility: false,
      }, { status: 400 });
    }
  }

  const defaultFallbackBlockId = CANONICAL_43_BLOCKS[0]?.id || 'blk_kaithal_rajound';
  const requestedParam = searchParams.get('block') || defaultFallbackBlockId;

  // 1. Resolve Block Metadata across all nationwide monitored blocks
  const block = ALL_NATIONWIDE_BLOCKS.find(
    (b) => b.id === requestedParam || BLOCK_SLUG_TO_UNIT_ID[b.id] === requestedParam
  );

  const unitId = (block ? BLOCK_SLUG_TO_UNIT_ID[block.id] : null) || BLOCK_SLUG_TO_UNIT_ID[requestedParam] || requestedParam;
  const currentDepth = block?.indicators.cgwbWellDepthMbgl ?? null;
  const blockId = block ? block.id : requestedParam;
  const blockName = block ? block.name : requestedParam;
  const districtName = block ? block.districtName : 'Monitored District';
  const stationName = block ? `${block.name} Central Observation Well` : 'Observation Station';

  // Age-aware forecast eligibility: the readiness ledger determines whether
  // verified observations exist. Observation age is honest metadata, not a hard blocker.
  const readiness = (readinessLedger.blocks as unknown as ReadinessRow[]).find((row) => row.block_id === blockId);
  if (readiness) {
    // Resolve trusted observations adaptively (historical CGWB series + verified telemetry)
    const demoPayload = await buildExperimentalDemoGlobalModelRequest(blockId);

    // If neither telemetry nor historical series is available, fail closed
    if (!demoPayload) {
      return NextResponse.json({
        blockId, blockName, districtName, stationName,
        modelIdentifier: 'none', modelVersion: 'none', modelStatus: 'unavailable',
        provenanceStatus: 'unverified',
        horizonStatus: 'unverified',
        operationalEligibility: false, baselineHistoricalDepthMbgl: currentDepth, forecasts: [],
        safeguardDisclaimer: readiness.exclusion_reason || readiness.blocking_reason || 'No verified station mapping or sufficient observation data available for this block.',
        generatedAt: new Date().toISOString(), isDemonstrationData: false,
        forecastEligibilityStatus: 'unavailable' as const,
        limitations: [readiness.exclusion_reason || 'Unverified station mapping'],
      });
    }

    const { request: observations, dataAvailabilityMode, observationDatesRange } = demoPayload;

    // Compute age-aware metadata for the latest observation
    const ageInfo = getObservationAgeInfo(observations.observations);
    const limitations: string[] = [];

    // Observation validity check: fail closed only if observation dates are invalid/missing
    if (ageInfo.freshnessStatus === 'unknown') {
      return NextResponse.json({
        blockId, blockName, districtName, stationName,
        modelIdentifier: 'none', modelVersion: 'none', modelStatus: 'unavailable',
        provenanceStatus: 'unverified', horizonStatus: 'unverified', operationalEligibility: false,
        baselineHistoricalDepthMbgl: currentDepth, forecasts: [],
        safeguardDisclaimer: 'No valid observation dates found in trusted observation records.',
        generatedAt: new Date().toISOString(), isDemonstrationData: false,
        inputObservationDate: ageInfo.latestObservationDate,
        inputObservationAgeDays: ageInfo.observationAgeDays,
        dataFreshnessStatus: ageInfo.freshnessStatus,
        forecastEligibilityStatus: 'unavailable' as const,
      });
    }

    // Determine forecast eligibility based on age (informational, not blocking)
    let forecastEligibilityStatus: 'operational' | 'research' | 'historical_research' | 'unavailable' = 'research';
    if (ageInfo.isOperationallyFresh) {
      forecastEligibilityStatus = 'operational';
    } else if (ageInfo.freshnessStatus === 'recent') {
      forecastEligibilityStatus = 'research';
      limitations.push(`Latest observation is ${ageInfo.observationAgeDays} days old. Forecast origin is historical, not current.`);
    } else if (ageInfo.freshnessStatus === 'historical') {
      forecastEligibilityStatus = 'historical_research';
      limitations.push(`Latest observation is ${ageInfo.observationAgeDays} days old. This is a historical-origin research forecast — target dates reflect predictions from the last observation, not from today.`);
    }

    // Call private model service — no longer blocked by age
    const invocation = await invokeGlobalForecast(observations);
    let served = invocation.body;
    let servingMode: 'live_inference' | 'precomputed_fallback' = 'live_inference';
    let liveFailure: ModelInvocationFailure | 'invalid_response' | null = invocation.failure;
    if (served && !isValidGlobalForecastResponse(served, observations.geography)) {
      served = null;
      liveFailure = 'invalid_response';
    }
    if (!served) {
      // Explicitly-labelled fallback: exact blockId + model match only, never another block.
      servingMode = 'precomputed_fallback';
      try {
        const precomputedMap = (await import('../../../../data/derived/precomputed_verified_block_forecasts.json')).default as Record<string, any>;
        const precomputed = Object.prototype.hasOwnProperty.call(precomputedMap, blockId) ? precomputedMap[blockId] : null;
        if (
          precomputed && precomputed.blockId === blockId &&
          precomputed.modelIdentifier === 'GlobalBlockAwareQuantileGB-v1' &&
          precomputed.modelVersion === '1.0.0' &&
          typeof precomputed.latestObservationDate === 'string' &&
          Array.isArray(precomputed.forecasts) && precomputed.forecasts.length > 0
        ) {
          served = {
            status: 'research_prototype',
            modelIdentifier: precomputed.modelIdentifier,
            modelVersion: precomputed.modelVersion,
            geography: observations.geography,
            originObservationDate: precomputed.latestObservationDate,
            units: 'm bgl',
            intervalStatus: 'ordered_uncalibrated',
            operationalEligibility: false,
            forecast: precomputed,
          };
        }
      } catch {
        // Fall through to honest unavailable response
      }
    }

    if (!served || !isValidGlobalForecastResponse(served, observations.geography)) {
      return NextResponse.json({
        blockId, blockName, districtName, stationName,
        modelIdentifier: 'none', modelVersion: 'none', modelStatus: 'unavailable',
        provenanceStatus: 'unverified', horizonStatus: 'unverified', operationalEligibility: false,
        baselineHistoricalDepthMbgl: currentDepth, forecasts: [],
        safeguardDisclaimer: 'Live model inference failed and no valid matching precomputed forecast exists for this block.',
        forecastServingMode: 'unavailable' as const,
        liveInferenceFailure: liveFailure,
        inferenceLatencyMs: invocation.latencyMs,
        generatedAt: new Date().toISOString(), isDemonstrationData: !ageInfo.isOperationallyFresh,
        inputObservationDate: ageInfo.latestObservationDate,
        inputObservationAgeDays: ageInfo.observationAgeDays,
        dataFreshnessStatus: ageInfo.freshnessStatus,
        forecastEligibilityStatus: 'unavailable' as const,
      });
    }

    const forecast = served.forecast as Omit<BlockForecastResponse, 'operationalEligibility'>;
    const isHistoricalOrigin = !ageInfo.isOperationallyFresh;

    // Build appropriate safeguard disclaimer based on observation age
    let safeguardDisclaimer: string;
    if (ageInfo.isOperationallyFresh) {
      safeguardDisclaimer = forecast.safeguardDisclaimer || 'Research Prototype: Groundwater forecasts represent statistical estimates. Not authorized for operational disaster declarations without field verification.';
    } else if (ageInfo.freshnessStatus === 'recent') {
      safeguardDisclaimer = `Research Forecast (Stale Input): Generated from verified observations last dated ${ageInfo.latestObservationDate} (${ageInfo.observationAgeDays} days ago). Forecast origin and target dates reflect predictions from that observation, not from today. Not certified for current operational decisions.`;
    } else {
      safeguardDisclaimer = `Historical Research Forecast: Generated from verified CGWB observations last dated ${ageInfo.latestObservationDate} (${ageInfo.observationAgeDays} days ago). This is a retrospective research prediction — target dates are relative to the historical observation origin. Does not represent current or future groundwater conditions.`;
    }

    if (servingMode === 'precomputed_fallback') {
      limitations.push('Served from an offline precomputed model output, not live inference.');
      if (liveFailure) limitations.push(`Live inference unavailable (${liveFailure}).`);
    }

    // Determine horizon status and check whether target dates are in the past
    const nowIso = new Date().toISOString().slice(0, 10);
    const hasPastTargetDates = Array.isArray(forecast.forecasts) && forecast.forecasts.some((f) => f.targetDate && f.targetDate < nowIso);
    let effectiveHorizonStatus: 'valid' | 'inconsistent_origin' | 'unverified' | 'stale_origin' = forecast.horizonStatus || 'valid';

    if (hasPastTargetDates) {
      effectiveHorizonStatus = 'stale_origin';
      forecastEligibilityStatus = 'historical_research';
      limitations.push('Forecast target dates have elapsed relative to current calendar date; served strictly as retrospective benchmark.');
    }

    return NextResponse.json({
      ...forecast,
      forecastServingMode: servingMode,
      liveInferenceFailure: servingMode === 'live_inference' ? null : liveFailure,
      inferenceLatencyMs: servingMode === 'live_inference' ? invocation.latencyMs : null,
      generatedAt: servingMode === 'live_inference' && typeof served.generatedAt === 'string' ? served.generatedAt : forecast.generatedAt,
      operationalEligibility: false,
      isDemonstrationData: isHistoricalOrigin || hasPastTargetDates,
      horizonStatus: effectiveHorizonStatus,
      dataAvailabilityMode,
      observationDatesRange,
      safeguardDisclaimer,
      inputObservationDate: ageInfo.latestObservationDate,
      inputObservationAgeDays: ageInfo.observationAgeDays,
      forecastOriginDate: ageInfo.latestObservationDate,
      dataFreshnessStatus: ageInfo.freshnessStatus,
      forecastEligibilityStatus,
      limitations,
    });
  }

  // 2. Global-model serving or database persisted model records
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let persistedPredictions: any[] = [];

  // 3. Fallback: Query Persisted Predictions from Database (cap to 4 quarters)
  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder') && unitId) {
    try {
      const url = `${supabaseUrl}/rest/v1/model_predictions?select=*&unit_id=eq.${unitId}&order=created_at.desc&limit=4`;
      const res = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          persistedPredictions = rows;
        }
      }
    } catch {
      // Handled gracefully below
    }
  }

  // 3. Provenance and Horizon Audit for Database Records
  if (persistedPredictions.length > 0) {
    const rawPred = persistedPredictions[0];
    const targetDateStr = rawPred.target_date || '';
    const recordCreatedStr = rawPred.created_at || '';

    // Evaluate Provenance and Horizon Consistency:
    // Uses model-aware training cutoff (e.g. 2023-11-01 for CGWB global models, 2025-11-15 for telemetry)
    const effectiveTrainingCutoff = getModelTrainingCutoff(rawPred.model_id);
    const isHorizonInconsistent = Boolean(
      targetDateStr &&
      new Date(targetDateStr).getTime() - new Date(effectiveTrainingCutoff).getTime() > 180 * 24 * 60 * 60 * 1000
    );

    // If horizon or origin provenance is invalid, present honest unavailable state
    if (isHorizonInconsistent) {
      return NextResponse.json({
        blockId,
        blockName,
        districtName,
        stationName,
        modelIdentifier: rawPred.model_id || 'quantile_gb_v2.0',
        modelVersion: '2.0.0',
        modelStatus: 'unavailable',
        provenanceStatus: 'unverifiable',
        horizonStatus: 'inconsistent_origin',
        operationalEligibility: false,
        baselineHistoricalDepthMbgl: currentDepth,
        forecasts: [],
        safeguardDisclaimer:
          'Scientific Audit Notice: Stored prediction target date is temporally decoupled from the underlying model training cutoff. Forecast record origin cannot be verified for the displayed horizon. Prediction is marked unavailable for operational use.',
        scientificAuditNotice:
          `Horizon inconsistency detected: Observation data cutoff for model ${rawPred.model_id || 'unspecified'} is ${effectiveTrainingCutoff}, but prediction record was created at ${recordCreatedStr.slice(0, 10)} projecting to ${targetDateStr}. Cannot serve temporal extrapolation as a calibrated forecast.`,
        generatedAt: recordCreatedStr || new Date().toISOString(),
        isDemonstrationData: false,
      });
    }

    // Process valid database prediction points (capped at 4 quarters)
    const forecastPoints: ForecastPoint[] = persistedPredictions.slice(0, 4).map((pred, idx) => {
      const p50 = Number(pred.predicted_gwl_mbgl);
      const rawP10 = pred.uncertainty_lower_mbgl !== null ? Number(pred.uncertainty_lower_mbgl) : null;
      const rawP90 = pred.uncertainty_upper_mbgl !== null ? Number(pred.uncertainty_upper_mbgl) : null;
      const originalP50 = Number(p50.toFixed(2));

      // Quantile Crossing Audit:
      const hasCrossing = Boolean(
        (rawP10 !== null && rawP10 > p50) ||
        (rawP90 !== null && rawP90 < p50) ||
        (rawP10 !== null && rawP90 !== null && rawP10 > rawP90)
      );

      const intervalStatus: 'uncalibrated' | 'ordered_uncalibrated' | 'invalid_crossing' | 'calibrated' =
        hasCrossing ? 'invalid_crossing' : 'ordered_uncalibrated';

      let targetSeason = 'Quarterly Horizon';
      if (pred.target_date) {
        const d = new Date(pred.target_date);
        const q = Math.floor(d.getMonth() / 3);
        const seasonNames = ['Winter Rabi (Jan-Mar)', 'Pre-Monsoon (Apr-Jun)', 'Monsoon Peak (Jul-Sep)', 'Post-Monsoon (Oct-Dec)'];
        targetSeason = `${seasonNames[q] || 'Quarterly'} ${d.getFullYear()}`;
      }

      const riskCat: 'normal' | 'watch' | 'severe' =
        pred.predicted_risk_severity === 'critical' ? 'severe' :
        pred.predicted_risk_severity === 'alert' || pred.predicted_risk_severity === 'watch' ? 'watch' : 'normal';

      const safeP10 = hasCrossing ? null : (rawP10 !== null ? Number(rawP10.toFixed(2)) : null);
      const safeP90 = hasCrossing ? null : (rawP90 !== null ? Number(rawP90.toFixed(2)) : null);
      const width = (safeP10 !== null && safeP90 !== null) ? Number((safeP90 - safeP10).toFixed(2)) : null;

      const months = (idx + 1) * 3;
      const days = months * 30; // 90 days for Q1 (3M), 180 days for Q2 (6M)

      return {
        horizonQuarter: idx + 1,
        forecastHorizonMonths: months,
        forecastHorizonDays: days,
        horizonDays: days,
        targetSeason,
        targetDate: pred.target_date || undefined,
        expectedDepthMbgl: originalP50,
        uncertaintyInterval: {
          lowerBoundP10Mbgl: safeP10,
          upperBoundP90Mbgl: safeP90,
          intervalWidthM: width,
          isIntervalCalibrated: false,
          intervalStatus,
        },
        baselinePersistence: {
          lastObservationPersistenceMbgl: currentDepth,
          seasonalPersistenceMbgl: null,
        },
        stressRiskCategory: riskCat,
        units: 'm bgl',
      };
    });

    const primaryModelId = rawPred.model_id || 'QuantileGB-v2.0';

    return NextResponse.json({
      blockId,
      blockName,
      districtName,
      stationName,
      modelIdentifier: primaryModelId,
      modelVersion: '2.0.0',
      modelStatus: 'research_prototype',
      provenanceStatus: 'verified',
      horizonStatus: 'valid',
      operationalEligibility: false,
      baselineHistoricalDepthMbgl: currentDepth,
      baselinePersistenceComparison: {
        lastObservationPersistenceMbgl: currentDepth,
        seasonalPersistenceMbgl: null,
      },
      forecasts: forecastPoints,
      safeguardDisclaimer:
        'Research Prototype Notice: Groundwater forecasts represent statistical quantile estimates trained on historical CGWB manual and DWLR well records. Intervals are uncalibrated and numerical safeguards do not constitute statistical calibration. Not authorized for operational disaster declarations without field verification.',
      generatedAt: rawPred.created_at || new Date().toISOString(),
      isDemonstrationData: false,
    });
  }

  // 4. Honest Unavailable Response
  return NextResponse.json({
    blockId,
    blockName,
    districtName,
    stationName,
    modelIdentifier: 'none',
    modelVersion: 'none',
    modelStatus: 'unavailable',
    provenanceStatus: 'unverified',
    horizonStatus: 'unverified',
    operationalEligibility: false,
    baselineHistoricalDepthMbgl: currentDepth,
    forecasts: [],
    safeguardDisclaimer:
      'Notice: Forecast unavailable. No active calibrated ML model predictions found for this block in the database ledger. Historical observations only.',
    generatedAt: new Date().toISOString(),
    isDemonstrationData: false,
  });
}
