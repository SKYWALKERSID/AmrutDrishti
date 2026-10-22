export interface OfflineForecastLike {
  latestObservationDate?: string | null;
  forecasts?: Array<{ targetDate?: string | null }>;
}

const MAX_ORIGIN_AGE_DAYS = 400;

/**
 * Offline artifacts are safe to display only when their observations are
 * recent and every prediction target is still in the future. This is a
 * freshness gate, not a claim of forecast calibration.
 */
export function hasCurrentForecastWindow(
  projection: OfflineForecastLike,
  now = new Date(),
): boolean {
  if (!projection.latestObservationDate || !projection.forecasts?.length) return false;
  const origin = new Date(`${projection.latestObservationDate}T00:00:00Z`);
  if (Number.isNaN(origin.getTime())) return false;
  const ageDays = (now.getTime() - origin.getTime()) / 86_400_000;
  if (ageDays < 0 || ageDays > MAX_ORIGIN_AGE_DAYS) return false;
  return projection.forecasts.every((forecast) => {
    if (!forecast.targetDate) return false;
    const target = new Date(`${forecast.targetDate}T00:00:00Z`);
    return !Number.isNaN(target.getTime()) && target.getTime() > now.getTime();
  });
}
