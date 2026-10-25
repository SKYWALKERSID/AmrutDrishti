import type { SchemeItem, BlockData } from '../types.ts';
import { INTERVENTION_SCHEMES } from '../data/schemes.ts';

export type DetectedSituationType =
  | 'compounding_drought_and_rapid_drawdown'
  | 'severe_groundwater_drawdown_stable_rain'
  | 'acute_meteorological_drought_watch'
  | 'favorable_recharge_window'
  | 'conflicting_or_insufficient_evidence';

export interface IntegratedSituationAssessment {
  situationType: DetectedSituationType;
  title: string;
  severityLevel: 'critical' | 'high' | 'moderate' | 'low' | 'data_gap';
  affectedUnit: {
    blockId: string;
    blockName: string;
    districtName: string;
    stateName: string;
  };
  triggeringEvidence: {
    groundwaterObservationDate?: string;
    groundwaterDepthMbgl?: number | null;
    drawdownRateMperYr?: number | null;
    predictedDepthHorizon90d?: number | null;
    rainfallAnomalyMm?: number | null;
    spi3Month?: number | null;
    drySpellDays?: number | null;
    forecastDeficitProbability?: number | null;
    dataQualityLimitations?: string[];
  };
  situationSummary: string;
  ruleExplanation: string;
  urgency: 'immediate' | 'high' | 'seasonal' | 'monitoring_only';
}

export interface SituationAwareInterventionRecommendation {
  id: string;
  situationType: DetectedSituationType;
  schemeId: string;
  schemeName: string;
  interventionType: string;
  priorityScore: number; // 0 - 100 based on multi-criteria ranking
  urgency: 'immediate' | 'high' | 'seasonal' | 'monitoring_only';
  estimatedCostRangeInr: [number, number];
  eligible: boolean;
  rationale: string;
  feasibilityConstraints: string[];
  responsibleRole: string;
  requiredApprovalAuthority: string;
  measurableMonitoringIndicator: string;
  safeguardNotice: string;
}

/**
 * Detects the hydrogeological situation by integrating groundwater observations,
 * station-forecast depth projections, unified rainfall intelligence, and rainfall forecast probabilities.
 */
