# JAL DRISHTI — Model Inventory & Registry Audit
**Audit Date**: October 13, 2026  
**Document**: `01_model_inventory.md`  

---

## 1. Discovered Models, Algorithms, and Estimators Inventory

| Field | Model 1: Quantile Regressor | Model 2: Sequence LSTM | Model 3: Seasonal Persistence | Model 4: Descriptive GSS Heuristic | Model 5: Frontend Offset Generator |
|---|---|---|---|---|---|
| **Model Name** | `QuantileGroundwaterModel` | `GroundwaterLSTM` | `SeasonalPersistenceBaseline` | `calculateDescriptiveGss` | Static Seasonal Horizon Offsets |
| **Category** | Machine Learning (Gradient Boosted Trees) | Machine Learning (Deep Neural Network) | Statistical Time-Series Baseline | Rule-Based Multi-Criteria Decision Analysis | Heuristic UI Arithmetic |
| **Source File** | [`ml/models.py`](file:///d:/Projects/JalDrishti/ml/models.py#L14) | [`ml/lstm_model.py`](file:///d:/Projects/JalDrishti/ml/lstm_model.py#L17) | [`ml/baselines.py`](file:///d:/Projects/JalDrishti/ml/baselines.py#L50) | [`src/lib/services/scientificEngine.ts`](file:///d:/Projects/JalDrishti/src/lib/services/scientificEngine.ts#L64) | [`src/app/api/forecast/route.ts`](file:///d:/Projects/JalDrishti/src/app/api/forecast/route.ts#L45) |
| **Entry Point** | `fit()`, `predict()` in `ml/train.py` | `forward()` (PyTorch `nn.Module`) | `fit()`, `predict()` in `ml/train.py` | `calculateDescriptiveGss()` | `GET()` in `/api/forecast` |
| **Training Status** | **VERIFIED (Trained on CGWB CSV)** | **NOT TRAINED (Skeleton only)** | **VERIFIED (Fitted on Training Split)** | **NOT APPLICABLE (Formulaic)** | **NOT APPLICABLE (Hardcoded)** |
| **Training Dataset** | `data/sources/cgwb_mp_cleaned_proper.csv` (13,090 rows) | N/A (Untrained) | `data/sources/cgwb_mp_cleaned_proper.csv` | N/A (Static weights) | N/A (Static offsets) |
| **Target Variable** | Groundwater depth at $t+1$ (`target_h1`, mbgl) | Multi-horizon depths ($h=1, 2, 4$) | Groundwater depth at $t$ | Normalized Stress Score (0–100) | Groundwater depth ($t+1, t+2, t+4$) |
| **Input Features** | 5 features (`water_level_lag_1`, `lag_2`, `lag_4`, `drawdown_velocity`, `season_code`) | 8 input dimensions | Observation depth at $t-4$ + seasonal trend delta | 4 indicators (depth, rainfall deficit, GRACE TWSA, NDVI) | `currentDepth` scalar |
| **Model Artifact** | Stored in runtime memory; predictions written to Supabase `public.model_predictions` | None (no `.pth` or `.pt` checkpoint file exists) | Dynamic dictionary of seasonal deltas | TypeScript rule set | Hardcoded array of objects |
| **Evaluation Function** | `calculate_hydrological_metrics()` in `ml/baselines.py` | None | `calculate_hydrological_metrics()` | Unit tests in `tests/scientificEngine.test.ts` | None |
| **Reported Metrics** | RMSE: 0.00m – 3.59m; MAE: 0.00m – 3.10m; NSE: -0.85 – 1.00 | None | RMSE: 1.30m – 4.98m; MAE: 1.13m – 4.37m | Deterministic bounds ($0 \le \text{GSS} \le 100$) | Hardcoded $+0.45$m, $+0.90$m, $+0.25$m |
| **App Integration** | **DISCONNECTED** (persisted in DB, ignored by `/api/forecast`) | **DISCONNECTED** | **DISCONNECTED** | **CONNECTED** (via `src/lib/services/geospatialService.ts`) | **CONNECTED** (directly rendered on `/monitoring`) |
| **Current Status** | **VALIDATION DEFECTS (STATUS 5)** | **IMPLEMENTED, NOT TRAINED (STATUS 2)** | **EXPERIMENTALLY VALIDATED BASELINE** | **RULE-BASED OPERATIONAL** | **PROHIBITED HEURISTIC (TO REPLACE)** |

---

## 2. Key Inventory Conclusions

1. **Only ONE trained ML algorithm exists**: Scikit-Learn `GradientBoostingRegressor` wrapped in `QuantileGroundwaterModel`.
2. **PyTorch Deep Learning (`GroundwaterLSTM`) is code-only**: PyTorch is not even installed in the environment (it imports fallback dummy class), and `ml/train.py` contains zero training loops for sequence models.
3. **The user interface is bypassed**: While `ml/train.py` successfully computes and inserts real model predictions into Supabase `public.model_predictions`, the active web application displays hardcoded static arithmetic (`currentDepth + 0.45`).
