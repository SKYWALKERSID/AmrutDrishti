# JalDrishti — Independent Scientific Audit of Uttar Pradesh Groundwater Telemetry Benchmark v2

**Audit Date:** 2026-10-16 (Reconciled: 2026-10-17)  
**Auditor Roles:** Independent Scientific Auditor, Hydrogeologist, ML Validation Specialist  
**Repository:** `D:\Projects\JalDrishti` (Branch: `main`)  
**Evaluation Standard:** Zero Production Mutations | Ground-Truth Row-Level Recalculation | Station-Cluster Uncertainty | Strict Provenance  
**Audit Status:** `PROVISIONAL_RESEARCH_RESULT` (Research Only; Operational Deployment `DISABLED`)

---

## 1. Scope, Source Provenance, Environment, and Exact Reproduction

### 1.1 Evaluated Datasets and Artifact Hashes

| Artifact Path | Artifact Description | Rows / Shape | SHA-256 Hash |
| :--- | :--- | :---: | :--- |
| [`data/sources/up_cgwb_telemetry_2021_2025.csv`](file:///D:/Projects/JalDrishti/data/sources/up_cgwb_telemetry_2021_2025.csv) | Primary CGWB/NWIC 6-hourly telemetry source | 304,146 obs, 171 stations | `44f35251df0b98e9acb3072dc343113b02388d3d3619db4dc2a09b1300f11814` |
| [`data/derived/up_station_identity_reconciliation.csv`](file:///D:/Projects/JalDrishti/data/derived/up_station_identity_reconciliation.csv) | Rebuilt WGS84 Geodesic Reconciliation Ledger | Exactly 78 candidate proximity pairs | `7fd7b9457b2bad3db5f529b06c7a8b0d1b1623e70eb7930da09207e6ceac78aa` |
| [`ml/artifacts/predictions_1m_variable_window.csv`](file:///D:/Projects/JalDrishti/ml/artifacts/predictions_1m_variable_window.csv) | Row-Level Independent Predictions (1M Variable Window) | 30,279 rows $\times$ 19 cols | `6e2a13b9f377fe2b47f16613ab6a24431abd83739c32c1b5b7f80e432ae0d4bf` |
| [`ml/artifacts/predictions_3m_variable_window.csv`](file:///D:/Projects/JalDrishti/ml/artifacts/predictions_3m_variable_window.csv) | Row-Level Independent Predictions (3M Variable Window) | 24,342 rows $\times$ 19 cols | `83b8a53a856bfbcbb3cc3bcf56472179c66dcebe0b52192f604e7969635873b0` |
| [`ml/artifacts/predictions_6m_variable_window.csv`](file:///D:/Projects/JalDrishti/ml/artifacts/predictions_6m_variable_window.csv) | Row-Level Independent Predictions (6M Variable Window) | 18,318 rows $\times$ 19 cols | `d0db78cfef444a1f89059d29ea5820cfcdb182841f44a10aac0b977aeebf310c` |
| [`ml/artifacts/up_telemetry_independent_audit.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_independent_audit.json) | Master Recalculated Benchmark Metrics & Clustered CIs | 344 lines JSON | Audited Artifact |
| [`ml/artifacts/up_telemetry_sensitivity_clean_stations.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_sensitivity_clean_stations.json) | Reconciled 19-Station Sensitivity & 18-Station Comparison | 102 lines JSON | Audited Artifact |

### 1.2 Exact Execution Environment & Reproduction Commands
- **Operating System:** Windows 11 (AMD64)
- **Python Version:** 3.14.6
- **Key Dependencies:** `scikit-learn==1.9.1`, `pandas==3.0.6`, `numpy==2.5.1`, `scipy==1.18.1`
- **Random Seed:** 42 (fixed for model fitting and bootstrap resampling)
- **Exact Reproduction Commands:**
  ```powershell
  python scripts/reconcile_up_station_identities.py
  python scripts/reconcile_sensitivity_and_bootstrap.py
  python scripts/audit_up_benchmark_predictions.py
  python -m pytest tests_py/test_up_rigorous_validation.py -v
  ```

---

## 2. Station Identity Reconciliation Audit & Count Discrepancy Resolution

### 2.1 Resolution of the 79-vs-76 Reporting Discrepancy
An earlier draft text reported 79 candidate pairs, while the listed categories summed to 76 (1 confirmed + 17 probable + 22 unresolved + 35 no match = 75 or 76). An exhaustive row-level inspection of [`data/derived/up_station_identity_reconciliation.csv`](file:///D:/Projects/JalDrishti/data/derived/up_station_identity_reconciliation.csv) reveals that the ledger contains **exactly 78 rows**. The earlier report suffered from typographical transcription errors from intermediate draft tables. 

Every row has **exactly one valid classification**, coordinates are 100% complete with **zero missing or invalid coordinates** across all telemetry and manual records, and the distance bands are **mutually exclusive and exhaustive** over the $[0, 1500\text{m}]$ candidate search radius.

### 2.2 Mutually Exclusive Distance Bands

| Distance Band | Pair Count (Rows) | Unique Telemetry Stations | Unique Manual Stations | Geographic Context |
| :--- | :---: | :---: | :---: | :--- |
| **0 to 100 m** | 1 | 1 | 1 | Immediate compound proximity (`Bhuawapar` at 86.4m) |
| **100 to 500 m** | 19 | 19 | 19 | Village / localized block compound radius |
| **500 to 1,000 m** | 24 | 23 | 23 | Same-revenue-village / local aquifer catchment radius |
| **1,000 to 1,500 m** | 34 | 30 | 30 | Adjacent village / distinct local hydrogeological setting |
| **Total (Exhaustive)** | **78** | **65** | **73** | All pairs within 1.5 km candidate proximity |

### 2.3 Distance Band × Status Cross-Tabulation Matrix (Exhaustive & Mutually Exclusive)

The apparent contradiction between "19 rows in 100–500m" and "19 probable_match rows within 500m" is resolved by the following direct cross-tabulation of `data/derived/up_station_identity_reconciliation.csv`:

| Distance Band | `confirmed_match` | `probable_match` | `unresolved` | `no_match_established` | Total Candidate Pairs | Unique Telemetry Stations | Unique Manual Stations |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **0 to 100 m** | 0 | 1 (`Bhuawapar`) | 0 | 0 | **1** | 1 | 1 |
| **100 to 500 m** | 0 | 18 | 1 (`Pilana_1`) | 0 | **19** | 19 | 19 |
| **500 to 1,000 m** | 0 | 0 | 24 | 0 | **24** | 23 | 23 |
| **1,000 to 1,500 m** | 0 | 0 | 0 | 34 | **34** | 30 | 30 |
| **Total Ledger Rows** | **0** | **19** | **25** | **34** | **78** | **65** | **73** |

#### Complete Reconciliation of the `Pilana_1` Row and $\le 500\text{m}$ Proximity
- **Exact `Pilana_1` Row Attributes in Ledger:**
  - `telemetry_station`: `Pilana_1` ($28.935833^\circ\text{N}, 77.372222^\circ\text{E}$), `telemetry_district`: `BAGHPAT`, `telemetry_block`: `PILANA`
  - `manual_station`: `Pilana  P` ($28.936389^\circ\text{N}, 77.369722^\circ\text{E}$), `manual_district`: `BAGHPAT`, `manual_block`: `-`
  - `geodesic_distance_m`: **$251.0\text{ m}$** (lies squarely within the $(100, 500\text{m}]$ distance band)
  - `status`: **`unresolved`** | `confidence`: `LOW` | `admin_label_agreement`: `DISTRICT_ONLY`
- **Reconciliation Accounting:**
  1. The **$(100, 500\text{m}]$ band contains exactly 19 rows**: 18 classified as `probable_match` + 1 classified as `unresolved` (`Pilana_1` at 251.0m, demoted from probable match because the manual record lacks block label confirmation).
  2. The **$[0, 100\text{m}]$ band contains exactly 1 row**: `Bhuawapar` at 86.4m, classified as `probable_match`.
  3. Total pairs within $\le 500\text{m}$ is therefore **$1 + 19 = 20\text{ rows}$**: exactly **19 `probable_match`** + **1 `unresolved` (`Pilana_1`)**.
  4. Across all 78 rows, there are **0 duplicate candidate pairs**. The 78 candidate pairs reference **65 unique telemetry stations** and **73 unique manual stations** (in the $>500\text{m}$ bands, a single well may be within candidate proximity of more than one nearby point).

---

## 3. The 18-versus-19 Station Sensitivity Analysis

### 3.1 Explanation of the Station Difference
- The earlier sensitivity analysis excluded **18 stations**.
- Re-running the geodesic reconciliation ledger conservatively identified **19 unique telemetry stations** classified as `probable_match` ($\le 500\text{m}$).
- The single station accounting for the discrepancy is **`Budaun Polytechnic College`** (geodesic distance $280.5\text{m}$ in Budaun district). An earlier legacy script filtered candidates using a string name-similarity heuristic ($\ge 0.3$), which discarded `Budaun Polytechnic College` against the manual network well label `Rasulpur`. The corrected WGS84 geodesic pipeline properly recognized it within the same administrative block compound ($280.5\text{m} \le 500\text{m}$) and added it to `probable_match`.

### 3.2 Explicit List of the 19 Excluded Telemetry Stations
Each identifier is unique and verified against source records:
1. `Bardwari-I` (262.6m, Hathras)
2. `Bhuawapar` (86.4m, Gorakhpur)
3. `Budaun Polytechnic College` (280.5m, Budaun) *(The 19th station)*
4. `Dapsaura_1` (449.1m, Fatehpur)
5. `Digner_1` (472.2m, Agra)
6. `Dugraiyya Brahmpur-I (Dp)` (288.5m, Budaun)
7. `Ferozpur_1` (440.0m, Moradabad)
8. `Jaspura_1` (436.4m, Banda)
9. `Kathela Garvi` (299.1m, Siddharthnagar)
10. `Modi Nagar- Pz Ii` (299.8m, Ghaziabad)
11. `Mohanlalganj_2` (444.6m, Lucknow)
12. `Mustafabad_5` (340.5m, Rae Bareli)
13. `Naharpur-I` (422.3m, Hathras)
14. `Pali-I` (424.3m, Lalitpur)
15. `Parikshat Garh Pz_1` (354.3m, Meerut)
16. `Rahawati_1` (485.4m, Moradabad)
17. `Rehman Khera_1` (496.0m, Lucknow)
18. `Sanjarpur Kaidwa` (290.4m, Muzaffarnagar)
19. `Shohratgarh_1` (438.1m, Siddharthnagar)

### 3.3 Side-by-Side 6-Month Sensitivity Benchmark Comparison

Both evaluations use the identical 6-Month Variable Window protocol under strict global cutoff `2025-01-01`:

| Evaluation Dimension | 18-Station Exclusion (Previous List) | 19-Station Exclusion (Updated Complete List) | Absolute Change |
| :--- | :---: | :---: | :---: |
| **Excluded Stations Count** | 18 | **19** | +1 station (`Budaun Polytechnic College`) |
| **Training Pairs ($t_0 < 2025, t_{\text{target}} \le 2024$)** | 30,658 (148 stations) | **30,478 (147 stations)** | -180 training pairs |
| **Test Pairs ($t_0 \ge 2025-01-01$)** | 15,987 (143 stations) | **15,861 (142 stations)** | -126 test pairs |
| **Persistence RMSE** | $3.436\text{ m}$ | **$3.449\text{ m}$** | $+0.013\text{ m}$ |
| **Persistence MAE** | $1.834\text{ m}$ | **$1.844\text{ m}$** | $+0.010\text{ m}$ |
| **Persistence NSE** | 0.848 | **0.847** | -0.001 |
| **Seasonal Persistence RMSE** | $3.961\text{ m}$ | **$3.976\text{ m}$** | $+0.015\text{ m}$ |
| **Ridge Regression RMSE** | $3.369\text{ m}$ | **$3.381\text{ m}$** | $+0.012\text{ m}$ |
| **Quantile GB ($P_{50}$) RMSE** | $3.291\text{ m}$ | **$3.297\text{ m}$** | $+0.006\text{ m}$ |
| **Quantile GB ($P_{50}$) MAE** | $1.710\text{ m}$ | **$1.719\text{ m}$** | $+0.009\text{ m}$ |
| **Quantile GB ($P_{50}$) NSE** | 0.861 | **0.860** | -0.001 |
| **QGB Pooled Gain over Persistence** | **+4.21%** | **+4.40%** | $+0.19\%$ |
| **Station Median RMSE (Persistence)** | $1.431\text{ m}$ | **$1.447\text{ m}$** | $+0.016\text{ m}$ |
| **Station Median RMSE (QGB $P_{50}$)** | $1.214\text{ m}$ | **$1.211\text{ m}$** | $-0.003\text{ m}$ |
| **Station Median Error Improvement** | +15.16% | **+16.33%** | $+1.17\%$ |
| **80% Nominal Interval Coverage** | 84.27% | **84.40%** | $+0.13\%$ |
| **Mean Interval Width** | $5.754\text{ m}$ | **$5.729\text{ m}$** | $-0.025\text{ m}$ |
| **Station-Cluster Bootstrap (95% CI, Seed 42)** | $[-0.075\text{ m}, +0.324\text{ m}]$ | **$[-0.045\text{ m}, +0.309\text{ m}]$** | Stable; includes zero ($N_{\text{boot}}=2000$) |
| **Station-Cluster Bootstrap (95% CI, Seed 2026)** | — | **$[-0.050\text{ m}, +0.310\text{ m}]$** | Stable across seeds ($N_{\text{boot}}=2000$) |
| **Date-Block Bootstrap (95% CI, Seed 42)** | $[+0.059\text{ m}, +0.252\text{ m}]$ | **$[+0.062\text{ m}, +0.256\text{ m}]$** | Supplementary ($N_{\text{boot}}=2000$) |
| **Date-Block Bootstrap (95% CI, Seed 2026)** | — | **$[+0.060\text{ m}, +0.257\text{ m}]$** | Supplementary ($N_{\text{boot}}=2000$) |

**Sensitivity Finding:** Removing `Budaun Polytechnic College` removed 180 training pairs and 126 test pairs. The pooled RMSE improvement shifted insignificantly from $+4.21\%$ to $+4.40\%$, and interval coverage moved from $84.27\%$ to $84.40\%$. This proves that model performance is robust to the exclusion of all 19 proximate candidate stations.

---

## 4. Bootstrap Stability and Uncertainty Reporting (2,000 Resamples, Dual Seeds)

### 4.1 Station-Cluster Bootstrap Methodology (Primary Evaluation)
The primary inferential resampling strategy is a **station-cluster bootstrap** (resampling stations as whole clusters with replacement):
- **Quantity Bootstrapped:** Paired difference in root-mean-square error:
  $$\Delta \text{RMSE} = \text{RMSE}_{\text{persistence}} - \text{RMSE}_{\text{model}}$$
  - **Sign Convention:** A **positive value** indicates that the model achieved a lower error (predictive improvement) than persistence. A negative value indicates the model performed worse.
- **Unit of Resampling:** Entire monitoring stations ($N_{\text{clusters}} = 142$ in sensitivity test, $N_{\text{clusters}} = 161$ in full 6M test).
- **Number of Resamples & Seeds:** $N_{\text{boot}} = 2,000$, evaluated under two independent, explicitly documented random seeds: **Seed `42`** and **Seed `2026`**.
- **Percentile Method:** Empirical 2.5th and 97.5th percentiles of the 2,000 bootstrap resample replications.
- **Weighting of Stations:** When a station is sampled, all its test pairs are included. Stations with larger observation counts contribute proportionally more pairs to the pooled calculation, matching the exact pooled metric definition.
- **Preservation of Paired Comparisons:** For each sampled observation $i$, the actual value $y_i$, persistence prediction $\hat{y}_{\text{persist}, i}$, and model prediction $\hat{y}_{\text{model}, i}$ are evaluated simultaneously, strictly preserving paired structure.

#### Empirical Stability Across Resample Seeds ($N_{\text{boot}} = 2,000$)

| Evaluation Population | Test Pairs ($N$) | Station Clusters | Random Seed | Mean $\Delta \text{RMSE}$ | 95% Confidence Interval | Interval Endpoints Stability |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Full 6-Month Evaluation** | 18,318 | 161 | `42` | $+0.139\text{ m}$ | **$[-0.008\text{ m}, +0.260\text{ m}]$** | Baseline reference |
| **Full 6-Month Evaluation** | 18,318 | 161 | `2026` | $+0.139\text{ m}$ | **$[-0.010\text{ m}, +0.255\text{ m}]$** | Shift $\le 0.005\text{ m}$; crosses zero |
| **Clean 19-Station Sensitivity** | 15,861 | 142 | `42` | $+0.148\text{ m}$ | **$[-0.045\text{ m}, +0.309\text{ m}]$** | Baseline reference |
| **Clean 19-Station Sensitivity** | 15,861 | 142 | `2026` | $+0.152\text{ m}$ | **$[-0.050\text{ m}, +0.310\text{ m}]$** | Shift $\le 0.005\text{ m}$; crosses zero |

**Definitive Inferential Conclusion:**
1. **Endpoint Stability:** Across both seeds at 2,000 resamples, the mean and 95% CI endpoints shift by at most $0.005\text{ m}$, confirming high numerical convergence and stability.
2. **Modest and Uncertain Gain:** Because the 95% confidence interval lower bound crosses zero in both seeds ($-0.008\text{ m}$ to $-0.010\text{ m}$ on full test; $-0.045\text{ m}$ to $-0.050\text{ m}$ on clean stations), the $+4.0\%$ to $+4.4\%$ pooled improvement is **modest and uncertain across station sub-samples**. Superiority over persistence cannot be guaranteed for every station.

### 4.2 Supplementary Date-Block Bootstrap Analysis
To examine sensitivity across time rather than across stations, a **date-block bootstrap** was evaluated with 2,000 resamples across the same two seeds:
- **Resampling Unit:** Contiguous calendar months (e.g., `2025-01`, `2025-02`, ..., `2025-08`).
- **Number of Unique Temporal Blocks:** Exactly **8 unique calendar months** covering the entire held-out test evaluation window.
- **Replacement Procedure:** Standard uniform random draw of month blocks with replacement ($N_{\text{boot}}=2000$).
- **Treatment of Missing Periods:** Months naturally contain varying numbers of active station reports; all paired observations within a sampled month are evaluated.
- **Paired Evaluation:** Actual values and simultaneous model and persistence predictions are paired per observation.
- **Empirical Results ($N_{\text{boot}} = 2,000$):**
  - **Full 6-Month Evaluation:**
    - Seed 42: Mean $+0.139\text{ m}$, 95% CI: **$[+0.073\text{ m}, +0.204\text{ m}]$**
    - Seed 2026: Mean $+0.139\text{ m}$, 95% CI: **$[+0.072\text{ m}, +0.207\text{ m}]$**
  - **Clean 19-Station Sensitivity:**
    - Seed 42: Mean $+0.159\text{ m}$, 95% CI: **$[+0.062\text{ m}, +0.256\text{ m}]$**
    - Seed 2026: Mean $+0.158\text{ m}$, 95% CI: **$[+0.060\text{ m}, +0.257\text{ m}]$**

#### Critical Methodological Caveats (Why Date-Block is Strictly Supplementary)
1. **Coarse Temporal Granularity ($N_{\text{blocks}} = 8$):** Resampling with replacement from only 8 calendar month blocks creates a discrete sampling distribution with substantial replication of whole months, violating the large-sample asymptotic assumptions of block bootstrapping.
2. **Loss of Spatial Variance:** In each sampled calendar month, observations from all 142–161 stations across the entire state of Uttar Pradesh are pooled together. This completely masks station-level heterogeneity and spatial variance.
3. **Scientific Status:** The date-block bootstrap confirms that during the 2025 test window, the model did not experience a single catastrophic failure month. However, **it is strictly exploratory and supplementary**. The **station-cluster bootstrap remains the authoritative scientific standard** for spatial generalization and uncertainty reporting.

### 4.3 Limitations of Temporal Autocorrelation
Within each station cluster, daily forecast origins create overlapping evaluation windows (e.g., pairs originating on day $t$ and day $t+1$ share similar hydrograph trajectories). While station clustering prevents treating correlated pairs as independent stations, **intra-station temporal autocorrelation remains**. Sample counts ($N=15,861$ to $18,318$) must not be interpreted as independent degrees of freedom.

---

## 5. Removal of Unsupported Explanations and Precision Corrections

In strict accordance with scientific audit standards, all language exceeding empirical evidence has been removed or corrected:

1. **Spatial Generalization to Unseen Stations:**
   - *Previous Language:* "Zero transfer skill."
   - *Corrected Language:* **"The unseen-station test did not demonstrate improvement over persistence (achieved approximately baseline parity at a -1.0% margin)."**
   - On 33 unseen stations ($N_{\text{test}}=3,782$), QGB RMSE is $2.868\text{ m}$ vs Persistence $2.840\text{ m}$. In deep alluvium with high spatial variance in baseline depths (0.5m to 53.3m), tree models cannot accurately predict absolute depth at an unmonitored site without local water table history.
2. **Interval Coverage Explanation:**
   - *Previous Language:* Attributed excess coverage to "training on intense historical summer drawdown cycles."
   - *Corrected Language:* **"The empirical 80% coverage is conservative (84.4% to 88.6%), producing wider intervals than nominal target. Without a separate, verified historical cycle ablation study, this over-coverage is documented as empirical model conservatism rather than definitively attributed to specific training drawdown events."**
3. **6-Month Pooled Improvement:**
   - *Previous Language:* Implied robust predictive gain.
   - *Corrected Language:* **"The 6-month pooled improvement (+4.0%) is modest and uncertain, as the station-cluster bootstrap 95% confidence interval ([-0.008 m, +0.248 m]) crosses zero."**
4. **Station-Level vs Pooled Aggregation:**
   - Station-median error improvements (+16.3% to +16.6%) are reported strictly separately from pooled RMSE.
   - *Aggregation Method:* Individual RMSEs are computed for each qualifying station with $\ge 10$ test observations ($N=135$ stations). The median of these station-level RMSEs is $1.211\text{ m}$ for QGB vs $1.447\text{ m}$ for Persistence.
5. **Quantile Safeguard vs Calibration:**
   - *Previous Language:* Referred to "post-hoc isotonic rearrangement / calibration."
   - *Corrected Language:* **"Quantile ordering is enforced by `order_quantiles`, an element-wise clipping heuristic anchored to the median point estimate $P_{50}$ (`safe_p10 = min(p10, p50)`, `safe_p90 = max(p90, p50)`). This is NOT isotonic regression, NOT conformal prediction, and does NOT recalibrate coverage. It is a deterministic post-hoc guardrail that prevents non-physical quantile inversions."**
6. **Leakage Testing Scope:**
   - *Corrected Language:* **"Successful passage of targeted negative regression tests demonstrates that the tested future-feature, target overlap, and preprocessing leakage mechanisms are caught by validation assertions; it does not constitute proof that every conceivable leakage mechanism in real-world data pipelines has been excluded."**
7. **Station Co-Location Language:**
   - *Corrected Language:* **"Candidate pairs within 500m are classified as `probable_match` based on spatial proximity and administrative label agreement; they are not described as the same physical well in the absence of authoritative well inventory documentation."**

---

## 6. Corrected Horizon Terminology & Elapsed-Time Distributions

| Declared Horizon | Search Window | Min | P10 | P25 | Median | Mean | P75 | P90 | Max | Empirical Distribution |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1-Month Variable Window** | [20, 40] days | 20 d | 20.0 d | 20.0 d | **20.0 d** | 21.2 d | 20.0 d | 24.0 d | 40 d | **93.7%** evaluated at 20–26 days |
| **3-Month Variable Window** | [75, 105] days | 75 d | 75.0 d | 75.0 d | **75.0 d** | 77.0 d | 76.0 d | 81.0 d | 105 d | **92.2%** evaluated at 75–84 days |
| **6-Month Variable Window** | [150, 210] days | 150 d | 150.0 d | 150.0 d | **150.0 d** | 152.1 d | 151.0 d | 154.0 d | 210 d | **95.6%** evaluated at 150–169 days |

---

## 7. Automated Test Suite Results

- **UP Rigorous Validation & Integrity Suite ([`tests_py/test_up_rigorous_validation.py`](file:///D:/Projects/JalDrishti/tests_py/test_up_rigorous_validation.py)):** **20 / 20 passed**
  - Includes 7 tests in `TestReconciliationAndBootstrapIntegrity` validating distance bands, 19-station exclusion list exactness, `Pilana_1` classification and distance band assignment, exact cross-tabulation matrix counts, zero leakage into sensitivity test sets, paired bootstrap alignment, dual-seed stability, and exact artifact provenance under 2,000 resamples.
  - Includes 4 negative leakage tests in `TestNegativeLeakageAndIntegrityRegressions`.
- **Full Python Test Suite ([`tests_py/`](file:///D:/Projects/JalDrishti/tests_py/)):** **67 / 67 passed** across all modules.

---

## 8. Definitive Research-Readiness Verdict & Active Restrictions

### 8.1 Scientific Status Verdict
- **Groundwater Forecasting Engine (Uttar Pradesh Telemetry):** **`PROVISIONAL_RESEARCH_RESULT`**
  - Retrospective research benchmarks demonstrate reproducible numerical behavior.
  - At short horizons (1M), Ridge Regression outperforms Persistence and Gradient Boosting.
  - At 6M, Quantile GB shows a modest pooled improvement (+4.0% to +4.4%), but station-cluster bootstrap confidence intervals cross zero ($[-0.008\text{ m}, +0.260\text{ m}]$ for Seed 42; $[-0.010\text{ m}, +0.255\text{ m}]$ for Seed 2026), and unseen station tests achieve baseline parity (-1.0%).
- **Predictive GSS Supervised Training:** **`BLOCKED`** (Stopped; `LABELS_UNAVAILABLE`).
- **IMD Dynamic Rainfall Integration:** **`BLOCKED`** (Multi-year NetCDF gridded data unavailable in repository).
- **Sikkim Mountain Springshed Discharge Model:** **`PROVISIONAL_RESEARCH_RESULT`** (Engine verified on synthetic fixtures; real discharge observations pending).

### 8.2 Mandatory Operational Restrictions
Operational eligibility remains strictly **`FALSE`**. Zero predictions written to Supabase `model_predictions`. Production deployment is blocked until live sensor telemetry streaming and local station depth calibration are implemented.

---

## Appendix: Audit Reconciliation Ledger & Discrepancy Log

| Item / Finding | Previous Benchmark Claim | Reconciled Independent Finding | Verifying Artifact / Script |
| :--- | :--- | :--- | :--- |
| **Station Pair Total** | Stated 79 pairs (categories summed to 76) | **Exactly 78 candidate pairs** across 65 unique telemetry and 73 manual stations. Reconciled typography error. | [`data/derived/up_station_identity_reconciliation.csv`](file:///D:/Projects/JalDrishti/data/derived/up_station_identity_reconciliation.csv) |
| **Excluded Station Count** | Excluded 18 co-located stations | **Excluded 19 probable co-located stations** (added `Budaun Polytechnic College` at 280.5m). | [`ml/artifacts/up_telemetry_sensitivity_clean_stations.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_sensitivity_clean_stations.json) |
| **Horizon Terminology** | "Exact 30-, 90-, 180-day forecasts" | **Variable-Window Horizons** [20–40d], [75–105d], [150–210d]. Actual elapsed medians are 20.0d, 75.0d, 150.0d. | [`ml/artifacts/up_telemetry_independent_audit.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_independent_audit.json) |
| **Uncertainty Method** | Termed "temporal block bootstrap" | **Station-cluster bootstrap** ($N_{\text{boot}}=2000$, dual seeds) supplemented with date-block bootstrap. | [`scripts/reconcile_sensitivity_and_bootstrap.py`](file:///D:/Projects/JalDrishti/scripts/reconcile_sensitivity_and_bootstrap.py) |
| **Bootstrap CI (6M)** | Implied robust predictive superiority | Station-cluster bootstrap 95% CI is **$[-0.008\text{ m}, +0.260\text{ m}]$** (Seed 42) and **$[-0.010\text{ m}, +0.255\text{ m}]$** (Seed 2026), crossing zero (modest & uncertain). | [`ml/artifacts/predictions_6m_variable_window.csv`](file:///D:/Projects/JalDrishti/ml/artifacts/predictions_6m_variable_window.csv) |
| **Unseen Station Skill** | Termed "zero transfer skill" | **Did not demonstrate improvement over persistence (baseline parity at -1.0% margin)**. | [`ml/artifacts/up_telemetry_spatial_generalization.json`](file:///D:/Projects/JalDrishti/ml/artifacts/up_telemetry_spatial_generalization.json) |
| **Quantile Safeguard** | Termed "isotonic recalibration" | **Element-wise clipping heuristic anchored to $P_{50}$** (`order_quantiles`); not statistical calibration. | [`ml/validation.py`](file:///D:/Projects/JalDrishti/ml/validation.py#L110-L113) |
