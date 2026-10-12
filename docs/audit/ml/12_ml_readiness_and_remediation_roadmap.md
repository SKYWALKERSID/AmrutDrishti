# JAL DRISHTI — ML Readiness & Remediation Roadmap
**Audit Date**: October 13, 2026  
**Document**: `12_ml_readiness_and_remediation_roadmap.md`  

---

## 1. Evidence-Based Readiness Decision

According to the 9-tier classification standard defined in Phase O:

| Model / Predictive Capability | Readiness Classification | Evidence-Based Justification |
|---|---|---|
| **Quantile Gradient Boosting Model** (`ml/models.py`) | **STATUS 5: VALIDATION DEFECTS** | The model trains cleanly and beats the seasonal persistence baseline on 4 of 6 blocks, but suffers from sample starvation in Palera/Baldeogarh and exhibits quantile crossing ($P_{10} > P_{50}$) without monotonicity enforcement. |
| **Groundwater Sequence LSTM** (`ml/lstm_model.py`) | **STATUS 2: IMPLEMENTED, NOT TRAINED** | PyTorch architecture is defined in code, but no training loop, checkpoint, or weights exist. |
| **Forecast Serving Route** (`src/app/api/forecast/route.ts`) | **STATUS 1: NOT IMPLEMENTED (BROKEN)** | Route returns hardcoded synthetic offsets (`+0.45`m) rather than querying `public.model_predictions`. |
| **Statistical Historical Indicators** (`indicatorCalculationService.ts`) | **STATUS 8: PILOT-READY WITH LIMITATIONS** | Defensible OLS trends and depth averages with strict NULL-propagation and verified unit test coverage (134/134 passing). |

> **Final Operational Determination**:  
> **NOT READY FOR OPERATIONAL WATER RESOURCE DECISION-SUPPORT.**  
> The model pipeline is a functioning **Research Prototype**. Prospective evaluation is permissible only in shadow mode or research demonstrations with visible safeguard notices.

---

## 2. Prioritized Post-Audit Remediation Roadmap

### Priority P0 (Critical Blockers — Must Fix Immediately)
1. **Wire `/api/forecast` to Supabase `public.model_predictions`**:
   - *Finding*: API serves fake $+0.45$m offsets instead of trained predictions.
   - *Proposed Correction*: Update `src/app/api/forecast/route.ts` to query `public.model_predictions` for the requested block, falling back to database baseline depths if no prediction exists.
   - *Acceptance Criteria*: API returns actual predicted $P_{10}, P_{50}, P_{90}$ values written by `ml/train.py`.

### Priority P1 (Scientific & Statistical Deficiencies)
2. **Enforce Quantile Monotonicity ($P_{10} \le P_{50} \le P_{90}$)**:
   - *Finding*: Inverted quantiles in Baldeogarh ($P_{10}=2.86$m vs $P_{50}=2.16$m).
   - *Proposed Correction*: Apply conformal prediction interval sorting `np.sort([p10, p50, p90])` in `predict()` method.
   - *Acceptance Criteria*: Zero quantile crossing occurrences across all pilot blocks.
3. **Handle Irregular Sampling in Target Generation**:
   - *Finding*: `shift(-1)` can bridge over missing quarters, distorting the 3-month forecast horizon.
   - *Proposed Correction*: Reindex observations to a continuous quarterly calendar grid (`Q-MAY, Q-AUG, Q-NOV, Q-JAN`) before computing shifts.

### Priority P2 (Robustness & Pipeline Enhancements)
4. **Historical Collocation of Satellite Environmental Features**:
   - *Finding*: Model trains on autoregressive lags only; live NDVI and SMAP are ignored during offline training.
   - *Proposed Correction*: Extract historical Sentinel-2 and NASA SMAP quarterly time-series (2021–2023) from Earth Engine and join them to `cgwb_mp_cleaned_proper.csv`.
5. **Add Python Automated ML Regression Tests**:
   - *Finding*: 0 automated tests for Python ML scripts.
   - *Proposed Correction*: Create `tests_py/test_ml_pipeline.py` testing monotonicity, lag causality, and TRD error thresholds.

### Priority P3 (Advanced Experiments)
6. **Train Sequence LSTM / Deep Learning with PyTorch**:
   - Once historical time-series exceeds 10+ years (via CGWB multi-decade archive), train `GroundwaterLSTM` with walk-forward temporal cross-validation.
