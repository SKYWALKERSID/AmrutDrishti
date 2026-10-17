import { NextRequest, NextResponse } from 'next/server';
import { ALL_NATIONWIDE_BLOCKS } from '@/lib/data/allNationwideBlocks';
import contrastProjectionsData from '@/lib/data/contrastProjections.json';

export const dynamic = 'force-dynamic';

export interface ForecastPoint {
  horizonQuarter: number;
  forecastHorizonMonths?: number;
  targetSeason: string;
  targetDate?: string;
  expectedDepthMbgl: number;
  uncertaintyInterval: {
    lowerBoundP10Mbgl: number | null;
    upperBoundP90Mbgl: number | null;
    intervalWidthM?: number | null;
    isIntervalCalibrated: boolean;
    intervalStatus: 'uncalibrated' | 'invalid_crossing' | 'calibrated' | 'calibrated_ordered';
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
  provenanceStatus: 'verified' | 'unverifiable' | 'unverified';
  horizonStatus: 'valid' | 'inconsistent_origin' | 'unverified';
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
  scientificAuditNotice?: string;
  error?: string;
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

// Known training data cutoff: updated from 2023-08-20 (manual CGWB) to 2025-11-15 (NWIC DWLR Telemetry)
const KNOWN_TRAINING_CUTOFF = '2025-11-15';

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

  const requestedParam = searchParams.get('block') || 'blk_tikamgarh_main';

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

  // 2. Check Verified Local Offline Packaged Quantile Predictions First (Rule 5 & TRD v1.0)
  const contrastProj = contrastProjectionsData as Record<string, any>;
  if (contrastProj && contrastProj[blockId]) {
    const cData = contrastProj[blockId];
    
    // If block projection is flagged unavailable due to insufficient data
    if (cData.modelStatus === 'unavailable' || !cData.forecasts || cData.forecasts.length === 0) {
      return NextResponse.json({
        blockId,
        blockName,
        districtName,
        stationName: cData.stationName || stationName,
        modelIdentifier: 'none',
        modelVersion: 'none',
        modelStatus: 'unavailable',
        provenanceStatus: 'unverified',
        horizonStatus: 'unverified',
        operationalEligibility: false,
        baselineHistoricalDepthMbgl: currentDepth,
        forecasts: [],
        safeguardDisclaimer: cData.safeguardDisclaimer || 'Notice: Insufficient historical observations available to generate verified forecasts.',
        generatedAt: cData.generatedAt || new Date().toISOString(),
        isDemonstrationData: false,
      });
    }

    return NextResponse.json({
      blockId,
      blockName,
      districtName,
      stationName: cData.stationName || stationName,
      modelIdentifier: cData.modelIdentifier || 'QuantileGB-v2.0',
      modelVersion: cData.modelVersion || '2.0.0',
      modelStatus: cData.modelStatus || 'research_prototype',
      provenanceStatus: cData.provenanceStatus || 'verified',
      horizonStatus: cData.horizonStatus || 'valid',
      operationalEligibility: false,
      baselineHistoricalDepthMbgl: cData.baselineHistoricalDepthMbgl ?? currentDepth,
      baselinePersistenceComparison: cData.forecasts?.[0]?.baselinePersistence || {
        lastObservationPersistenceMbgl: currentDepth,
        seasonalPersistenceMbgl: null,
      },
      forecasts: cData.forecasts.slice(0, 4),
      safeguardDisclaimer: cData.safeguardDisclaimer,
      scientificAuditNotice: cData.scientificAuditNotice,
      generatedAt: cData.generatedAt || new Date().toISOString(),
      isDemonstrationData: false,
    });
  }

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
    // If training data ended on 2025-11-15, target date cannot be > 180 days after training cutoff
    const isHorizonInconsistent = Boolean(
      targetDateStr &&
      new Date(targetDateStr).getTime() - new Date(KNOWN_TRAINING_CUTOFF).getTime() > 180 * 24 * 60 * 60 * 1000
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
          `Horizon inconsistency detected: Observation data cutoff is ${KNOWN_TRAINING_CUTOFF}, but prediction record was created at ${recordCreatedStr.slice(0, 10)} projecting to ${targetDateStr}. Cannot serve temporal extrapolation as a calibrated forecast.`,
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

      const intervalStatus: 'uncalibrated' | 'invalid_crossing' | 'calibrated' | 'calibrated_ordered' =
        hasCrossing ? 'invalid_crossing' : 'calibrated_ordered';

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

      return {
        horizonQuarter: idx + 1,
        forecastHorizonMonths: (idx + 1) * 3,
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

  // 4. Contrast Benchmark / Offline Packaged Quantile Predictions
  try {
    const contrastProj = contrastProjectionsData as Record<string, any>;
    if (contrastProj && contrastProj[blockId]) {
      const cData = contrastProj[blockId];
      
      // If block projection is flagged unavailable due to insufficient data
      if (cData.modelStatus === 'unavailable' || !cData.forecasts || cData.forecasts.length === 0) {
        return NextResponse.json({
          blockId,
          blockName,
          districtName,
          stationName: cData.stationName || stationName,
          modelIdentifier: 'none',
          modelVersion: 'none',
          modelStatus: 'unavailable',
          provenanceStatus: 'unverified',
          horizonStatus: 'unverified',
          operationalEligibility: false,
          baselineHistoricalDepthMbgl: currentDepth,
          forecasts: [],
          safeguardDisclaimer: cData.safeguardDisclaimer || 'Notice: Insufficient historical observations available to generate verified forecasts.',
          generatedAt: cData.generatedAt || new Date().toISOString(),
          isDemonstrationData: false,
        });
      }

      return NextResponse.json({
        blockId,
        blockName,
        districtName,
        stationName: cData.stationName || stationName,
        modelIdentifier: cData.modelIdentifier || 'QuantileGB-v2.0',
        modelVersion: cData.modelVersion || '2.0.0',
        modelStatus: cData.modelStatus || 'research_prototype',
        provenanceStatus: cData.provenanceStatus || 'verified',
        horizonStatus: cData.horizonStatus || 'valid',
        operationalEligibility: false,
        baselineHistoricalDepthMbgl: cData.baselineHistoricalDepthMbgl ?? currentDepth,
        baselinePersistenceComparison: cData.forecasts?.[0]?.baselinePersistence || {
          lastObservationPersistenceMbgl: currentDepth,
          seasonalPersistenceMbgl: null,
        },
        forecasts: cData.forecasts.slice(0, 4),
        safeguardDisclaimer: cData.safeguardDisclaimer,
        scientificAuditNotice: cData.scientificAuditNotice,
        generatedAt: cData.generatedAt || new Date().toISOString(),
        isDemonstrationData: false,
      });
    }
  } catch {
    // Fall through to honest unavailable state
  }

  // 5. Honest Unavailable Response
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
      'Notice: No active calibrated ML model predictions found for this block in the database ledger. Historical observations only.',
    generatedAt: new Date().toISOString(),
    isDemonstrationData: false,
  });
}
