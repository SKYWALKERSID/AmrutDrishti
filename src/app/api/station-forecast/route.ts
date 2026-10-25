import { NextRequest, NextResponse } from 'next/server';
import { isValidExperimentalStationForecast, isValidExperimentalStationList } from '@/lib/services/nwdpStationForecastContract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The 35 MB station artifact is loaded on first service use; allow a cold start.
const TIMEOUT_MS = 15_000;
const STATION_ID_PATTERN = /^[^\u0000-\u001f]{1,256}::[^\u0000-\u001f]{1,256}::[^\u0000-\u001f]{1,256}$/;
const ACTIVE_STATES = new Set([
  'Madhya Pradesh', 'Rajasthan', 'Punjab', 'Haryana', 'Karnataka',
  'Telangana', 'Tamil Nadu', 'Meghalaya', 'Tripura',
]);

function serviceConfig() {
  const customUrl = process.env.JALDRISHTI_MODEL_SERVICE_URL?.trim();
  const token = process.env.JALDRISHTI_MODEL_SERVICE_TOKEN?.trim();
  if (!token) return null;

  if (customUrl && /^https?:\/\//.test(customUrl)) {
    return {
      baseUrl: customUrl.replace(/\/$/, ''),
      token,
      isVercelDirect: false,
    };
  }

  // On Vercel, route internally to the station_forecast serverless function
  const host = (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim())
    || process.env.VERCEL_URL?.trim();

  if (host) {
    return {
      baseUrl: `https://${host}/api/station_forecast`,
      token,
      isVercelDirect: true,
    };
  }

  return null;
}

function unavailable(reason: string, status = 503) {
  return NextResponse.json({
    status: 'unavailable', reason, operationalEligibility: false,
    intervalStatus: 'ordered_uncalibrated',
    measurementStatus: 'experimental_source_reported_variable_unverified_depth',
  }, { status });
}

export async function GET(request: NextRequest) {
  const config = serviceConfig();
  if (!config) return unavailable('experimental_station_model_service_not_configured');
  const stationId = request.nextUrl.searchParams.get('stationId');
  const isListRequest = request.nextUrl.searchParams.get('stations') === 'true';
  if (isListRequest) {
    try {
      const listUrl = config.isVercelDirect
        ? `${config.baseUrl}?stations=true`
        : `${config.baseUrl}/v1/station-forecast/stations`;

      const response = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${config.token}` },
        cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return unavailable('experimental_station_list_unavailable');
      const body: unknown = await response.json();
      if (!isValidExperimentalStationList(body)) return unavailable('invalid_experimental_station_list');
      const stations = body.stations.filter((station) => ACTIVE_STATES.has(station.state)
        && station.stationId.startsWith(`${station.state}::`));
      return NextResponse.json({ ...body, stations, count: stations.length });
    } catch {
      return unavailable('experimental_station_model_service_unavailable');
    }
  }
  if (!stationId || !STATION_ID_PATTERN.test(stationId)) {
    return NextResponse.json({ status: 'unavailable', reason: 'valid_station_id_required', operationalEligibility: false }, { status: 400 });
  }
  const state = stationId.split('::', 1)[0];
  if (!ACTIVE_STATES.has(state)) return NextResponse.json({ status: 'unavailable', reason: 'station_outside_active_scope', operationalEligibility: false }, { status: 404 });
  const horizonParam = request.nextUrl.searchParams.get('horizonDays');
  const horizonDays = horizonParam === '180' ? 180 : 90;
  try {
    const postUrl = config.isVercelDirect
      ? config.baseUrl
      : `${config.baseUrl}/v1/station-forecast`;

    const response = await fetch(postUrl, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ stationId, horizonDays }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return unavailable(response.status === 404 ? 'station_not_trained' : 'experimental_station_inference_unavailable', response.status === 404 ? 404 : 503);
    const body: unknown = await response.json();
    if (!isValidExperimentalStationForecast(body, stationId)) return unavailable('invalid_experimental_station_forecast');
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return unavailable('experimental_station_model_service_unavailable');
  }
}
