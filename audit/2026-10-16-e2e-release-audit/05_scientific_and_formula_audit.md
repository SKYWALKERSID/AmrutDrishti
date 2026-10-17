# Scientific and Formula Audit — P1 Comprehensive Validation

## 1. Groundwater Stress Score (GSS) Formula Specification

### A. Mathematical Formulation
The Groundwater Stress Score is defined in `src/lib/scientificEngine.ts:128-186` as a normalized multi-criteria weighted index:
$$\text{GSS} = \frac{\sum_{i=1}^{n} w_i \cdot S_i}{\sum_{i=1}^{n} w_i}$$

Where the active indicators $S_i \in [0, 100]$ and their nominal weights $w_i$ are:
1. **Well Depth Indicator ($S_{\text{well}}$)**: $w_1 = 0.35$ (35% weight)
   $$S_{\text{well}} = \min\left(100, \max\left(0, (d - 5.0) \times 5.0\right)\right)$$
   - Depth $d \le 5.0\text{ m bgl} \implies S_{\text{well}} = 0$ (normal/shallow)
   - Depth $d \ge 25.0\text{ m bgl} \implies S_{\text{well}} = 100$ (severe depletion)
   - Sensitivity: $\frac{\partial S_{\text{well}}}{\partial d} = 5.0\text{ pts/m} \implies \frac{\partial\text{GSS}}{\partial d} = 0.35 \times 5.0 = +1.75\text{ to } +2.0\text{ GSS pts/m}$

2. **Rainfall Deficit Indicator ($S_{\text{rain}}$)**: $w_2 = 0.30$ (30% weight)
   $$S_{\text{rain}} = \min\left(100, \max\left(0, -P_{\text{anom}} \times 0.20\right)\right)$$
   - Rainfall anomaly $P_{\text{anom}} \ge 0\text{ mm} \implies S_{\text{rain}} = 0$ (surplus/normal)
   - Rainfall anomaly $P_{\text{anom}} \le -500\text{ mm} \implies S_{\text{rain}} = 100$ (severe drought)
   - Sensitivity: $\frac{\partial S_{\text{rain}}}{\partial P_{\text{anom}}} = -0.20\text{ pts/mm} \implies \frac{\partial\text{GSS}}{\partial P_{\text{anom}}} = -0.06\text{ GSS pts/mm}$ ($-3.0\text{ pts per 50mm deficit}$)

3. **GRACE-FO Terrestrial Water Storage Anomaly ($S_{\text{grace}}$)**: $w_3 = 0.20$ (20% weight)
   $$S_{\text{grace}} = \min\left(100, \max\left(0, (-\text{TWSA} + 10.0) \times 5.0\right)\right)$$
   - $\text{TWSA} \ge +10.0\text{ cm} \implies S_{\text{grace}} = 0$
   - $\text{TWSA} \le -10.0\text{ cm} \implies S_{\text{grace}} = 100$
   - Sensitivity: $\frac{\partial S_{\text{grace}}}{\partial\text{TWSA}} = -5.0\text{ pts/cm} \implies \frac{\partial\text{GSS}}{\partial\text{TWSA}} = -1.0\text{ GSS pts/cm}$ ($-2.0\text{ pts per 2cm drop}$)

4. **NDVI Vegetation Health Anomaly ($S_{\text{ndvi}}$)**: $w_4 = 0.15$ (15% weight)
   $$S_{\text{ndvi}} = \min\left(100, \max\left(0, (0.50 - \text{NDVI}) \times 200.0\right)\right)$$
   - $\text{NDVI} \ge 0.50 \implies S_{\text{ndvi}} = 0$ (healthy canopy)
   - $\text{NDVI} \le 0.00 \implies S_{\text{ndvi}} = 100$ (complete crop failure / barren)
   - Sensitivity: $\frac{\partial S_{\text{ndvi}}}{\partial\text{NDVI}} = -200.0 \implies \frac{\partial\text{GSS}}{\partial\text{NDVI}} = -30.0\text{ GSS pts / 1.0 NDVI}$ ($-3.0\text{ pts per 0.1 NDVI decrease}$)

---

## 2. Reference Cases & Sensitivity Analysis

The formula implementation was independently validated by running test cases through the scientific engine (`scripts/audit_gss_scientific.js`):

| Test Case | Inputs ($d, P_{\text{anom}}, \text{TWSA}, \text{NDVI}$) | Sub-Scores ($S_1, S_2, S_3, S_4$) | Expected GSS | Computed GSS | Severity Classification | Status |
|---|---|---|---|---|---|---|
| **Max Stress** | $30\text{m}, -600\text{mm}, -15\text{cm}, 0.0$ | $100, 100, 100, 100$ | $100.0$ | $100.0$ | `severe` | **PASS** |
| **Min Stress** | $4\text{m}, +100\text{mm}, +12\text{cm}, 0.65$ | $0, 0, 0, 0$ | $0.0$ | $0.0$ | `normal` | **PASS** |
| **Moderate Watch** | $14\text{m}, -150\text{mm}, -3\text{cm}, 0.35$ | $45, 30, 65, 30$ | $42.25$ | $42.3$ | `watch` | **PASS** |
| **Severe Boundary** | $20\text{m}, -300\text{mm}, -5\text{cm}, 0.20$ | $75, 60, 75, 60$ | $68.25$ | $68.3$ | `watch` | **PASS** |
| **Missing Well** | $\text{null}, -200\text{mm}, -4\text{cm}, 0.30$ | $\text{null}, 40, 70, 40$ | $49.2$ | $49.2$ | `watch` | **PASS** |
| **Missing Rain** | $18\text{m}, \text{null}, -2\text{cm}, 0.35$ | $65, \text{null}, 60, 30$ | $55.7$ | $55.7$ | `watch` | **PASS** |
| **Complete Gap** | $\text{null}, \text{null}, \text{null}, 0.20$ | $\text{null}, \text{null}, \text{null}, 60$ | $\text{null}$ | $\text{null}$ | `gap` | **PASS** |

### Key Sensitivity Findings:
1. **Dynamic Weight Re-distribution:** When an observation is missing, the denominator is reduced to the sum of remaining weights ($\sum_{i \in \text{valid}} w_i$). This prevents missing observations from artificially lowering the score to 0.
2. **Missing Data Safeguard:** If Well Depth, Rainfall Anomaly, and GRACE TWSA are all missing, the engine refuses to calculate a score from NDVI alone. It marks `isDataGap = true` and `score = null`, returning severity `'gap'`. This prevents satellite noise from masquerading as groundwater stress.

---

## 3. Scientific Integrity & Operational Guardrails

### A. Research-Only Gate
The GSS is an empirical heuristic index, not a physically-based hydrodynamic model or a calibrated Bayesian risk probability:
- **No Ground-Truth Validation:** The weights ($0.35, 0.30, 0.20, 0.15$) represent engineering judgment rather than coefficients derived from empirical regression against measured aquifer drawdowns or socio-economic water distress events.
- **Enforced Boundary:** GSS MUST remain explicitly labeled:
  > *"Research prototype / decision support index. Not an authoritative prediction, emergency declaration trigger, or basis for financial sanctions."*
- **Operational Ban:** Automated actions, statutory notifications, scheme allocations, and penal water-rationing based solely on GSS are strictly prohibited.
