import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DerivedIndicatorRow, RiskSeverityEnum } from '../types/database.ts';

export interface PublishedObservationRecord {
  station_id: string;
  station_name: string;
  district_id: string;
  district_name: string;
  block_id: string;
  block_name: string;
  observation_date: string;
  water_level_mbgl: number | null;
  unit: string;
  quality_flag: string | null;
  source_name: string;
  source_provider: string;
  source_resource_url: string;
}

export interface CalculatedBlockIndicator {
  unit_id: string;
  block_name: string;
  district_id: string;
  district_name: string;
  total_observations: number;
  valid_observations: number;
  null_observations: number;
  latest_observation_date: string;
  cgwb_well_depth_mbgl: number | null;
  well_depth_trend_m_per_yr: number | null;
  descriptive_stress_score: number | null;
  risk_severity: RiskSeverityEnum;
  primary_stress_driver: string;
  safeguard_notice: string;
}

/**
 * Computes defensible groundwater indicators from published observations for a set of blocks.
 *
 * Rules:
 * - cgwb_well_depth_mbgl: average water level on the latest date that has valid measurements.
 * - well_depth_trend_m_per_yr: OLS linear regression slope across time in years.
 * - risk_severity: 'watch' if mean >= 7.0 mbgl or trend >= 0.2 m/yr; 'severe' if mean >= 12.0 mbgl or trend >= 0.5 m/yr; 'normal' otherwise; 'gap' if no valid data.
 * - Never converts missing measurements to zero.
 */
export function calculateBlockIndicatorsFromObservations(
  observations: PublishedObservationRecord[]
): Map<string, CalculatedBlockIndicator> {
  const byBlock = new Map<string, PublishedObservationRecord[]>();

  for (const obs of observations) {
    if (!obs.block_id) continue;
    if (!byBlock.has(obs.block_id)) {
      byBlock.set(obs.block_id, []);
    }
    byBlock.get(obs.block_id)!.push(obs);
  }

  const results = new Map<string, CalculatedBlockIndicator>();

  for (const [blockId, blockObs] of byBlock.entries()) {
    const validObs = blockObs.filter(o => o.water_level_mbgl !== null && typeof o.water_level_mbgl === 'number');
    const nullCount = blockObs.length - validObs.length;
    const blockName = blockObs[0].block_name;
    const districtId = blockObs[0].district_id;
    const districtName = blockObs[0].district_name;

    if (validObs.length === 0) {
      results.set(blockId, {
        unit_id: blockId,
        block_name: blockName,
        district_id: districtId,
        district_name: districtName,
        total_observations: blockObs.length,
        valid_observations: 0,
        null_observations: nullCount,
        latest_observation_date: blockObs[0].observation_date,
        cgwb_well_depth_mbgl: null,
        well_depth_trend_m_per_yr: null,
        descriptive_stress_score: null,
        risk_severity: 'gap',
        primary_stress_driver: 'Data Gap — No valid groundwater measurements recorded for this block.',
        safeguard_notice: 'Data Gap Notice — Observed indicator coverage below threshold.'
      });
      continue;
    }

    // Sort valid observations chronologically
    validObs.sort((a, b) => a.observation_date.localeCompare(b.observation_date));

    // Group valid observations by date to find latest date with measurements
    const dateMap = new Map<string, number[]>();
    for (const o of validObs) {
      if (!dateMap.has(o.observation_date)) dateMap.set(o.observation_date, []);
      dateMap.get(o.observation_date)!.push(o.water_level_mbgl!);
    }

    const sortedDates = Array.from(dateMap.keys()).sort();
    const latestDate = sortedDates[sortedDates.length - 1];
    const latestLevels = dateMap.get(latestDate)!;
    const meanLatestMbgl = Number((latestLevels.reduce((a, b) => a + b, 0) / latestLevels.length).toFixed(2));

    // Calculate OLS linear regression across all valid observations: y = water_level_mbgl, x = time in years
    let trendMperYr: number | null = null;
    if (sortedDates.length >= 2 && validObs.length >= 3) {
      const t0 = new Date(sortedDates[0]).getTime();
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      const n = validObs.length;

      for (const o of validObs) {
        const years = (new Date(o.observation_date).getTime() - t0) / (1000 * 3600 * 24 * 365.25);
        const y = o.water_level_mbgl!;
        sumX += years;
        sumY += y;
        sumXY += years * y;
        sumXX += years * years;
      }

      const denominator = n * sumXX - sumX * sumX;
      if (Math.abs(denominator) > 1e-6) {
        const slope = (n * sumXY - sumX * sumY) / denominator;
        trendMperYr = Number(slope.toFixed(3));
      }
    }

    // Determine descriptive risk severity
    let severity: RiskSeverityEnum = 'normal';
    if (meanLatestMbgl >= 12.0 || (trendMperYr !== null && trendMperYr >= 0.5)) {
      severity = 'severe';
    } else if (meanLatestMbgl >= 7.0 || (trendMperYr !== null && trendMperYr >= 0.2)) {
      severity = 'watch';
    }

    // Descriptive stress score scaled 0-100 based on observed well depth (e.g. 0m -> 0, 15m -> 100)
    const descriptiveScore = Math.min(100, Math.max(0, Math.round((meanLatestMbgl / 15.0) * 100)));

    const driver = `Observed quarterly monitoring well level averaging ${meanLatestMbgl} m bgl on ${latestDate} across ${latestLevels.length} station(s). Multi-year trend: ${trendMperYr !== null ? `${trendMperYr > 0 ? '+' : ''}${trendMperYr} m/yr` : 'insufficient dates'}.`;

    results.set(blockId, {
      unit_id: blockId,
      block_name: blockName,
      district_id: districtId,
      district_name: districtName,
      total_observations: blockObs.length,
      valid_observations: validObs.length,
      null_observations: nullCount,
      latest_observation_date: latestDate,
      cgwb_well_depth_mbgl: meanLatestMbgl,
      well_depth_trend_m_per_yr: trendMperYr,
      descriptive_stress_score: descriptiveScore,
      risk_severity: severity,
      primary_stress_driver: driver,
      safeguard_notice: 'Derived from published CGWB monitoring well network measurements (2021-2023). Satellite and rainfall parameters remain null. Not an AI forecast.'
    });
  }

  return results;
}

/**
 * Builds database-ready DerivedIndicatorRow objects.
 */
export function buildDerivedIndicatorRows(
  calculated: Map<string, CalculatedBlockIndicator>
): Omit<DerivedIndicatorRow, 'indicator_id' | 'created_at'>[] {
  const rows: Omit<DerivedIndicatorRow, 'indicator_id' | 'created_at'>[] = [];

  for (const item of calculated.values()) {
    rows.push({
      unit_id: item.unit_id,
      grace_twsa_cm: null,
      rainfall_anomaly_mm: null,
      spi_3month: null,
      sentinel_ndvi: null,
      sentinel_ndwi: null,
      smap_soil_moisture: null,
      cgwb_well_depth_mbgl: item.cgwb_well_depth_mbgl,
      well_depth_trend_m_per_yr: item.well_depth_trend_m_per_yr,
      descriptive_stress_score: item.descriptive_stress_score,
      risk_severity: item.risk_severity,
      data_status: 'observed',
      primary_stress_driver: item.primary_stress_driver,
      safeguard_notice: item.safeguard_notice,
      assessed_date: item.latest_observation_date
    });
  }

  return rows;
}
