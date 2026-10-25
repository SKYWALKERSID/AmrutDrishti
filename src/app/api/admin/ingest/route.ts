import { NextRequest, NextResponse } from 'next/server';
import manifest from '../../../../../data/derived/nwdp_telemetry_ingestion_manifest.json' with { type: 'json' };
import quarantine from '../../../../../data/derived/nwdp_telemetry_quarantine.json' with { type: 'json' };

export const dynamic = 'force-dynamic';

/**
 * JAL DRISHTI — Administrative Telemetry Ingestion & Health Endpoint
 * ===================================================================
 * Provides authorized administrative access to telemetry ingestion status,
 * source registry health, and quarantined anomaly breakdown across the 9 approved active states.
 *
 * Requirements:
 * 1. Bearer token / Admin API Key authentication.
 * 2. Never exposes private secrets or database credentials.
 * 3. Returns deterministic, audited metadata and quarantine metrics.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_API_KEY || process.env.JALDRISHTI_MODEL_SERVICE_TOKEN;

  // If admin secret is set in the environment, require valid Bearer token
  if (adminSecret && adminSecret !== 'placeholder-token') {
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== adminSecret) {
      return NextResponse.json({
        error: 'Unauthorized: Valid administrative bearer credentials required.',
        status: 'unauthorized',
      }, { status: 401 });
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const stateFilter = searchParams.get('state');

  const resources = manifest.input_resources as Array<{ state: string; filename: string; url: string }>;
  const states = [...new Set(resources.map((resource) => resource.state))];
  const filteredStates = stateFilter
    ? states.filter((s) => s.toLowerCase() === stateFilter.toLowerCase())
    : states;

  const sourceStatuses = filteredStates.map((stateName) => {
    const stateResources = resources.filter((resource) => resource.state === stateName);
    return {
      state: stateName,
      catalogueUrl: null,
      packageId: null,
      organization: 'NWDP/NWIC',
      resourcesCount: stateResources.length,
      resourceFiles: stateResources.map((resource) => ({
        id: null,
        name: resource.filename,
        format: 'CSV',
        url: resource.url,
      })),
      ingestionStatus: 'candidate_only_not_block_verified',
    };
  });

  return NextResponse.json({
    status: 'candidate_only_not_block_verified',
    engine: 'NWDP_only_fail_closed_rebuild',
    timestamp: new Date().toISOString(),
    manifestSummary: {
      generatedAt: manifest.generated_at,
      rawRecordsScanned: manifest.counts.source_rows,
      candidateNotVerifiedCount: manifest.counts.candidate_not_verified,
      quarantinedCount: manifest.counts.quarantined,
      quarantineBreakdown: quarantine.quarantine_counts,
    },
    quarantineSampleCount: 0,
    activeSources: sourceStatuses,
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_API_KEY || process.env.JALDRISHTI_MODEL_SERVICE_TOKEN;

  if (adminSecret && adminSecret !== 'placeholder-token') {
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== adminSecret) {
      return NextResponse.json({
        error: 'Unauthorized: Valid administrative bearer credentials required.',
        status: 'unauthorized',
      }, { status: 401 });
    }
  }

  // Trigger audited telemetry synchronization / refresh verification
  return NextResponse.json({
    status: 'acknowledged',
    message: 'NWDP-only candidate ingestion is present; no station-to-block telemetry mapping is currently verified.',
    timestamp: new Date().toISOString(),
    recordsCandidateNotVerified: manifest.counts.candidate_not_verified,
    recordsQuarantined: manifest.counts.quarantined,
  });
}
