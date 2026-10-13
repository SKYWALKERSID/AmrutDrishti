# Groundwater Risk Model: Independent Baseline & ML Evaluation Report

**Document Version:** 1.0.0  
**Evaluation Date:** 2026-10-13  
**Status:** Completed Non-Persisting Evaluation across All Pilot Units  
**Execution Command:** `python -m ml.evaluate_independent`  
**Governing Directives:** PRD §4.3, §6; TRD §7; Master Vibe-Coding Prompt §5 (Scientific Integrity)

---

## 1. Executive Summary

In compliance with Phase D of the Mission Directives and Section 5 of the JalDrishti Workspace Rules, we executed an independent, non-persisting evaluation comparing:
1. **Simple Last-Observation Persistence Baseline:** $\hat{y}_t = y_{t-1}$.
2. **Seasonal Persistence Baseline:** $\hat{y}_t = y_{t-4} + \Delta_{\text{season}}$.
3. **Multi-Output Quantile Gradient Boosting Regressor (Quantile GB):** $P_{10}, P_{50}, P_{90}$ pinball loss estimates.

### Formal Scientific Validation Gates (WMO & TRD v1.0)
* **Gate 1:** $\text{RMSE} \le 1.50\text{ m}$.
* **Gate 2:** Nash-Sutcliffe Efficiency $\text{NSE} \ge 0.65$.
* **Gate 3:** Improvement over baseline $\ge 15\%$.

---

## 2. Empirical Evaluation Results

### Part A: Reproduction of Legacy Pooled-Data Training Protocol (`ml/train.py`)
*Protocol: Row-pooled block DataFrame, 80/20 train/test split, Palera synthetic tail fallback.*

| Block | Train $N$ | Test $N$ | Fallback Triggered | Train/Test Overlap Rows | ML RMSE (m) | Seasonal Baseline RMSE (m) | NSE | Quantile Crossing Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Bijawar** | 53 | 11 | False | 0 | 3.593 | 4.984 | -0.854 | 0.00 |
| **Rajnagar** | 55 | 14 | False | 0 | 3.071 | 4.014 | -0.128 | 0.07 |
| **Baldeogarh** | 12 | 3 | False | 0 | 0.844 | 1.909 | 0.392 | 0.33 |
| **Jatara** | 50 | 12 | False | 0 | 1.578 | 2.281 | -0.075 | 0.00 |
| **Palera** | 9 | 3 | **True** | **3 (100% test leakage)** | **0.001** | 1.296 | **1.000** | 0.00 |
| **Tikamgarh** | 39 | 9 | False | 0 | 3.612 | 2.153 | -0.184 | 0.00 |

#### Critical Finding on Legacy Training Protocol:
In Palera, because eligible data was fewer than 10 rows, the legacy script executed a fallback:
`tr = m.dropna(...); te = tr.tail(3)`.
This caused **100% of the test set to be identical to the training set**, resulting in an artificial $\text{RMSE} = 0.001\text{m}$ and $\text{NSE} = 1.000$. **This is textbook train/test leakage.** The new evaluation protocol completely eliminates this fallback and flags Palera honestly as **INSUFFICIENT DATA**.

---

### Part B: Station-Aware One-Campaign-Ahead Protocol (`ml/validation.py`)
*Protocol: Station-grouped lag construction, strictly causal horizon $h \in [45, 135]$ days, chronological split on last 2 target dates (`2023-05-20` to `2023-08-20`), zero target overlap.*

| Block | Eligible $N$ | Train $N$ | Test $N$ | Test Stations | ML MAE (m) | ML RMSE (m) | Persistence RMSE (m) | Seasonal RMSE (m) | RMSE Impr. vs Persist. | NSE | $P_{10}\text{-}P_{90}$ Coverage | Mean Width (m) | Crossing Rate | Gates Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Bijawar** | 45 | 34 | 11 | 6 | 2.225 | 2.918 | 4.349 | 3.241 | **+32.9%** | 0.483 | 73% | 5.91m | 0.36 | **FAIL (NSE < 0.65)** |
| **Rajnagar** | 47 | 33 | 14 | 7 | 2.482 | 3.533 | 3.536 | 1.881 | +0.1% | -0.758 | 50% | 2.84m | 0.43 | **FAIL (All gates)** |
| **Baldeogarh** | 14 | 10 | 4 | 2 | 1.604 | 2.478 | 1.656 | 1.211 | -49.7% | -3.659 | 75% | 5.62m | 0.00 | **FAIL (Low N < 10)** |
| **Jatara** | 45 | 33 | 12 | 7 | 1.459 | 1.580 | 1.780 | 2.961 | +11.2% | -0.078 | 42% | 2.38m | 0.00 | **FAIL (RMSE > 1.50)** |
| **Palera** | 5 | 2 | 3 | 1 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **INSUFFICIENT DATA** |
| **Tikamgarh** | 34 | 28 | 6 | 4 | 3.127 | 3.994 | 4.325 | 2.680 | +7.7% | 0.068 | 33% | 3.30m | 0.00 | **FAIL (Low N < 10)** |

---

## 3. Detailed Scientific Analysis

### 1. Persistence vs. Machine Learning
* In **Bijawar**, Quantile GB improved substantially over naive persistence (+32.9% RMSE reduction: 2.918m vs 4.349m), but its NSE of 0.483 fell short of the hydrological standard ($0.65$).
* In **Rajnagar** and **Baldeogarh**, simple seasonal naive benchmarks outperformed the Gradient Boosting model ($\text{RMSE} = 1.881\text{m}$ and $1.211\text{m}$ vs ML's $3.533\text{m}$ and $2.478\text{m}$). In hard-rock aquifers where recharge is predominantly a cyclical annual phenomenon driven by the monsoon, complex non-linear models without deep hydrogeological parameters (e.g., fracture connectivity, specific yield) struggle to beat the annual seasonal cycle.

### 2. Empirical Uncertainty Coverage & Quantile Crossings
* For a nominal 80% prediction interval ($P_{10}$ to $P_{90}$), empirical coverage ranged from **33% to 75%**, falling below nominal calibration.
* Quantile crossing was observed in **36% of Bijawar predictions** and **43% of Rajnagar predictions** when using unconstrained raw regressors.
* This proves that independent single-quantile gradient boosting regressors **cannot be presented as statistically calibrated prediction intervals** without conformal calibration or post-processing monotonicity enforcement.

---

## 4. Operational Gating Decision

Based on these empirical results:
1. **Model Status:** The Quantile Gradient Boosting model must remain designated as a **Research Prototype (`research_prototype`)**.
2. **Operational Eligibility:** Set strictly to `operationalEligibility = false`.
3. **Mandatory Disclaimer:** The serving layer in `src/app/api/forecast/route.ts` must return the transparent safeguard notice:
   > *"Research Prototype Notice: Groundwater forecasts represent statistical quantile estimates trained on historical CGWB manual well records. Intervals are uncalibrated and numerical safeguards do not constitute statistical calibration. Not authorized for operational disaster declarations without field verification."*
4. **No Automated Promotion:** The model is prevented from authorizing financial resource allocations, disaster declarations, or overriding field verification.