export function detectIntegratedSituation(
  block: BlockData,
  rainfallIntel?: any,
  rainfallForecast?: any,
  groundwaterForecast90?: any
): IntegratedSituationAssessment {
  const wellDepth = block.indicators.cgwbWellDepthMbgl;
  const wellTrend = block.indicators.wellDepthTrendMperYr;
  const rainDeficit = rainfallIntel?.recent_30d_anomaly_mm ?? block.indicators.rainfallAnomalyMm;
  const spi = rainfallIntel?.spi_3month_equivalent ?? block.indicators.spi3Month;
  const drySpellDays = rainfallIntel?.current_dry_spell_days ?? null;
  const probDeficit = rainfallForecast?.event_probabilities?.probability_severe_deficit_gt_50pct ?? null;
  const predictedDepth90d = groundwaterForecast90?.prediction?.p50 ?? null;

  const dataQualityLimitations: string[] = [];
  if (wellDepth === null) dataQualityLimitations.push('Missing CGWB/NWIC piezometric well observation.');
  if (rainDeficit === null) dataQualityLimitations.push('Missing unified rainfall anomaly observation.');
  if (predictedDepth90d === null) dataQualityLimitations.push('Station telemetry groundwater forecast unavailable.');

  // Rule 1: Conflicting or Insufficient Evidence
  if (wellDepth === null && rainDeficit === null) {
    return {
      situationType: 'conflicting_or_insufficient_evidence',
      title: 'Insufficient Evidence / Multi-Sensor Data Gap',
      severityLevel: 'data_gap',
      affectedUnit: {
        blockId: block.id,
        blockName: block.name,
        districtName: block.districtName,
        stateName: block.state
      },
      triggeringEvidence: {
        groundwaterDepthMbgl: null,
        rainfallAnomalyMm: null,
        dataQualityLimitations
      },
      situationSummary: 'Required verified groundwater levels and rainfall measurements are unavailable. Pre-feasibility civil works cannot be authorized without local physical surveys.',
      ruleExplanation: 'Fail-closed protocol enforces data-gap designation when primary hydrogeological and rainfall telemetry are offline.',
      urgency: 'monitoring_only'
    };
  }

  // Rule 2: Compounding Drought & Rapid Drawdown (High Deficit + Active Water Table Drop)
  const isRainDeficitSevere = (rainDeficit !== null && rainDeficit <= -150) || (spi !== null && spi <= -1.2);
  const isDrawdownSevere = (wellTrend !== null && wellTrend < -0.4) || (predictedDepth90d !== null && wellDepth !== null && (predictedDepth90d - wellDepth > 0.5));

  if (isRainDeficitSevere && isDrawdownSevere) {
    return {
      situationType: 'compounding_drought_and_rapid_drawdown',
      title: 'Compounding Meteorological Drought & Rapid Aquifer Drawdown',
      severityLevel: 'critical',
      affectedUnit: {
        blockId: block.id,
        blockName: block.name,
        districtName: block.districtName,
        stateName: block.state
      },
      triggeringEvidence: {
        groundwaterObservationDate: block.indicators.lastUpdatedDate,
        groundwaterDepthMbgl: wellDepth,
        drawdownRateMperYr: wellTrend,
        predictedDepthHorizon90d: predictedDepth90d,
        rainfallAnomalyMm: rainDeficit,
        spi3Month: spi,
        drySpellDays,
        forecastDeficitProbability: probDeficit,
        dataQualityLimitations
      },
      situationSummary: `Acute depletion risk: Active water table drop (${wellTrend ? wellTrend + ' m/yr' : 'projected +90d drop'}) compounding with severe rainfall shortfall (${rainDeficit} mm). Natural monsoon replenishment insufficient to stabilize extraction.`,
      ruleExplanation: 'Dual threshold triggered: Meteorological deficit (SPI <= -1.2 or deficit <= -150mm) intersecting with empirical annual drawdown (>0.4 m/yr) or forward ML depth decline.',
      urgency: 'immediate'
    };
  }

  // Rule 3: Severe Groundwater Drawdown with Stable / Non-Deficit Rainfall (Pumping Over-Draft)
  if (isDrawdownSevere && !isRainDeficitSevere) {
    return {
      situationType: 'severe_groundwater_drawdown_stable_rain',
      title: 'Anthropogenic Aquifer Over-Drafting (Pumping Stress)',
      severityLevel: 'high',
      affectedUnit: {
        blockId: block.id,
        blockName: block.name,
        districtName: block.districtName,
        stateName: block.state
      },
      triggeringEvidence: {
        groundwaterObservationDate: block.indicators.lastUpdatedDate,
        groundwaterDepthMbgl: wellDepth,
        drawdownRateMperYr: wellTrend,
        predictedDepthHorizon90d: predictedDepth90d,
        rainfallAnomalyMm: rainDeficit,
        spi3Month: spi,
        dataQualityLimitations
      },
      situationSummary: `Groundwater level is depleting rapidly (${wellTrend ? wellTrend + ' m/yr' : 'deepening table'}) despite normal meteorological precipitation (${rainDeficit ?? 0} mm). Indicates demand-driven agricultural or industrial extraction exceeding natural aquifer recharge capacity.`,
      ruleExplanation: 'High drawdown rate with normal meteorological index isolates extraction over-draft from rainfall shortfall.',
      urgency: 'high'
    };
  }

  // Rule 4: Acute Meteorological Drought Watch (Rainfall Deficit with Stable Well Depth)
  if (isRainDeficitSevere && !isDrawdownSevere) {
    return {
      situationType: 'acute_meteorological_drought_watch',
      title: 'Acute Meteorological Drought Advisory',
      severityLevel: 'moderate',
      affectedUnit: {
        blockId: block.id,
        blockName: block.name,
        districtName: block.districtName,
        stateName: block.state
      },
      triggeringEvidence: {
        groundwaterObservationDate: block.indicators.lastUpdatedDate,
        groundwaterDepthMbgl: wellDepth,
        rainfallAnomalyMm: rainDeficit,
        spi3Month: spi,
        drySpellDays,
        forecastDeficitProbability: probDeficit,
        dataQualityLimitations
      },
      situationSummary: `Severe rainfall anomaly (${rainDeficit} mm) detected, but physical groundwater levels remain buffered by regional storage or delayed percolation. Soil moisture depletion and upcoming seasonal drawdown expected.`,
      ruleExplanation: 'Deficit precipitation criteria met with buffered groundwater table; preventative surface retention warranted.',
      urgency: 'seasonal'
    };
  }

  // Rule 5: Favorable Natural Recharge Window (Surplus Rain + Favorable Soil Moisture)
  const isSurplusRain = rainDeficit !== null && rainDeficit >= 50;
  return {
    situationType: 'favorable_recharge_window',
    title: isSurplusRain ? 'Favorable Monsoon Replenishment & Storage Window' : 'Stable Hydrological Baseline',
    severityLevel: isSurplusRain ? 'low' : 'low',
    affectedUnit: {
      blockId: block.id,
      blockName: block.name,
      districtName: block.districtName,
      stateName: block.state
    },
    triggeringEvidence: {
      groundwaterObservationDate: block.indicators.lastUpdatedDate,
      groundwaterDepthMbgl: wellDepth,
      drawdownRateMperYr: wellTrend,
      rainfallAnomalyMm: rainDeficit,
      spi3Month: spi,
      dataQualityLimitations
    },
    situationSummary: isSurplusRain
      ? `Surplus precipitation (+${rainDeficit} mm) provides high potential for natural and managed aquifer recharge.`
      : 'Observed groundwater levels and rainfall measurements remain within normal seasonal baseline variance.',
    ruleExplanation: 'Hydrological variables indicate baseline stability or positive net infiltration.',
    urgency: 'seasonal'
  };
}

