"""
Comprehensive Multi-State Forecasting Benchmark Engine
Compares:
1. Last-Observation Persistence
2. Seasonal Persistence (Year-Lag Delta)
3. Regularized Ridge Linear Model
4. Corrected Quantile Gradient Boosting with Non-Crossing Quantiles

Strict Chronological Split:
Train targets <= 2023-06-30; Test origins >= 2023-07-01. Zero target overlap.
"""
import os
import sys
sys.path.insert(0, os.path.abspath('.'))
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, mean_absolute_error

from ml.feature_engineering import clean_and_harmonize_observations, build_station_training_matrix
from ml.models import QuantileGroundwaterModel
from ml.validation import mae, rmse, nse, pinball, interval_coverage, quantile_crossings, rmse_improvement_pct

def mean_interval_width(lo, hi):
    m = np.isfinite(lo) & np.isfinite(hi)
    return float(np.mean(np.asarray(hi)[m] - np.asarray(lo)[m])) if np.any(m) else np.nan

DATASETS = {
    'Punjab': 'data/sources/cgwb_contrast/PB.csv',
    'Haryana': 'data/sources/cgwb_contrast/HR.csv',
    'Rajasthan': 'data/sources/cgwb_contrast/RJ.csv',
    'Assam': 'data/sources/cgwb_contrast/AS.csv',
    'Arunachal Pradesh': 'data/sources/cgwb_contrast/AR.csv',
}

FEATURES_BASE = ["wl_origin", "wl_prev", "wl_year_before_target", "drawdown_velocity_q1", "season_code"]

def evaluate_predictions(y_true, y_pred, name="Model"):
    m = np.isfinite(y_true) & np.isfinite(y_pred)
    yt, yp = y_true[m], y_pred[m]
    if len(yt) < 2:
        return {"mae": np.nan, "rmse": np.nan, "nse": np.nan, "n": len(yt)}
    r = float(np.sqrt(mean_squared_error(yt, yp)))
    a = float(mean_absolute_error(yt, yp))
    denom = np.sum((yt - np.mean(yt)) ** 2)
    nse_val = float(1.0 - (np.sum((yt - yp) ** 2) / denom)) if denom > 0 else np.nan
    return {"mae": round(a, 3), "rmse": round(r, 3), "nse": round(nse_val, 3), "n": len(yt)}

