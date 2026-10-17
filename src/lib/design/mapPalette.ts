/**
 * Leaflet map colour palette (RESOLVED values - rendering-library constraint).
 *
 * Leaflet writes `color` / `fillColor` into SVG attributes (or canvas draw calls) from a
 * plain string at layer-creation time. A CSS custom property cannot be relied on there
 * (canvas renderers cannot resolve var(); SVG attributes would not update on a theme change),
 * so resolved hex strings are centralised here instead of being scattered in LeafletMap.tsx.
 *
 * Each value MUST equal the named token in src/app/globals.css (:root).
 * tests/designTokens.test.ts fails if they drift apart.
 *
 * Meaning (do not merge categories):
 *   severe / watch / normal  semantic status (risk severity, GRACE, rainfall, well thresholds)
 *   gap                      missing data, drawn grey rather than imputed
 *   rainfallNormal           quantitative layer: rainfall not in large deficit
 *   outlineSelected          selection outline / Sentinel layer fill
 *   outlineDefault           centre-marker outline
 */
export const MAP_COLORS = {
  severe: '#dc3545', // --status-error
  watch: '#ffc107', // --status-warning
  normal: '#198754', // --status-success
  gap: '#606060', // --status-gap
  rainfallNormal: '#0284c7', // --data-rainfall-precip
  outlineSelected: '#0f5757', // --primary-main
  outlineDefault: '#ffffff', // --bg-surface
} as const;

/** Token each resolved map colour mirrors; used by the drift-guard test. */
export const MAP_COLOR_TOKENS = {
  severe: '--status-error',
  watch: '--status-warning',
  normal: '--status-success',
  gap: '--status-gap',
  rainfallNormal: '--data-rainfall-precip',
  outlineSelected: '--primary-main',
  outlineDefault: '--bg-surface',
} as const;
