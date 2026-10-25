export type LocalFallbackResult<Local> =
  | { status: 'observations'; value: Local }
  | { status: 'empty' | 'unverified' | 'unavailable' };

export type HistoricalSourceDecision<Row, Local> =
  | { source: 'historical_database'; observations: Row[]; totalCount: number; fallbackStatus: 'not_requested' | 'empty' | 'unverified' | 'unavailable' }
  | { source: 'local_processed_observation_archive'; value: Local; databaseStatus: 'empty' | 'error' }
  | { source: 'unavailable'; status: 503; databaseStatus: 'error'; fallbackStatus: 'not_requested' | 'empty' | 'unverified' | 'unavailable' };

export function mayPublishLocalHistoricalFallback(args: {
  readinessStatus: string;
  mappingVerified: boolean;
  observationCount: number;
}): boolean {
  return args.mappingVerified
    && args.observationCount > 0
    && (args.readinessStatus === 'available' || args.readinessStatus === 'eligible_for_research_prediction');
}

// Fail closed when a row's human source label contradicts its resource path.
export function isSourceResourceConsistent(row: {
  source_name?: unknown;
  source_provider?: unknown;
  source_resource_url?: unknown;
}): boolean {
  const label = `${String(row.source_name ?? '')} ${String(row.source_provider ?? '')}`.toLowerCase();
  const resource = String(row.source_resource_url ?? '').toLowerCase();
  if (!resource) return false;
  const saysTelemetry = /nwdp|nwic|telemetry|dwlr/.test(label);
  const saysManual = /manual|quarterly/.test(label);
  const resourceSaysManual = /manual|quarterly/.test(resource);
  const resourceSaysTelemetry = /telemetry|dwlr|gwl_tel/.test(resource);
  if (saysTelemetry && resourceSaysManual) return false;
  if (saysManual && resourceSaysTelemetry) return false;
  if (saysTelemetry && !/nwdp\.nwic\.gov\.in/.test(resource)) return false;
  return true;
}

/**
 * Selects published database results first, then an explicitly validated local
 * fallback. Query/loader exceptions are classified, never converted to success.
 */
export async function selectHistoricalObservationSource<Row, Local>(args: {
  queryDatabase: () => Promise<{ data: Row[] | null; count: number | null; error: unknown | null }>;
  loadLocal?: () => Promise<LocalFallbackResult<Local>>;
}): Promise<HistoricalSourceDecision<Row, Local>> {
  let data: Row[] | null = null;
  let count: number | null = null;
  let databaseFailed = false;
  try {
    const result = await args.queryDatabase();
    databaseFailed = Boolean(result.error);
    data = result.data;
    count = result.count;
  } catch {
    databaseFailed = true;
  }

  if (!databaseFailed && data && data.length > 0) {
    return { source: 'historical_database', observations: data, totalCount: count ?? data.length, fallbackStatus: 'not_requested' };
  }

  let fallback: LocalFallbackResult<Local> = { status: 'unavailable' };
  if (args.loadLocal) {
    try {
      fallback = await args.loadLocal();
    } catch {
      fallback = { status: 'unavailable' };
    }
  } else {
    fallback = { status: 'empty' };
  }

  if (fallback.status === 'observations') {
    return { source: 'local_processed_observation_archive', value: fallback.value, databaseStatus: databaseFailed ? 'error' : 'empty' };
  }
  if (databaseFailed) {
    return { source: 'unavailable', status: 503, databaseStatus: 'error', fallbackStatus: fallback.status };
  }
  return {
    source: 'historical_database',
    observations: [],
    totalCount: 0,
    fallbackStatus: fallback.status,
  };
}
