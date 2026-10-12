# JalDrishti — AI & Machine Learning Implementation Plan & Roadmap
**Document ID:** `PLN-AIML-001`  
**Target:** Robust, Scientifically Validated Groundwater Level Forecasting for Pilot Blocks in Bundelkhand  
**Compliance Standards:** JalDrishti TRD v1.0, Project Rules (Data & Scientific Integrity), WMO Guidelines  

---

## 1. Executive Strategy & Scientific Principles

Per Section 5 of the JalDrishti Workspace Rules:
1. **Never Present Simulated or Uncalibrated Models as Validated Forecasts.**
2. **Prevent Temporal and Spatial Data Leakage:** Piezometer observations from future quarters or neighboring stations within the same localized fractured aquifer compartment must not leak into training sets.
3. **Mandatory Baseline Benchmark:** A complex deep-learning model (e.g., LSTM) is justified only if it empirically outperforms a simple seasonal persistence baseline and classical auto-regressive model (ARIMA / SARIMAX).
4. **Uncertainty Quantification:** Groundwater depth forecasts must provide confidence prediction intervals (P10 / P50 / P90 or 95% CI) rather than deceptive point precision.

---

## 2. Technical Architecture & ML Stack

```
[Raw Datasets (CGWB + IMD + GRACE)] 
       ↓
[Feature Engineering & Temporal Alignment] 
       ↓
[Baseline Models: Persistence & SARIMAX] vs [Candidate ML: XGBoost & LSTM]
       ↓
[Rolling-Origin Cross-Validation (RMSE, MAE, NSE)]
       ↓
[Quantized ONNX Export & Supabase model_registry]
       ↓
[Next.js Serverless API /api/forecast & Confidence Band UI]
```

### Technology Selection
- **Feature Pipeline & Training:** Python 3.11 with `uv`, `pandas`, `polars`, `scikit-learn`, `xgboost`, `pytorch`.
- **Runtime Inference:** `onnxruntime-web` or Node.js `@onnxruntime/node` integrated directly into Next.js App Router API routes, avoiding Python server overhead in production.
- **Persistence & Auditing:** PostgreSQL `model_registry` (model version, hyperparams, training timestamp, validation metrics) and `model_predictions` (predicted depth, confidence intervals, prediction horizon).

---

## 3. Data Schema & Feature Engineering

### 3.1 Input Features Matrix ($X_t$)
1. **Hydrological Lag Features:**
   - $GW_{t-1}, GW_{t-2}, GW_{t-4}$ (Groundwater depth lag 1 quarter, 2 quarters, and previous year same season).
   - $\Delta GW_{t-1, t-2}$ (Quarterly drawdown velocity).
2. **Meteorological Drivers:**
   - $P_{\text{cum-3m}}$ (Cumulative 90-day precipitation from IMD 0.25° grid).
   - $\text{SPI-3}$ (Standardized Precipitation Index - 3 Month).
   - Monsoon departure percentage from 30-year normal.
3. **Regional Storage (Gravity / Satellite):**
   - $\text{TWSA}_{\text{GRACE}}$ (Terrestrial Water Storage Anomaly, monthly equivalent water height).
4. **Static Geomorphic & Hydrogeological Embeddings:**
   - Aquifer Lithology (Weathered Granite / Gneiss / Quartzite / Alluvium).
   - Net Sown Area / Irrigated Cropland ratio.

### 3.2 Target Variable ($Y_{t+h}$)
- **Target:** Depth to water level in meters below ground level ($\text{m bgl}$) at horizon $h \in \{1, 2, 4\}$ quarters (3 months, 6 months, 12 months ahead).

---

## 4. Progressive Implementation Roadmap

