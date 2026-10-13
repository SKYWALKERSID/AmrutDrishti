/**
 * JAL DRISHTI — Nationwide Monitored Administrative Geography Dataset
 * 
 * Aggregates all empirical monitoring units across:
 * - Madhya Pradesh & Uttar Pradesh (Bundelkhand Pilot Basin)
 * - Punjab, Rajasthan, Haryana (Over-Exploited / High-Scarcity Red Zones)
 * - Arunachal Pradesh, Sikkim, Assam (Pristine Recharge / Surplus Basins)
 * 
 * Provides unified datasets for Overview, Explorer, Monitoring, Risk & Scoring, and Interventions.
 */

import type { DistrictData, BlockData } from '../types.ts';
import { BUNDELKHAND_DISTRICTS } from './bundelkhand.ts';
import { NATIONAL_CONTRAST_DISTRICTS } from './nationalContrast.ts';

/**
 * Normalizes state names to standard canonical Indian state names.
 */
export function normalizeStateName(stateName: string): string {
  if (!stateName) return '';
  const lower = stateName.toLowerCase().trim();
  if (lower.includes('uttar pradesh')) return 'Uttar Pradesh';
  if (lower.includes('madhya pradesh')) return 'Madhya Pradesh';
  if (lower.includes('punjab')) return 'Punjab';
  if (lower.includes('rajasthan')) return 'Rajasthan';
  if (lower.includes('haryana')) return 'Haryana';
  if (lower.includes('arunachal')) return 'Arunachal Pradesh';
  if (lower.includes('sikkim')) return 'Sikkim';
  if (lower.includes('assam')) return 'Assam';
  return stateName;
}

/**
 * Canonical unified list of all 28 monitored districts across all 8 active states.
 */
export const ALL_NATIONWIDE_DISTRICTS: DistrictData[] = [
  ...BUNDELKHAND_DISTRICTS,
  ...NATIONAL_CONTRAST_DISTRICTS
].map(dist => ({
  ...dist,
  state: normalizeStateName(dist.state),
  blocks: dist.blocks.map(b => ({
    ...b,
    state: normalizeStateName(b.state)
  }))
}));

/**
 * Canonical unified pool of all 60 monitored blocks across all 8 active states.
 */
export const ALL_NATIONWIDE_BLOCKS: BlockData[] = ALL_NATIONWIDE_DISTRICTS.flatMap(d => d.blocks);

/**
 * Merges live database blocks with nationwide baseline blocks.
 * If live PostGIS/Supabase rows exist, they override baseline values for matching block IDs.
 */
export function mergeWithLiveBlocks(liveBlocks: BlockData[]): BlockData[] {
  if (!liveBlocks || liveBlocks.length === 0) {
    return ALL_NATIONWIDE_BLOCKS;
  }

  const liveMap = new Map<string, BlockData>();
  for (const b of liveBlocks) {
    liveMap.set(b.id, b);
  }

  return ALL_NATIONWIDE_BLOCKS.map(block => {
    const live = liveMap.get(block.id);
    if (live) {
      return {
        ...live,
        state: normalizeStateName(live.state || block.state)
      };
    }
    return block;
  });
}
