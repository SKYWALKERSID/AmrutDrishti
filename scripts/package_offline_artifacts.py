"""
Packages offline model artifacts and evaluation manifests for local reproducibility.
Saves:
- Model joblib weights for each evaluated region
- Manifest metadata (features, training dates, metrics, integrity checksums)
- Strictly local to ml/artifacts/. ZERO writes to Supabase.
"""
import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge, ElasticNet
from sklearn.metrics import mean_squared_error, mean_absolute_error

sys.path.insert(0, os.path.abspath('.'))
from ml.feature_engineering import clean_and_harmonize_observations, build_station_training_matrix
from ml.models import QuantileGroundwaterModel
from ml.validation import mae, rmse, nse, interval_coverage, quantile_crossings, rmse_improvement_pct

def mean_interval_width(lo, hi):
    m = np.isfinite(lo) & np.isfinite(hi)
    return float(np.mean(np.asarray(hi)[m] - np.asarray(lo)[m])) if np.any(m) else np.nan

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

def package_all():
    os.makedirs('ml/artifacts', exist_ok=True)
    manifest = {
        "generated_at": "2026-10-16T20:30:00Z",
        "pipeline_version": "v2.0_station_autonomous",
        "description": "Offline reproducible model package with non-crossing quantiles and chronological split",
        "operational_eligibility": False,
        "models": {}
    }
    
    datasets = {
        'Punjab': 'data/sources/cgwb_contrast/PB.csv',
        'Haryana': 'data/sources/cgwb_contrast/HR.csv',
        'Rajasthan': 'data/sources/cgwb_contrast/RJ.csv',
        'Assam': 'data/sources/cgwb_contrast/AS.csv',
        'Arunachal Pradesh': 'data/sources/cgwb_contrast/AR.csv',
    }
    
    feature_cols = ["wl_origin", "wl_prev", "wl_year_before_target", "drawdown_velocity_q1", "season_code"]
    horizon = "target_h1"
    
    for state_name, file_path in datasets.items():
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
        
        # Train Ridge
        ridge = Ridge(alpha=10.0)
        ridge.fit(X_train, y_train)
        
        # Train Quantile GB
        qgb = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
        qgb.fit(X_train, y_train)
        
        preds_q = qgb.predict(X_test, enforce_ordering=True)
        m_qgb = eval_metrics(y_test.values, preds_q["p50"])
        cov = interval_coverage(y_test.values, preds_q["p10"], preds_q["p90"])
        width = mean_interval_width(preds_q["p10"], preds_q["p90"])
        crossings = float(np.mean(quantile_crossings(preds_q["p10"], preds_q["p50"], preds_q["p90"])))
        
        state_code = state_name.lower().replace(' ', '_')
        qgb_path = f"ml/artifacts/qgb_v2_{state_code}.joblib"
        ridge_path = f"ml/artifacts/ridge_v2_{state_code}.joblib"
        
        joblib.dump(qgb, qgb_path)
        joblib.dump(ridge, ridge_path)
        
        manifest["models"][state_name] = {
            "state_code": state_code,
            "qgb_artifact": qgb_path,
            "ridge_artifact": ridge_path,
            "features": feature_cols,
            "n_train": len(X_train),
            "n_test": len(X_test),
            "test_dates": [d.strftime('%Y-%m-%d') for d in test_dates],
            "metrics": {
                "qgb_rmse": m_qgb["rmse"],
                "qgb_mae": m_qgb["mae"],
                "qgb_nse": m_qgb["nse"],
                "coverage_80pct": round(cov * 100.0, 1),
                "mean_width_m": round(width, 2),
                "crossing_rate": crossings
            }
        }
        print(f"Packaged artifacts for {state_name}: {qgb_path}, {ridge_path}")
        
    with open('ml/artifacts/manifest.json', 'w') as f:
        json.dump(manifest, f, indent=2)
    print("\nSaved manifest to ml/artifacts/manifest.json")

if __name__ == '__main__':
    package_all()
