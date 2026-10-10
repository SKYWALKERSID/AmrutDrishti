import { NextResponse } from 'next/server';
import { fetchBlocksGeospatialData } from '@/lib/services/geospatialService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await fetchBlocksGeospatialData();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch geospatial data';
    return NextResponse.json(
      {
        blocks: [],
        source: 'fallback_empty',
        isDemonstrationData: true,
        totalCount: 0,
        fetchedAt: new Date().toISOString(),
        errorMessage: message,
      },
      { status: 500 }
    );
  }
}
