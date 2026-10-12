# JAL DRISHTI — Groundwater Indicator Scientific Review
**Audit Date**: October 13, 2026  
**Document**: `09_groundwater_indicator_scientific_review.md`  

---

## 1. Indicator Calculation Service Audit (`src/lib/services/`)

The repository distinguishes **statistical historical indicators** from **AI predictive models**. This section audits the statistical calculations implemented in:
- [`src/lib/services/indicatorCalculationService.ts`](file:///d:/Projects/JalDrishti/src/lib/services/indicatorCalculationService.ts)
- [`src/lib/services/scientificEngine.ts`](file:///d:/Projects/JalDrishti/src/lib/services/scientificEngine.ts)

| Indicator / Metric | Mathematical Formula | Code Implementation | Sign & Unit Convention | Thresholds & Boundaries | Scientific Validity Rating |
|---|---|---|---|---|---|
| **Mean Groundwater Depth** | $\bar{L}_{\text{latest}} = \frac{1}{M}\sum_{i=1}^M L_i(t_{\text{latest}})$ | `indicatorCalculationService.ts:101` | metres below ground level (mbgl) | Averaged on latest valid date; nulls strictly preserved (never zeroed). | **Scientifically Valid** |
| **Well Depth Trend** | OLS Slope: $\beta = \frac{n\sum xy - \sum x \sum y}{n\sum x^2 - (\sum x)^2}$ | `indicatorCalculationService.ts:121` | metres per year (m/yr), where $x$ is time in decimal years | **Positive slope ($>0$) = depth increasing (depletion)**; Negative slope ($<0$) = depth decreasing (recharge). | **Scientifically Valid** |
| **Risk Severity Classification** | Rule-based tiered heuristic | `indicatorCalculationService.ts:128` | Categorical: `normal`, `watch`, `severe`, `gap` | `severe` if depth $\ge 12$m or trend $\ge +0.5$ m/yr; `watch` if depth $\ge 7$m or trend $\ge +0.2$ m/yr. | **Valid Heuristic (Documented)** |
| **Descriptive Stress Score (GSS)** | $\text{GSS} = \min(100, \max(0, \text{round}((\bar{L} / 15.0) \times 100)))$ | `indicatorCalculationService.ts:135` | Integer (0–100) | Normalizes depth relative to regional 15m unconfined basement threshold. | **Valid Descriptive Index** |
| **Composite Multi-Criteria GSS** | Weighted sum of normalized depth (40%), rainfall deficit (25%), GRACE TWSA (20%), and NDVI (15%) | `scientificEngine.ts:64-115` | Integer (0–100) or `null` | **Strict NULL propagation**: If depth or rainfall is missing, returns `null` and flags `isDataGap = true`. | **Scientifically Valid (Rule 5 Compliant)** |

---

## 2. Review of Sign Conventions & Physical Meaning

- **Depth to Water Level (mbgl)**:
  Measured downwards from ground surface.
  - Smaller number (e.g. 3m) = Water table near surface (High storage / recharge).
  - Larger number (e.g. 18m) = Water table deep below ground (Depletion / stress).
- **Trend Sign**:
  - Code: `trendMperYr >= 0.5` $\rightarrow$ classified as `severe`.
  - Verification: Since depth is measured downwards, a positive rate of change $+0.5$ m/yr means water depth increases by 50 cm per year (aquifer is sinking). The code correctly treats positive slope as risk elevation.

---

## 3. Separation of Historical Indicators from Forecasts

In full compliance with Section 5 of JalDrishti Workspace Rules:
- The safeguard notice explicitly reads:
  `"Derived from published CGWB monitoring well network measurements (2021-2023). Satellite and rainfall parameters remain null. Not an AI forecast."`
- The application never presents historical linear trends as future predictive certainty.
