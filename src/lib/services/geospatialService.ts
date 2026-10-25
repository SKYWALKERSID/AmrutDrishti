import { createBrowserClient } from '@supabase/ssr';
import type { BlockData } from '../types.ts';
import type { AdministrativeUnitRow, DerivedIndicatorRow } from '../types/database.ts';
import { mapDbRowToBlockData } from '../mappers/blockMapper.ts';
import { ALL_BLOCKS } from '../data/bundelkhand.ts';

import { sortBlocksHierarchy } from '../data/geographicSorting.ts';

export interface GeospatialQueryResult {
  blocks: BlockData[];
  /**
   * Origin of the data:
   *   'live_database'        — rows fetched from configured Supabase instance.
   *   'demonstration_fixture' — local fixture data (only in explicit JALDRISHTI_DEMO_MODE).
   *   'fallback_empty'        — DB unconfigured, error, or returned no usable results.
   */
  source: 'live_database' | 'demonstration_fixture' | 'fallback_empty';
  /**
   * True when the data should be treated as demonstration/unvalidated.
   * Live-DB data remains true until field-verified operational validation is confirmed.
   * Always true for demonstration_fixture and fallback_empty sources.
   */
  isDemonstrationData: boolean;
  totalCount: number;
  fetchedAt: string;
  errorMessage?: string;
}

/**
 * Server-side read-only data access service for JalDrishti Geospatial layers.
 * Querying administrative_units and derived_indicators with explicit fallback semantics.
 * Uses supported @supabase/ssr server client preserving RLS rules.
 */
export async function fetchBlocksGeospatialData(): Promise<GeospatialQueryResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const fetchedAt = new Date().toISOString();
  const isExplicitDemo = process.env.JALDRISHTI_DEMO_MODE === 'true';

  const demo = (message: string): GeospatialQueryResult => {
    const sortedDemoBlocks = sortBlocksHierarchy(ALL_BLOCKS);
    return {
      blocks: sortedDemoBlocks,
      source: 'demonstration_fixture',
      isDemonstrationData: true,
      totalCount: sortedDemoBlocks.length,
      fetchedAt,
      errorMessage: message
    };
  };

  const emptyResult = (message: string): GeospatialQueryResult => ({
    blocks: [],
    source: 'fallback_empty',
    isDemonstrationData: true,
    totalCount: 0,
    fetchedAt,
    errorMessage: message
  });

  // 1. Check Environment Variables
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    if (isExplicitDemo) {
      return demo('Supabase environment unconfigured; explicit JALDRISHTI_DEMO_MODE enabled.');
    }
    return emptyResult('Supabase environment unconfigured; live geospatial records unavailable.');
  }

  try {
    let supabase;
    if (typeof window === 'undefined') {
      try {
        const { createClient: createServerClient } = await import('../supabase/server.ts');
        supabase = await createServerClient();
      } catch {
        supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
      }
    } else {
      supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    }

    // 2. Query administrative_units
    const { data: units, error: unitsError } = await supabase
      .from('administrative_units')
      .select('*')
      .eq('unit_type', 'block');

    if (unitsError) {
      if (isExplicitDemo) {
        return demo(`Database query error (administrative_units): ${unitsError.message}. Using demonstration fixtures.`);
      }
      return emptyResult(`Database query error (administrative_units): ${unitsError.message}.`);
    }

    if (!units || units.length === 0) {
      if (isExplicitDemo) {
        return demo('No administrative units returned from database. Using demonstration fixtures.');
      }
      return emptyResult('No administrative units returned from database.');
    }

    // 3. Query derived_indicators ordered by assessed_date DESC for deduplication
    const { data: indicators, error: indicatorsError } = await supabase
      .from('derived_indicators')
      .select('*')
      .order('assessed_date', { ascending: false });

    if (indicatorsError) {
      console.warn('Could not fetch derived_indicators, proceeding with unit-only mapping:', indicatorsError.message);
    }

    // Map latest indicator per unit_id (deduplication)
    const indicatorMap = new Map<string, DerivedIndicatorRow>();
    if (indicators && indicators.length > 0) {
      for (const ind of indicators as DerivedIndicatorRow[]) {
        if (!indicatorMap.has(ind.unit_id)) {
          indicatorMap.set(ind.unit_id, ind);
        }
      }
    }

    // 4. Map DB Rows to BlockData Model (preserves data gaps cleanly if indicatorMap is empty)
    const mappedBlocks: BlockData[] = (units as AdministrativeUnitRow[]).map(unit => {
      const indicator = indicatorMap.get(unit.unit_id) || null;
      return mapDbRowToBlockData(unit, indicator);
    });

    const sortedMappedBlocks = sortBlocksHierarchy(mappedBlocks);
    const hasSimulatedRows = sortedMappedBlocks.some(b => b.assessment.dataStatus === 'simulated');
    const operationallyValidated = false;

    return {
      blocks: sortedMappedBlocks,
      source: 'live_database',
      isDemonstrationData: hasSimulatedRows || !operationallyValidated,
      totalCount: sortedMappedBlocks.length,
      fetchedAt
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during geospatial data fetch';
    if (isExplicitDemo) {
      return demo(`Geospatial service exception: ${message}. Using demonstration fixtures.`);
    }
    return emptyResult(`Geospatial service exception: ${message}.`);
  }
}

