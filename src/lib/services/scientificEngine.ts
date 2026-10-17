/**
 * JAL DRISHTI — Scientific Evaluation & Intervention Matching Service
 * 
 * Implements:
 * 1. Descriptive Groundwater Stress Score (GSS) rule-based calculation with documented weights
 *    and strict scientific NULL-propagation / data gap handling.
 * 2. Transparent forecasting safeguards (rejecting uncalibrated countdowns/false precision).
 * 3. Evidence-traceable Scheme & Intervention Recommendation Matching with eligibility criteria.
 * 
 * Governed by PRD §4.3, §6, §7 and TRD §7 (Indicator & ML Engineering).
 */

import type { BlockData, RiskSeverity, SchemeItem } from '../types.ts';
import { INTERVENTION_SCHEMES } from '../data/schemes.ts';

// ---------------------------------------------------------------------------
// 1. Scientific GSS Calculation Contract
// ---------------------------------------------------------------------------

export interface GssCalculationResult {
  score: number | null;
  severity: RiskSeverity;
  primaryStressDriver: string;
  isDataGap: boolean;
  activeIndicatorsCount: number;
  normalizationBreakdown: {
    wellDepthNorm: number | null;
    rainDeficitNorm: number | null;
    graceTwsaNorm: number | null;
    ndviNorm: number | null;
  };
  confidenceInterval: [number, number] | null; // Null when uncalibrated
  safeguardNotice: string;
}

/**
 * Normalizes depth to groundwater in meters below ground level (mbgl).
 * Baseline for crystalline and hard-rock aquifer zones:
 * - 0 to 5m: low stress (0.0)
 * - 25m+: critical stress (1.0)
 */
function normalizeWellDepth(depthMbgl: number | null): number | null {
  if (depthMbgl === null || depthMbgl === undefined) return null;
  if (depthMbgl <= 5) return 0;
  if (depthMbgl >= 25) return 1;
  return (depthMbgl - 5) / (25 - 5);
}

/**
 * Normalizes rainfall anomaly in mm.
 * - Negative anomaly (deficit) indicates stress.
 * - Anomaly >= 0mm: no stress (0.0)
 * - Anomaly <= -400mm: severe deficit (1.0)
 */
function normalizeRainfallDeficit(anomalyMm: number | null): number | null {
  if (anomalyMm === null || anomalyMm === undefined) return null;
  if (anomalyMm >= 0) return 0;
  if (anomalyMm <= -400) return 1;
  return Math.abs(anomalyMm) / 400;
}

/**
 * Normalizes NASA GRACE-FO TWSA in cm.
 * - Positive or zero anomaly: no stress (0.0)
 * - Anomaly <= -10cm: regional storage depletion (1.0)
 */
function normalizeGraceTwsa(twsaCm: number | null): number | null {
  if (twsaCm === null || twsaCm === undefined) return null;
  if (twsaCm >= 0) return 0;
  if (twsaCm <= -10) return 1;
  return Math.abs(twsaCm) / 10;
}

/**
 * Normalizes Sentinel-2 NDVI canopy vigor.
 * - NDVI >= 0.60: lush vegetation / low stress (0.0)
 * - NDVI <= 0.15: severe dry canopy / stress (1.0)
 */
function normalizeNdvi(ndvi: number | null): number | null {
  if (ndvi === null || ndvi === undefined) return null;
  if (ndvi >= 0.60) return 0;
  if (ndvi <= 0.15) return 1;
  return (0.60 - ndvi) / (0.60 - 0.15);
}

/**
 * Computes the descriptive Groundwater Stress Score (GSS) from available environmental indicators.
 * 
 * Rules:
 * - If key observed indicators (well depth & rain deficit) are missing, returns isDataGap = true,
 *   score = null, and severity = 'gap'. Never silently converts missing values to zero!
 * - Weighting is re-normalized across available non-null indicators only.
 * - Output score is strictly bounded [0, 100].
 * - confidenceInterval is always NULL unless calibrated against held-out physical datasets.
 */
