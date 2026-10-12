# JAL DRISHTI — Python ML Regression Test Suite Report

**Document Date:** October 13, 2026  
**Status:** Automated & Verified  
**Execution Environment:** Windows PowerShell / Python 3.12 (stdlib `unittest`)  
**Scope:** `tests_py/` regression test suite covering metrics, uncertainty bounds, temporal leakage prevention, and hydrological baselines.

---

## 1. Executive Summary

As mandated by Phase 5 and Phase 6 of the *JalDrishti ML Validation, Forecast Integration & Regression Testing* protocol, an automated Python test suite has been established under `tests_py/`. This suite tests the algorithmic integrity, hydrological baseline benchmarking, and data-leakage safeguards without requiring external database connections or internet access.

The test suite executed with **0 failures and 0 errors across 19 unit tests**.

```text
python -m unittest discover tests_py
...................
----------------------------------------------------------------------
Ran 19 tests in 0.468s

OK
```

---

## 2. Test Suite Architecture

The test suite is structured into 4 isolated test modules under `tests_py/`:

| Module | Test Count | Key Functionalities Tested |
| :--- | :---: | :--- |
| [`tests_py/test_metrics.py`](file:///d:/Projects/JalDrishti/tests_py/test_metrics.py) | 8 | Hand-calculated MAE, RMSE, Bias; NSE perfect/mean/worse scenarios; zero-variance/constant observation handling; empty & NaN filtration; Pinball loss at $\alpha=0.10, 0.50$; $P_{10}$–$P_{90}$ interval coverage; relative RMSE improvement formula. |
| [`tests_py/test_quantile_model.py`](file:///d:/Projects/JalDrishti/tests_py/test_quantile_model.py) | 3 | Multi-output Quantile Gradient Boosting regressor initialization, fitting, output dimension verification, finite value verification, quantile crossing detection ($P_{10} > P_{50}$ or $P_{50} > P_{90}$), and row-wise ordering safeguard behavior. |
| [`tests_py/test_baselines.py`](file:///d:/Projects/JalDrishti/tests_py/test_baselines.py) | 4 | `SeasonalPersistenceBaseline` fitting on multi-year seasonal quarters; quarterly delta calculation; lag-4 forward projection; fallback to lag-1 upon missing 1-year history; NaN propagation when both historical lags are absent. |
| [`tests_py/test_temporal_leakage.py`](file:///d:/Projects/JalDrishti/tests_py/test_temporal_leakage.py) | 4 | Multi-station isolation preventing cross-station pairing; campaign horizon window filtering ($45 \le \text{gap} \le 135$ days); duplicate same-day same-station observation averaging; strict chronological train/test splitting (training target dates $\le \min(\text{test origin date})$). |

---

## 3. Detailed Test Assertions & Results

### 3.1 Mathematical Metrics (`test_metrics.py`)
- **Hand-Calculated Error Metrics:** Verified against known arrays `y = [10.0, 12.0, 14.0]` and `p = [11.0, 11.0, 15.0]`:
  - $\text{MAE} = 1.00000$ (Pass)
  - $\text{RMSE} = 1.00000$ (Pass)
  - $\text{Bias} = +0.33333$ (Pass)
- **Nash-Sutcliffe Efficiency (NSE):**
  - Perfect forecast: $\text{NSE} = 1.0$ (Pass)
  - Climatological mean forecast: $\text{NSE} = 0.0$ (Pass)
  - Poor forecast: $\text{NSE} = -5.0$ (Pass)
  - Constant series: Denominator is 0; returns `None` rather than fabricated $1.0$ or crash (Pass)
  - Series length $< 2$: returns `None` (Pass)
- **Quantile Pinball Loss:** Evaluated at $\alpha = 0.50$ (equivalent to $0.5 \cdot |\text{error}|$) and $\alpha = 0.10$ with asymmetric penalty verification (Pass).
- **Interval Coverage:** Verified coverage fraction calculation for observations falling between $P_{10}$ and $P_{90}$ (Pass).

### 3.2 Quantile Regressor & Crossing Safeguards (`test_quantile_model.py`)
- **Output Structure:** Verified output dictionary contains `'p10'`, `'p50'`, `'p90'` arrays of matching lengths with finite numeric values.
- **Crossing Detection:** Tested Boolean mask generator `quantile_crossings()` against intentional inversion inputs ($P_{10} = 6.0 > P_{50} = 5.0$).
- **Ordering Safeguard:** Evaluated `order_quantiles()` sorting row-wise $[P_{10}, P_{50}, P_{90}]$. Confirmed output enforces numeric monotonicity without altering array shapes.

### 3.3 Hydrological Baselines (`test_baselines.py`)
- **Delta Estimation:** Verified that `SeasonalPersistenceBaseline` accurately calculates quarterly difference between observed depth and $t-4$ lag across 4 distinct hydrological seasons.
- **Lag Fallback:** Verified that when 4-quarter history is missing, the model gracefully falls back to $t-1$ lag plus seasonal offset, and returns `NaN` when neither is present.

### 3.4 Temporal Leakage & Station Isolation (`test_temporal_leakage.py`)
- **Station Independence:** Created synthetic dataset with 2 stations on interleaved observation dates. Verified `build_station_horizon_matrix()` creates separate causal pairs per station without mixing readings across stations.
- **Horizon Gate:** Verified that consecutive readings separated by $<45$ days (interim checks) or $>135$ days (skipped quarterly campaigns) are rejected from the 1-campaign target matrix.
- **Target Overlap Prohibition:** Verified that in chronological train/test splitting, all training target dates are strictly before or equal to the earliest test origin date ($\max(T_{\text{train}}^{\text{target}}) \le \min(T_{\text{test}}^{\text{origin}})$).

---

## 4. Verification Status

1. **Python ML Test Suite:** 19/19 passing (0.468s).
2. **TypeScript Web Test Suite:** 134/134 passing across all 9 suites (0.600s).
3. **Next.js Production Build:** `npm run build` completed successfully in 11.1s; 11/11 pages statically/dynamically optimized with zero lint or type errors.
