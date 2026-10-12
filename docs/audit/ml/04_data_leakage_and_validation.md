# JAL DRISHTI — Data Leakage & Validation Strategy Audit
**Audit Date**: October 13, 2026  
**Document**: `04_data_leakage_and_validation.md`  

---

## 1. Systematic Data Leakage Investigation

| Leakage Vector | Code / Pipeline Check | Finding | Classification | Risk Analysis & Evidence |
|---|---|---|---|---|
| **Temporal Order Inversion** | Check if random `train_test_split(shuffle=True)` is used | `ml/train.py:84` uses sequential slicing: `train_df = matrix.iloc[:split_idx]`, `test_df = matrix.iloc[split_idx:]` | **NOT DETECTED** | Strictly forward-ordered walk-forward chronological split. Future rows never enter the training set. |
| **Autoregressive Feature Leakage** | Check lag feature creation | `ml/feature_engineering.py:67-72` uses positive shifts: `shift(1)`, `shift(2)`, `shift(4)` | **NOT DETECTED** | Lags only reference past quarters ($t-1, t-2, t-4$). Drawdown velocity uses `lag_1 - lag_2`. Zero future information in features. |
| **Target Generation Alignment** | Check forward target shifting | `ml/feature_engineering.py:105` uses `features_df["target_h1"] = features_df["water_level_mbgl"].shift(-1)` | **POTENTIAL LEAKAGE (IRREGULAR SPACING)** | If an intermediate observation quarter is missing in the raw series, `shift(-1)` takes the *next available row* (which could be 6 or 9 months later rather than strictly 3 months later), creating horizon distortion. |
| **Global Scaling / Normalization Leakage** | Check `StandardScaler` / `MinMaxScaler` across full dataset | No global scaler fitted. Features are raw meters and discrete season integers. | **NOT DETECTED** | No global means or standard deviations are leaked across split boundaries. |
| **Future Exogenous Leakage** | Check if future rainfall or satellite imagery is in feature matrix | Features are limited to past lags (`lag_1`, `lag_2`, `lag_4`, `season_code`). | **NOT DETECTED** | No post-event variables or future rainfall forecasts are fed into the training matrix. |
| **Spatial Cross-Station Contamination** | Check cross-station bleeding | Models are trained **independently per pilot block** (`for block_id in PILOT_BLOCKS:`). | **NOT DETECTED** | Separate models fit separate block boundaries; no spatial pooling contamination exists. |
| **Test Set Hyperparameter Over-tuning** | Check tuning search on test set | Hyperparameters (`max_depth=3, n_estimators=100`) are fixed constants; no grid-search over test set. | **NOT DETECTED** | Test set was evaluated purely for validation reporting, not for tuning feedback. |

---

## 2. Validation Strategy Review

### Temporal Forecasting Validation
- **Method**: Single-split chronological walk-forward validation (Train: earlier 80%, Test: latest 20%).
- **Adequacy**: Sound design for time-series. However, because it is a single historical cutoff rather than a multi-origin rolling backtest (e.g., rolling 4-fold temporal CV), seasonal biases in the final test period heavily influence the reported metrics.

### Geographic Generalization Evaluation
- **Method**: Local block-specific models.
- **Limitation**: The repository does **not** evaluate spatial transferability (e.g. training on Chhatarpur blocks and testing on unmonitored Tikamgarh blocks). A block without historical well data cannot currently use this model.

### Small-Data Vulnerability in Holdout Splits
- In **Baldeogarh** ($N=18$), the test set contains only **4 points**.
- In **Palera** ($N=13$), the test set contains only **3 points**.
- **Conclusion**: A test set with $N < 10$ has massive statistical variance. Palera's reported $0.001$m error and $1.00$ NSE is a small-sample artifact, not proof of generalization.
