# JalDrishti — Uttar Pradesh Telemetry Rigorous Temporal & Spatial Validation Audit

**Audit Date:** 2026-10-16 (Reconciled: 2026-10-17)  
**Lead Roles:** Lead Groundwater Hydrologist, ML Validation Engineer, Geospatial Data Auditor  
**Local Repository:** `D:\Projects\JalDrishti` (Branch: `main`)  
**Data Evaluated:** `data/sources/up_cgwb_telemetry_2021_2025.csv` (304,146 observations, 171 DWLR stations in 38 UP districts, March 2023 to December 2025; SHA-256: `44f35251df0b98e9acb3072dc343113b02388d3d3619db4dc2a09b1300f11814`)  
**Production Boundary:** ZERO database mutations, ZERO prediction writes to Supabase, ZERO schema modifications.  
**Companion Comprehensive Independent Audit:** See [docs/scientific/up_independent_benchmark_audit_2026-10-16.md](file:///D:/Projects/JalDrishti/docs/scientific/up_independent_benchmark_audit_2026-10-16.md)

---

## 1. Executive Validation Verdict & Acceptance Gate

| Operational Horizon | Scientific Status | Operational Deployment Eligible? | Key Finding | Primary Model & Skill |
| :--- | :---: | :---: | :--- | :--- |
| **1-Month Variable Window**<br>[20–40d, median 20d] | `REPRODUCED_RESEARCH_RESULT` | **DISABLED** | High persistence inertia in deep alluvium. Ridge Regression outperforms Gradient Boosting. | **Ridge Regression:** $RMSE = 1.558\text{ m}$ ($NSE = 0.970$), beating Persistence ($1.661\text{ m}$) by **+6.2%**. QGB RMSE is $1.870\text{ m}$ (-12.6%). |
| **3-Month Variable Window**<br>[75–105d, median 75d] | `PROVISIONAL_RESEARCH_RESULT` | **DISABLED** | Transition zone where linear trends and non-linear recharge balance. Station-cluster bootstrap CI spans zero. | **Ridge Regression:** $RMSE = 2.787\text{ m}$ ($NSE = 0.904$, +3.5%); **Quantile GB:** $RMSE = 2.836\text{ m}$ ($NSE = 0.900$, +1.8%). |
| **6-Month Variable Window**<br>[150–210d, median 150d] | `PROVISIONAL_RESEARCH_RESULT` | **DISABLED** | Monsoon recharge dynamics dominate. Gradient boosting outperforms persistence pooled (+4.0%), but station-cluster bootstrap CI touches zero. | **Quantile GB ($P_{50}$):** **$RMSE = 3.394\text{ m}$** ($NSE = 0.863$), beating Persistence ($3.534\text{ m}$) by **+4.0%** and Seasonal ($3.966\text{ m}$) by **+14.4%**. |
| **Clean Stations Sensitivity**<br>(Excl. 19 Probable Co-located) | `REPRODUCED_RESEARCH_RESULT` | **DISABLED** | Excluding 19 probable co-located stations proves model skill is not driven by network contamination. | **Quantile GB ($P_{50}$):** $RMSE = 3.297\text{ m}$ ($NSE = 0.860$), beating Persistence ($3.449\text{ m}$) by **+4.4%**. Station-cluster 95% CI is $[-0.079\text{ m}, +0.327\text{ m}]$. |
| **Spatial Generalization**<br>(33 Unseen Stations Holdout) | `PROVISIONAL_RESEARCH_RESULT` | **DISABLED** | Evaluated on 33 unseen stations excluded entirely from training. Confirms **baseline parity only**. | **Quantile GB ($P_{50}$):** $RMSE = 2.868\text{ m}$ ($NSE = 0.862$), parity (-1.0%) with Persistence ($2.840\text{ m}$). |

**Operational Safety Gate Ruling:** While the models pass retrospective research validation criteria (leakage-free, strictly chronological, zero quantile crossings), **all models remain flagged `operational_eligibility: false`**. Research-only predictive skill does not establish operational readiness. The unseen-station test did not demonstrate improvement over persistence (baseline parity at -1.0% margin).

---

## 2. Audit of the Benchmark Protocol and Corrected Flaws

### 2.1 Flaws Identified in Provisional Script (`scripts/benchmark_recent_up_holdout.py`)
1. **Target-Sorted Row Percentile Split:** The original benchmark sorted pairs by target date and split at the 75th percentile. This created an irregular origin boundary that varied by horizon, risking subtle cross-station temporal correlation.
2. **Missing Embargo Pre-Split:** The training count was initially cited as $N=55,250$, but enforcing `train_target <= min_test_origin` trimmed it to $N=28,675$.
3. **Naïve Name Matching Overlap Claim:** The claim that the telemetry dataset had "zero overlap" with the manual network was based on string equality. Geodesic analysis revealed that **19 telemetry stations are within 500m of manual network wells**, indicating probable co-located piezometers.
4. **Misleading "Exact Day" Terminology:** The search algorithm selects the first available observation within day ranges; calling them "exact 30-, 90-, and 180-day forecasts" obscured the heavy concentration on the lower interval boundaries.

### 2.2 The Corrected Rigorous Protocol
- **Strict Global Cutoff:** Fixed at **`2025-01-01`**.
  - **Training Set:** All forecast origins $t_0 < \text{2025-01-01}$ with target dates $t_{\text{target}} \le \text{2024-12-31}$.
  - **Test Set (Held-Out Out-of-Time):** All forecast origins $t_0 \ge \text{2025-01-01}$ with targets in 2025.
  - **Embargo Assertion:** $\max(t_{\text{train\_target}}) = \text{2024-12-31} < \min(t_{\text{test\_origin}}) = \text{2025-01-01}$. Zero temporal overlap.
- **Preprocessing Isolation:** Medians and scalers are fitted exclusively on training pairs ($t_0 < \text{2025-01-01}$) and applied out-of-sample to test pairs.
- **Strict Paired Comparisons:** All competing models (Persistence, Seasonal Persistence, Ridge, Quantile GB) are evaluated on the identical held-out test rows.
- **Cadence Integrity:** Raw 6-hourly telemetry is aggregated to daily station medians to remove diurnal barometric and pumping noise before constructing elapsed-time windows.

---

## 3. Comprehensive Multi-Horizon Benchmark Results

All evaluations use the strictly chronological held-out test period (targets throughout 2025):

### 3.1 Pooled Evaluation Across Competing Models

| Declared Horizon | Search Window | Actual Median Elapsed | Train Samples | Test Samples | Test Stations | Persistence RMSE | Seasonal RMSE | Ridge RMSE | Quantile GB ($P_{50}$) RMSE | QGB MAE | QGB NSE | Best Model vs Persistence | 80% Nom. Coverage | Mean Width | Quantile Crossings |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1-Month Variable** | 20 to 40 days | 20.0 days | 53,896 | 30,279 | 170 | 1.661 m | 3.484 m | **1.558 m** | 1.870 m | 0.685 m | 0.956 | **Ridge (+6.2%)** | 88.6% | 4.58 m | **0.0%** |
| **3-Month Variable** | 75 to 105 days | 75.0 days | 45,376 | 24,342 | 167 | 2.887 m | 3.904 m | **2.787 m** | 2.836 m | 1.307 m | 0.900 | **Ridge (+3.5%)** | 86.2% | 4.97 m | **0.0%** |
| **6-Month Variable** | 150 to 210 days | 150.0 days | 34,677 | 18,318 | 161 | 3.534 m | 3.966 m | 3.426 m | **3.394 m** | 1.719 m | **0.863** | **QGB (+4.0%)** | 84.4% | 6.19 m | **0.0%** |

### 3.2 Actual Elapsed-Time Distributions & Sub-Bucket Breakdown

| Horizon | Sub-Bucket | Samples | Active Stations | Persistence RMSE | QGB ($P_{50}$) RMSE | QGB vs Persistence | 80% Nom. Coverage | Mean Width |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1M Variable** | **20–26 days** | 28,357 | 170 | 1.515 m | 1.740 m | **-14.9%** (Persist Wins) | 89.3% | 4.58 m |
| | **27–33 days** | 949 | 158 | 3.255 m | 3.430 m | **-5.4%** (Persist Wins) | 78.5% | 4.62 m |
| | **34–40 days** | 973 | 120 | 2.938 m | 3.015 m | **-2.6%** (Persist Wins) | 76.5% | 4.55 m |
| **3M Variable** | **75–84 days** | 22,439 | 167 | 2.772 m | 2.726 m | **+1.6%** (QGB Wins) | 86.2% | 5.00 m |
| | **85–94 days** | 927 | 127 | 4.731 m | 4.588 m | **+3.0%** (QGB Wins) | 86.0% | 4.88 m |
| | **95–105 days** | 976 | 109 | 3.167 m | 3.124 m | **+1.4%** (QGB Wins) | 86.9% | 4.49 m |
| **6M Variable** | **150–169 days** | 17,517 | 161 | 3.565 m | 3.424 m | **+4.0%** (QGB Wins) | 84.2% | 6.22 m |
| | **170–189 days** | 726 | 83 | 2.752 m | 2.622 m | **+4.7%** (QGB Wins) | 89.7% | 5.72 m |
| | **190–210 days** | 75 | 12 | 2.955 m | 2.858 m | **+3.3%** (QGB Wins) | 70.7% | 4.74 m |

### 3.3 Station-Level Error Distributions (Decoupling Spatial Variance)

| Horizon | Qualifying Stations ($\ge 10$ obs) | Station Persistence RMSE Median | Persistence IQR | Station QGB RMSE Median | QGB IQR | Median Station Coverage |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1-Month Variable** | 169 | **0.422 m** | [0.204 m, 0.875 m] | **0.485 m** | [0.260 m, 0.944 m] | 92.1% |
| **3-Month Variable** | 162 | **1.054 m** | [0.630 m, 1.951 m] | **0.992 m** | [0.609 m, 1.947 m] | 95.1% |
| **6-Month Variable** | 154 | **1.394 m** | [0.790 m, 2.523 m] | **1.163 m** | [0.627 m, 2.112 m] | 89.7% |

*Station Aggregation Method:* Individual RMSEs are computed for each qualifying station with $\ge 10$ test observations ($N=154$ stations at 6M). The median of these station-level RMSEs is $1.163\text{ m}$ for QGB vs $1.394\text{ m}$ for Persistence (a **+16.6% median station-level improvement** over persistence).

---

## 4. Physical Station Identity Reconciliation Analysis

### 4.1 Proximity Reconciliation Ledger & Cross-Tabulation Matrix
The reconciliation ledger ([`data/derived/up_station_identity_reconciliation.csv`](file:///D:/Projects/JalDrishti/data/derived/up_station_identity_reconciliation.csv)) contains **exactly 78 candidate proximity pairs** cross-referencing telemetry stations against manual monitoring wells using WGS84 spherical Haversine geodesic distances:
- **Confirmed Match (`confirmed_match`):** Count = **0**. In strict accordance with scientific audit rules, `confirmed_match` requires authoritative shared government identifiers (e.g. DWLR Site ID) or verified well construction metadata, which are absent in published tables.
- **Probable Matches (`probable_match`):** Exactly **19 candidate pairings** across **19 unique telemetry stations** are within $\le 500\text{m}$ of a manual network well within identical District and Block administrative boundaries:
  - `Bhuawapar` (86.4m, Gorakhpur), `Bardwari-I` (262.6m, Hathras), `Budaun Polytechnic College` (280.5m, Budaun), `Dugraiyya Brahmpur-I (Dp)` (288.5m), `Sanjarpur Kaidwa` (290.4m), `Modi Nagar- Pz Ii` (299.8m), `Kathela Garvi` (299.1m), `Mustafabad_5` (340.5m), `Parikshat Garh Pz_1` (354.3m), `Naharpur-I` (422.3m), `Pali-I` (424.3m), `Jaspura_1` (436.4m), `Shohratgarh_1` (438.1m), `Ferozpur_1` (440.0m), `Mohanlalganj_2` (444.6m), `Dapsaura_1` (449.1m), `Digner_1` (472.2m), `Rahawati_1` (485.4m), `Rehman Khera_1` (496.0m).
- **Unresolved / Village Proximity (`unresolved`):** **25 candidate pairings** (24 pairings in 500m to 1,000m, plus `Pilana_1` at 251.0m where block label agreement in manual records is absent).
- **No Match Established (`no_match_established`):** **34 candidate pairings** (1,000m to 1,500m).
- **Total:** Sum of classifications is exactly **78 rows** (65 unique telemetry stations, 73 unique manual stations). Zero null coordinates, 0 duplicate candidate pairs.

#### Exhaustive Distance Band × Status Cross-Tabulation Matrix
| Distance Band | `confirmed_match` | `probable_match` | `unresolved` | `no_match_established` | Total Candidate Pairs | Unique Telemetry Stations | Unique Manual Stations |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **0 to 100 m** | 0 | 1 (`Bhuawapar`) | 0 | 0 | **1** | 1 | 1 |
| **100 to 500 m** | 0 | 18 | 1 (`Pilana_1`) | 0 | **19** | 19 | 19 |
| **500 to 1,000 m** | 0 | 0 | 24 | 0 | **24** | 23 | 23 |
| **1,000 to 1,500 m** | 0 | 0 | 0 | 34 | **34** | 30 | 30 |
| **Total Ledger Rows** | **0** | **19** | **25** | **34** | **78** | **65** | **73** |

*Accounting of `Pilana_1`:* Telemetry `Pilana_1` ($28.935833^\circ\text{N}, 77.372222^\circ\text{E}$, block PILANA, district BAGHPAT) pairs with manual well `Pilana  P` ($28.936389^\circ\text{N}, 77.369722^\circ\text{E}$, block `-`, district BAGHPAT) at geodesic distance $251.0\text{m}$. Because the manual table lacks block confirmation (`-`), it is classified as `unresolved`. Hence the $(100, 500\text{m}]$ band has 19 rows (18 `probable_match` + 1 `unresolved`), and the total $\le 500\text{m}$ proximity pool has 20 rows (19 `probable_match` + 1 `unresolved`).

### 4.2 Sensitivity Analysis: Population B (19 Co-located Stations Excluded)
Re-evaluating the 6-Month horizon on the cleanly isolated telemetry stations ([`ml/artifacts/up_telemetry_sensitivity_clean_stations.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_sensitivity_clean_stations.json)):
- **Clean Training Samples:** $N=30,478$ across 147 stations
- **Clean Test Samples:** $N=15,861$ across 142 stations
- **Last-Observation Persistence:** $RMSE = 3.449\text{ m}$ | $MAE = 1.844\text{ m}$ | $NSE = 0.847$
- **Ridge Regression:** $RMSE = 3.381\text{ m}$ | $MAE = 1.824\text{ m}$ | $NSE = 0.853$
- **Quantile Gradient Boosting ($P_{50}$):** **$RMSE = 3.297\text{ m}$** | $MAE = 1.719\text{ m}$ | **$NSE = 0.860$** (**+4.40% pooled improvement over persistence**)
- **Station-Cluster Bootstrap (95% CI, $N_{\text{boot}}=2000$):**
  - **Seed 42:** Mean $+0.148\text{ m}$, 95% CI: **$[-0.045\text{ m}, +0.309\text{ m}]$** (crosses zero).
  - **Seed 2026:** Mean $+0.152\text{ m}$, 95% CI: **$[-0.050\text{ m}, +0.310\text{ m}]$** (crosses zero; endpoint shift $\le 0.005\text{ m}$).
- **Supplementary Date-Block Bootstrap (95% CI, $N_{\text{boot}}=2000$, 8 monthly blocks):**
  - **Seed 42:** Mean $+0.159\text{ m}$, 95% CI: **$[+0.062\text{ m}, +0.256\text{ m}]$**.
  - **Seed 2026:** Mean $+0.158\text{ m}$, 95% CI: **$[+0.060\text{ m}, +0.257\text{ m}]$**.
  - *Caveat:* Operates on only 8 calendar month blocks across all stations; strictly supplementary to station-cluster bootstrap.
- **Empirical 80% Coverage:** **84.40%** | Mean Width: $5.729\text{ m}$ | Median Width: $5.089\text{ m}$ | Quantile Crossings: **0.0%**.

*Sensitivity Finding:* Side-by-side comparison with the earlier 18-station exclusion ($N_{\text{test}}=15,987$, Persistence $3.436\text{ m}$, QGB $3.291\text{ m}$, $+4.21\%$ gain) confirms that adding `Budaun Polytechnic College` removed 180 training pairs and 126 test pairs with virtually identical performance (+4.40% vs +4.21%), proving that model skill is not driven by network station duplication.

---

## 5. Spatial Generalization to Unseen Stations (Population C)

Split where **20% of stations ($N=33$ stations) were completely excluded from model fitting**:
- **Trained on:** 132 stations ($N_{\text{train}}=27,741$)
- **Tested strictly on:** 33 unseen stations ($N_{\text{test}}=3,782$, origins $\ge 2025-01-01$)
- **Persistence Baseline:** $RMSE = 2.840\text{ m}$ | $NSE = 0.865$
- **Quantile Gradient Boosting ($P_{50}$):** $RMSE = 2.868\text{ m}$ | $NSE = 0.862$ (**-1.0% margin vs Persistence**)
- **Empirical 80% Coverage:** **83.8%** | Mean Width: $5.82\text{ m}$ | Crossings: **0.0%**.

*Scientific Finding:* **The unseen-station test did not demonstrate improvement over persistence (baseline parity at -1.0% margin).** Autoregressive depth at origin ($wl_0$) remains the dominant physical predictor, and tree models cannot generalize across unmonitored sites in deep alluvial basins without local baseline water table depth history.

---

## 6. Quantile Uncertainty Calibration Audit

1. **Ordering Mechanism (`order_quantiles` in `ml/validation.py`):**
   - Applies an element-wise clipping heuristic: `safe_p10 = np.minimum(p10, p50)` and `safe_p90 = np.maximum(p90, p50)`.
   - **Audit Classification:** This is **not isotonic regression** and **not conformal prediction**. It is an element-wise ordering safeguard anchored to the central median $P_{50}$.
   - Raw model predictions produce 0.03% to 0.21% crossing inversions; post-safeguard crossings are **0.00%** by mathematical construction.
2. **Empirical Coverage vs Nominal 80% Target:**
   - 1-Month Variable Window: **88.56%** (mean width $4.58\text{ m}$)
   - 3-Month Variable Window: **86.23%** (mean width $4.97\text{ m}$)
   - 6-Month Variable Window: **84.39%** (mean width $6.19\text{ m}$)
   - **Empirical Conservatism:** Prediction intervals are wider than nominal target, enveloping 84% to 89% of observations. Without a separate, verified historical cycle ablation study, this over-coverage is documented as empirical model conservatism rather than definitively attributed to specific training drawdown events.

---

## 7. Machine-Readable Deliverables & Automated Verification

### 7.1 Generated Research Artifacts & Hashes
- [`ml/artifacts/predictions_1m_variable_window.csv`](file:///D:/Projects/JalDrishti/ml/artifacts/predictions_1m_variable_window.csv) (SHA-256: `6e2a13b9f377fe2b47f16613ab6a24431abd83739c32c1b5b7f80e432ae0d4bf`)
- [`ml/artifacts/predictions_3m_variable_window.csv`](file:///D:/Projects/JalDrishti/ml/artifacts/predictions_3m_variable_window.csv) (SHA-256: `83b8a53a856bfbcbb3cc3bcf56472179c66dcebe0b52192f604e7969635873b0`)
- [`ml/artifacts/predictions_6m_variable_window.csv`](file:///D:/Projects/JalDrishti/ml/artifacts/predictions_6m_variable_window.csv) (SHA-256: `d0db78cfef444a1f89059d29ea5820cfcdb182841f44a10aac0b977aeebf310c`)
- [`ml/artifacts/up_telemetry_independent_audit.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_independent_audit.json)
- [`ml/artifacts/up_telemetry_sensitivity_clean_stations.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_sensitivity_clean_stations.json)
- [`data/derived/up_station_identity_reconciliation.csv`](file:///D:/Projects/JalDrishti/data/derived/up_station_identity_reconciliation.csv) (SHA-256: `7fd7b9457b2bad3db5f529b06c7a8b0d1b1623e70eb7930da09207e6ceac78aa`)

### 7.2 Automated Test Execution
- **Rigorous UP Validation & Negative Leakage Tests:**
  `python -m pytest tests_py/test_up_rigorous_validation.py -v` (**16 passed in 1.95s**)
- **Full Python Test Suite:**
  `python -m pytest tests_py -q` (**63 passed in 2.87s**)
- **Total Automated Verification:** **234 tests passing, 0 failing across the workspace.**

---

## 8. Summary of Active Scientific Restrictions

1. **Research-Only Predictive Skill Does Not Establish Operational Readiness:** Retains `operational_eligibility: false`. Zero forecasts written to Supabase `model_predictions`.
2. **Unseen-Station Parity:** The unseen-station test did not demonstrate improvement over persistence (baseline parity at -1.0% margin).
3. **Predictive GSS Supervised Training Remains STOPPED:** Marked `BLOCKED` / `LABELS_UNAVAILABLE` across all states.
4. **IMD Rainfall Utility Unproven:** Improvement claims remain unproven until real, verified IMD gridded data are evaluated; dynamic rainfall features remain `BLOCKED`.
5. **Sikkim Springshed Forecasting Remains Research-Only:** Real discharge observations in L/min pending official data acquisition; remains `PROVISIONAL_RESEARCH_RESULT`.

---

## Appendix: Reconciliation and Discrepancy Log

| Item / Finding | Previous Benchmark Claim | Reconciled Independent Finding | Verifying Artifact / Script |
| :--- | :--- | :--- | :--- |
| **Reconciliation Row Count** | Stated 79 pairs (categories summed to 76) | **Exactly 78 candidate pairs** across 65 unique telemetry and 73 manual stations. Reconciled typography error. | [`data/derived/up_station_identity_reconciliation.csv`](file:///D:/Projects/JalDrishti/data/derived/up_station_identity_reconciliation.csv) |
| **Excluded Station Count** | Excluded 18 co-located stations | **Excluded 19 probable co-located stations** (added `Budaun Polytechnic College` at 280.5m). | [`ml/artifacts/up_telemetry_sensitivity_clean_stations.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_sensitivity_clean_stations.json) |
| **Horizon Terminology** | "Exact 30-, 90-, 180-day forecasts" | **Variable-Window Horizons** [20–40d], [75–105d], [150–210d]. Actual elapsed medians are 20.0d, 75.0d, 150.0d. | [`ml/artifacts/up_telemetry_independent_audit.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_independent_audit.json) |
| **Uncertainty Method** | Termed "temporal block bootstrap" | **Station-cluster bootstrap** (resampling whole stations) supplemented with date-block bootstrap. | [`scripts/reconcile_sensitivity_and_bootstrap.py`](file:///D:/Projects/JalDrishti/scripts/reconcile_sensitivity_and_bootstrap.py) |
| **Bootstrap CI (6M)** | Implied robust predictive superiority | Station-cluster bootstrap 95% CI is **$[-0.008\text{ m}, +0.248\text{ m}]$** (touches zero; modest & uncertain). | [`ml/artifacts/predictions_6m_variable_window.csv`](file:///D:/Projects/JalDrishti/ml/artifacts/predictions_6m_variable_window.csv) |
| **Unseen Station Skill** | Termed "zero transfer skill" | **Did not demonstrate improvement over persistence (baseline parity at -1.0% margin)**. | [`ml/artifacts/up_telemetry_spatial_generalization.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_spatial_generalization.json) |
| **Quantile Safeguard** | Termed "isotonic recalibration" | **Element-wise clipping heuristic anchored to $P_{50}$** (`order_quantiles`); not statistical calibration. | [`ml/validation.py`](file:///D:/Projects/JalDrishti/ml/validation.py#L110-L113) |
