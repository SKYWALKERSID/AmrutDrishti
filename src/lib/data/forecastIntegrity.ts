export interface OfflineForecastLike {
  latestObservationDate?: string | null;
  forecasts?: Array<{ targetDate?: string | null }>;
}

/**
 * Age-aware observation freshness classification.
 *
 * Observation age is informational metadata, not an unconditional hard blocker.
 * Older verified CGWB quarterly observations remain eligible for historical
 * analysis, model training, and research forecasts. Only current-origin
 * operational decisions require recent observations.
 *
 * Thresholds:
 *   fresh:       <= 180 days  — suitable for operational decision support
 *   recent:      <= 540 days  — suitable for research forecasts with stale notice
 *   historical:  > 540 days   — suitable for training, trends, and historical-origin forecasts
 *   unknown:     missing or invalid date
 */
export type DataFreshnessStatus = 'fresh' | 'recent' | 'historical' | 'unknown';

export const FRESH_THRESHOLD_DAYS = 180;
export const RECENT_THRESHOLD_DAYS = 540;

export interface ObservationAgeInfo {
  latestObservationDate: string | null;
  observationAgeDays: number | null;
  freshnessStatus: DataFreshnessStatus;
  isOperationallyFresh: boolean;
  isResearchEligible: boolean;
}

/**
 * Computes observation age and freshness classification.
 * Does NOT block forecast generation — callers decide eligibility.
 */
export function computeObservationAge(
  latestObservationDate: string | null | undefined,
  now = new Date(),
): ObservationAgeInfo {
  if (!latestObservationDate) {
    return {
      latestObservationDate: null,
      observationAgeDays: null,
      freshnessStatus: 'unknown',
      isOperationallyFresh: false,
      isResearchEligible: false,
    };
  }
  const origin = new Date(`${latestObservationDate}T00:00:00Z`);
  if (Number.isNaN(origin.getTime())) {
    return {
      latestObservationDate,
      observationAgeDays: null,
      freshnessStatus: 'unknown',
      isOperationallyFresh: false,
      isResearchEligible: false,
    };
  }

  const ageDays = Math.round((now.getTime() - origin.getTime()) / 86_400_000);

  // Future-dated observations are invalid
  if (ageDays < 0) {
    return {
      latestObservationDate,
      observationAgeDays: ageDays,
      freshnessStatus: 'unknown',
      isOperationallyFresh: false,
      isResearchEligible: false,
    };
  }

  let freshnessStatus: DataFreshnessStatus;
  if (ageDays <= FRESH_THRESHOLD_DAYS) {
    freshnessStatus = 'fresh';
  } else if (ageDays <= RECENT_THRESHOLD_DAYS) {
    freshnessStatus = 'recent';
  } else {
    freshnessStatus = 'historical';
  }

  return {
    latestObservationDate,
    observationAgeDays: ageDays,
    freshnessStatus,
    isOperationallyFresh: ageDays <= FRESH_THRESHOLD_DAYS,
    isResearchEligible: ageDays >= 0, // Any valid-dated observation is research-eligible
  };
}

/**
 * @deprecated Use computeObservationAge() instead. Retained for backward compatibility
 * during transition. Now returns true for any valid-dated observation.
 */
export function hasFreshObservationOrigin(
  latestObservationDate: string | null | undefined,
  now = new Date(),
): boolean {
  const info = computeObservationAge(latestObservationDate, now);
  return info.isResearchEligible;
}

/**
 * Determines whether an offline forecast artifact has a valid forecast window.
 * Under the new age-aware model, this checks structural validity (target dates
 * are after the origin) but does NOT require the origin to be within 400 days.
 */
export function hasCurrentForecastWindow(
  projection: OfflineForecastLike,
  now = new Date(),
): boolean {
  if (!projection.latestObservationDate || !projection.forecasts?.length) return false;
  const origin = new Date(`${projection.latestObservationDate}T00:00:00Z`);
  if (Number.isNaN(origin.getTime())) return false;
  // Verify each forecast target is after the observation origin
  return projection.forecasts.every((forecast) => {
    if (!forecast.targetDate) return false;
    const target = new Date(`${forecast.targetDate}T00:00:00Z`);
    return !Number.isNaN(target.getTime()) && target.getTime() > origin.getTime();
  });
}