/**
 * Generates situation-specific intervention recommendations mapped to statutory government schemes.
 */
export function generateSituationAwareInterventions(
  assessment: IntegratedSituationAssessment
): SituationAwareInterventionRecommendation[] {
  const recommendations: SituationAwareInterventionRecommendation[] = [];

  for (const scheme of INTERVENTION_SCHEMES) {
    let eligible = false;
    let priorityScore = 40;
    let urgency: 'immediate' | 'high' | 'seasonal' | 'monitoring_only' = 'seasonal';
    let interventionType = '';
    let rationale = '';
    let minCost = 500000;
    let maxCost = scheme.maxSanctionUnitAmountInr;
    const feasibilityConstraints: string[] = [];

    // Scheme 1: Atal Bhujal Yojana
    if (scheme.id === 'sch_atal_bhujal') {
      if (assessment.situationType === 'compounding_drought_and_rapid_drawdown') {
        eligible = true;
        priorityScore = 95;
        urgency = 'immediate';
        interventionType = 'Emergency Gram Panchayat Water Security Plan & Artificial Recharge Wells';
        rationale = 'Dual crisis: Rapid drawdown combined with deficient monsoon. Prioritizes community-managed aquifer recharge shafts and demand-side irrigation water rationing.';
        minCost = 1500000;
        maxCost = 2500000;
        feasibilityConstraints.push('Requires site hydrogeological survey to confirm unconfined aquifer permeable zone.', 'Gram Sabha water budgeting resolution mandatory.');
      } else if (assessment.situationType === 'severe_groundwater_drawdown_stable_rain') {
        eligible = true;
        priorityScore = 88;
        urgency = 'high';
        interventionType = 'Demand-Side Irrigation Water Budgeting & Piezometer Telemetry';
        rationale = 'Drawdown driven by pumping over-draft. Immediate demand management and crop-water diversification necessary.';
        minCost = 1000000;
        maxCost = 2000000;
        feasibilityConstraints.push('Voluntary community farmer compliance required for water budgeting.');
      } else if (assessment.situationType === 'conflicting_or_insufficient_evidence') {
        eligible = false;
        priorityScore = 20;
        urgency = 'monitoring_only';
        interventionType = 'DWLR Telemetry Installation & Hydrogeological Baseline Survey';
        rationale = 'Groundwater data gap: Telemetry monitoring infrastructure required before scheme eligibility can be evaluated.';
        minCost = 500000;
        maxCost = 1000000;
        feasibilityConstraints.push('Requires baseline borehole installation.');
      } else {
        eligible = false;
        priorityScore = 35;
        interventionType = 'Routine Seasonal Water Balance Monitoring';
        rationale = 'Groundwater drawdown thresholds (<0.4 m/yr) not breached.';
      }
    }

    // Scheme 2: Mission Amrit Sarovar
    else if (scheme.id === 'sch_amrit_sarovar') {
      if (
        assessment.situationType === 'compounding_drought_and_rapid_drawdown' ||
        assessment.situationType === 'acute_meteorological_drought_watch'
      ) {
        eligible = true;
        priorityScore = 90;
        urgency = 'high';
        interventionType = 'Deep Desilting, Inlet Channel Re-excavation & Percolation Tank Augmentation';
        rationale = 'Rainfall deficit requires maximizing runoff capture during intermittent showers to recharge shallow weathered aquifers.';
        minCost = 1200000;
        maxCost = 3500000;
        feasibilityConstraints.push('Minimum 1-acre traditional water body footprint required.', 'Soil permeability check required to avoid impermeable clay siltation.');
      } else if (assessment.situationType === 'favorable_recharge_window') {
        eligible = true;
        priorityScore = 75;
        urgency = 'seasonal';
        interventionType = 'Traditional Village Pond Rejuvenation & Spillway Maintenance';
        rationale = 'Surplus precipitation provides opportune conditions to fill rejuvenated village storage bodies.';
        minCost = 800000;
        maxCost = 2500000;
        feasibilityConstraints.push('Catchment runoff area protection required.');
      } else {
        eligible = true;
        priorityScore = 50;
        interventionType = 'Standard Amrit Sarovar Village Water Retention Pond';
        rationale = 'General district rural water body capacity expansion.';
        minCost = 750000;
        maxCost = 2000000;
      }
    }

    // Scheme 3: MGNREGA Water Conservation
    else if (scheme.id === 'sch_mgnrega_water') {
      if (assessment.situationType === 'compounding_drought_and_rapid_drawdown' || assessment.situationType === 'acute_meteorological_drought_watch') {
        eligible = true;
        priorityScore = 85;
        urgency = 'immediate';
        interventionType = 'Contour Trenches, Check Dams, Boulder Bunds & Farm Ponds';
        rationale = 'Labor-intensive ridge-to-valley treatments to arrest sudden torrential runoff and reduce surface soil moisture evaporation.';
        minCost = 600000;
        maxCost = 1500000;
        feasibilityConstraints.push('Slope gradient (>3%) and labor budget availability required.');
      } else {
        eligible = true;
        priorityScore = 55;
        urgency = 'seasonal';
        interventionType = 'Gully Plugs & Silt Detention Dams';
        rationale = 'Routine watershed conservation works for rural habitations.';
        minCost = 300000;
        maxCost = 1000000;
      }
    }

    // Scheme 4: Jal Jeevan Mission
    else if (scheme.id === 'sch_jjm') {
      const wellDepth = assessment.triggeringEvidence.groundwaterDepthMbgl;
      if (typeof wellDepth === 'number' && wellDepth > 14) {
        eligible = true;
        priorityScore = assessment.situationType === 'compounding_drought_and_rapid_drawdown' ? 92 : 80;
        urgency = 'immediate';
        interventionType = 'Deep Borewell Source Sustainability & Infiltration Gallery Construction';
        rationale = `Deep groundwater level (${wellDepth} m bgl) threatens community piped water supply intake. Source sustainability structure required to avert tanker dependency.`;
        minCost = 2000000;
        maxCost = 5000000;
        feasibilityConstraints.push('Detailed Project Report (DPR) clearance by PHED required.', 'Water quality testing for fluoride/salinity mandatory.');
      } else {
        eligible = false;
        priorityScore = 30;
        urgency = 'monitoring_only';
        interventionType = 'Rural Piped Water Intake Monitoring';
        rationale = 'Borehole water table is currently within stable yield limits (<= 14m bgl).';
      }
    }

    recommendations.push({
      id: `rec_${assessment.affectedUnit.blockId}_${scheme.id}`,
      situationType: assessment.situationType,
      schemeId: scheme.id,
      schemeName: scheme.name,
      interventionType,
      priorityScore,
      urgency,
      estimatedCostRangeInr: [minCost, maxCost],
      eligible,
      rationale,
      feasibilityConstraints,
      responsibleRole: scheme.reviewOwnerRole,
      requiredApprovalAuthority: scheme.reviewOwnerRole === 'district_collector' ? 'District Collector / Magistrate' : 'Block Development Officer (BDO)',
      measurableMonitoringIndicator: scheme.id === 'sch_atal_bhujal'
        ? 'Seasonal piezometer water table recovery rate (m bgl) & extraction reduction (%)'
        : scheme.id === 'sch_jjm'
        ? 'Daily household functional tap supply liters-per-capita-per-day (LPCD)'
        : 'Surface water storage volume (cu.m) & satellite NDWI',
      safeguardNotice: 'Automated Situation-Aware Decision Support — Does NOT automatically authorize expenditure. DPR clearance and field physical verification required.'
    });
  }

  // Sort by priorityScore descending
  return recommendations.sort((a, b) => b.priorityScore - a.priorityScore);
}
