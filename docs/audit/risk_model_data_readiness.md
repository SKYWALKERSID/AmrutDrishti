# Groundwater Risk Model: Data Readiness Audit

**Document Version:** 1.0.0  
**Audit Date:** 2026-10-13  
**Status:** Completed Empirical Data Readiness Assessment  
**Governing Directives:** PRD §4.3, §6; TRD §7; Master Vibe-Coding Prompt §5 (Data & Scientific Integrity)

---

## 1. Executive Summary

This report evaluates the readiness of all candidate datasets available in JalDrishti for training and validating predictive groundwater-risk models.

### Key Findings
1. **Primary Observation Dataset:** The verified Central Ground Water Board (CGWB) Madhya Pradesh observation ledger (`data/sources/cgwb_mp_cleaned_proper.csv` and `data/sources/cgwb_cleaned_processed.csv`) spans **2021-01 to 2023-08** (~11 quarters of manual quarterly campaigns).
2. **Station Sample Size:** Across the 6 Bundelkhand pilot blocks, the total count of eligible station-horizon pairs with complete causal lags and valid next-quarter targets is modest:
   * **Bijawar:** 45 eligible pairs (34 train, 11 test across 6 stations).
   * **Rajnagar:** 47 eligible pairs (33 train, 14 test across 7 stations).
   * **Baldeogarh:** 14 eligible pairs (10 train, 4 test across 2 stations) — *Low Sample Count*.
   * **Jatara:** 45 eligible pairs (33 train, 12 test across 7 stations).
   * **Palera:** 5 eligible pairs (2 train, 3 test across 1 station) — *Insufficient Data*.
   * **Tikamgarh Main:** 34 eligible pairs (28 train, 6 test across 4 stations) — *Low Test Sample Count*.
3. **Temporal Decoupling / Prediction Cutoff:** The manual CGWB observation series in the repository ends at **2023-08-20**. Ingestion of live NWIC DWLR telemetry extends certain pilot wells to **2025-11-15**, but gridded environmental companion feeds (historical SMAP, Sentinel-2, GRACE) are not continuously co-located in daily post-2023 time series at individual well heads.
4. **Missing Values & No Zero-Coercion:** Null observations are strictly preserved as `NaN`/`null`. Zero-fill is strictly prohibited for well depth, rainfall anomaly, and satellite anomalies.

---

## 2. Feature-by-Feature Data Readiness Matrix

