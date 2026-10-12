# JAL DRISHTI — ML Forecast Integration Fix Report
**Audit Date**: October 13, 2026  
**Document**: `ml_forecast_integration_fix.md`  
**Target Route**: [`src/app/api/forecast/route.ts`](file:///d:/Projects/JalDrishti/src/app/api/forecast/route.ts)  
**Consumer UI**: [`src/app/monitoring/page.tsx`](file:///d:/Projects/JalDrishti/src/app/monitoring/page.tsx)

---

## 1. Summary of Changes & Fixes

### A. Eliminated Synthetic Offset Generation
- **Removed**:
  - `expectedDepthMbgl = currentDepth + 0.45`
  - `lowerBoundP10Mbgl = currentDepth - 0.20`
  - `upperBoundP90Mbgl = currentDepth + 1.10`
  - `baselineHistoricalDepthMbgl = currentDepth ?? 12.5` (hardcoded 12.5m fallback removed).
- **Result**: Zero synthetic arithmetic is executed on the active serving path.

### B. Connected Genuine Persisted Inferences
- The route handler now resolves the requested block slug or LGD unit ID (`3783`, `3788`, `4027`, `4028`, `4030`, `4032`).
- Issues a secure server-side query to Supabase:
  ```
  GET /rest/v1/model_predictions?select=*&unit_id=eq.{unitId}&order=created_at.desc&limit=4
  ```
- Reads the genuine quantile model predictions produced by `ml/train.py` (model ID `quantile_gb_v1.0`).

### C. Added Quantile Ordering Safeguard
- Persisted predictions are evaluated for monotonicity.
- Enforces $P_{10} \le P_{50} \le P_{90}$ via numerical sorting safeguard (`[p10, p50, p90].sort()`), preventing visual inverted confidence intervals (e.g., in Baldeogarh where raw unconstrained boosting had inverted $P_{10}$ and $P_{50}$).

### D. Honest Unavailable State
- If no prediction exists for a block or database is unconfigured, the endpoint returns:
  ```json
  {
    "modelStatus": "unavailable",
    "forecasts": [],
    "safeguardDisclaimer": "Notice: No active calibrated ML model predictions found for this block in the database ledger. Historical observations only."
  }
  ```
- The frontend [`src/app/monitoring/page.tsx`](file:///d:/Projects/JalDrishti/src/app/monitoring/page.tsx) renders a transparent notice rather than an empty broken container or synthetic numbers.
