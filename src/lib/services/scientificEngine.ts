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
// 1.1 Groundwater Intelligence & Drought Risk Assessment
// ---------------------------------------------------------------------------

export interface GroundwaterIntelligenceResult {
  droughtRisk: {
    category: 'Normal / Low Risk' | 'Watch / Moderate Deficit' | 'Severe Drought Watch' | 'Data Gap / Unverified';
    basis: string;
    spi3Month: number | null;
    rainfallDeficitMm: number | null;
    ruleExplanation: string;
  };
  waterAvailability: {
    status: 'qualitative_trend_only';
    direction: 'depleting' | 'recharging' | 'stable' | 'unverified';
    drawdownRateMperYr: number | null;
    storageLimitationNotice: string;
  };
  rechargeIntelligence: {
    rechargePotential: 'favorable' | 'moderate' | 'depleted' | 'unverified';
    naturalReplenishmentSummary: string;
    satelliteTwsaStatus: string;
  };
  actionableSummary: string;
}

/**
 * Derives rule-based groundwater intelligence and drought risk from observed environmental indicators.
 * Strict scientific constraints:
 * - Does not invent drought probability or training labels.
 * - Does not claim absolute underground storage volume without aquifer geometry and specific yield.
 * - Explicitly reports qualitative water availability trends.
 */
export function evaluateGroundwaterIntelligence(indicators: {
  cgwbWellDepthMbgl: number | null;
  rainfallAnomalyMm: number | null;
  graceTwsaCm: number | null;
  sentinelNdvi: number | null;
  smapSoilMoisture?: number | null;
  wellDepthTrendMperYr?: number | null;
  spi3Month?: number | null;
}): GroundwaterIntelligenceResult {
  // 1. Drought Risk Category (Rule-based Meteorological + Hydrological Indicators)
  let droughtCategory: GroundwaterIntelligenceResult['droughtRisk']['category'] = 'Normal / Low Risk';
  let basis = 'Observed rainfall and groundwater levels within seasonal baseline bounds.';
  let ruleExplanation = 'Evaluated using 3-month SPI and monsoon rainfall anomaly against state 30-year Long Period Average (LPA).';

  const spi = indicators.spi3Month ?? null;
  const rainDeficit = indicators.rainfallAnomalyMm ?? null;
  const wellDepth = indicators.cgwbWellDepthMbgl ?? null;
  const trend = indicators.wellDepthTrendMperYr ?? null;

  if (rainDeficit === null && spi === null && wellDepth === null) {
    droughtCategory = 'Data Gap / Unverified';
    basis = 'Missing rainfall precipitation and piezometric depth observations.';
    ruleExplanation = 'Drought risk assessment cannot be computed without observed meteorological or hydrological indicators.';
  } else if ((spi !== null && spi < -1.5) || (rainDeficit !== null && rainDeficit <= -250)) {
    droughtCategory = 'Severe Drought Watch';
    basis = `Significant monsoon deficit (${rainDeficit !== null ? `${rainDeficit} mm` : 'N/A'}${spi !== null ? `, SPI: ${spi}` : ''}) threatening aquifer replenishment.`;
    ruleExplanation = 'Meteorological drought criteria met (SPI < -1.5 or rainfall deficit >= 250 mm). High risk of uncompensated seasonal drawdown.';
  } else if ((spi !== null && spi < -0.5) || (rainDeficit !== null && rainDeficit < -100) || (trend !== null && trend < -0.3)) {
    droughtCategory = 'Watch / Moderate Deficit';
    basis = `Moderate precipitation deficit (${rainDeficit !== null ? `${rainDeficit} mm` : 'N/A'}) or active piezometric drawdown (${trend !== null ? `${trend} m/yr` : 'unverified'}).`;
    ruleExplanation = 'Indicators signal moisture deficit or downward water-table gradient requiring water-use monitoring.';
  }

  // 2. Water Availability & Storage Limitations
  let direction: GroundwaterIntelligenceResult['waterAvailability']['direction'] = 'unverified';
  if (trend !== null) {
    // trend in m/yr: negative value indicates water table falling / piezometric head declining (depleting),
    // positive value indicates water table rising closer to surface (recovering / potential recharge).
    if (trend < -0.2) direction = 'depleting';
    else if (trend > 0.2) direction = 'recharging';
    else direction = 'stable';
  } else if (wellDepth !== null) {
    direction = wellDepth > 15 ? 'depleting' : 'stable';
  }

  const storageLimitationNotice = 'Absolute groundwater volume (m³ or BCM) cannot be determined without physical aquifer boundary surveys, verified specific yield (Sy), and saturated thickness. JalDrishti strictly reports piezometric trends (m bgl) and relative stress indices to prevent false precision.';

  // 3. Recharge & Anomaly Intelligence
  let rechargePotential: GroundwaterIntelligenceResult['rechargeIntelligence']['rechargePotential'] = 'unverified';
  let naturalReplenishmentSummary = 'Recharge potential unverified due to missing rainfall or soil moisture observations.';
  if (rainDeficit !== null) {
    if (rainDeficit >= 0) {
      rechargePotential = 'favorable';
      naturalReplenishmentSummary = `Normal to surplus rainfall (+${rainDeficit} mm) provides potential hydrological conditions favorable for natural infiltration, subject to local lithology and runoff.`;
    } else if (rainDeficit > -150) {
      rechargePotential = 'moderate';
      naturalReplenishmentSummary = `Moderate rainfall shortfall (${rainDeficit} mm); potential recharge expected to be subdued.`;
    } else {
      rechargePotential = 'depleted';
      naturalReplenishmentSummary = `Acute monsoon deficit (${rainDeficit} mm) severely limits natural recharge conditions, accelerating uncompensated seasonal pumping stress.`;
    }
  }

  const twsa = indicators.graceTwsaCm;
  const satelliteTwsaStatus = twsa !== null && twsa !== undefined
    ? `Regional terrestrial mass anomaly: ${twsa > 0 ? `+${twsa}` : twsa} cm. ${twsa < -5 ? 'Regional storage indicates basin-scale depletion.' : 'Regional mass within normal limits.'}`
    : 'Regional satellite mass anomaly unavailable.';

  // 4. Actionable Summary
  let actionableSummary = '';
  if (droughtCategory === 'Severe Drought Watch') {
    actionableSummary = 'Prioritize artificial recharge structures (check dams, percolation tanks), activate participatory water budgeting under Atal Bhujal Yojana, and restrict non-essential agricultural dewatering.';
  } else if (droughtCategory === 'Watch / Moderate Deficit') {
    actionableSummary = 'Encourage micro-irrigation, desilt existing village water bodies (Amrit Sarovar), and closely monitor multi-quarter ML forecast trajectories.';
  } else if (droughtCategory === 'Data Gap / Unverified') {
    actionableSummary = 'Deploy or calibrate local piezometer telemetry before initiating statutory emergency actions or financial sanctions.';
  } else {
    actionableSummary = 'Maintain sustainable extraction practices and continue regular seasonal piezometric monitoring.';
  }

  return {
    droughtRisk: {
      category: droughtCategory,
      basis,
      spi3Month: spi,
      rainfallDeficitMm: rainDeficit,
      ruleExplanation,
    },
    waterAvailability: {
      status: 'qualitative_trend_only',
      direction,
      drawdownRateMperYr: trend,
      storageLimitationNotice,
    },
    rechargeIntelligence: {
      rechargePotential,
      naturalReplenishmentSummary,
      satelliteTwsaStatus,
    },
    actionableSummary,
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
