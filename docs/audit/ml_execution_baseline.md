# ML Execution Baseline (Pre-Change State)
**Date**: 2026-10-13 · **Branch**: `main` · **HEAD**: `b57d590 INGESTION`

## 1. Working tree before this task
| Path | State | Origin |
|---|---|---|
| `ml/feature_engineering.py` | Modified, uncommitted | Earlier session edits (CSV loader, column renames) |
| `ml/train.py` | Modified, uncommitted | Earlier session rewrite (training loop + Supabase writes) |
| `docs/audit/ml/` | Untracked | Earlier ML audit (00–13) |

These were preserved as-is. They were written earlier **in this same assistant session**, so this report treats them as unreviewed code, not trusted evidence.

## 2. Environment
Python 3.14, scikit-learn 1.9.1, pandas 3.0.6, numpy 2.5.1. **pytest is not installed**, so the Python tests use stdlib `unittest` and nothing new was installed. PyTorch is not installed, so `GroundwaterLSTM` can't be run.

## 3. Dataset fingerprint
`data/sources/cgwb_mp_cleaned_proper.csv`: sha256 `f7fd9f75f4b50be88c610fec27181aafd233983f5ab5dca4299e080ea0cdbee4`, 13,090 rows (all of MP).
Pilot subset (one row per station per campaign, no duplicate station/date):

| Block | Station-rows | Stations | Campaign dates |
|---|---:|---:|---:|
| Bijawar | 73 | 8 | 10 |
| Rajnagar | 74 | 8 | 10 |
| Baldeogarh | 20 | 2 | 10 |
| Jatara | 67 | 7 | 10 |
| Palera | 15 | 2 | 9 |
| Tikamgarh | 56 | 7 | 10 |

Campaigns: 2021-01, 2021-08, 2021-11, 2022-01, 2022-05, 2022-08, 2022-11, 2023-01, 2023-05, 2023-08. That's about 3 years. Note that 2021-05 is missing.

## 4. Existing side effects (inspected before running anything)
- `ml/train.py --mode train` writes to `public.model_registry` and `public.model_predictions` with the service-role key on every run. **It was not re-run in this task.**
- It upserts all six block models under **one** `model_id` (`quantile_gb_v1.0`), so the registry's `performance_metrics` only hold the last block's metrics.
- `target_date` is set to `today + 90 days`. The model inputs actually end in 2023-08, so that date is mislabelled.
- `scripts/cron_live_satellite_ingest.py` (committed in `b57d590`) writes **hardcoded constants** to `derived_indicators` (see §7).

## 5. Existing forecast API (`src/app/api/forecast/route.ts`)
- **Confirmed:** it serves synthetic arithmetic (`currentDepth + 0.45`, `+0.90`, `+0.25`, with fixed ±bounds).
- It falls back to a fabricated depth of `12.5` and reads from the `ALL_BLOCKS` fixture. It never queries the database.

## 6. Access path for `public.model_predictions`
- Schema: `unit_id, model_id, target_date, predicted_gwl_mbgl, uncertainty_lower_mbgl, uncertainty_upper_mbgl, predicted_risk_severity, created_at`.
- Under RLS, only the `authenticated` role can SELECT (`20261011000002_permissions_remediation.sql`). An anon read returned **401** in this task.
- The correct path is the existing cookie-based `src/lib/supabase/server.ts` client.
- Prediction rows could not be listed without an authenticated session, and I did not use the service role to read them.

## 7. Integrity defect found during baseline (outside ML scope, not modified)
The six `derived_indicators` rows dated 2026-10-12 contain identical constants for every block, all labelled `data_status='observed'`:
- `grace_twsa_cm=-4.8`
- `cgwb_well_depth_mbgl=11.8`
- `well_depth_trend_m_per_yr=-0.38`

These values come from literals in `cron_live_satellite_ingest.py`, not from any observation. They are now the latest rows, so they **override the genuine CGWB-derived values** (e.g. Baldeogarh 1.23 m) in the UI. The script's rainfall "normal" (20 mm) and stress-score formula are also unsourced.

**Production data was not changed** under this task's rules. Correcting it needs your authorisation (see `ml_final_readiness.md`).

## 8. Baseline checks
- `npm test` → 134/134 pass (run earlier today, 2026-10-13).
- `npm run build` → success.
