# 16-block integration correction report

## Outcome

The recent 16-block hydrograph/forecast addition was **not eligible to be presented as verified historical data or current ML output**. Each added hydrograph array lacked a source ID, station mapping, retrieval record, and reproducible generator. All bundled forecasts had stale 2023 origins and 2024 targets; five of their states have no packaged model artifact. The implementation now fails closed instead of showing those values as observations or forecasts.

No database, schema, migration, external data source, deployment, or production record was modified.

## Functional versus scientific status

| Block | Groundwater graph | Satellite / rainfall | ML inference | Forecast | Quantiles | Intervention | Provenance / limitation |
|---|---|---|---|---|---|---|---|
| Chhatarpur | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | Added series untraceable; MP artifact exists but traceable local series is absent |
| Shivamogga | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Karnataka packaged model |
| Bhadravati | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Karnataka packaged model |
| Davanagere | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Karnataka packaged model |
| Adilabad | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Telangana packaged model |
| Nandipet | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Telangana packaged model |
| Rajendranagar | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Telangana packaged model |
| Ottapidaram | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Tamil Nadu packaged model |
| St Thomas Mount | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Tamil Nadu packaged model |
| Periyanaickenpalayam | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Tamil Nadu packaged model |
| Thadlaskein | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Meghalaya packaged model |
| Umling | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Meghalaya packaged model |
| Mylliem | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Meghalaya packaged model |
| Amarpur | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Tripura packaged model |
| Dukli | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Tripura packaged model |
| Ambassa | BLOCKED_MISSING_DATA | PARTIALLY_WORKING | BLOCKED_MODEL | BLOCKED_MODEL | Not emitted | PARTIALLY_WORKING | No Tripura packaged model |

`PARTIALLY_WORKING` satellite/rainfall means the existing registered indicator is rendered through the normal monitoring/intervention path, but this task did not establish a source-record-to-chart trace for the value. It is not a claim that a block-specific live series exists.

## Corrections

- Added a provenance gate for all 16 newly added arrays. The monitoring chart will now show only observations returned by the published historical API; the untraceable local arrays are retained only as audit artifacts.
- Removed unsupported manual trend extrapolation from `scripts/generate_verified_predictions.py`.
- Changed inference terminology from `calibrated_ordered` to `ordered_uncalibrated`; ordered quantiles are not calibration.
- Added a freshness gate: offline forecasts require a current observation origin and future targets. The stale ledger was sanitized to explicit `unavailable`, `stale_observation`, and `stale_origin` records, with no forecast points.
- Preserved `operationalEligibility: false` throughout.

## Required dependency to progress

For each blocked block: obtain published groundwater observations with source URL/dataset version, station identifier, coordinates, unit, observation date, and approved block mapping; then train or validate a model artifact for its state with temporal held-out evaluation and interval coverage evidence. Regenerate forecasts only from that reviewed input.

## Verification

- `npm test`: 220 passed, 0 failed, 1 skipped (live server absent).
- `npx tsc --noEmit`: passed.
- `python scripts/generate_verified_predictions.py`: blocked because the host's WindowsApps `python.exe` could not start. The unsafe unsupported-state fallback was removed in source; it was not used to regenerate any data.
- `npm run build`: blocked by `EPERM` on ignored `.next\\server\\app\\api` output directory after compilation began; no source error was reported.
