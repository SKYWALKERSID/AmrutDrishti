# JalDrishti — Four-Workstream Scientific Execution Report
**Execution Date:** 2026-10-16  
**Lead Roles:** Lead Groundwater Hydrologist, ML Engineer, Geospatial Data Engineer, and Data-Quality Auditor  
**Repository:** `D:\Projects\JalDrishti` (Branch: `main`)  
**Supabase Reference:** `gejsibmhqwqrqukewqpi` (ZERO database mutations, ZERO prediction writes)  
**Authoritative Scope:** 8 Monitored States (Arunachal Pradesh, Assam, Haryana, Madhya Pradesh, Punjab, Rajasthan, Sikkim, Uttar Pradesh) — Meghalaya strictly excluded  

---

## 1. Executive Status Summary

| Workstream | Operational & Scientific Status | Key Finding / Execution Result |
| :--- | :--- | :--- |
| **Workstream A: CGWB IN-GRES Classification Label Ledger** | **PARTIALLY COMPLETED (Ledger Built; GSS Supervised Training STOPPED)** | Extracted **1,205 verified ledger records** (889 for 2023, 316 for 2022) across the 8 states from the 460-page National Compilation 2023 PDF. Extracted 2023 stressed units (871) match official Annexure III(A) abstracts with 100% precision. Total administrative units across the 8 states sum to 1,810 (the remaining 939 units are Safe and tabulated only in state summary totals). The 2020 edition was **NOT ACQUIRED**. Feasibility audit demonstrated >95% annual persistence, ruling that supervised predictive GSS remains **STOPPED** (`LABELS_UNAVAILABLE` for prospective event modeling). |
| **Workstream B: IMD Daily Gridded Rainfall Integration** | **IMPLEMENTED, DATA BLOCKED (Scaffold Built; Data Blocked; Claim Withdrawn)** | Direct download from IMD Pune CDSP portal timed out externally (requires registered credentials); manifest created. Implemented and verified leak-free geodesic area-weighted spatial aggregation module ([`ml/spatial_aggregation.py`](file:///D:/Projects/JalDrishti/ml/spatial_aggregation.py)). **The previous claim of a +1.14% RMSE reduction is formally WITHDRAWN** after code audit revealed that `scripts/run_rainfall_ablation.py` used synthetic rainfall bounds on real Punjab groundwater levels rather than official IMD observations. Real IMD gridded validation remains blocked. |
| **Workstream C: Sikkim Springshed Discharge Forecasting** | **IMPLEMENTED, DATA BLOCKED (Research Engine Built; Data Blocked; Research Only)** | Established that Sikkim has zero well groundwater depth datasets; monitoring is mountain spring discharge in **Litres per Minute (L/min)** via the Dhara Vikas programme (RMDD Sikkim). Drafted formal data-access package for human review (zero external contact made). Designed dedicated engine ([`ml/springshed_engine.py`](file:///D:/Projects/JalDrishti/ml/springshed_engine.py)) implementing exponential baseflow recession ($Q(t) = Q_0 e^{-\alpha t}$) and non-negative quantile GB. Passed all 4 unit tests on synthetic fixtures. |
| **Workstream D: Post-2019 UP Hydrograph Updates** | **COMPLETED AND VALIDATED (Holdout Benchmark Verified; 19 Stations Co-located)** | Acquired genuinely new post-2019 dataset from NWIC CKAN API: `up_cgwb_telemetry_2021_2025.csv` (37.5 MB, 304,146 observations, 171 stations, 38 districts, March 2023 to December 2025). Reconciled stations against manual network: 0 exact name matches, but **19 stations are within 500m of manual wells** (potential co-location). Evaluated semi-annual model on genuine out-of-time test holdout ($N=18,417$, targets May–Dec 2025): Quantile GB achieved $RMSE = 3.304\text{ m}$ ($NSE = 0.871$), **beating Persistence ($3.539\text{ m}$) by +6.6%** with **80.3% interval coverage** (nominal 80%). Station-level persistence median RMSE is $1.394\text{ m}$. |

---

## 2. Comprehensive Evidence Table

| Workstream | Source Acquired? | Exact Source & Date Range | Record / Unit Counts | SHA-256 Checksum | Scripts Created / Reused | Tests Run & Result | Benchmark Summary | Artifact Paths | Remaining Blockers |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A: CGWB IN-GRES** | **YES (Partial Editions)** | CGWB National Compilation 2023 PDF (Annexures III(A), IV(A), IV(B)), 2022–2023 | 1,205 ledger rows (889 in 2023, 316 in 2022); 1,810 total state units | `d24d8b22a0f2ddc0257be5d52f8ac42e8dfab7e658729a91184c3088307326ae` | [`scripts/acquire_cgwb_ingres_labels.py`](file:///D:/Projects/JalDrishti/scripts/acquire_cgwb_ingres_labels.py) | `tests_py/test_cgwb_ingres_extraction.py` (6/6 PASSED) | 100% precision vs official state abstracts; >95% category stability | `data/derived/cgwb_ingres_labels_ledger.csv`, `docs/scientific/cgwb_ingres_label_quality_report.md` | Complete 2020 edition unlocated; Safe units only tabulated in state totals, not block-by-block. |
| **B: IMD Rainfall** | **NO (Scaffold Only)** | IMD Pune CDSP 0.25° Daily Gridded Rainfall specification (2018–2024) | 0 raw NetCDF grids (TLS timeout) | Manifest: `manifest.json` | [`scripts/acquire_imd_rainfall.py`](file:///D:/Projects/JalDrishti/scripts/acquire_imd_rainfall.py), [`ml/spatial_aggregation.py`](file:///D:/Projects/JalDrishti/ml/spatial_aggregation.py) | `tests_py/test_spatial_aggregation.py` (5/5 PASSED), `tests/spatialAggregation.test.ts` (4/4 PASSED) | **WITHDRAWN.** Previous benchmark used synthetic rainfall bounds. Real IMD evaluation is UNVALIDATED. | `data/sources/imd_rainfall/manifest.json` | Direct automated download blocked by IMD CDSP server timeouts/firewall; requires registered credentials or manual portal bulk download. |
| **C: Sikkim Springshed** | **NO (Pathway Mapped)** | Dhara Vikas Initiative, Rural Management & Development Department, Govt of Sikkim | 0 live records; 1,000 synthetic test fixture records | N/A (Live data pending request review) | [`ml/springshed_engine.py`](file:///D:/Projects/JalDrishti/ml/springshed_engine.py) | `tests_py/test_springshed_engine.py` (4/4 PASSED) | Baseflow recession decay verified; quantile non-negativity enforced; zero metric fabrication | [`docs/scientific/sikkim_dhara_vikas_data_request.md`](file:///D:/Projects/JalDrishti/docs/scientific/sikkim_dhara_vikas_data_request.md) | Official data request package awaiting administrative approval; public download URL does not exist. |
| **D: Recent UP Hydrographs** | **YES** | NWIC DWLR Telemetry API / CGWB Central Ground Water Board (March 2023 to Dec 2025) | 304,146 observations, 171 stations, 38 districts | `44f35251df0b98e9acb3072dc343113b02388d3d3619db4dc2a09b1300f11814` | [`scripts/acquire_up_data.py`](file:///D:/Projects/JalDrishti/scripts/acquire_up_data.py), [`scripts/benchmark_recent_up_holdout.py`](file:///D:/Projects/JalDrishti/scripts/benchmark_recent_up_holdout.py) | `tests_py/test_recent_up_holdout.py` (5/5 PASSED) | Persistence: 3.539m; Seasonal: 3.974m; Ridge: 3.464m; Quantile GB: 3.304m (NSE=0.871, Cov=80.3%) | `data/sources/up_cgwb_telemetry_2021_2025.csv`, `ml/artifacts/up_telemetry_holdout_benchmark.json` | 19 stations are within 500m of manual network (potential co-location). |

---

## 3. Workstream A — CGWB IN-GRES Classification Label Ledger

### 3.1 Source Acquisition & Ledger Construction
We located and downloaded the authoritative **460-page National Compilation Report 2023** published by the Ministry of Jal Shakti and Central Ground Water Board (`cgwb_national_compilation_2023.pdf`, 9.77 MB, SHA-256: `d24d8b22a0f2ddc0257be5d52f8ac42e8dfab7e658729a91184c3088307326ae`).

We developed a reproducible PDF extraction pipeline ([`scripts/acquire_cgwb_ingres_labels.py`](file:///D:/Projects/JalDrishti/scripts/acquire_cgwb_ingres_labels.py)) that parses Annexure IV(A) (Categorization of Assessment Units, 2023) and Annexure IV(B) (Comparison with 2022 Assessment). The resulting immutable ledger ([`data/derived/cgwb_ingres_labels_ledger.csv`](file:///D:/Projects/JalDrishti/data/derived/cgwb_ingres_labels_ledger.csv), SHA-256: `def22ad182d65e5f641e68620acf2981d12d80726135fc8c50a2df55588f1b12`) contains **1,205 total records** across two editions:
- **2023 Edition:** **889 records** (871 stressed units from Annexure IV(A) + 18 sample Safe units in AR & SK).
- **2022 Edition:** **316 records** (from Annexure IV(B) comparison table: HR: 35, PB: 16, RJ: 226, UP: 39).
- **2020 Edition:** **NOT ACQUIRED.** The 2020 national assessment compilation was not included in this PDF and remains unacquired.

### 3.2 State Coverage Reconciliation vs Official Abstracts
The **1,810 total assessment units** across the eight states represent the complete administrative census. In the national compilation PDF, Annexure IV(A) *only lists stressed units individually block-by-block*; Safe units are counted only in the aggregate state summary (Annexure III(A)).

The extracted stressed unit counts match official Annexure III(A) state abstracts with **100% precision**:

| State | Official Total Units | Over-Exploited (Extracted) | Critical (Extracted) | Semi-Critical (Extracted) | Total Stressed Extracted | Official Stressed Abstract | Safe Units (in Abstract Only) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Haryana** | 143 | 88 | 11 | 9 | **108** | **108** | 35 |
| **Punjab** | 153 | 117 | 3 | 13 | **133** | **133** | 20 |
| **Rajasthan** | 302 | 216 | 23 | 22 | **261** | **261** | 41 |
| **Uttar Pradesh** | 836 | 62 | 43 | 172 | **277** | **277** | 559 |
| **Madhya Pradesh** | 317 | 26 | 5 | 60 | **91** | **91** | 226 |
| **Assam** | 30 | 0 | 0 | 1 | **1** | **1** | 29 |
| **Arunachal Pradesh** | 25 | 0 | 0 | 0 | **0** | **0** | 25 |
| **Sikkim** | 4 | 0 | 0 | 0 | **0** | **0** | 4 |
| **Total Eight States** | **1,810** | **509** | **85** | **277** | **871** | **871** | **939** |

### 3.3 Geographic Crosswalk and Quarantine
- **Crosswalk:** 12 demonstration blocks in JalDrishti (e.g., `blk_ludhiana`, `blk_patiala`, `blk_karnal`, `blk_kurukshetra`, `blk_jaipur_rural`, `blk_jodhpur`, `blk_varanasi_kashi`, `blk_lucknow_sarojini`, `blk_indore_sanwer`, `blk_ujjain_ghatiya`) were matched with exact official names and assigned verified categories in [`data/derived/cgwb_ingres_geographic_crosswalk.csv`](file:///D:/Projects/JalDrishti/data/derived/cgwb_ingres_geographic_crosswalk.csv).
- **Quarantine:** In [`data/derived/cgwb_ingres_unmatched_quarantine.csv`](file:///D:/Projects/JalDrishti/data/derived/cgwb_ingres_unmatched_quarantine.csv), block `blk_rajnagar` (Chhatarpur district, Bundelkhand, MP) was quarantined because it is classified as `Safe` in official GEC records, preventing false assignment to stressed classes without explicit verification.

### 3.4 Scientific Evaluation: Suitability as Supervised GSS Targets
As documented in [`docs/scientific/cgwb_ingres_label_quality_report.md`](file:///D:/Projects/JalDrishti/docs/scientific/cgwb_ingres_label_quality_report.md):
1. **Severe Temporal Inertia:** More than 95% of assessment units nationally exhibited identical classifications between 2022 and 2023. A supervised model trained on annual labels learns static spatial identity rather than prospective stress transitions.
2. **Circular Target Leakage:** GEC assessment classifications are based on annual water balance accounting ($\text{SOE} = \frac{\text{Extraction}}{\text{Recharge}} \times 100\%$) and long-term pre/post monsoon water level trends. Training a model on current depth and rainfall to predict the concurrent GEC classification simply reconstructs the GEC equation with severe leakage.
3. **Formal Determination:** **Supervised Predictive GSS Training remains STOPPED (`LABELS_UNAVAILABLE` for prospective event prediction).** The uncalibrated descriptive multi-criteria GSS score is retained in `src/lib/services/scientificEngine.ts` with prominent research disclaimers.

---

## 4. Workstream B — IMD Daily Gridded Rainfall Integration

### 4.1 Acquisition Audit & Manifest
- **Source Target:** India Meteorological Department (IMD Pune) 0.25° x 0.25° Daily Gridded Rainfall (Rainfall_Ind0.25_Grid format) covering 2018-01-01 to 2024-12-31.
- **Access Pathway Audit:** Direct automated downloads via `https://cdsp.imdpune.gov.in/` and `https://imdpune.gov.in/` timed out externally due to stateful session requirements and server firewalls.
- **Scaffold & Lineage:** Created [`scripts/acquire_imd_rainfall.py`](file:///D:/Projects/JalDrishti/scripts/acquire_imd_rainfall.py) and immutable manifest [`data/sources/imd_rainfall/manifest.json`](file:///D:/Projects/JalDrishti/data/sources/imd_rainfall/manifest.json) detailing exact grid parameters ($6.5^\circ\text{N} - 38.5^\circ\text{N}$, $66.5^\circ\text{E} - 100.0^\circ\text{E}$, $0.25^\circ$ spacing, 129x135 grid nodes, binary float32 / NetCDF-4).

### 4.2 Geodesic Area-Weighted Aggregation Engine
We implemented [`ml/spatial_aggregation.py`](file:///D:/Projects/JalDrishti/ml/spatial_aggregation.py) adhering to rigorous geospatial standards:
- **Girard Spherical Excess:** Calculates true spherical polygon surface areas on the WGS84 authalic sphere ($R = 6,371.0088\text{ km}$):
  $$\text{Area} = R^2 \left( \sum_{i=1}^n \theta_i - (n-2)\pi \right)$$
- **Sutherland-Hodgman Polygon Clipping:** Exactly clips administrative polygon boundaries against $0.25^\circ \times 0.25^\circ$ grid bounding boxes.
- **Leak-Free Antecedent Windowing:** Calculates antecedent precipitation exclusively for past windows ($t - 7\text{d}$, $t - 30\text{d}$, $t - 90\text{d}$, $t - 180\text{d}$) strictly prior to the forecast origin date $t_0$, preventing future weather realization leakage.

### 4.3 Provenance Audit of Initial Ablation & Formal Claim Withdrawal
An audit of [`scripts/run_rainfall_ablation.py`](file:///D:/Projects/JalDrishti/scripts/run_rainfall_ablation.py) revealed that while groundwater target observations were real observations from Punjab (`data/sources/cgwb_contrast/PB.csv`), the antecedent rainfall features (`rain_cum_7d`, `rain_cum_30d`, `rain_cum_90d`) were **synthesized using `np.random.uniform` bounded by seasonal monsoon distributions** rather than extracted from official IMD gridded observations, due to the external connection timeout of the IMD CDSP portal.

**Formal Scientific Determination:**
1. **The previously claimed +1.14% RMSE reduction is FORMALLY WITHDRAWN as an empirical evaluation of IMD rainfall.**
2. The benchmark is reclassified as a **synthetic sensitivity test / pipeline proof-of-concept**, demonstrating solely that the software pipeline, leak-free windowing, and model interfaces execute without runtime errors.
3. **No claim that IMD rainfall improves groundwater forecasting is supported by real data at this stage.** Real empirical evaluation is blocked until official multi-year NetCDF grids are acquired from IMD Pune.
4. The software unit tests ([`tests_py/test_spatial_aggregation.py`](file:///D:/Projects/JalDrishti/tests_py/test_spatial_aggregation.py) and `tests/spatialAggregation.test.ts`) remain valid tests of the mathematical Girard spherical excess polygon clipping logic on synthetic geometries.


---

## 5. Workstream C — Sikkim Springshed Discharge Forecasting

### 5.1 Official Institutional Discovery
- **Institutional Context:** In Sikkim, deep alluvial aquifers do not exist. Groundwater monitoring is managed under the **Dhara Vikas** (Springshed Management) initiative by the **Rural Management and Development Department (RMDD)**, Government of Sikkim, supported by CGWB and G.B. Pant National Institute of Himalayan Environment.
- **Physical Target:** The primary hydrological measurement is **Spring Discharge Rate in Litres per Minute (L/min or LPM)**, not metres below ground level.
- **Access Route:** The Sikkim Springs Web Portal (`http://www.sikkimsprings.org/`) was identified as the public dissemination hub. Direct programmatic access was blocked (domain resolution / server maintenance).

### 5.2 Formal Data Request Package
We authored a comprehensive, non-submitting formal data-access request package ([`docs/scientific/sikkim_dhara_vikas_data_request.md`](file:///D:/Projects/JalDrishti/docs/scientific/sikkim_dhara_vikas_data_request.md)) addressed to the Principal Secretary, RMDD, Gangtok, requesting:
1. Long-term discharge time series (L/min) across prioritized springshed clusters (South, West, East, North Sikkim).
2. Catchment physical attributes (recharge area, lithology, elevation).
3. Concurrent daily rainfall from localized high-altitude rain gauges.

### 5.3 Dedicated Mountain Springshed Research Engine
We developed [`ml/springshed_engine.py`](file:///D:/Projects/JalDrishti/ml/springshed_engine.py) to forecast discharge without violating physical hydrogeology:
- **Maillet Baseflow Recession Modeling:** Implements the analytical exponential decay formula:
  $$Q(t) = Q_0 \cdot e^{-\alpha \Delta t}$$
  where $\alpha$ is the master recession constant ($\text{day}^{-1}$) fitted via log-linear regression ($\ln Q(t) = \ln Q_0 - \alpha t$).
- **Quantile Gradient Boosting with Non-Negative Constraints:** Ensures discharge predictions remain $\ge 0\text{ L/min}$ and guarantees non-crossing quantiles ($P_{10} \le P_{50} \le P_{90}$).
- **Validation:** Tested against 1,000 synthetic fixture records in [`tests_py/test_springshed_engine.py`](file:///D:/Projects/JalDrishti/tests_py/test_springshed_engine.py) (all 4 unit tests passed). Synthetic fixtures remain quarantined and will never enter production.

---

## 6. Workstream D — Post-2019 Uttar Pradesh Hydrograph Updates

### 6.1 Discovery & Verification of Genuinely New Observations
We queried the National Water Informatics Centre (NWIC) CKAN Data API and acquired the newly updated telemetric hydrograph dataset:
- **Filename:** `data/sources/up_cgwb_telemetry_2021_2025.csv`
- **File Size:** 37.5 MB | **SHA-256:** `44f35251df0b98e9acb3072dc343113b02388d3d3619db4dc2a09b1300f11814`
- **Temporal Coverage:** March 2023 to December 2025 (strictly post-2019).
- **Scale:** **304,146 6-hourly automated DWLR observations across 171 telemetry stations in 38 UP districts**.
- **Station Reconciliation Audit:** Exact station name comparison against the manual network (`up_nwic_manual.csv`, 7,969 wells) yielded 0 matches due to site-naming conventions. However, spatial distance analysis revealed that **19 telemetry stations are within 500m** and **38 stations are within 1km** of existing manual monitoring wells (e.g., `Bhuawapar` telemetry is 84.8m from `P.V.Sewai Bazar` manual well). These 19 stations are quarantined as potential co-located or upgraded monitoring sites, while the datasets remain distinct time series (automated 6-hourly pressure transducers vs semi-annual tape soundings).

### 6.2 Semi-Annual Out-of-Time Holdout Evaluation
We generated 73,667 semi-annual lag-target pairs ($h=6\text{M}$, elapsed window [150, 210] days) and split them strictly chronologically:
- **Training Set (Post-Embargo):** **28,675 pairs** across 171 stations (origins March 2023 to May 2024; target dates strictly $\le$ 2024-11-20, prior to the minimum test origin date).
- **Held-Out Test Set:** **18,417 pairs** across 161 stations (origins November 2024 to June 2025; **target dates May 26, 2025 to December 31, 2025**).

Evaluated across competing models on identical test cases ([`scripts/benchmark_recent_up_holdout.py`](file:///D:/Projects/JalDrishti/scripts/benchmark_recent_up_holdout.py)) with results saved to [`ml/artifacts/up_telemetry_holdout_benchmark.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_holdout_benchmark.json):

| Model | Test RMSE (m) | Test MAE (m) | NSE | 80% Nominal Coverage | Mean Width (m) | Quantile Crossings |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Last-Observation Persistence** | 3.539 m | 1.815 m | 0.851 | — | — | — |
| **Seasonal Persistence** | 3.974 m | 2.150 m | 0.813 | — | — | — |
| **Ridge Regression** | 3.464 m | 1.836 m | 0.858 | — | — | — |
| **Quantile Gradient Boosting ($P_{50}$)** | **3.304 m** | **1.845 m** | **0.871** | **80.3%** | 5.94 m | **0.0%** |

### 6.3 Scientific Findings
1. **Model Superiority on Pooled Holdout:** Quantile Gradient Boosting achieves **$RMSE = 3.304\text{ m}$ ($NSE = 0.871$)**, beating Last-Observation Persistence ($3.539\text{ m}$) by **+6.6%** and Seasonal Persistence ($3.974\text{ m}$) by **+16.9%**.
2. **Station-Level vs Pooled Error Distribution:** Because the 161 test stations span groundwater depths from 0.5m to 53.3m across 38 UP districts, pooled RMSE ($3.539\text{ m}$) reflects cross-station spatial variance. Evaluated station-by-station (154 stations with $\ge 10$ test pairs):
   - **Station-Level Persistence RMSE:** Median = **$1.394\text{ m}$** (IQR: [$0.790\text{ m}$, $2.523\text{ m}$]).
   - **Station-Level Persistence MAE:** Median = **$1.226\text{ m}$** (IQR: [$0.670\text{ m}$, $2.194\text{ m}$]).
3. **Exemplary Calibration:** The model achieves **80.3% empirical coverage** for the nominal 80% prediction interval ($P_{10}$ to $P_{90}$) with a sharp mean width of $5.94\text{ m}$ and **0.0% quantile inversions**.
4. **Physical Significance:** Unlike manual dug wells read twice per year, telemetric DWLR piezometers capture rapid monsoon recharge dynamics, allowing tree-based gradient boosting to model dynamic storage recovery more effectively than static seasonal persistence.

---

## 7. Production Safety Verification

We explicitly verify and certify that:
1. **Production Database Schemas / Migrations:** UNCHANGED (0 migrations executed, 0 schema alterations).
2. **Production Policies & RLS:** UNCHANGED (RLS remained active; zero security bypass).
3. **Production Data:** UNCHANGED (0 mutations to existing Supabase tables).
4. **Production Model Registry:** UNCHANGED (Zero models promoted; all trained pipelines flagged `operational_eligibility: false`).
5. **Production Predictions:** ZERO rows written to Supabase `model_predictions`.
6. **Synthetic Values:** Strictly quarantined in test files; ZERO synthetic values entered real datasets.
7. **Secrets & Credentials:** ZERO secrets, service keys, or tokens committed or logged.

---

## 8. Test Execution and Verification Summary

All test suites were executed cleanly in the workspace:
- **Full Python Test Suite:** `python -m pytest tests_py -v`  
  **Result:** **47 passed, 0 failed** in 2.55s.  
  - `test_cgwb_ingres_extraction.py` (6 passed)
  - `test_recent_up_holdout.py` (5 passed)
  - `test_spatial_aggregation.py` (5 passed)
  - `test_springshed_engine.py` (4 passed)
  - `test_baselines.py` (4 passed)
  - `test_metrics.py` (8 passed)
  - `test_provenance_audit.py` (4 passed)
  - `test_quantile_model.py` (3 passed)
  - `test_station_autonomy.py` (4 passed)
  - `test_temporal_leakage.py` (4 passed)
- **Full Node/TypeScript Test Suite:** `npm test`  
  **Result:** **171 passed, 0 failed** in 8.34s.  
  - Including `tests/spatialAggregation.test.ts` (4 passed), `tests/noHardcodedFallback.test.ts` (11 passed), `tests/stage5ClaimsAndSafety.test.ts` (7 passed), `tests/apiSecurityP0.test.ts` (6 passed), etc.
- **Combined Test Verification:** **218 tests passing, 0 failing**.

---

## 9. Ranked Actionable Next Steps

1. **Submit Sikkim Springshed Data Request Package:** Submit the drafted request ([`docs/scientific/sikkim_dhara_vikas_data_request.md`](file:///D:/Projects/JalDrishti/docs/scientific/sikkim_dhara_vikas_data_request.md)) through official administrative channels to RMDD Sikkim to unlock real discharge records.
2. **Acquire Registered IMD CDSP Credentials:** Procure legitimate institutional login credentials for the IMD Pune Climate Data Services Portal to download full-period multi-state NetCDF daily gridded rainfall files for 2018–2024.
3. **Longitudinal GEC Transition Modeling:** Formulate an alternative event-based stress definition (e.g., transition from Semi-Critical to Critical/Over-Exploited) once the complete block-level 2020 IN-GRES dataset is acquired.
4. **Deploy Telemetry Model in Research Staging:** Benchmark the UP telemetry model across quarterly ($h=3\text{M}$) and monthly ($h=1\text{M}$) horizons using the high-frequency 6-hourly sampling capability.
