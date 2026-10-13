# Groundwater Risk Model: Implementation & Architecture Report

**Document Version:** 1.0.0  
**Implementation Date:** 2026-10-13  
**Status:** Architecture Implemented & Verified in Codebase  
**Governing Directives:** PRD §4.3, §6, §7; TRD §7; Master Vibe-Coding Prompt §4, §5

---

## 1. Architectural Overview

The groundwater risk and prediction architecture in JalDrishti decouples **deterministic data pipelines**, **statistical predictive modeling**, and **policy risk evaluation** into clear, isolated layers:

```
[ Central Ground Water Board (CGWB) & NWIC Telemetry ]
                          │
                          ▼
             [ Data Harmonization & Provenance ]
       (Clean nulls, validate dates, coordinate bounds)
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
[ Deterministic Indicators ]      [ Causal Feature Matrix ]
- 30-year rainfall anomaly        - Station-grouped causal lags (t-1, t-4)
- 3-Month SPI (Gamma fit)         - Quarterly drawdown velocity
- OLS well depth trends           - Cyclical season codes
- Area-weighted grid clipping     - Verified horizon: 45 to 135 days
         │                                 │
         │                                 ▼
         │                   [ Quantile Estimator (P10, P50, P90) ]
         │                   - Gradient Boosting Pinball Loss
         │                   - P50 Median Anchor Preservation
         │                   - Monotonicity Ordering Safeguards
         │                                 │
         └────────────────┬────────────────┘
                          ▼
            [ Risk Assessment Layer ]
       - Physical Depth Thresholds (12.0 mbgl critical)
       - Multi-criteria Descriptive GSS Index (Heuristic)
       - Scheme Eligibility Rules (Atal Jal, Amrit Sarovar)
                          │
                          ▼
          [ API Contracts & Serving Guardrails ]
       - /api/forecast (Horizon & Provenance Audits)
       - /api/geospatial/blocks (PostGIS Database)
       - Fail-Closed Behavior (Blocks = [], Source = fallback_empty)
                          │
                          ▼
       [ UI Components with Honest Loading / Unavailable States ]
       - Skeletons on loading; explicit "Risk Score Unavailable" on gaps
```

---

## 2. Component Specifications

### A. Feature Engineering & Matrix Construction (`ml/feature_engineering.py`)
* **Station Grouping:** Lags are constructed strictly per unique station identifier (`grouped by station`), preventing cross-well contamination.
* **Causal Shifting:**
  $$w_{\text{lag\_1}} = \text{shift}(1),\quad w_{\text{lag\_4}} = \text{shift}(4),\quad \Delta w = w_{\text{lag\_1}} - w_{\text{lag\_2}}$$
* **Strict Horizon Window:** Validates that $t_{\text{target}} - t_{\text{origin}} \in [45, 135]$ days. Missed campaigns are rejected from the 1-quarter target array.

### B. Quantile Estimator & Monotonicity Safeguards (`ml/models.py`, `ml/validation.py`)
* **Architecture:** 3 independent gradient boosting regressors trained on quantile pinball loss:
  $$\mathcal{L}_q(y, \hat{y}) = \max(q(y - \hat{y}), (q - 1)(y - \hat{y}))$$
  for $q \in \{0.10, 0.50, 0.90\}$.
* **P50 Immutability Safeguard:** The central $P_{50}$ point estimate is treated as an immutable physical median anchor.
* **Monotonicity Post-Processing:**
  $$\tilde{P}_{10} = \min(P_{10}, P_{50}),\quad \tilde{P}_{90} = \max(P_{90}, P_{50})$$
  This guarantees that $P_{10} \le P_{50} \le P_{90}$ unconditionally while leaving $P_{50}$ untouched.
* **Audit Metadata:** Returned payloads flag whether raw predictions crossed (`has_crossing: true`) and mark intervals as `uncalibrated` or `invalid_crossing`.

### C. Policy Risk Assessment Layer (`src/lib/services/scientificEngine.ts`)
* **Separation of Concerns:** Does not convert raw ML predictions into government-style severity classifications without defensible hydrogeological basis.
* **Physical Aquifer Bounds:**
  * **Critical Drawdown ($\ge 12.0\text{ m bgl}$):** Represents casing dewatering in Bundelkhand granite.
  * **Watch Condition ($7.0 - 12.0\text{ m bgl}$):** Moderate seasonal depletion.
  * **Normal Condition ($< 7.0\text{ m bgl}$):** Sustained unconfined storage.
* **Data Gap Handling:** When inputs are missing, returns `score: null` and `severity: 'gap'`. Never converts missing data to safe/normal scores.

---

## 3. Serving Layer & Data Contract (`src/app/api/forecast/route.ts`)

The serving route enforces strict runtime safety checks before responding to client requests:
1. **Target Unit Resolution:** Resolves requested block slug against pilot unit mappings without defaulting to `ALL_BLOCKS[0]`.
2. **Horizon Consistency Audit:**
   $$\text{Days from training cutoff to prediction target} \le 180\text{ days}$$
   If a prediction record in the database projects years beyond the training cutoff (e.g. 2027 projection from 2023 training data), the route rejects the forecast and returns `modelStatus: 'unavailable'`, `horizonStatus: 'inconsistent_origin'`, and an explicit audit notice.
3. **Horizon Limit Cap:** Caps queried database records to 4 quarters (`limit=4`).
4. **Honest Unavailable Response:** If no verified model prediction exists, returns `modelStatus: 'unavailable'`, `forecasts: []`, and an explicit disclaimer notice.
