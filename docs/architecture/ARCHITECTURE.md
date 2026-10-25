# AMRUT DRISHTI — SYSTEM & DATA FLOW ARCHITECTURE

## 1. High-Level System Architecture

Amrut Drishti is an AI-powered groundwater intelligence and monitoring decision-support platform designed for India's administrative blocks.

```text
[ National Water Portals ]          [ Satellite Earth Observation ]
 • NWIC / NWDP Telemetry               • NASA GRACE-FO (TWSA)
 • CGWB Quarterly Monitoring           • IMD Gridded Rainfall (0.25°)
 • State Groundwater Depts             • Sentinel-2 NDVI / SMAP
              │                                      │
              ▼                                      ▼
[ Data Acquisition & Validation ]    [ Geospatial Feature Preprocessing ]
 • Physical bounds check [0, 150m]    • Spherical polygon clipping
 • Station identity mapping           • Area-weighted gridded aggregation
 • 400-day observation freshness      • Seasonal precipitation anomaly
              │                                      │
              └───────────────┬──────────────────────┘
                              ▼
            [ Dual-Tier Observation Service ]
              1. Supabase PostgREST View (`v_published_historical_observations`)
              2. Reviewed Local CGWB Series (`verified_cgwb_block_series.json`)
              3. Honest Unavailable State (fail-closed, 0 fabricated records)
                              │
              ┌───────────────┴──────────────────────┐
              ▼                                      ▼
[ Web Application (Next.js 15) ]       [ ML Inference Service (FastAPI) ]
 • Monitoring Time-Series Graphs        • Artifact: GlobalBlockAwareQuantileGB-v1
 • Leaflet GIS Map Explorer             • Quantile Loss Horizons: Q1, Q2, Q3, Q4
 • Descriptive GSS Risk Breakdown       • P10, Expected, P90 Intervals
 • Conservation Interventions Matrix    • Label: ordered_uncalibrated (operationalEligibility: false)
```

## 2. Canonical Scope & Active Geography

The active application scope is strictly bounded to:
- **Active States:** 9 Monitored States (Madhya Pradesh, Karnataka, Telangana, Tamil Nadu, Rajasthan, Haryana, Punjab, Meghalaya, Tripura).
- **Active Districts:** 28 Administrative Districts.
- **Active Blocks:** Exactly **43 Canonical Blocks** (`src/lib/data/canonical43Blocks.json`).
- **Archived Reference Basins:** 11 Assam blocks (`blk_kamrup_*`, `blk_sonitpur_*`, `blk_dibrugarh_*`, `blk_cachar_*`), `blk_mahendragarh_narnaul` (Haryana), and `blk_dhalai_salema` (Tripura) are strictly removed from active selectors and map pin collections and preserved in historical reference registries.

## 3. Data Ingestion & Observation Pipeline

1. **Database Access Path (`v_published_historical_observations`):**
   - Served via `/api/historical-observations?block=<block_id>`.
   - Reads approved public view with `security_invoker = true`, filtering `publication_status = 'published'` and `data_status = 'observed'`.
2. **Local Verified Fallback Path:**
   - Bundled CGWB manual well records (`verified_cgwb_block_series.json` and `contrastHistoricalSeries.json`).
   - Gated by `src/lib/data/historicalSeriesProvenance.ts`.
   - Distinctly labeled in the UI as **Historical Archive (Stale)** when observations exceed 400 days from current date.
3. **Data Integrity & Anti-Hallucination Rules:**
   - Zero fabricated observation records or synthetic date extensions.
   - Fail-closed empty state (`observations: []`, `totalCount: 0`) when neither source has verified physical measurements.

## 4. Machine Learning Inference Pipeline

1. **Inference Service Architecture:**
   - Python FastAPI service running in `ml/serving.py` on `http://127.0.0.1:8081`.
   - Mutual-authentication via bearer token (`AMRUTDRISHTI_MODEL_SERVICE_TOKEN`).
2. **Feature Engineering:**
   - Ingests verified observation sequence + IMD rainfall anomalies + GRACE TWSA + SMAP soil moisture.
   - Categorical block encoding with out-of-fold generalization.
3. **Operational Safeguards:**
   - `operationalEligibility` is hard-coded to `false` until multi-station field validation is completed.
   - P10–P90 uncertainty intervals are explicitly marked `ordered_uncalibrated`.
   - 400-day freshness gate strictly enforces that obsolete observation origins cannot produce authoritative forecasts.

## 5. Experimental NWDP Station Model (Research Pipeline Only)

The retained 18 NWDP CSVs feed a separate station-isolated experimental training and inference path (`ml/nwdp_training.py`, `ml/nwdp_inference.py`, `ml/serving.py`). Its artifacts, source-record lineage, and response-contract tests are retained. It is not a product route: the former `/experimental-telemetry` page and public Next.js proxy were removed because the approved PRD/TRD do not require a standalone station-forecast experience. The source variable's datum/sign convention and station-to-block containment are unresolved; therefore station predictions are not merged into the verified block observation provider, `/api/forecast`, risk, or interventions. Any future UI integration requires documented measurement and mapping evidence and must remain visibly experimental until then.