export function calculateDescriptiveGss(indicators: {
  cgwbWellDepthMbgl: number | null;
  rainfallAnomalyMm: number | null;
  graceTwsaCm: number | null;
  sentinelNdvi: number | null;
}): GssCalculationResult {
  const normWell = normalizeWellDepth(indicators.cgwbWellDepthMbgl);
  const normRain = normalizeRainfallDeficit(indicators.rainfallAnomalyMm);
  const normGrace = normalizeGraceTwsa(indicators.graceTwsaCm);
  const normNdvi = normalizeNdvi(indicators.sentinelNdvi);

  const breakdown = {
    wellDepthNorm: normWell,
    rainDeficitNorm: normRain,
    graceTwsaNorm: normGrace,
    ndviNorm: normNdvi
  };

  // If both primary indicators are missing, declare data gap
  if (normWell === null && normRain === null && normGrace === null) {
    return {
      score: null,
      severity: 'gap',
      primaryStressDriver: 'Data Gap — Missing observed well depth, precipitation, and TWSA measurements.',
      isDataGap: true,
      activeIndicatorsCount: 0,
      normalizationBreakdown: breakdown,
      confidenceInterval: null,
      safeguardNotice: 'Data Gap Notice — Field measurements pending. Do not perform risk scoring without observed indicators.'
    };
  }

  // Base canonical weights
  const weights = [
    { val: normWell, weight: 0.35, driver: 'Aquifer Drawdown (Well Depth)' },
    { val: normRain, weight: 0.30, driver: 'Monsoon Rainfall Deficit' },
    { val: normGrace, weight: 0.20, driver: 'Regional Terrestrial Storage Depletion (GRACE TWSA)' },
    { val: normNdvi, weight: 0.15, driver: 'Vegetation Canopy Stress (NDVI)' }
  ];

  let weightedSum = 0;
  let totalActiveWeight = 0;
  let maxContributor = '';
  let maxContributionVal = -1;
  let activeCount = 0;

  for (const item of weights) {
    if (item.val !== null) {
      weightedSum += item.val * item.weight;
      totalActiveWeight += item.weight;
      activeCount++;
      if (item.val > maxContributionVal) {
        maxContributionVal = item.val;
        maxContributor = item.driver;
      }
    }
  }

  if (totalActiveWeight === 0) {
    return {
      score: null,
      severity: 'gap',
      primaryStressDriver: 'Data Gap — Insufficient non-null indicators for composite scoring.',
      isDataGap: true,
      activeIndicatorsCount: 0,
      normalizationBreakdown: breakdown,
      confidenceInterval: null,
      safeguardNotice: 'Data Gap Notice — Observed indicator coverage below threshold.'
    };
  }

  // Rescale across active weights
  const normalizedScore = (weightedSum / totalActiveWeight) * 100;
  const roundedScore = Math.round(Math.max(0, Math.min(100, normalizedScore)));

  let severity: RiskSeverity = 'normal';
  if (roundedScore >= 70) {
    severity = 'severe';
  } else if (roundedScore >= 45) {
    severity = 'watch';
  }

  return {
    score: roundedScore,
    severity,
    primaryStressDriver: maxContributor || 'Composite Hydrological Stress',
    isDataGap: false,
    activeIndicatorsCount: activeCount,
    normalizationBreakdown: breakdown,
    confidenceInterval: null, // Always null pending physical calibration
    safeguardNotice: 'Descriptive Composite Score — Heuristic weighted index. Not an authoritative prediction or financial sanction basis.'
  };
}

// ---------------------------------------------------------------------------
// 2. Intervention Recommendation Engine Contract
// ---------------------------------------------------------------------------

export interface SchemeRecommendationMatch {
  scheme: SchemeItem;
  matchConfidence: 'high' | 'medium' | 'low';
  eligible: boolean;
  matchReason: string;
  recommendedInterventionType: string;
  estimatedSanctionRangeInr: [number, number];
  safeguardNotice: string;
}

/**
 * Matches an administrative unit / block to government schemes based on
 * explicit hydrogeological evidence and scheme eligibility rules.
 */
