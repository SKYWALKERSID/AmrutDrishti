# Machine Learning and Forecast Readiness Audit — P1

## 1. Live Model Registry Audit

The live Supabase table `model_registry` was queried and inspected using authenticated `service_role` access:

| Field | Value | Operational Standard Requirement | Compliance Verdict |
|---|---|---|---|
| **Model Identifier** | `quantile_gb_v1.0` | Required unique semver identifier | **PASS** |
| **Model Version** | `1.0.0` | Strict semantic versioning | **PASS** |
| **Model Status** | `research_prototype` | Prohibited from `production_active` without passing gate | **PASS (Gated)** |
| **Training Date** | `2026-10-14T10:00:00Z` | Documented provenance timestamp | **PASS** |
| **Algorithm** | Quantile Gradient Boosting Regressor | Quantile probabilistic forecasting | **PASS** |
| **Evaluation RMSE** | **3.612 m** | Must beat baseline RMSE by $\ge 15\%$ | **FAIL (Disqualified)** |
| **Baseline RMSE** | **2.153 m** (Seasonal Persistence) | Reference seasonal baseline | **Baseline Standard** |
| **NSE (Nash-Sutcliffe)** | **-0.184** | Must have $NSE > 0.50$ for operational skill | **FAIL (Negative Skill)** |
| **Quantile Inversion** | Observed in unit `4027` ($P_{50} = 2.16\text{m} < P_{10} = 2.86\text{m}$) | $P_{10} \le P_{50} \le P_{90}$ strict monotonic ordering | **FAIL (Crossing Detected)** |

---

## 2. Scientific Evaluation & Disqualification

### A. Failure Against Seasonal-Persistence Baseline
1. **Negative Predictive Skill ($NSE = -0.184$):**
   A Nash-Sutcliffe Efficiency below $0$ indicates that a simple historical mean or seasonal persistence baseline outperforms the machine learning model. The model's RMSE of $3.612\text{m}$ is **67.8% higher (worse)** than the naive baseline of $2.153\text{m}$.
2. **Quantile Crossing Phenomenon:**
   In `model_predictions` for unit `4027`, the predicted median water level ($P_{50} = 2.16\text{m}$) is shallower than the 10th percentile conservative lower bound ($P_{10} = 2.86\text{m}$). This occurs when separate quantile models are trained independently without monotonicity constraints (isotonic regression or non-crossing penalty).

### B. Enforced Runtime Safeguards
Because the model fails operational readiness:
1. `src/app/api/forecast/route.ts` hard-enforces:
   - `modelStatus: 'research_prototype'`
   - `operationalEligibility: false`
   - Horizon cap at 4 quarters (1 year). Any request with $h > 4$ is rejected with HTTP 400.
2. Predictions are quarantined for research evaluation and **MUST NOT** be used to trigger automated administrative interventions, warnings, or budgeting decisions.
