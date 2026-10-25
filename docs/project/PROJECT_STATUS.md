# JAL DRISHTI — PROJECT STATUS & IMPLEMENTATION AUDIT

**Status:** Historical implementation snapshot; not evidence of current production verification  
**Date:** Historical implementation snapshot dated October 24, 2026; product-scope review updated October 25, 2026  
**Scope:** 43 Active Canonical Blocks • 28 Districts • 9 Target States  

> The verification counts below are historical report claims and have not been rerun for
> this update. Current NWDP telemetry uses the 18 retained CSVs only. The new experimental
> station model does not establish measurement datum or station-to-block mapping; it is
> excluded from trusted block forecasts and operational eligibility. See
> `audit/nwdp_repository_wide_update_report.md` for freshly executed results.

---

## 1. Executive Implementation Summary

The JalDrishti platform architecture has been fully consolidated:
1. **Unified Physical Data Layer:** Connected to Supabase `v_published_historical_observations` and reviewed CGWB manual archives (`verified_cgwb_block_series.json`). Zero fabricated records, synthetic dates, or silent mock fallbacks.
2. **Active ML Serving Bridge:** The `GlobalBlockAwareQuantileGB-v1` model is served via FastAPI (`http://127.0.0.1:8081`) and integrated into Next.js routes (`/api/forecast`). Predictions supply 4-horizon quantile estimates with strict uncertainty labels (`ordered_uncalibrated`) and `operationalEligibility: false`.
3. **Frontend Component Parity:** Monitoring (`/monitoring`) and Map Explorer (`/explorer`) both consume canonical block identities and observation APIs with race-condition prevention and clean state transitions.
4. **Clean Scope Isolation:** 11 Assam blocks, Narnaul (Haryana), and Salema (Tripura) are safely excluded from active UI selectors and preserved in historical reference registries.
5. **All Verification Suites Green:**
   - `npm test`: 237 passed, 0 failed.
   - `npx tsc --noEmit`: 0 errors.
   - `python -m pytest tests_py`: 113 passed, 0 failed.
   - `npm run build`: 14/14 static and dynamic routes compiled successfully.

### Station-level NWDP model product status (2026-10-25)

The 18-file NWDP station model, training artifacts, source lineage, Python inference, and contract tests are retained for reproducible experimental station-level telemetry forecasting. The standalone `/experimental-telemetry` page and proxy are not required by the approved PRD/TRD and are not part of active product navigation; the capability is surfaced only in the existing Monitoring page as explicitly experimental, unmapped station telemetry. Station measurement datum/sign convention and station-to-block containment remain unresolved, so this panel is not block evidence and is not used by risk or intervention decisions. The block-level API fails closed unless provenance and the existing 400-day freshness gate pass.

---

## 2. Active Component Status

| Component | Status | Source of Truth |
|:---|:---:|:---|
| **Overview Dashboard** | Fully Active | `src/app/overview/page.tsx` & `src/lib/data/allNationwideBlocks.ts` |
| **Map Explorer (GIS)** | Fully Active | `src/components/MapExplorer.tsx` & `/api/forecast` |
| **Monitoring Graphs** | Fully Active | `src/app/monitoring/page.tsx` & `/api/historical-observations` |
| **Risk Assessment** | Fully Active | `src/app/risk-assessment/page.tsx` & `scientificEngine.ts` |
| **Interventions Planner**| Fully Active | `src/app/interventions/page.tsx` & `ruleMatchedSchemes.ts` |
| **Model Inference Bridge**| Fully Active | `ml/serving.py` & `src/lib/services/globalForecastBridge.ts` |

---

## 3. Known Limitations & Scientific Boundaries

1. **Database Table vs Archive Coverage:** In Supabase, only Bundelkhand blocks currently have published database rows. The remaining 37 blocks cleanly fall back to local verified official CGWB records, accurately labeled **Historical Archive (Stale)**.
2. **Operational Eligibility Gate:** The model operates under `operationalEligibility: false` because formal field piezometer network cross-calibration across all 9 states remains in progress.
3. **Uncertainty Intervals:** P10–P90 prediction intervals are mathematically sorted quantiles but remain labeled `ordered_uncalibrated` until formal empirical calibration tests are conducted.
