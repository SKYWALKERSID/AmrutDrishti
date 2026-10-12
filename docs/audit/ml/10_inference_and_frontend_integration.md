# JAL DRISHTI — Inference & Frontend Integration Audit
**Audit Date**: October 13, 2026  
**Document**: `10_inference_and_frontend_integration.md`  

---

## 1. End-to-End Prediction Inference Path Audit

Tracing the complete pipeline from data source to user interface:

$$\text{Data Source} \longrightarrow \text{Training Pipeline} \longrightarrow \text{Persistence Layer} \longrightarrow \text{API Endpoint} \longrightarrow \text{Frontend Dashboard}$$

| Architecture Link | Implementation Component | Contract & Location | Audit Findings & Verification Status | Defect Classification |
|---|---|---|---|---|
| **1. Input Observation** | CGWB CSV observations | `data/sources/cgwb_mp_cleaned_proper.csv` | **VERIFIED.** 13,090 raw records loaded. | Clean |
| **2. Feature Processing** | Temporal lag generator | `ml/feature_engineering.py` | **VERIFIED.** Constructs causal lags (`lag_1`, `lag_2`, `lag_4`, `drawdown_velocity`). | Clean |
| **3. Model Inference** | Multi-output Quantile Boosting | `ml/train.py` & `ml/models.py` | **VERIFIED.** Fits $P_{10}, P_{50}, P_{90}$ regressors for all 6 pilot blocks. | Clean |
| **4. Database Persistence** | Supabase REST API | `public.model_predictions` & `public.model_registry` | **VERIFIED.** Forecast records successfully inserted with HTTP 201 status. | Clean |
| **5. API Serving Route** | Next.js dynamic Route Handler | [`src/app/api/forecast/route.ts`](file:///d:/Projects/JalDrishti/src/app/api/forecast/route.ts) | **FAILED (BROKEN LINK).** Route does **not** query `public.model_predictions` or load model checkpoints. It generates **synthetic arithmetic offsets** (`currentDepth + 0.45`). | **CRITICAL DEFECT (P0)** |
| **6. Client-Side Fetching** | Monitoring Page React Hook | [`src/app/monitoring/page.tsx:122`](file:///d:/Projects/JalDrishti/src/app/monitoring/page.tsx#L122) | **VERIFIED.** Client issues `fetch('/api/forecast?block=...')`. | Clean |
| **7. Dashboard Display** | Shaded forecast band chart | [`src/app/monitoring/page.tsx:290-330`](file:///d:/Projects/JalDrishti/src/app/monitoring/page.tsx#L290) | **DISCONNECTED CONTENT.** Displays the chart with $P_{10}-P_{90}$ bands, but renders the mock offsets served by the API. | **DISCONNECTED INFERENCE** |

---

## 2. Root Cause Analysis of Inference Disconnection

In `src/app/api/forecast/route.ts`:
```typescript
// Line 39-55 of src/app/api/forecast/route.ts
const currentDepth = block.indicators.cgwbWellDepthMbgl ?? 12.5;

const forecastPoints: ForecastPoint[] = [
  {
    horizonQuarter: 1,
    targetSeason: seasons[(baseSeasonIdx + 1) % 4],
    expectedDepthMbgl: Number((currentDepth + 0.45).toFixed(2)), // <-- HARDCODED FIXTURE ARITHMETIC
    uncertaintyInterval: {
      lowerBoundP10Mbgl: Number((currentDepth - 0.20).toFixed(2)),
      upperBoundP90Mbgl: Number((currentDepth + 1.10).toFixed(2)),
    },
    ...
```

The route contains a mock placeholder implementation. Even though `ml/train.py` writes real forecasts to the database, `/api/forecast` never queries Supabase table `public.model_predictions` to retrieve them!

---

## 3. Transparency & Safeguard Disclaimers

The frontend displays an appropriate safeguard disclaimer:
`"Research Prototype Notice: Groundwater forecasts represent statistical quantile estimates with confidence bounds. Do not use as authoritative disaster declarations without CGWB field corroboration."`

However, until `/api/forecast/route.ts` is wired to read real records from `public.model_predictions`, the numbers shown on screen are mock offsets rather than real model predictions.
