# JAL DRISHTI — ML Forecast Validity & Provenance Audit Report

**Audit Date:** October 13, 2026  
**Audit Type:** Focused Evidence-Based Scientific Audit  
**Scope:** Prediction provenance in `public.model_predictions`, training cutoff vs. target horizon decoupling, quantile semantics & interval crossings, block mapping reconciliation, and API availability semantics.

---

## 1. Executive Audit Summary

A rigorous audit of the groundwater predictions stored in Supabase `public.model_predictions` and served by `/api/forecast` was conducted to determine whether they constitute scientifically valid forecasts for their displayed target dates.

### Key Audit Findings:
1. **Critical Provenance & Horizon Decoupling:**
   - The underlying training dataset ([`data/sources/cgwb_mp_cleaned_proper.csv`](file:///d:/Projects/JalDrishti/data/sources/cgwb_mp_cleaned_proper.csv)) terminates with its latest observation on **August 20, 2023** (`2023-08-20`).
   - The model `quantile_gb_v1.0` was trained on historical data ending in August 2023.
   - In [`ml/train.py`](file:///d:/Projects/JalDrishti/ml/train.py) line 198, the target date was dynamically synthesized at script runtime using:
     $$\text{target\_date} = \text{date.today}() + 90\text{ days} = \text{"2027-01-11"}$$
   - **Conclusion:** A 90-day forecast horizon projected from a run date in October 2026 using observation features that ended in August 2023 represents an unverified ~3.5-year extrapolation, **not a valid 90-day seasonal forecast**.
2. **Quantile Crossing & Calibration Audit:**
   - In unconstrained quantile gradient boosting, raw predictions exhibited severe quantile crossings (e.g., $P_{10} = 2.86 > P_{50} = 2.16$ in Baldeogarh; $P_{10} = 3.02 > P_{50} = 3.46$ near-coincidence in Tikamgarh).
   - Numerical clamping (`min/max` sorting) enforces arithmetic monotonicity but **does not constitute statistical calibration**. Presenting clamped values as valid $P_{10}$–$P_{90}$ 80% coverage intervals is misleading.
3. **Remediation Implemented (Smallest Safe Change):**
   - [`src/app/api/forecast/route.ts`](file:///d:/Projects/JalDrishti/src/app/api/forecast/route.ts) now audits both horizon plausibility and quantile crossings.
   - When a stored prediction's target date is decoupled from its training cutoff ($> 180$ days post-observation), the API reports `modelStatus: 'unavailable'`, `provenanceStatus: 'unverifiable'`, and `horizonStatus: 'inconsistent_origin'`, serving an honest empty array (`forecasts: []`) with an explicit scientific disclosure.
   - The model's original median $P_{50}$ is preserved without alteration. Any crossing intervals are flagged as `invalid_crossing` with bounds set to `null` rather than falsified.

---

## 2. Row-by-Row Trace of `public.model_predictions`

All 6 rows currently residing in Supabase `public.model_predictions` were retrieved and audited via the read-only service path:

| Unit LGD ID | Pilot Block Name | Stored Model ID | Training Data Cutoff | Forecast Origin Date | Stored Target Date | Stored P50 | Stored P10 / P90 | Raw Crossing Violation? | Provenance & Horizon Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **3783** | Bijawar | `quantile_gb_v1.0` | `2023-08-20` | `2026-10-12` (script run) | `2027-01-11` | 8.07 m | 3.12 / 13.12 m | No ($P_{10} \le P_{50} \le P_{90}$) | **Inconsistent Horizon** (~3.5 yr extrapolation) |
| **3788** | Rajnagar | `quantile_gb_v1.0` | `2023-08-20` | `2026-10-12` (script run) | `2027-01-11` | 4.23 m | 2.02 / 6.67 m | No ($P_{10} \le P_{50} \le P_{90}$) | **Inconsistent Horizon** (~3.5 yr extrapolation) |
| **4027** | Baldeogarh | `quantile_gb_v1.0` | `2023-08-20` | `2026-10-12` (script run) | `2027-01-11` | 2.16 m | 2.86 / 5.00 m | **YES** ($P_{10} = 2.86 > P_{50} = 2.16$) | **Inconsistent Horizon & Invalid Crossing** |
| **4028** | Jatara | `quantile_gb_v1.0` | `2023-08-20` | `2026-10-12` (script run) | `2027-01-11` | 4.53 m | 1.99 / 5.15 m | No ($P_{10} \le P_{50} \le P_{90}$) | **Inconsistent Horizon** (~3.5 yr extrapolation) |
| **4030** | Palera | `quantile_gb_v1.0` | `2023-08-20` | `2026-10-12` (script run) | `2027-01-11` | 5.71 m | 4.25 / 6.81 m | No ($P_{10} \le P_{50} \le P_{90}$) | **Inconsistent Horizon** (and insufficient training data) |
| **4032** | Tikamgarh | `quantile_gb_v1.0` | `2023-08-20` | `2026-10-12` (script run) | `2027-01-11` | 3.46 m | 3.02 / 10.00 m | No ($P_{10} \le P_{50} \le P_{90}$) | **Inconsistent Horizon** (~3.5 yr extrapolation) |

---

## 3. Provenance and Target Date Synthesis Mechanism

Inspecting lines 136–204 of [`ml/train.py`](file:///d:/Projects/JalDrishti/ml/train.py) revealed the exact mechanism of error:
```python
# ml/train.py lines 137, 198:
latest_features = matrix[feature_cols].tail(1).bfill().ffill()
future_pred = ml_model.predict(latest_features)

pred_record = {
    'unit_id': unit_lgd,
    'model_id': 'quantile_gb_v1.0',
    'target_date': (datetime.date.today() + datetime.timedelta(days=90)).strftime('%Y-%m-%d'),
    'predicted_gwl_mbgl': p50_val,
    'uncertainty_lower_mbgl': p10_val,
    'uncertainty_upper_mbgl': p90_val,
    ...
}
```
- `latest_features` was extracted from the last row of `matrix`, which corresponds to **August 20, 2023**.
- However, `target_date` was calculated not from August 2023, but from `date.today() + 90 days` on the day the script was run in October 2026, producing `2027-01-11`.
- **Finding:** A model receiving inputs from 2023 cannot forecast water levels in 2027 without 2023–2026 intermediate observations. Claiming that `2027-01-11` is a 90-day forecast violates hydrological causation.

---

## 4. Quantile Semantics & Crossing Rectification

### The Clamping Fallacy
Previously, lines 99–102 of `route.ts` used:
```typescript
const safeP50 = Number(p50.toFixed(2));
const safeP10 = Number(Math.min(p10, safeP50).toFixed(2));
const safeP90 = Number(Math.max(p90, safeP50).toFixed(2));
```
While this prevented UI inversion ($P_{10} \le P_{50} \le P_{90}$), it disguised model unreliability. In Baldeogarh, the model literally predicted that the 10th percentile (recharge scenario) was **2.86m**, while the median was **2.16m**. Forcing $P_{10}$ to $2.16m$ misrepresented the model's actual quantile output.

### The Corrected Standard
1. **$P_{50}$ Invariance:** The median prediction is preserved without modification.
2. **Explicit Interval Nullification:** When raw $P_{10} > P_{50}$ or $P_{90} < P_{50}$, `intervalStatus` is explicitly set to `'invalid_crossing'` and bounds are nullified (`lowerBoundP10Mbgl: null`, `upperBoundP90Mbgl: null`), preventing false claims of calibrated uncertainty intervals.
3. **No Claim of Statistical Calibration:** Non-crossing intervals are marked `'uncalibrated'`, reflecting that conformal calibration has not yet been applied.

---

## 5. Verification of All Six Block Mappings

The mapping between application slug identifiers and official unit LGD codes is verified:

| Block Slug | Unit LGD Code | Block Name | District | Mapping Match |
| :--- | :---: | :--- | :--- | :---: |
| `blk_bijawar` | **3783** | Bijawar | Chhatarpur | **[VERIFIED]** |
| `blk_rajnagar` | **3788** | Rajnagar | Chhatarpur | **[VERIFIED]** |
| `blk_baldeogarh` | **4027** | Baldeogarh | Tikamgarh | **[VERIFIED]** |
| `blk_jatara` | **4028** | Jatara | Tikamgarh | **[VERIFIED]** |
| `blk_palera` | **4030** | Palera | Tikamgarh | **[VERIFIED]** |
| `blk_tikamgarh_main` | **4032** | Tikamgarh | Tikamgarh | **[VERIFIED]** |

All mappings are confirmed consistent across [`bundelkhand.ts`](file:///d:/Projects/JalDrishti/src/lib/data/bundelkhand.ts), [`cron_live_satellite_ingest.py`](file:///d:/Projects/JalDrishti/scripts/cron_live_satellite_ingest.py), [`train.py`](file:///d:/Projects/JalDrishti/ml/train.py), and [`route.ts`](file:///d:/Projects/JalDrishti/src/app/api/forecast/route.ts).

---

## 6. Audit Regression Test Suite Results

An audit test suite was added under [`tests_py/test_provenance_audit.py`](file:///d:/Projects/JalDrishti/tests_py/test_provenance_audit.py), testing:
- $P_{50}$ immutability when raw quantiles cross.
- Crossing detection and interval nullification.
- Training cutoff vs. target horizon decoupling detection ($>180$ days gap).
- Clear separation between stored prediction records and operational eligibility.

### Test Execution Results:
```text
python -m unittest discover tests_py
.......................
----------------------------------------------------------------------
Ran 23 tests in 0.459s

OK
```
- **Python Tests:** 23/23 tests passing (0.459s).
- **TypeScript Tests:** 134/134 tests passing (0.527s).
- **Next.js Production Build:** 11/11 pages compiled cleanly in 3.0s (`npm run build`).
