import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSourceResourceConsistent, mayPublishLocalHistoricalFallback, selectHistoricalObservationSource } from '@/lib/services/historicalObservationSource';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 100;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function localArchivePayload(trusted: Awaited<ReturnType<typeof import('@/lib/services/trustedObservationProvider').getTrustedBlockObservations>>, from: string | null, to: string | null, limit: number, offset: number) {
  let obs = trusted.observations;
  if (from) obs = obs.filter((o) => o.observationDate >= from);
  if (to) obs = obs.filter((o) => o.observationDate <= to);
  const totalCount = obs.length;
  const sorted = [...obs].sort((a, b) => b.observationDate.localeCompare(a.observationDate));
  const paginated = sorted.slice(offset, offset + limit);
  const provenance = {
    sourceOrganization: trusted.provenance.sourceOrganization,
    sourceFiles: trusted.provenance.sourcePaths,
    stationId: trusted.stationId,
    measurementType: trusted.provenance.measurementType,
    transformation: trusted.provenance.measurementType === 'telemetry_six_hourly_aggregated_daily' ? 'daily_median_of_six_hourly_readings' : 'source_observation_or_daily_deduplication',
    mappingVerified: trusted.provenance.isVerifiedMapping,
    mappingEvidence: trusted.provenance.mappingEvidence,
  };
  return {
    source: 'local_processed_observation_archive',
    provenance,
    observations: paginated.map((o) => ({
      station_id: o.stationId || trusted.stationId || 'unresolved-station',
      station_name: trusted.stationName || `${trusted.geography.block} Station`,
      district_id: trusted.geography.district,
      district_name: trusted.geography.district,
      block_id: trusted.blockId,
      block_name: trusted.geography.block,
      observation_date: o.observationDate,
      water_level_mbgl: o.depthMbgl,
      unit: 'metre below ground level',
      quality_flag: trusted.provenance.isVerifiedMapping ? 'accepted_local_processed' : 'mapping_unverified',
      source_name: trusted.provenance.sourceOrganization,
      source_provider: trusted.provenance.sourceOrganization,
      source_resource_url: 'https://nwdp.nwic.gov.in',
    })),
    totalCount, limit, offset,
  };
}

/**
 * Read-only published historical-observation contract.
 * The view is intentionally not created by this route; deployment is blocked
 * until the schema, publication fields, and RLS policy are approved.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get('limit') ?? '50'), 1), MAX_LIMIT);
  const offset = Math.max(Number(params.get('offset') ?? '0'), 0);
  if (!Number.isInteger(limit) || !Number.isInteger(offset)) {
    return NextResponse.json({ error: 'limit and offset must be integers' }, { status: 400 });
  }

  const district = params.get('district');
  const block = params.get('block');
  const station = params.get('station');
  const from = params.get('from');
  const to = params.get('to');
  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) {
    return NextResponse.json({ error: 'from and to must use YYYY-MM-DD' }, { status: 400 });
  }

  const BLOCK_SLUG_TO_UNIT_ID: Record<string, string> = {
    'blk_bijawar': '3783',
    'blk_rajnagar': '3788',
    'blk_baldeogarh': '4027',
    'blk_jatara': '4028',
    'blk_palera': '4030',
    'blk_tikamgarh_main': '4032',
    '3783': '3783',
    '3788': '3788',
    '4027': '4027',
    '4028': '4028',
    '4030': '4030',
    '4032': '4032'
  };

  const resolvedBlockId = block ? (BLOCK_SLUG_TO_UNIT_ID[block] || block) : null;

  const decision = await selectHistoricalObservationSource({
    queryDatabase: async () => {
      const supabase = await createClient();
      let query = supabase
        .from('v_published_historical_observations')
        .select('station_id,station_name,district_id,district_name,block_id,block_name,observation_date,water_level_mbgl,unit,quality_flag,source_name,source_provider,source_resource_url', { count: 'exact' })
        .eq('publication_status', 'published')
        .eq('data_status', 'observed')
        .order('observation_date', { ascending: false })
        .range(offset, offset + limit - 1);
      if (district) query = query.eq('district_id', district);
      if (resolvedBlockId) query = query.eq('block_id', resolvedBlockId);
      if (station) query = query.eq('station_id', station);
      if (from) query = query.gte('observation_date', from);
      if (to) query = query.lte('observation_date', to);
      const { data, error, count } = await query;
      return { data, error, count };
    },
    loadLocal: block ? async () => {
      const { getTrustedBlockObservations } = await import('@/lib/services/trustedObservationProvider');
      const trusted = await getTrustedBlockObservations(block);
      if (!mayPublishLocalHistoricalFallback({
        readinessStatus: trusted.availabilityStatus,
        mappingVerified: trusted.provenance.isVerifiedMapping,
        observationCount: trusted.observations.length,
      })) {
        return { status: 'unverified' as const };
      }
      if (trusted.observations.length === 0) return { status: 'empty' as const };
      return { status: 'observations' as const, value: localArchivePayload(trusted, from, to, limit, offset) };
    } : undefined,
  });

  if (decision.source === 'unavailable') {
    return NextResponse.json({ error: 'Historical observations unavailable', source: decision.source, databaseStatus: decision.databaseStatus, fallbackStatus: decision.fallbackStatus }, { status: decision.status });
  }
  if (decision.source === 'historical_database'
      && decision.observations.some((row) => !isSourceResourceConsistent(row as Record<string, unknown>))) {
    return NextResponse.json({
      error: 'Historical observations withheld because source labels and resource URLs conflict',
      reason: 'source_provenance_conflict',
      source: decision.source,
      operationalEligibility: false,
    }, { status: 503 });
  }
  if (decision.source === 'local_processed_observation_archive') {
    return NextResponse.json({ ...decision.value, databaseStatus: decision.databaseStatus });
  }
  return NextResponse.json({ source: decision.source, observations: decision.observations, totalCount: decision.totalCount, limit, offset, fallbackStatus: decision.fallbackStatus });
}
