export interface HistoricalObservation {
  station_id: string;
  station_name: string;
  district_id: string;
  district_name: string;
  block_id: string | null;
  block_name: string | null;
  observation_date: string;
  water_level_mbgl: number | null;
  unit: string;
  quality_flag: string | null;
  source_name: string;
  source_provider: string;
  source_resource_url: string;
}

export interface HistoricalObservationQuery {
  limit?: number;
  offset?: number;
  district?: string;
  block?: string;
  station?: string;
  from?: string;
  to?: string;
}

export interface HistoricalObservationResponse {
  source: 'historical_database';
  observations: HistoricalObservation[];
  totalCount: number;
  limit: number;
  offset: number;
}

export async function fetchHistoricalObservations(
  query: HistoricalObservationQuery = {},
  fetcher: typeof fetch = fetch
): Promise<HistoricalObservationResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const response = await fetcher(`/api/historical-observations?${params.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Historical observations unavailable');
  }
  if (body.source !== 'historical_database' || !Array.isArray(body.observations)) {
    throw new Error('Unexpected historical observations response');
  }
  return body as HistoricalObservationResponse;
}