| Feature | Source | Geographic Resolution | Temporal Resolution | Units | Missingness Rate | Valid Date Range | Historical Availability at Origin ($t$) | Readiness Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Well Depth at Origin ($w_t$)** | CGWB National Hydrograph Network / NWIC | Station Point Coordinates | Quarterly Campaigns (Jan, May, Aug, Nov) | m bgl | 0% (Required for origin) | 2021-01-01 to 2023-08-20 (Manual); 2025-11-15 (Telemetry) | Fully causal (measured at $t$) | **READY (High Quality)** |
| **Lag-1 Depth ($w_{t-1}$)** | CGWB | Station Point | Previous Quarter ($t - 90\text{d}$) | m bgl | ~12% (First campaign of station has no lag) | 2021-05-01 to 2023-08-20 | Fully causal (measured $< t$) | **READY (High Quality)** |
| **Lag-4 / Same-Season Depth ($w_{t-4}$)** | CGWB | Station Point | Previous Year ($t - 365\text{d} \pm 45\text{d}$) | m bgl | ~38% (Stations with $< 1\text{ year}$ history) | 2022-01-01 to 2023-08-20 | Fully causal (measured $< t$) | **READY with Fallback Rules** |
| **Drawdown Velocity ($\Delta w$)** | Derived ($w_t - w_{t-1}$) | Station Point | Quarterly rate of change | m / quarter | ~12% | 2021-05-01 to 2023-08-20 | Fully causal | **READY** |
| **Target Season Code** | Derived calendar quarter | Discrete [0, 1, 2, 3] | Deterministic | Dimensionless | 0% | All dates | Known a priori | **READY** |
| **IMD 0.25° Gridded Rainfall ($P_{\text{cum\_3m}}$)** | India Meteorological Department (IMD) | 0.25° grid (~25 km) | Daily aggregated to 90-day window | mm | ~5% | 1991 to 2023 | Available up to origin $t$ | **READY (Staged / Sample)** |
| **SPI-3 Month** | Derived from IMD gridded series | 0.25° grid | Monthly (3-month window) | Dimensionless $[-4, +4]$ | ~8% | Requires $\ge 20$ baseline years | Available up to origin $t$ | **READY where baseline $\ge 20\text{ yrs}$** |
| **NASA GRACE-FO TWSA** | JPL/CSR RL06 Mascon | 0.5° Mascon (~50 km) | Monthly | cm water equivalent | Available as block aggregate | 2002 to 2023 | Available at regional block level | **RESTRICTED:** Mascon resolution is too coarse ($> 2500\text{ km}^2$) to resolve station-level micro-fractures; used as macro-regional background only. |
| **Sentinel-2 NDVI / NDWI** | ESA Copernicus Sentinel-2 | 10m to 20m optical | 5-day revisit (cloud-gapped) | Index $[-1, +1]$ | High cloud obscuration during monsoon (Jul-Aug) | 2018 to 2026 | Cloud gaps during critical recharge periods | **RESTRICTED:** Cloud cover creates severe monsoon data gaps; unsuitable as mandatory quarterly lag feature. |
| **SMAP Surface Soil Moisture** | NASA SMAP L3 | 9 km grid | 2-3 day revisit | $\text{m}^3/\text{m}^3$ | Coarse resolution; missing deep root-zone physics | 2015 to 2023 | Coarse spatial resolution | **RESTRICTED:** Fails to capture hard-rock unconfined water table dynamics at $> 10\text{m}$ depths. |

---

## 3. Data Leakage & Integrity Audits

### A. Temporal Leakage Audit
* **Causal Ordering:** All lag features use strictly positive backward time shifts ($t-1, t-2, t-4$). No forward-looking operators are used in feature extraction.
* **Target Isolation:** The target observation $y_{t+h}$ is strictly separated from origin features. Only rows with $h \in [45, 135]$ days are admitted as 1-quarter horizons. Missing campaigns (e.g. 180+ days) are rejected from horizon 1.
* **Train/Test Chronological Split:** In accordance with `ml/validation.py`, the test split consists of the final 2 target dates (`2023-05-20` and `2023-08-20`). The training cutoff is set strictly to the earliest test origin date:
  $$\max(\text{train target date}) \le \min(\text{test origin date})$$
  Ensures zero target overlap between training and evaluation partitions.

### B. Spatial Isolation Audit
* **Station Autonomy:** Lag features are computed strictly on the time series of individual monitoring wells (`grouped by station`). Lags are never computed across mixed stations in an unsorted block DataFrame.
* **No Cross-Station Contamination:** Previous observations from Station A are never assigned as the lag feature of Station B.

---

## 4. Readiness Verdict for Model Training

1. **Auto-regressive & Lag-Based Modeling:** **DATA READY.** The station-level CGWB observation series supports causal multi-lag Gradient Boosting and seasonal persistence baselines for pilot blocks Bijawar, Rajnagar, and Jatara.
2. **Deep Learning (LSTM / GRU):** **NOT DATA READY.** With only 30–50 temporal points per block, deep recurrent architectures severely overfit and fail validation gates compared to simple baselines.
3. **Multi-Variate Satellite Integration:** **PARTIALLY READY.** GRACE and NDVI provide valuable macro-regional context for descriptive indicators, but cloud cover and spatial coarseness preclude their use as mandatory predictive features at the individual well level.
