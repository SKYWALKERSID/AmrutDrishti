"""
Evaluates MP DWLR Telemetry across the 5 models:
1. Persistence
2. Seasonal Persistence
3. Ridge Regression
4. ElasticNet
5. Quantile GB
"""
import os
import sys
import numpy as np
import pandas as pd
import requests
from sklearn.linear_model import Ridge, ElasticNet
from sklearn.metrics import mean_squared_error, mean_absolute_error

sys.path.insert(0, os.path.abspath('.'))
from ml.feature_engineering import build_station_training_matrix
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

def benchmark_mp_telemetry():
    env = {}
    if os.path.exists('.env.local'):
        with open('.env.local', 'r', encoding='utf-8') as f:
            for l in f:
                if '=' in l and not l.strip().startswith('#'):
                    k, v = l.strip().split('=', 1)
                    env[k.strip()] = v.strip().strip('\'"')
    url = env.get('NEXT_PUBLIC_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    
    r = requests.get(f"{url}/rest/v1/station_observations?select=station_id,observation_date,water_level_mbgl&limit=10000", headers=headers)
    df = pd.DataFrame(r.json())
    df['observation_date'] = pd.to_datetime(df['observation_date'])
    df['water_level_mbgl'] = pd.to_numeric(df['water_level_mbgl'], errors='coerce')
    df = df.rename(columns={'station_id': 'station'})
    
    matrix = build_station_training_matrix(df, station_col='station', date_col='observation_date', value_col='water_level_mbgl')
    
    horizon = "target_h1"
    valid_df = matrix.dropna(subset=["wl_origin", horizon]).copy()
    target_dates = sorted(valid_df["target_h1_date"].dropna().unique())
    test_dates = target_dates[-2:]
    test_df = valid_df[valid_df["target_h1_date"].isin(test_dates)].copy()
    test_min_origin = test_df["origin_date"].min()
    train_df = valid_df[valid_df["target_h1_date"] <= test_min_origin].copy()
    
    feature_cols = ["wl_origin", "wl_prev", "wl_year_before_target", "drawdown_velocity_q1", "season_code"]
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
    
    # 3. Ridge
    ridge = Ridge(alpha=10.0)
    ridge.fit(X_train, y_train)
    y_ridge = ridge.predict(X_test)
    m_ridge = eval_metrics(y_test.values, y_ridge)
    
    # 4. ElasticNet
    enet = ElasticNet(alpha=0.1, l1_ratio=0.5, random_state=42)
    enet.fit(X_train, y_train)
    y_enet = enet.predict(X_test)
    m_enet = eval_metrics(y_test.values, y_enet)
    
    # 5. Quantile GB
    q_model = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
    q_model.fit(X_train, y_train)
    preds_q = q_model.predict(X_test, enforce_ordering=True)
    m_qgb = eval_metrics(y_test.values, preds_q["p50"])
    
    cov = interval_coverage(y_test.values, preds_q["p10"], preds_q["p90"])
    width = mean_interval_width(preds_q["p10"], preds_q["p90"])
    crossings = quantile_crossings(preds_q["p10"], preds_q["p50"], preds_q["p90"])
    
    test_dates_str = f"{test_dates[0].strftime('%Y-%m-%d')} to {test_dates[1].strftime('%Y-%m-%d')}"
    
    print("\n" + "=" * 80)
    print("MP DWLR TELEMETRY BENCHMARK RESULTS (1Q / h=1):")
    print(f"  Test Dates:        {test_dates_str}")
    print(f"  Train / Test Pairs: {len(X_train)} / {len(X_test)}")
    print(f"  [1] Persistence:       RMSE = {m_persist['rmse']:.3f}m | MAE = {m_persist['mae']:.3f}m | NSE = {m_persist['nse']}")
    print(f"  [2] Seasonal Baseline: RMSE = {m_seasonal['rmse']:.3f}m | MAE = {m_seasonal['mae']:.3f}m | NSE = {m_seasonal['nse']}")
    print(f"  [3] Ridge Regression:  RMSE = {m_ridge['rmse']:.3f}m | MAE = {m_ridge['mae']:.3f}m | NSE = {m_ridge['nse']}")
    print(f"  [4] ElasticNet:        RMSE = {m_enet['rmse']:.3f}m | MAE = {m_enet['mae']:.3f}m | NSE = {m_enet['nse']}")
    print(f"  [5] Quantile GB (P50): RMSE = {m_qgb['rmse']:.3f}m | MAE = {m_qgb['mae']:.3f}m | NSE = {m_qgb['nse']}")
    print(f"  --> QGB vs Seasonal:   {rmse_improvement_pct(m_qgb['rmse'], m_seasonal['rmse']):+.1f}%")
    print(f"  --> Ridge vs Seasonal: {rmse_improvement_pct(m_ridge['rmse'], m_seasonal['rmse']):+.1f}%")
    print(f"  --> Coverage (80%):    {cov*100:.1f}% | Width: {width:.2f}m | Crossings: {float(np.mean(crossings))*100:.1f}%")

if __name__ == '__main__':
    benchmark_mp_telemetry()
