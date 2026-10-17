"""
Canonical Benchmark for Newly Acquired Authoritative Datasets:
1. Uttar Pradesh (UPGW Semi-Annual & Annual Networks, 7,969 stations, 189k records)
2. Madhya Pradesh Ground Water Department (MP GWD, 5,156 wells, 590k records)

Compares:
- Last-Observation Persistence
- Seasonal Persistence
- Ridge Regression
- Quantile Gradient Boosting (P10, P50, P90)
"""
import os
import sys
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
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
    # Handle near-zero variance
    if denom <= 1e-4:
        nse_val = np.nan
    else:
        nse_val = float(1.0 - (np.sum((y_true - y_pred) ** 2) / denom))
    return {"mae": round(a, 3), "rmse": round(r, 3), "nse": round(nse_val, 3) if not np.isnan(nse_val) else np.nan, "n": len(y_true)}

def benchmark_up_semi_annual():
    print("\n" + "=" * 80)
    print("EVALUATING ACQUIRED DATASET: UTTAR PRADESH (UPGW) | HORIZON: Semi-Annual (h=6m)")
    print("=" * 80)
    
    file_path = "data/sources/up_nwic_manual.csv"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return None
        
    df = pd.read_csv(file_path, low_memory=False)
    df['observation_date'] = pd.to_datetime(df['Data Acquisition Time'], errors='coerce', dayfirst=True)
    df['water_level_mbgl'] = pd.to_numeric(df['Groundwater Level Quarterly Manual (meter)'], errors='coerce')
    df = df.rename(columns={'Station': 'station'})
    
    # Filter valid range and focus on recent decadal data (2010-2019) to ensure high station overlap
    df = df[(df['water_level_mbgl'] >= 0.0) & (df['water_level_mbgl'] <= 150.0)]
    df = df[df['observation_date'] >= '2010-01-01'].dropna(subset=['station', 'observation_date', 'water_level_mbgl'])
    
    clean = df.groupby(['station', 'observation_date'])['water_level_mbgl'].mean().reset_index().sort_values(['station', 'observation_date'])
    
    # Build semi-annual pairs (150 to 210 days)
    records = []
    for st, g in clean.groupby('station'):
        d_vals = g['observation_date'].values
        w_vals = g['water_level_mbgl'].values
        n = len(d_vals)
        if n < 2:
            continue
        for i in range(n):
            t0 = d_vals[i]
            y0 = w_vals[i]
            prev_y = w_vals[i-1] if i > 0 else np.nan
            
            # Find year-ago lag (315 to 415 days)
            year_ago_y = np.nan
            for k in range(i):
                diff_k = (t0 - d_vals[k]) / np.timedelta64(1, 'D')
                if 315 <= diff_k <= 415:
                    year_ago_y = w_vals[k]
                    break
                    
            for j in range(i + 1, n):
                diff = (d_vals[j] - t0) / np.timedelta64(1, 'D')
                if 150 <= diff <= 210:
                    records.append({
                        'station': st,
                        'origin_date': t0,
                        'target_date': d_vals[j],
                        'wl_origin': y0,
                        'wl_prev': prev_y,
                        'wl_year_ago': year_ago_y,
                        'season_code': pd.Timestamp(t0).month % 4,
                        'target': w_vals[j]
                    })
                    break
                    
    matrix = pd.DataFrame(records)
    print(f"Total valid semi-annual pairs in UP (2010-2019): {len(matrix)} across {matrix['station'].nunique()} stations")
    
    target_dates = sorted(matrix['target_date'].dropna().unique())
    test_dates = target_dates[-2:]
    test_df = matrix[matrix['target_date'].isin(test_dates)].copy()
    test_min_origin = test_df['origin_date'].min()
    train_df = matrix[matrix['target_date'] <= test_min_origin].copy()
    
    print(f"Train pairs: {len(train_df)} | Test pairs: {len(test_df)} (targets: {[pd.Timestamp(d).strftime('%Y-%m-%d') for d in test_dates]})")
    
    feature_cols = ['wl_origin', 'wl_prev', 'wl_year_ago', 'season_code']
    train_imputed = train_df.copy()
    test_imputed = test_df.copy()
    for c in feature_cols:
        m = train_imputed[c].median()
        train_imputed[c] = train_imputed[c].fillna(m)
        test_imputed[c] = test_imputed[c].fillna(m)
        
    X_train = train_imputed[feature_cols]
    y_train = train_imputed['target']
    X_test = test_imputed[feature_cols]
    y_test = test_imputed['target']
    
    # 1. Persistence
    y_persist = test_df['wl_origin'].values
    m_persist = eval_metrics(y_test.values, y_persist)
    
    # 2. Seasonal Persistence (year-ago)
    y_seasonal = np.where(test_df['wl_year_ago'].notnull(), test_df['wl_year_ago'].values, test_df['wl_origin'].values)
    m_seasonal = eval_metrics(y_test.values, y_seasonal)
    
    # 3. Ridge
    ridge = Ridge(alpha=10.0)
    ridge.fit(X_train, y_train)
    y_ridge = ridge.predict(X_test)
    m_ridge = eval_metrics(y_test.values, y_ridge)
    
    # 4. Quantile GB
    q_model = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
    q_model.fit(X_train, y_train)
    preds_q = q_model.predict(X_test, enforce_ordering=True)
    m_qgb = eval_metrics(y_test.values, preds_q['p50'])
    
    cov = interval_coverage(y_test.values, preds_q['p10'], preds_q['p90'])
    width = mean_interval_width(preds_q['p10'], preds_q['p90'])
    crossings = float(np.mean(quantile_crossings(preds_q['p10'], preds_q['p50'], preds_q['p90'])))
    
    print("-" * 80)
    print(f"BENCHMARK RESULTS FOR UTTAR PRADESH (h=6m / Semi-Annual):")
    print(f"  [1] Persistence:       RMSE = {m_persist['rmse']:.3f}m | MAE = {m_persist['mae']:.3f}m | NSE = {m_persist['nse']}")
    print(f"  [2] Seasonal Baseline: RMSE = {m_seasonal['rmse']:.3f}m | MAE = {m_seasonal['mae']:.3f}m | NSE = {m_seasonal['nse']}")
    print(f"  [3] Ridge Regression:  RMSE = {m_ridge['rmse']:.3f}m | MAE = {m_ridge['mae']:.3f}m | NSE = {m_ridge['nse']}")
    print(f"  [4] Quantile GB (P50): RMSE = {m_qgb['rmse']:.3f}m | MAE = {m_qgb['mae']:.3f}m | NSE = {m_qgb['nse']}")
    print(f"  --> QGB vs Persistence: {rmse_improvement_pct(m_qgb['rmse'], m_persist['rmse']):+.1f}%")
    print(f"  --> Ridge vs Persistence: {rmse_improvement_pct(m_ridge['rmse'], m_persist['rmse']):+.1f}%")
    print(f"  --> Coverage (80%):    {cov*100:.1f}% | Width: {width:.2f}m | Crossings: {crossings*100:.1f}%")
    
    return {
        'state': 'Uttar Pradesh',
        'network': 'UPGW Manual Network (NWIC)',
        'horizon': 'Semi-Annual (h=6m)',
        'n_train': len(X_train),
        'n_test': len(X_test),
        'persist_rmse': m_persist['rmse'],
        'seasonal_rmse': m_seasonal['rmse'],
        'ridge_rmse': m_ridge['rmse'],
        'qgb_rmse': m_qgb['rmse'],
        'qgb_nse': m_qgb['nse'],
        'coverage_80': cov,
        'mean_width': width
    }

