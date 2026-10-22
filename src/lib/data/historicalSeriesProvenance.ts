/**
 * Provenance gate for bundled hydrograph series.
 *
 * The listed series were added without a source identifier, station mapping,
 * retrieval record, or reproducible generator. They therefore cannot be used
 * as historical observations. The raw arrays are retained as audit artifacts
 * only; this registry keeps them out of the monitoring chart until a reviewed
 * source manifest links each point to published observations.
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

export const UNTRACEABLE_ADDED_HYDROGRAPH_BLOCK_IDS = new Set([
  'blk_chhatarpur_main', 'blk_shivamogga_main', 'blk_bhadravati',
  'blk_davanagere_main', 'blk_adilabad_main', 'blk_nandipet',
  'blk_rajendranagar', 'blk_ottapidaram', 'blk_st_thomas_mount',
  'blk_periyanaickenpalayam', 'blk_thadlaskein', 'blk_umling',
  'blk_mylliem', 'blk_amarpur', 'blk_dukli', 'blk_ambassa',
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

const BUNDLED_SOURCE_REQUIRES_REVIEW: HistoricalSeriesProvenance = {
  kind: 'regionalized_estimate',
  displayableAsObservation: false,
  source: null,
  temporalCoverage: null,
  units: 'm bgl',
  generationMethod: 'Bundled local series; source-level verification is required before display.',
  limitation: 'The API may display published observations when available; local fallback is withheld until provenance is reviewed.',
};

export function historicalSeriesProvenanceFor(blockId: string): HistoricalSeriesProvenance {
  return UNTRACEABLE_ADDED_HYDROGRAPH_BLOCK_IDS.has(blockId)
    ? UNTRACEABLE_GENERATED
    : BUNDLED_SOURCE_REQUIRES_REVIEW;
}
