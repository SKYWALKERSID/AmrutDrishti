/**
 * Recharts colour palette for monitoring visualisations.
 *
 * Every value is a CSS custom property defined once in src/app/globals.css (:root).
 * Recharts writes these strings into SVG presentation attributes (stroke, fill) and
 * inline styles, where var(--token) is resolved by the browser. Do NOT add hex values here.
 *
 * Interface decoration (grid, axes, tooltip, reference line) uses neutral tokens.
 * Series colours encode different scientific variables and must stay distinct:
 *   wellDepth          observed well depth (m bgl)
 *   satelliteTwsa      GRACE/GRACE-FO regional TWSA (cm) - coarse satellite product
 *   forecastProjection ML projection and its P10/P90 bounds (modelled, not observed)
 *   rainfallObserved   observed monsoon rainfall (mm)
 *   rainfallBaseline   30-year LPA normal (mm)
 */
export const CHART_COLORS = {
  grid: 'var(--border-main)',
  axisText: 'var(--text-muted)',
  referenceLine: 'var(--text-subtle)',
  tooltipBg: 'var(--bg-surface)',
  tooltipBorder: 'var(--border-main)',
  wellDepth: 'var(--data-observed-well)',
  satelliteTwsa: 'var(--data-satellite-twsa)',
  forecastProjection: 'var(--data-forecast-projection)',
  rainfallObserved: 'var(--data-rainfall-precip)',
  rainfallBaseline: 'var(--data-rainfall-baseline)',
  deviationDeficit: 'var(--status-error)',
  deviationSurplus: 'var(--status-success)',
} as const;

/** Rainfall deviation from LPA: negative = deficit (error colour); zero/positive = surplus (success colour). */
export function deviationColor(deviationMm: number): string {
  return deviationMm < 0 ? CHART_COLORS.deviationDeficit : CHART_COLORS.deviationSurplus;
}
