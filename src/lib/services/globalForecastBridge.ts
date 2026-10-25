/** Server-only client for the authenticated private Python model boundary. */
import { hasCurrentForecastWindow, computeObservationAge, type ObservationAgeInfo } from '../data/forecastIntegrity.ts';

export interface TrustedModelObservation {
  stationId: string;
  observationDate: string;
  depthMbgl: number;
  units: 'm bgl';
}

export interface GlobalModelRequest {
  contractVersion: 'global-forecast/v1';
  trustedObservationSource: 'internal_verified_block_observations';
  geography: { state: string; district: string; block: string; blockId: string };
  observations: TrustedModelObservation[];
}

const TIMEOUT_MS = 12_000;
export const MAX_TRUSTED_OBSERVATION_AGE_DAYS = 400;

/**
 * Computes the age metadata for the latest observation in a set.
 * Does NOT block forecast generation — callers decide eligibility
 * based on the returned freshness status.
 */
export function getObservationAgeInfo(observations: TrustedModelObservation[], now = new Date()): ObservationAgeInfo {
  if (!Array.isArray(observations) || observations.length < 2) {
    return computeObservationAge(null, now);
  }
  const dates = observations.map((item) => item.observationDate).sort();
  return computeObservationAge(dates.at(-1), now);
}

/** The block forecast contract retains the 400-day trusted-origin gate. */
export function hasFreshTrustedObservationOrigin(observations: TrustedModelObservation[], now = new Date()): boolean {
  const info = getObservationAgeInfo(observations, now);
  return info.observationAgeDays !== null
    && info.observationAgeDays >= 0
    && info.observationAgeDays <= MAX_TRUSTED_OBSERVATION_AGE_DAYS;
}

export type ModelInvocationFailure =
  | 'service_not_configured' | 'token_missing' | 'timeout' | 'network_error'
  | 'unauthorized' | 'invalid_request' | 'service_error' | 'invalid_body';

export interface ModelInvocationResult {
  body: Record<string, unknown> | null;
  failure: ModelInvocationFailure | null;
  latencyMs: number;
}

/**
 * Resolves the private model endpoint.
 * 1. JALDRISHTI_MODEL_SERVICE_URL with an explicit path is used verbatim
 *    (e.g. https://host/api/py_forecast); a bare origin keeps the legacy
 *    container route `/v1/forecast`.
 * 2. Otherwise, on Vercel, the same deployment's Python Function is addressed
 *    over HTTPS at `https://$VERCEL_URL/api/py_forecast` (Functions are separately
 *    invoked; there is no localhost/shared process).
 */
export function resolveModelServiceUrl(env: Record<string, string | undefined> = process.env): string | null {
  const configured = env.JALDRISHTI_MODEL_SERVICE_URL?.trim();
  if (configured) {
    if (!/^https?:\/\//.test(configured)) return null;
    try {
      const parsed = new URL(configured);
      return parsed.pathname === '/' ? `${parsed.origin}/v1/forecast` : configured;
    } catch {
      return null;
    }
  }
  const host = (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) || env.VERCEL_URL?.trim();
  return env.VERCEL && host ? `https://${host}/api/py_forecast` : null;
}

export async function invokeGlobalForecast(
  input: GlobalModelRequest,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<ModelInvocationResult> {
  const started = Date.now();
  const done = (body: Record<string, unknown> | null, failure: ModelInvocationFailure | null): ModelInvocationResult =>
    ({ body, failure, latencyMs: Date.now() - started });
  const url = resolveModelServiceUrl(env);
  if (!url) return done(null, 'service_not_configured');
  const token = env.JALDRISHTI_MODEL_SERVICE_TOKEN;
  if (!token) return done(null, 'token_missing');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  // Optional: lets the server-side call pass Vercel Deployment Protection.
  if (env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  try {
    const response = await fetchImpl(url, {
      method: 'POST', cache: 'no-store', headers,
      body: JSON.stringify(input), signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) return done(null, 'unauthorized');
    if (response.status >= 400 && response.status < 500) return done(null, 'invalid_request');
    if (!response.ok) return done(null, 'service_error');
    const body: unknown = await response.json();
    return body && typeof body === 'object' ? done(body as Record<string, unknown>, null) : done(null, 'invalid_body');
  } catch (error) {
    const name = (error as { name?: string })?.name;
    return done(null, name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network_error');
  }
}

export async function requestGlobalForecast(input: GlobalModelRequest): Promise<Record<string, unknown> | null> {
  return (await invokeGlobalForecast(input)).body;
}

function isDateOnly(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Treat the private service response as untrusted at this boundary.  A 200 is
 * never sufficient: its complete research-only forecast contract must match
 * the request geography and use ordered, finite quantiles.
 *
 * Freshness: the approved 400-day trusted-origin gate remains mandatory,
 * in addition to structural forecast-window checks.
 */
export function isValidGlobalForecastResponse(
  response: Record<string, unknown>,
  expectedGeography: GlobalModelRequest['geography'],
): boolean {
  const geography = response.geography as Record<string, unknown> | undefined;
  const forecast = response.forecast as Record<string, unknown> | undefined;
  const forecastPoints = forecast?.forecasts;
  if (!Array.isArray(forecastPoints) || forecastPoints.length < 1 || forecastPoints.length > 4) return false;
  const origin = response.originObservationDate;
  if (!isDateOnly(origin)) return false;
  const expectedOrigin = Date.parse(`${origin}T00:00:00Z`);
  const pointsAreValid = forecastPoints.every((point, index) => {
    if (!point || typeof point !== 'object') return false;
    const entry = point as Record<string, unknown>;
    const interval = entry.uncertaintyInterval as Record<string, unknown> | undefined;
    const expected = entry.expectedDepthMbgl;
    const p10 = interval?.lowerBoundP10Mbgl;
    const p90 = interval?.upperBoundP90Mbgl;
    const targetDate = entry.targetDate;
    return entry.horizonQuarter === index + 1
      && entry.forecastHorizonMonths === (index + 1) * 3
      && entry.units === 'm bgl'
      && isDateOnly(targetDate)
      && Date.parse(`${targetDate}T00:00:00Z`) > expectedOrigin
      && isFiniteNumber(expected) && isFiniteNumber(p10) && isFiniteNumber(p90)
      && p10 <= expected && expected <= p90
      && interval?.isIntervalCalibrated === false
      && interval?.intervalStatus === 'ordered_uncalibrated';
  });

  // Structural forecast-window validity: verifies target dates are chronologically after origin
  const structurallyValid = hasCurrentForecastWindow({
    latestObservationDate: origin,
    forecasts: forecastPoints.map((point) => ({ targetDate: (point as Record<string, unknown>).targetDate as string })),
  });

  return structurallyValid
    && response.status === 'research_prototype'
    && response.modelIdentifier === 'GlobalBlockAwareQuantileGB-v1'
    && response.modelVersion === '1.0.0'
    && response.units === 'm bgl'
    && response.intervalStatus === 'ordered_uncalibrated'
    && response.operationalEligibility === false
    && geography?.state === expectedGeography.state
    && geography?.district === expectedGeography.district
    && geography?.block === expectedGeography.block
    && geography?.blockId === expectedGeography.blockId
    && pointsAreValid;
}
