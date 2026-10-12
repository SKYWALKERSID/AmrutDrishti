# JAL DRISHTI — ML Master Audit Report
**Audit Date**: October 13, 2026  
**Auditor**: Independent AI/ML & Scientific Verification Agent  
**Target Component**: All Machine Learning, Statistical Forecasters, and Predictive Pipelines in `ml/`, `src/lib/services/`, and `src/app/api/forecast/`  
**Governing Standards**: PRD v1.0 §4.3 & §6; TRD v1.0 §7; JalDrishti Workspace Rules Section 5 (Scientific Integrity)

---

## 1. Executive Summary & Core Mandate Findings

| Audit Verification Item | Finding & Evidence-Based Reality | Audit Status |
|---|---|---|
| **Genuine ML Model Found?** | **YES.** `QuantileGroundwaterModel` in `ml/models.py` (Multi-Output Quantile Gradient Boosting) and `GroundwaterLSTM` in `ml/lstm_model.py`. | **VERIFIED** |
| **Model Actually Trained?** | **PARTIALLY.** `QuantileGroundwaterModel` is trained via `ml/train.py` on 13,090 raw records from `data/sources/cgwb_mp_cleaned_proper.csv`. `GroundwaterLSTM` is implemented in code but **NOT TRAINED** (uninvoked in pipeline). | **VERIFIED (GB TRAINED / LSTM NOT TRAINED)** |
| **Reported Accuracy Reproducible?** | **YES.** Executing `python -m ml.train --mode train` reproduces exact RMSE, MAE, and NSE metrics in 8.1 seconds on CPU across all 6 pilot blocks. | **REPRODUCIBLE** |
| **Data Leakage Detected?** | **POTENTIAL LEAKAGE.** Causal time-lags are strictly shifted, but forward target generation uses `shift(-1)` without enforcing contiguous quarterly temporal gaps when missing quarters occur. | **QUALIFIED RISK** |
| **Temporal Validation Appropriate?** | **PARTIALLY.** Uses chronological 80/20 train/test split. However, held-out test sizes for low-observation blocks (Palera, Baldeogarh) are extremely small ($N=3$ and $N=4$). | **SAMPLE CONSTRAINED** |
| **Outperforms Suitable Baseline?** | **YES on 4 of 6 blocks.** Beated Seasonal Persistence baseline by 23.5% to 56.0% in Bijawar, Rajnagar, Baldeogarh, and Jatara. In Tikamgarh, baseline outperformed ML. | **BLOCK DEPENDENT** |
| **Uncertainty Quantified?** | **YES.** Directly models $P_{10}$, $P_{50}$, and $P_{90}$ quantile bounds via Pinball loss minimization. Monotonicity ($P_{10} \le P_{50} \le P_{90}$) verified on 4 blocks; violated on 2 blocks. | **PARTIALLY CALIBRATED** |
| **Inference Connected to UI?** | **DISCONNECTED.** The frontend `/monitoring` page queries `/api/forecast`, but `/api/forecast/route.ts` serves **synthetic arithmetic offsets** (`currentDepth + 0.45m`), completely bypassing the trained weights and Supabase `public.model_predictions`! | **CRITICAL DEFECT** |
| **Overall ML Readiness Status** | **VALIDATION DEFECTS & DISCONNECTED INFERENCE (STATUS 5)** | **NOT OPERATIONALLY READY** |

---

## 2. The Three Most Critical Blockers

### Blocker 1: Frontend/API Inference Disconnection (Severity: P0)
While `ml/train.py` successfully fits quantile gradient boosting models and writes predictions to Supabase `public.model_predictions`, the active Next.js API endpoint [`src/app/api/forecast/route.ts`](file:///d:/Projects/JalDrishti/src/app/api/forecast/route.ts) does **not** load trained model checkpoints or query `public.model_predictions`. Instead, it generates hardcoded offsets (`expectedDepthMbgl = currentDepth + 0.45`). The user-facing dashboard is displaying heuristic mock numbers rather than model inference.

### Blocker 2: Extremely Small Sample Sizes in Low-Observation Blocks (Severity: P1)
In blocks such as **Palera** ($N=13$ total measurements) and **Baldeogarh** ($N=18$), the 80/20 temporal split leaves only 3 to 4 observations in the test set. Palera reported an artificial $R^2 / \text{NSE} = 1.00$ and $\text{RMSE} = 0.001$m because the model fit near-identical points. This represents severe sample starvation and pseudo-accuracy.

### Blocker 3: Lack of Quantile Monotonicity Enforcement (Severity: P1)
Because separate independent `GradientBoostingRegressor` instances are trained for $q=0.10, 0.50, 0.90$, quantile crossings occur (e.g. in Baldeogarh, $P_{10} = 2.86$m while $P_{50} = 2.16$m). In hydrology, $P_{10}$ must strictly represent the favorable recharge scenario (shallower depth) and $P_{90}$ the severe drawdown scenario (deeper depth). Without non-crossing sorting or conformal sorting, uncertainty bounds can invert.

---

## 3. Executive Decision & Operational Advice

> **Operational Decision**: **DO NOT USE FOR MUNICIPAL OR DISASTER GROUNDWATER INTERVENTION PLANNING.**  
> The model pipeline is a functional **Research Prototype** that demonstrates that machine learning can beat persistence baselines on Bundelkhand well observations. However, because inference is disconnected from the UI and quantile crossing occurs without rigorous sample depth, it must remain labeled as a **Prototype Demonstration** per Rule 5 until post-audit remediation is executed.
