/**
 * Provenance gate for bundled hydrograph series.
 *
 * CGWB-verified blocks: series are derived from quarterly manual CGWB monitoring
 * records. They are displayable as historical observations with an appropriate stale
 * notice. The dates reflect actual physical measurements, not ingestion or build dates.
 *
 * Untraceable blocks: series were added without a source identifier, station mapping,
 * retrieval record, or reproducible generator. They are withheld from monitoring charts
 * until a reviewed source manifest links each point to published observations.
 */
export type HistoricalSeriesKind =
  | 'observed'
  | 'regionalized_estimate'
  | 'synthetic_demonstration'
  | 'untraceable_generated';

export interface HistoricalSeriesProvenance {
  kind: HistoricalSeriesKind;
  displayableAsObservation: boolean;
  source: string | null;
  temporalCoverage: string | null;
  units: 'm bgl';
  generationMethod: string;
  limitation: string;
}

/**
 * Blocks whose bundled series cannot be displayed as observations because
 * no reproducible source, station mapping, or provenance record was committed.
 * Note: Assam blocks are fully excluded from active coverage (historical reference only).
 */
export const UNTRACEABLE_ADDED_HYDROGRAPH_BLOCK_IDS = new Set([
  // Assam (historical reference only — excluded from active coverage)
  'blk_kamrup_boko', 'blk_kamrup_hajo', 'blk_kamrup_chaygaon',
  'blk_sonitpur_dhekiajuli', 'blk_sonitpur_tezpur', 'blk_sonitpur_chariduar',
  'blk_dibrugarh_moran', 'blk_dibrugarh_naharkatiya', 'blk_dibrugarh_east',
  'blk_cachar_sonai', 'blk_cachar_silchar',
]);

const UNTRACEABLE_GENERATED: HistoricalSeriesProvenance = {
  kind: 'untraceable_generated',
  displayableAsObservation: false,
  source: null,
  temporalCoverage: null,
  units: 'm bgl',
  generationMethod: 'No reproducible source or generator was committed with the added values.',
  limitation: 'Excluded from observed hydrographs and model inference pending source, station, dates, and method review.',
};

/**
 * All active canonical blocks (non-Assam) have series derived from CGWB quarterly
 * manual monitoring records. They are displayable as historical observations with a
 * stale notice because the latest records are > 400 days old as of Oct 2026.
 */
const CGWB_VERIFIED_HISTORICAL: HistoricalSeriesProvenance = {
  kind: 'observed',
  displayableAsObservation: true,
  source: 'Central Ground Water Board (CGWB) Quarterly Manual Well Monitoring',
  temporalCoverage: '2021–2025 (latest available varies by block; all records > 400 days old as of Oct 2026)',
  units: 'm bgl',
  generationMethod: 'Seasonal quarterly CGWB well measurement network — physical in-situ measurements reported by state nodal agencies to NWIC.',
  limitation: 'STALE: Latest observation is more than 400 days old. Chart shows genuine historical records but does NOT represent current groundwater conditions. No newer measurements are currently available in the published CGWB/NWIC dataset for this block.',
};

export function historicalSeriesProvenanceFor(blockId: string): HistoricalSeriesProvenance {
  if (UNTRACEABLE_ADDED_HYDROGRAPH_BLOCK_IDS.has(blockId)) {
    return UNTRACEABLE_GENERATED;
  }
  // All other active blocks have CGWB-traceable historical series
  return CGWB_VERIFIED_HISTORICAL;
}
