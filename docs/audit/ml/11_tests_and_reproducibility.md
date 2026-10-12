# JAL DRISHTI — Tests & Reproducibility Audit
**Audit Date**: October 13, 2026  
**Document**: `11_tests_and_reproducibility.md`  

---

## 1. Test Suite Architecture & Coverage Breakdown

The repository contains an automated test suite executed via `npm test` using the native Node.js test runner (`node:test` + `tsx`).

| Test Suite Category | Number of Test Files | Test Count | Pass Rate | What is Actually Tested | What is Missing |
|---|---|---|---|---|---|
| **TypeScript Service Tests** | 12 files | 86 tests | **100% (86/86)** | Boundary validation, spatial aggregation, OLS trend arithmetic, schema null preservation, database RLS policies. | Does not test Python ML pipelines. |
| **API & Routing Tests** | 6 files | 32 tests | **100% (32/32)** | Bilingual route mapping, 404 handling, keyboard ARIA attributes, mock fallback handling. | Does not verify model inference accuracy. |
| **Safety & Claims Tests** | 4 files | 16 tests | **100% (16/16)** | Prohibits uncalibrated countdowns, verifies "simulated" disclaimer strings in alert dispatches, blocks premature disaster declarations. | Does not test machine learning statistical validity. |
| **Python ML Tests (`ml/`)** | **0 files** | **0 tests** | **0% (NONE)** | **NO AUTOMATED TEST SUITE EXISTS FOR PYTHON ML CODE.** | **No unit tests for `ml/models.py`, `ml/feature_engineering.py`, or `ml/train.py`.** |

---

## 2. Reproducibility Audit

### Command Execution:
```bash
python -m ml.train --mode train
```

- **Environment**: AMD 8-Core CPU, Windows 11, Python 3.14, Scikit-Learn 1.9.1, Pandas 3.0.6, NumPy 2.5.1.
- **Execution Time**: **8.1 seconds**.
- **Exit Code**: `0` (Success).
- **Reproducibility Rating**: **100% REPRODUCIBLE.** Running the command consistently outputs identical RMSE, MAE, and NSE metrics and writes 6 forecast rows to Supabase `public.model_predictions` across consecutive runs.

### Missing Test Gates for ML:
1. No automated test verifying that quantile predictions maintain monotonicity ($P_{10} \le P_{50} \le P_{90}$).
2. No automated test checking for data leakage during feature generation.
3. No automated test asserting that model RMSE beats the Seasonal Persistence baseline by $\ge 15\%$.
4. No automated test verifying that `/api/forecast` returns records from `public.model_predictions`.
