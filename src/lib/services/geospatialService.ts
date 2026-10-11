import { createBrowserClient } from '@supabase/ssr';
import type { BlockData } from '../types.ts';
import type { AdministrativeUnitRow, DerivedIndicatorRow } from '../types/database.ts';
import { mapDbRowToBlockData } from '../mappers/blockMapper.ts';
import { ALL_BLOCKS } from '../data/bundelkhand.ts';

export interface GeospatialQueryResult {
  blocks: BlockData[];
  /**
   * Origin of the data:
   *   'live_database'        — rows fetched from configured Supabase instance.
   *   'demonstration_fixture' — local fixture data (no DB configured or DB error).
   *   'fallback_empty'        — DB reachable but returned no usable results.
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

  // 1. Check Environment Variables
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    return {
      blocks: ALL_BLOCKS,
      source: 'demonstration_fixture',
      isDemonstrationData: true,
      totalCount: ALL_BLOCKS.length,
      fetchedAt,
      errorMessage: 'Supabase environment variables unconfigured. Serving demonstration fixtures with explicit safeguard disclaimers.'
    };
  }

  try {
    // Dynamic context check: Try loading server client when running inside Next.js server runtime,
    // otherwise fallback to createBrowserClient.
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
      return {
        blocks: ALL_BLOCKS,
        source: 'demonstration_fixture',
        isDemonstrationData: true,
        totalCount: ALL_BLOCKS.length,
        fetchedAt,
        errorMessage: `Database query error (administrative_units): ${unitsError.message}. Serving fallback demonstration fixtures.`
      };
    }

    if (!units || units.length === 0) {
      return {
        blocks: ALL_BLOCKS,
        source: 'demonstration_fixture',
        isDemonstrationData: true,
        totalCount: ALL_BLOCKS.length,
        fetchedAt,
        errorMessage: 'No administrative units returned from database. Serving fallback demonstration fixtures.'
      };
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
    if (indicators) {
      for (const ind of indicators as DerivedIndicatorRow[]) {
        if (!indicatorMap.has(ind.unit_id)) {
          indicatorMap.set(ind.unit_id, ind);
        }
      }
    }

    // 4. Map DB Rows to BlockData Model
    const mappedBlocks: BlockData[] = (units as AdministrativeUnitRow[]).map(unit => {
      const indicator = indicatorMap.get(unit.unit_id) || null;
      return mapDbRowToBlockData(unit, indicator);
    });

    // Separate three orthogonal concepts:
    //   hasSimulatedRows  — at least one DB row carries data_status='simulated'.
    //   operationallyValidated — independent field verification has been confirmed for
    //                            this dataset. Currently false: no validation process
    //                            has been completed. Set true only with explicit evidence.
    //   isDemonstrationData — true if EITHER condition holds. A live-DB source can still
    //                         contain demonstration-quality data; callers must not assume
    //                         source='live_database' implies validated observations.
    const hasSimulatedRows = mappedBlocks.some(b => b.assessment.dataStatus === 'simulated');
    // operationallyValidated: change to true only when field-verified data is confirmed
    // by an independent authority and the relevant Phase C acceptance criteria are met.
    const operationallyValidated = false;

    return {
      blocks: mappedBlocks,
      source: 'live_database',
      isDemonstrationData: hasSimulatedRows || !operationallyValidated,
      totalCount: mappedBlocks.length,
      fetchedAt
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during geospatial data fetch';
    return {
      blocks: ALL_BLOCKS,
      source: 'demonstration_fixture',
      isDemonstrationData: true,
      totalCount: ALL_BLOCKS.length,
      fetchedAt,
      errorMessage: `Geospatial service exception: ${message}. Serving fallback demonstration fixtures.`
    };
  }
}