```
Phase 1: Dataset Curation & Leakage-Free Splitting
└── Tasks: Clean 2021-2025 CGWB MP well data, interpolate gaps safely, build block features.
Phase 2: Baseline Benchmark Establishment
└── Tasks: Implement Seasonal Persistence & SARIMAX baselines to define target accuracy.
Phase 3: Model Training, Cross-Validation & Hyperparameter Tuning
└── Tasks: Train Gradient Boosted Trees and Sequence LSTM with Rolling-Origin CV.
Phase 4: Uncertainty Estimation & Safeguard Calibration
└── Tasks: Conformal Prediction intervals (P10/P50/P90); calibrate against dry/wet extremes.
Phase 5: ONNX Pipeline Export & Node/Next.js Runtime Integration
└── Tasks: Quantize model to ONNX, build Next.js inference API (/api/forecast).
Phase 6: UI Visualization & Public Safeguard Enforcement
└── Tasks: Multi-axis forecast chart with confidence bands in /monitoring and /risk-assessment.
```

### Detailed Phase Breakdown

#### Phase 1: Dataset Curation & Feature Engineering (Sprint 1)
- **Task 1.1:** Process `gwl_manual_quarterly_cgwb_mp_2021_2025.xlsx` into clean block-level time-series for the 6 pilot blocks (Bijawar, Rajnagar, Baldeogarh, Jatara, Palera, Tikamgarh).
- **Task 1.2:** Aggregate IMD gridded daily rainfall to quarterly accumulations per block boundary using Sutherland-Hodgman clipping.
- **Task 1.3:** Build feature extraction scripts ensuring strict temporal indexing (no future data leakage).

#### Phase 2: Baselines & Validation Harness (Sprint 2)
- **Task 2.1:** Implement **Persistence Baseline** (Next quarter depth = current depth $\pm$ historical seasonal delta).
- **Task 2.2:** Implement **SARIMAX** with rainfall as exogenous regressor.
- **Task 2.3:** Setup Rolling-Origin Walk-Forward Cross-Validation (expanding window, evaluating forecast error across 2023–2025 test seasons).
- **Evaluation Metrics:**
  - $\text{RMSE}$ (Root Mean Square Error) $< 1.5\text{ m}$.
  - $\text{MAE}$ (Mean Absolute Error) $< 1.0\text{ m}$.
  - $\text{NSE}$ (Nash-Sutcliffe Efficiency) $> 0.65$.

#### Phase 3: Machine Learning Model Development (Sprint 3)
- **Task 3.1:** Train multi-output **XGBoost / LightGBM Regressor** with Quantile Loss ($q \in [0.1, 0.5, 0.9]$).
- **Task 3.2:** Train **Bidirectional LSTM / GRU** recurrent neural network modeling long-term multi-year recharge inertia.
- **Task 3.3:** Compare against baselines. Only promote ML model if it outperforms SARIMAX by $\ge 15\%$ on held-out RMSE.

#### Phase 4: ONNX Export & Database Ledger (Sprint 4)
- **Task 4.1:** Export chosen model to ONNX format with graph optimization.
- **Task 4.2:** Populate PostgreSQL `model_registry` with model metadata, checksum, training loss, and test NSE.
- **Task 4.3:** Ingest pre-calculated model predictions into `model_predictions` table.

#### Phase 5: Next.js Runtime Integration (Sprint 5)
- **Task 5.1:** Create `/api/forecast` endpoint utilizing `onnxruntime-node` or PostgREST queries against `model_predictions`.
- **Task 5.2:** Add dynamic time-series forecasting charts in `src/app/monitoring/page.tsx` rendering:
  - Solid line: Observed historical CGWB depth (2021–2025).
  - Dotted line: P50 forecast (3-month, 6-month, 12-month horizon).
  - Shaded area: 90% confidence uncertainty interval (P10 to P90).

#### Phase 6: Governance, Testing & Safe Wording Enforcement (Sprint 6)
- **Task 6.1:** Author automated unit & integration tests (`tests/mlForecasting.test.ts`).
- **Task 6.2:** Mandatory Safe Wording enforcement:
  - Prominent badge: *"ML Research Forecast — Subject to Seasonal Recharge Verification"*.
  - Strict prohibition of countdowns like "days until water depletion".
