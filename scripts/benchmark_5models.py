"""
Script to evaluate all 5 forecasting candidates on identical test sets:
1. Persistence
2. Seasonal Persistence
3. Ridge Regression (alpha=10.0)
4. ElasticNet (alpha=0.1, l1_ratio=0.5)
5. Quantile Gradient Boosting (P50)

Evaluated strictly on identical held-out test splits.
"""
import os
import sys
sys.path.insert(0, os.path.abspath('.'))
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge, ElasticNet
from sklearn.metrics import mean_squared_error, mean_absolute_error

from ml.feature_engineering import clean_and_harmonize_observations, build_station_training_matrix
from ml.models import QuantileGroundwaterModel
from ml.validation import mae, rmse, nse, interval_coverage, quantile_crossings, rmse_improvement_pct

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

def eval_metrics(yt, yp):
    m = np.isfinite(yt) & np.isfinite(yp)
    y_true, y_pred = yt[m], yp[m]
    if len(y_true) < 2:
        return {"mae": np.nan, "rmse": np.nan, "nse": np.nan, "n": len(y_true)}
    r = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    a = float(mean_absolute_error(y_true, y_pred))
    denom = np.sum((y_true - np.mean(y_true)) ** 2)
    nse_val = float(1.0 - (np.sum((y_true - y_pred) ** 2) / denom)) if denom > 0 else np.nan
    return {"mae": round(a, 3), "rmse": round(r, 3), "nse": round(nse_val, 3), "n": len(y_true)}

def benchmark_full():
    rows = []
    horizon = "target_h1"
    feature_cols = ["wl_origin", "wl_prev", "wl_year_before_target", "drawdown_velocity_q1", "season_code"]
    
    for state_name, file_path in DATASETS.items():
        raw_df = pd.read_csv(file_path, low_memory=False)
        clean_df = clean_and_harmonize_observations(raw_df)
        matrix = build_station_training_matrix(clean_df)
        
        valid_df = matrix.dropna(subset=["wl_origin", horizon]).copy()
        target_dates = sorted(valid_df["target_h1_date"].dropna().unique())
        test_dates = target_dates[-2:]
        test_df = valid_df[valid_df["target_h1_date"].isin(test_dates)].copy()
        test_min_origin = test_df["origin_date"].min()
        train_df = valid_df[valid_df["target_h1_date"] <= test_min_origin].copy()
        
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
        
        # 1. Persistence
        y_persist = test_df["wl_origin"].values
        m_persist = eval_metrics(y_test.values, y_persist)
        
        # 2. Seasonal Persistence
        y_seasonal = np.where(test_df["wl_year_before_target"].notnull(), test_df["wl_year_before_target"].values, test_df["wl_origin"].values)
        m_seasonal = eval_metrics(y_test.values, y_seasonal)
        
        # 3. Ridge Regression
        ridge = Ridge(alpha=10.0)
        ridge.fit(X_train, y_train)
        y_ridge = ridge.predict(X_test)
        m_ridge = eval_metrics(y_test.values, y_ridge)
        
        # 4. ElasticNet
        enet = ElasticNet(alpha=0.1, l1_ratio=0.5, random_state=42)
        enet.fit(X_train, y_train)
        y_enet = enet.predict(X_test)
        m_enet = eval_metrics(y_test.values, y_enet)
        
        # 5. Quantile GB (P50)
        q_model = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
        q_model.fit(X_train, y_train)
        preds_q = q_model.predict(X_test, enforce_ordering=True)
        m_qgb = eval_metrics(y_test.values, preds_q["p50"])
        
        # Uncertainty
        cov = interval_coverage(y_test.values, preds_q["p10"], preds_q["p90"])
        width = mean_interval_width(preds_q["p10"], preds_q["p90"])
        crossings = quantile_crossings(preds_q["p10"], preds_q["p50"], preds_q["p90"])
        
        test_dates_str = f"{test_dates[0].strftime('%Y-%m-%d')} to {test_dates[1].strftime('%Y-%m-%d')}"
        
        rows.append({
            "State": state_name,
            "Test Dates": test_dates_str,
            "N_train": len(X_train),
            "N_test": len(X_test),
            "Persistence_RMSE": m_persist["rmse"],
            "Seasonal_RMSE": m_seasonal["rmse"],
            "Ridge_RMSE": m_ridge["rmse"],
            "ElasticNet_RMSE": m_enet["rmse"],
            "QuantileGB_RMSE": m_qgb["rmse"],
            "QuantileGB_MAE": m_qgb["mae"],
            "QuantileGB_NSE": m_qgb["nse"],
            "QGB_vs_Seasonal_pct": rmse_improvement_pct(m_qgb["rmse"], m_seasonal["rmse"]),
            "Ridge_vs_Seasonal_pct": rmse_improvement_pct(m_ridge["rmse"], m_seasonal["rmse"]),
            "Coverage_80pct": round(cov * 100.0, 1),
            "Mean_Width_m": round(width, 2),
            "Crossings": round(float(np.mean(crossings)) * 100.0, 1)
        })
        
    res_df = pd.DataFrame(rows)
    print(res_df.to_string(index=False))
    res_df.to_csv("audit/benchmark_5models_results.csv", index=False)

if __name__ == "__main__":
    os.makedirs("audit", exist_ok=True)
    benchmark_full()