def run_state_benchmark(state_name, file_path, horizon="target_h1"):
    print(f"\n" + "=" * 80)
    print(f"EVALUATING STATE: {state_name.upper()} | HORIZON: {horizon}")
    print("=" * 80)
    
    if not os.path.exists(file_path):
        print(f"Skipping: file not found {file_path}")
        return None
        
    raw_df = pd.read_csv(file_path, low_memory=False)
    clean_df = clean_and_harmonize_observations(raw_df)
    matrix = build_station_training_matrix(clean_df)
    
    if matrix.empty or horizon not in matrix.columns:
        print(f"No valid pairs for horizon {horizon}")
        return None
        
    # Valid rows for this horizon
    valid_df = matrix.dropna(subset=["wl_origin", horizon]).copy()
    if len(valid_df) < 20:
        print(f"Insufficient samples: {len(valid_df)}")
        return None
        
    # Strict Chronological split: test on final target dates
    target_dates = sorted(valid_df["target_h1_date" if horizon=="target_h1" else "target_h4_date"].dropna().unique())
    if len(target_dates) < 3:
        print("Insufficient temporal breadth for walk-forward test split")
        return None
        
    # Last 2 distinct campaign dates as test set
    test_dates = target_dates[-2:]
    target_date_col = "target_h1_date" if horizon=="target_h1" else "target_h4_date"
    test_df = valid_df[valid_df[target_date_col].isin(test_dates)].copy()
    
    # Train cutoff: train target date <= min(test origin date)
    test_min_origin = test_df["origin_date"].min()
    train_df = valid_df[valid_df[target_date_col] <= test_min_origin].copy()
    
    print(f"Station count: {valid_df['station'].nunique()} | Total pairs: {len(valid_df)}")
    print(f"Train pairs: {len(train_df)} (up to {test_min_origin.date()}) | Test pairs: {len(test_df)} (targets: {[d.date() for d in test_dates]})")
    
    if len(train_df) < 15 or len(test_df) < 5:
        print("Train or test split too small for reliable statistics")
        return None
        
    # Features (fill missing lags with origin where necessary for tree models, or drop for clean comparison)
    # For fair comparison across all models, use rows with complete lags or median impute on train
    feature_cols = ["wl_origin", "wl_prev", "wl_year_before_target", "drawdown_velocity_q1", "season_code"]
    
    # Fit imputer strictly on train
    train_imputed = train_df.copy()
    test_imputed = test_df.copy()
    
    for c in feature_cols:
        med = train_imputed[c].median()
        train_imputed[c] = train_imputed[c].fillna(med)
        test_imputed[c] = test_imputed[c].fillna(med)
        
    X_train = train_imputed[feature_cols]
    y_train = train_imputed[horizon]
    X_test = test_imputed[feature_cols]
    y_test = test_imputed[horizon]
    
    # 1. Baseline 1: Last-observation persistence (predicts wl_origin)
    y_pred_persist = test_df["wl_origin"].values
    m_persist = evaluate_predictions(y_test.values, y_pred_persist, "Persistence")
    
    # 2. Baseline 2: Seasonal persistence (predicts wl_year_before_target)
    # If year before target is missing, fallback to wl_origin
    y_pred_seasonal = np.where(test_df["wl_year_before_target"].notnull(), test_df["wl_year_before_target"].values, test_df["wl_origin"].values)
    m_seasonal = evaluate_predictions(y_test.values, y_pred_seasonal, "Seasonal Persistence")
    
    # 3. Candidate 1: Ridge Regularized Linear Model
    ridge = Ridge(alpha=10.0)
    ridge.fit(X_train, y_train)
    y_pred_ridge = ridge.predict(X_test)
    m_ridge = evaluate_predictions(y_test.values, y_pred_ridge, "Ridge Regression")
    
    # 4. Candidate 2: Quantile Gradient Boosting with Non-Crossing Ordering
    q_model = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
    q_model.fit(X_train, y_train)
    preds_q = q_model.predict(X_test, enforce_ordering=True)
    m_qgb = evaluate_predictions(y_test.values, preds_q["p50"], "Quantile GB (P50)")
    
    # Interval metrics
    cov = interval_coverage(y_test.values, preds_q["p10"], preds_q["p90"])
    width = mean_interval_width(preds_q["p10"], preds_q["p90"])
    crossings = quantile_crossings(preds_q["p10"], preds_q["p50"], preds_q["p90"])
    crossing_rate = float(np.mean(crossings))
    
    # Compute improvements
    impr_vs_persist = rmse_improvement_pct(m_qgb["rmse"], m_persist["rmse"])
    impr_vs_seasonal = rmse_improvement_pct(m_qgb["rmse"], m_seasonal["rmse"])
    
    print("-" * 80)
    print(f"BENCHMARK RESULTS FOR {state_name} ({horizon}):")
    print(f"  [1] Persistence:       RMSE = {m_persist['rmse']:.3f}m | MAE = {m_persist['mae']:.3f}m | NSE = {m_persist['nse']}")
    print(f"  [2] Seasonal Baseline: RMSE = {m_seasonal['rmse']:.3f}m | MAE = {m_seasonal['mae']:.3f}m | NSE = {m_seasonal['nse']}")
    print(f"  [3] Ridge Regression:  RMSE = {m_ridge['rmse']:.3f}m | MAE = {m_ridge['mae']:.3f}m | NSE = {m_ridge['nse']}")
    print(f"  [4] Quantile GB (P50): RMSE = {m_qgb['rmse']:.3f}m | MAE = {m_qgb['mae']:.3f}m | NSE = {m_qgb['nse']}")
    print(f"  --> RMSE Improvement vs Persistence: {impr_vs_persist:+.1f}%")
    print(f"  --> RMSE Improvement vs Seasonal:    {impr_vs_seasonal:+.1f}%")
    print(f"  --> Empirical 80% Interval Coverage: {cov*100:.1f}% (Nominal: 80.0%) | Mean Width: {width:.2f}m")
    print(f"  --> Quantile Crossing Inversions:    {crossing_rate*100:.1f}% (Must be 0.0%)")
    
    return {
        "state": state_name,
        "horizon": horizon,
        "test_n": len(y_test),
        "persist_rmse": m_persist["rmse"],
        "seasonal_rmse": m_seasonal["rmse"],
        "ridge_rmse": m_ridge["rmse"],
        "qgb_rmse": m_qgb["rmse"],
        "qgb_mae": m_qgb["mae"],
        "qgb_nse": m_qgb["nse"],
        "impr_vs_persist_pct": impr_vs_persist,
        "impr_vs_seasonal_pct": impr_vs_seasonal,
        "coverage_p10_p90": cov,
        "mean_width_m": width,
        "crossing_rate": crossing_rate
    }

if __name__ == "__main__":
    results = []
    # Test h=1 (1 quarter)
    for st, path in DATASETS.items():
        res = run_state_benchmark(st, path, horizon="target_h1")
        if res:
            results.append(res)
            
    print("\n" + "=" * 80)
    print("ALL STATES 1-QUARTER FORECAST SUMMARY TABLE")
    print("=" * 80)
    res_df = pd.DataFrame(results)
    print(res_df.to_string(index=False))