def benchmark_mp_gwd_3m():
    print("\n" + "=" * 80)
    print("EVALUATING ACQUIRED DATASET: MADHYA PRADESH GWD | HORIZON: 3-Month (Quarterly)")
    print("=" * 80)
    
    file_path = "data/sources/mp_gwd_manual_monthly.csv"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return None
        
    df = pd.read_csv(file_path, low_memory=False)
    df['observation_date'] = pd.to_datetime(df['date'], errors='coerce', dayfirst=True)
    df['water_level_mbgl'] = pd.to_numeric(df['Water Level'], errors='coerce')
    df = df.rename(columns={'Well No': 'station'})
    
    # Filter valid range and focus on 2018-2025
    df = df[(df['water_level_mbgl'] >= 0.0) & (df['water_level_mbgl'] <= 150.0)]
    df = df[df['observation_date'] >= '2018-01-01'].dropna(subset=['station', 'observation_date', 'water_level_mbgl'])
    
    clean = df.groupby(['station', 'observation_date'])['water_level_mbgl'].mean().reset_index().sort_values(['station', 'observation_date'])
    
    # Build 3-month pairs (60 to 120 days)
    records = []
    for st, g in clean.groupby('station'):
        d_vals = g['observation_date'].values
        w_vals = g['water_level_mbgl'].values
        n = len(d_vals)
        if n < 2:
            continue
        for i in range(n):
            t0 = d_vals[i]
            y0 = w_vals[i]
            prev_y = w_vals[i-1] if i > 0 else np.nan
            
            # Find year-ago lag (315 to 415 days)
            year_ago_y = np.nan
            for k in range(i):
                diff_k = (t0 - d_vals[k]) / np.timedelta64(1, 'D')
                if 315 <= diff_k <= 415:
                    year_ago_y = w_vals[k]
                    break
                    
            for j in range(i + 1, n):
                diff = (d_vals[j] - t0) / np.timedelta64(1, 'D')
                if 60 <= diff <= 120:
                    records.append({
                        'station': st,
                        'origin_date': t0,
                        'target_date': d_vals[j],
                        'wl_origin': y0,
                        'wl_prev': prev_y,
                        'wl_year_ago': year_ago_y,
                        'season_code': pd.Timestamp(t0).month % 4,
                        'target': w_vals[j]
                    })
                    break
                    
    matrix = pd.DataFrame(records)
    print(f"Total valid 3-month pairs in MP GWD (2018-2025): {len(matrix)} across {matrix['station'].nunique()} wells")
    
    target_dates = sorted(matrix['target_date'].dropna().unique())
    # Hold out last ~10% temporal target dates
    split_idx = int(len(target_dates) * 0.90)
    test_dates = target_dates[split_idx:]
    test_df = matrix[matrix['target_date'].isin(test_dates)].copy()
    test_min_origin = test_df['origin_date'].min()
    train_df = matrix[matrix['target_date'] <= test_min_origin].copy()
    
    print(f"Train pairs: {len(train_df)} | Test pairs: {len(test_df)}")
    
    feature_cols = ['wl_origin', 'wl_prev', 'wl_year_ago', 'season_code']
    train_imputed = train_df.copy()
    test_imputed = test_df.copy()
    for c in feature_cols:
        m = train_imputed[c].median()
        train_imputed[c] = train_imputed[c].fillna(m)
        test_imputed[c] = test_imputed[c].fillna(m)
        
    X_train = train_imputed[feature_cols]
    y_train = train_imputed['target']
    X_test = test_imputed[feature_cols]
    y_test = test_imputed['target']
    
    # 1. Persistence
    y_persist = test_df['wl_origin'].values
    m_persist = eval_metrics(y_test.values, y_persist)
    
    # 2. Seasonal Persistence (year-ago)
    y_seasonal = np.where(test_df['wl_year_ago'].notnull(), test_df['wl_year_ago'].values, test_df['wl_origin'].values)
    m_seasonal = eval_metrics(y_test.values, y_seasonal)
    
    # 3. Ridge
    ridge = Ridge(alpha=10.0)
    ridge.fit(X_train, y_train)
    y_ridge = ridge.predict(X_test)
    m_ridge = eval_metrics(y_test.values, y_ridge)
    
    # 4. Quantile GB
    q_model = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
    q_model.fit(X_train, y_train)
    preds_q = q_model.predict(X_test, enforce_ordering=True)
    m_qgb = eval_metrics(y_test.values, preds_q['p50'])
    
    cov = interval_coverage(y_test.values, preds_q['p10'], preds_q['p90'])
    width = mean_interval_width(preds_q['p10'], preds_q['p90'])
    crossings = float(np.mean(quantile_crossings(preds_q['p10'], preds_q['p50'], preds_q['p90'])))
    
    print("-" * 80)
    print(f"BENCHMARK RESULTS FOR MADHYA PRADESH GWD (h=3m / Quarterly):")
    print(f"  [1] Persistence:       RMSE = {m_persist['rmse']:.3f}m | MAE = {m_persist['mae']:.3f}m | NSE = {m_persist['nse']}")
    print(f"  [2] Seasonal Baseline: RMSE = {m_seasonal['rmse']:.3f}m | MAE = {m_seasonal['mae']:.3f}m | NSE = {m_seasonal['nse']}")
    print(f"  [3] Ridge Regression:  RMSE = {m_ridge['rmse']:.3f}m | MAE = {m_ridge['mae']:.3f}m | NSE = {m_ridge['nse']}")
    print(f"  [4] Quantile GB (P50): RMSE = {m_qgb['rmse']:.3f}m | MAE = {m_qgb['mae']:.3f}m | NSE = {m_qgb['nse']}")
    print(f"  --> QGB vs Persistence: {rmse_improvement_pct(m_qgb['rmse'], m_persist['rmse']):+.1f}%")
    print(f"  --> Ridge vs Persistence: {rmse_improvement_pct(m_ridge['rmse'], m_persist['rmse']):+.1f}%")
    print(f"  --> Coverage (80%):    {cov*100:.1f}% | Width: {width:.2f}m | Crossings: {crossings*100:.1f}%")
    
    return {
        'state': 'Madhya Pradesh',
        'network': 'MP GWD State Network (NWIC)',
        'horizon': 'Quarterly (h=3m)',
        'n_train': len(X_train),
        'n_test': len(X_test),
        'persist_rmse': m_persist['rmse'],
        'seasonal_rmse': m_seasonal['rmse'],
        'ridge_rmse': m_ridge['rmse'],
        'qgb_rmse': m_qgb['rmse'],
        'qgb_nse': m_qgb['nse'],
        'coverage_80': cov,
        'mean_width': width
    }

if __name__ == '__main__':
    # Can run either or both
    benchmark_mp_gwd_3m()