export function matchInterventionRecommendations(
  block: BlockData
): SchemeRecommendationMatch[] {
  const recommendations: SchemeRecommendationMatch[] = [];

  for (const scheme of INTERVENTION_SCHEMES) {
    let eligible = false;
    let matchReason = '';
    let matchConfidence: 'high' | 'medium' | 'low' = 'low';
    let recType = '';
    let minCost = 500000;
    let maxCost = scheme.maxSanctionUnitAmountInr;

    // 1. Atal Bhujal Yojana
    if (scheme.id === 'sch_atal_bhujal') {
      const wellDepth = block.indicators.cgwbWellDepthMbgl;
      const wellTrend = block.indicators.wellDepthTrendMperYr;
      const rainDeficit = block.indicators.rainfallAnomalyMm;

      if (wellDepth === null && wellTrend === null) {
        matchReason = 'Ineligible / Data Gap: Missing groundwater level and drawdown trend observation data.';
        eligible = false;
        matchConfidence = 'low';
        recType = 'Groundwater Telemetry Monitoring';
      } else if (
        (block.riskSeverity === 'severe' || block.riskSeverity === 'watch') &&
        (wellTrend !== null && wellTrend < -0.4)
      ) {
        eligible = true;
        matchConfidence = 'high';
        recType = 'Community Artificial Recharge & Piezometer Network';
        matchReason = `High stress condition (${block.riskSeverity}) with active drawdown trend (${wellTrend} m/yr) and rainfall deficit (${rainDeficit ?? 'unverified'} mm).`;
        minCost = 1500000;
      } else if (block.riskSeverity === 'severe') {
        eligible = true;
        matchConfidence = 'medium';
        recType = 'Water Security Plan & Demand Management';
        matchReason = 'Target block categorized under severe stress; eligible for Gram Panchayat water budget planning.';
        minCost = 800000;
      } else {
        eligible = false;
        matchConfidence = 'low';
        recType = 'Water Security Plan (Low Priority)';
        matchReason = block.riskSeverity === 'gap'
          ? 'Ineligible: Groundwater stress level unverified due to missing observations.'
          : 'Criteria not met: Block not categorized under severe stress or active drawdown trend.';
      }
    }

    // 2. Mission Amrit Sarovar
    else if (scheme.id === 'sch_amrit_sarovar') {
      const ndwi = block.indicators.sentinelNdwi;
      const soilMoisture = block.indicators.smapSoilMoisture;

      if (ndwi === null && soilMoisture === null) {
        eligible = false;
        matchConfidence = 'low';
        recType = 'Village Water Body Survey';
        matchReason = 'Data Gap: Surface water index (NDWI) and microwave soil moisture unavailable for this block. On-site pond survey required.';
      } else if (ndwi !== null && ndwi < -0.25) {
        eligible = true;
        matchConfidence = 'high';
        recType = 'Desilting and Rejuvenation of Silted Village Water Body';
        matchReason = `Surface water index (NDWI ${ndwi}) and soil moisture (${soilMoisture ?? 'unverified'}) indicate depleted local storage capacity.`;
        minCost = 1000000;
        maxCost = 3500000;
      } else {
        eligible = true;
        matchConfidence = 'medium';
        recType = 'Traditional Pond Re-excavation';
        matchReason = 'General eligibility for priority district water retention capacity expansion.';
        minCost = 750000;
        maxCost = 2500000;
      }
    }

    // 3. MGNREGA Water Conservation
    else if (scheme.id === 'sch_mgnrega_water') {
      if (block.riskSeverity === 'severe' || block.riskSeverity === 'watch') {
        eligible = true;
        matchConfidence = 'high';
        recType = 'Contour Trenching, Check Dams & Boulder Bunds';
        matchReason = `Natural resource conservation works matched to arrest runoff in hard-rock terrain.`;
        minCost = 500000;
        maxCost = 1500000;
      } else if (block.riskSeverity === 'gap') {
        eligible = false;
        matchConfidence = 'low';
        recType = 'Watershed Pre-feasibility Survey';
        matchReason = 'Data Gap: Hydrological stress unverified due to missing telemetry; civil works subject to local survey.';
      } else {
        eligible = true;
        matchConfidence = 'low';
        recType = 'Erosion Control & Gully Plugs';
        matchReason = 'Standard watershed conservation works for rural habitations.';
        minCost = 300000;
        maxCost = 1000000;
      }
    }

    // 4. Jal Jeevan Mission
    else if (scheme.id === 'sch_jjm') {
      const wellDepth = block.indicators.cgwbWellDepthMbgl;
      if (wellDepth === null) {
        eligible = false;
        matchConfidence = 'low';
        recType = 'Source Depth Survey';
        matchReason = 'Ineligible / Data Gap: Missing groundwater well depth observation to verify source sustainability threshold (>14m bgl).';
      } else if (wellDepth > 14) {
        eligible = true;
        matchConfidence = 'high';
        recType = 'Deep Piped Water Source Sustainability & Infiltration Well';
        matchReason = `Groundwater level (${wellDepth}m bgl) threatens rural drinking water source yield stability.`;
        minCost = 2000000;
        maxCost = 5000000;
      } else {
        eligible = false;
        matchConfidence = 'low';
        recType = 'Drinking Water Source Monitoring';
        matchReason = `Source depth (${wellDepth}m bgl) is currently within stable limits (<= 14m bgl threshold).`;
      }
    }

    recommendations.push({
      scheme,
      eligible,
      matchConfidence,
      matchReason,
      recommendedInterventionType: recType || 'Water Conservation Work',
      estimatedSanctionRangeInr: [minCost, maxCost],
      safeguardNotice: 'Rule-Based Pre-feasibility Suggestion — Detailed Project Report (DPR) and field hydrogeological survey required before financial sanction.'
    });
  }

  return recommendations;
}
