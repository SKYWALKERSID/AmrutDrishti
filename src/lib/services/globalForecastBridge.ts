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

const TIMEOUT_MS = 4_000;
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

export async function requestGlobalForecast(input: GlobalModelRequest): Promise<Record<string, unknown> | null> {
  const baseUrl = process.env.JALDRISHTI_MODEL_SERVICE_URL;
  const token = process.env.JALDRISHTI_MODEL_SERVICE_TOKEN;
  if (!baseUrl || !token || !baseUrl.startsWith('http')) return null;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/forecast`, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input), signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
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
  options?: {
    allowHistoricalDemo?: boolean;
  },
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

  const withinFreshnessGate = options?.allowHistoricalDemo || hasFreshTrustedObservationOrigin([
    { stationId: 'origin-check', observationDate: origin, depthMbgl: 0, units: 'm bgl' },
    { stationId: 'origin-check', observationDate: origin, depthMbgl: 0, units: 'm bgl' },
  ]);
  const structurallyValid = withinFreshnessGate && hasCurrentForecastWindow({
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
