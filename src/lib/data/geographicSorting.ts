/**
 * AMRUT DRISHTI — Authoritative Geographic Sorting & Hierarchy Utilities
 * 
 * Enforces the global alphabetical hierarchy across all dropdowns, tables, maps, and selector panels:
 * State (A–Z) -> District (A–Z within State) -> Block (A–Z within District)
 * 
 * Uses case-insensitive, locale-aware sorting (Intl.Collator) with trimmed whitespace handling.
 * Never mutates original input arrays.
 */

import type { BlockData, DistrictData } from '../types.ts';
import type { IndianStateMeta } from '../data/indiaStates.ts';

const geoCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * Standard comparator for two strings using English locale-aware base sensitivity.
 * Trims leading/trailing whitespace and treats empty strings safely.
 */
export function compareGeoNames(a?: string | null, b?: string | null): number {
  const strA = (a ?? '').trim();
  const strB = (b ?? '').trim();
  return geoCollator.compare(strA, strB);
}

/**
 * Returns a sorted copy of IndianStateMeta or state objects alphabetically A-Z.
 */
export function sortStatesAlphabetically<T extends { name: string }>(states: T[]): T[] {
  if (!states || !Array.isArray(states)) return [];
  return [...states].sort((a, b) => compareGeoNames(a.name, b.name));
}

/**
 * Returns a sorted copy of DistrictData array.
 * Sorted primarily by State (A-Z) if multiple states are present, then by District name (A-Z).
 */
export function sortDistrictsAlphabetically(districts: DistrictData[]): DistrictData[] {
  if (!districts || !Array.isArray(districts)) return [];
  return [...districts].sort((a, b) => {
    const stateComp = compareGeoNames(a.state, b.state);
    if (stateComp !== 0) return stateComp;
    return compareGeoNames(a.name, b.name);
  });
}

/**
 * Returns a sorted copy of BlockData array.
 * Strictly adheres to the hierarchy:
 * State (A-Z) -> District Name (A-Z) -> Block Name (A-Z).
 */
export function sortBlocksHierarchy(blocks: BlockData[]): BlockData[] {
  if (!blocks || !Array.isArray(blocks)) return [];
  return [...blocks].sort((a, b) => {
    const stateComp = compareGeoNames(a.state, b.state);
    if (stateComp !== 0) return stateComp;

    const distComp = compareGeoNames(a.districtName, b.districtName);
    if (distComp !== 0) return distComp;

    return compareGeoNames(a.name, b.name);
  });
}

/**
 * Simple block sort by block name A-Z (e.g. when filtering within a single district).
 */
export function sortBlocksByName(blocks: BlockData[]): BlockData[] {
  if (!blocks || !Array.isArray(blocks)) return [];
  return [...blocks].sort((a, b) => compareGeoNames(a.name, b.name));
}
