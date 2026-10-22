/**
 * Sanitizes bundled offline forecasts without inventing replacement values.
 * A record is unavailable if its last observation is older than 400 days or
 * every target date has elapsed. It preserves the old date as audit metadata.
 */
import fs from 'node:fs';

const path = 'src/lib/data/contrastProjections.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const now = new Date();
const maxAgeMs = 400 * 86_400_000;
let sanitized = 0;

for (const entry of Object.values(data)) {
  const origin = entry.latestObservationDate ? new Date(`${entry.latestObservationDate}T00:00:00Z`) : null;
  const targets = Array.isArray(entry.forecasts) ? entry.forecasts.map((f) => new Date(`${f.targetDate}T00:00:00Z`)) : [];
  const staleOrigin = !origin || Number.isNaN(origin.getTime()) || now - origin > maxAgeMs;
  const staleTargets = !targets.length || targets.every((target) => Number.isNaN(target.getTime()) || target <= now);
  if (staleOrigin || staleTargets) {
    entry.modelIdentifier = 'none';
    entry.modelVersion = 'none';
    entry.modelStatus = 'unavailable';
    entry.provenanceStatus = 'stale_observation';
    entry.horizonStatus = 'stale_origin';
    entry.operationalEligibility = false;
    entry.forecasts = [];
    entry.isDemonstrationData = false;
    entry.scientificAuditNotice = 'Offline forecast withheld because its observation origin and forecast targets are stale. No replacement prediction was generated.';
    entry.safeguardDisclaimer = 'Forecast unavailable: the bundled offline artifact is stale or lacks a current source observation. Refresh traceable observations and rerun the reviewed inference pipeline; no extrapolated replacement is shown.';
    sanitized += 1;
  }
}

fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Sanitized ${sanitized} stale offline projection records.`);
