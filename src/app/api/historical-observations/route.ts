import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 100;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

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

  try {
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
    if (error) return NextResponse.json({ error: 'Historical observations unavailable' }, { status: 503 });
    return NextResponse.json({ source: 'historical_database', observations: data ?? [], totalCount: count ?? 0, limit, offset });
  } catch {
    return NextResponse.json({ error: 'Historical observations unavailable' }, { status: 503 });
  }
}
