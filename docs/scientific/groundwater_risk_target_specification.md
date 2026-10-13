# Groundwater Risk Target Specification: Predictive Problem Formulation

**Document Version:** 1.0.0  
**Specification Date:** 2026-10-13  
**Status:** Approved Scientific Specification  
**Governing Directives:** PRD §4.3, §6; TRD §7; Master Vibe-Coding Prompt §5 (Scientific Integrity)

---

## 1. Executive Summary

This specification rigorously defines the predictive targets, forecast horizons, geographic units of analysis, label knowability constraints, and evaluation boundaries for groundwater machine-learning models in JalDrishti.

Per Section 4 of the Mission Directives, we formulate two separate predictive problems:
* **Model A (Physical Groundwater Condition):** Station-level future depth-to-water level ($y \in \mathbb{R}^+$ in meters below ground level, m bgl) at a validated quarterly campaign horizon ($h \in [45, 135]$ days).
* **Model B (Operational Groundwater Stress Risk):** Future risk outcome defined by an explicit hydrogeological standard versus heuristic composite indices.

---

## 2. Model A: Future Physical Groundwater Condition

### A. Prediction Target Formulation
* **Target Variable:** $y_{s, t+h} \in \mathbb{R}^+$ — Depth to water table in meters below ground level (m bgl) measured at specific observation station $s$ at future observation campaign date $t+h$.
* **Forecast Origin:** Time $t$ — The timestamp of the current valid manual or DWLR observation campaign at station $s$.
* **Horizon Definition:** $h \in [45, 135]\text{ days}$ (nominal 1 quarter / ~90 days).
  * In the Central Ground Water Board (CGWB) monitoring network, field campaigns occur roughly four times annually: Pre-Monsoon (May), Monsoon Peak (August), Post-Monsoon (November), and Winter/Rabi (January).
  * A valid one-campaign-ahead prediction requires that the subsequent record falls between 45 and 135 days after origin $t$. If an intervening campaign was missed (e.g. gap of 180+ days), the record **must not** be treated as a 1-quarter target.
* **Geographic Unit & Spatial Resolution:** Monitoring Station (Well) level. Predictions are computed for verified physical stations (CGWB hydrograph network stations). Block-level projections are derived by aggregating valid station estimates, never by conflating heterogeneous stations into an undifferentiated pool prior to lagging.
* **Quantile Targets:**
  * Median Point Estimate ($P_{50}$): Expected depth under normal weather and seasonal recharge.
  * Favorable Recharge Bound ($P_{10}$): 10th percentile depth (shallower water table, high monsoon infiltration).
  * Severe Drawdown Bound ($P_{90}$): 90th percentile depth (deeper water table, acute seasonal deficit).

### B. Causal Feature Availability at Forecast Origin ($t$)
All features must be knowable strictly at or before origin date $t$:
1. $w_{s, t}$: Water level measurement at origin (m bgl).
2. $w_{s, t-1}$: Previous valid observation at the same station $s$.
3. $w_{s, \text{year\_prior}}$: Same-station observation approximately 365 days prior to target date ($\pm 45$ day seasonal window).
4. $\Delta w_{s, \text{drawdown}} = w_{s, t} - w_{s, t-1}$: Observed drawdown rate over the preceding interval.
5. $\text{Season}_{\text{target}} \in \{0, 1, 2, 3\}$: Calendar quarter of the target date (cyclical seasonal component).
6. $P_{\text{cum\_3m}}$: 90-day cumulative precipitation from IMD 0.25° gridded observations prior to $t$.
7. $\text{SPI-3}_t$: 3-month Standardized Precipitation Index computed at origin $t$.

---

## 3. Model B: Groundwater Risk Target Specification

### A. Evaluation of Candidate Risk Targets

We evaluated four alternative risk targets:

| Candidate Target | Definition | Data Readiness | Scientific Soundness | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Option 1: Future Continuous Depth ($y \ge \theta$)** | Physical depth exceeding hydrogeological threshold (e.g., $12.0\text{ m bgl}$ critical hard-rock casing depth). | High (Directly observable in CGWB records). | High (Physical, objective, traceable to well screen failure). | **APPROVED (Primary Physical Risk Standard)** |
| **Option 2: Future Drawdown Velocity ($\Delta y \ge 0.5\text{ m/yr}$)** | Multi-year rate of aquifer storage decline. | Medium (Requires multi-year continuous station history). | High (Standard CGWB long-term trend criteria). | **APPROVED (Secondary Trend Standard)** |
| **Option 3: Legacy Heuristic GSS Score ($> 70$)** | Hand-entered or weighted multi-criteria index. | Zero independent ground truth labels exist. | Low (Invented weights; training on GSS simply memorizes the formula). | **REJECTED AS TRAINING TARGET** |
| **Option 4: CGWB National Dynamic Assessment Category** | Official categorization ('Safe', 'Semi-Critical', 'Critical', 'Over-Exploited'). | Published biennially at block level (not quarterly station level). | High (Official government standard), but temporal resolution is multi-year. | **REJECTED FOR QUARTERLY ML (Retained as policy reference)** |

### B. Chosen Operational Risk Formulation
To preserve scientific integrity:
> **Do not invent a risk label from the same formula or threshold that the model is intended to replace.**

Instead, the operational risk engine is decoupled into two tiers:
1. **Tier 1 — Calibrated Physical Forecast ($P_{50}, P_{90}$):** Predictive ML model forecasts future water table depth and bounds.
2. **Tier 2 — Policy Risk Classification:** Grounded in physical thresholds for Bundelkhand fractured granite aquifers:
   * **Severe Risk:** Expected depth $P_{50} \ge 12.0\text{ m bgl}$, OR Upper stress bound $P_{90} \ge 15.0\text{ m bgl}$, OR persistent multi-year decline $> 0.5\text{ m/yr}$. (Corresponds to well yield failure and suction-lift centrifugal pump cavitation).
   * **Watch / Moderate Risk:** Expected depth $7.0\text{ m bgl} \le P_{50} < 12.0\text{ m bgl}$, OR seasonal deficit departure $> 20\%$.
   * **Normal / Favorable:** Expected depth $P_{50} < 7.0\text{ m bgl}$ and stable trend.
   * **Data Gap:** Incomplete observations, uncalibrated horizon, or prediction origin $> 180\text{ days}$ prior.

### C. Abstention & Gate Criteria
The system must return an explicit **Unavailable State** and abstain from generating an ML risk prediction when:
1. Observation history has $< 8$ historical campaign points for the target unit.
2. The forecast horizon is irregular ($< 45\text{ days}$ or $> 135\text{ days}$).
3. The underlying model fails the independent hydrological benchmark gate ($\text{RMSE} \le 1.50\text{ m}$, $\text{NSE} \ge 0.65$, and $\ge 15\%$ improvement over seasonal persistence).
4. Uncertainty interval displays quantile crossing ($P_{10} > P_{50}$ or $P_{90} < P_{50}$).
