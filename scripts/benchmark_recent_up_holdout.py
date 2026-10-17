"""
JAL DRISHTI — Recent (Post-2019) Uttar Pradesh Hydrograph Holdout Benchmark
Evaluates the newly acquired Central Ground Water Board (CGWB) telemetry dataset:
`data/sources/up_cgwb_telemetry_2021_2025.csv` (304,146 readings across 171 stations, 2023-2025).
SHA-256: 44f35251df0b98e9acb3072dc343113b02388d3d3619db4dc2a09b1300f11814

Evaluates:
1. Last-Observation Persistence
2. Seasonal Persistence (12-month lag)
3. Ridge Regression
4. Quantile Gradient Boosting (P10, P50, P90)
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, mean_absolute_error

sys.path.insert(0, os.path.abspath('.'))
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
    nse_val = float(1.0 - (np.sum((y_true - y_pred) ** 2) / denom)) if denom > 1e-4 else np.nan
    return {"mae": round(a, 3), "rmse": round(r, 3), "nse": round(nse_val, 3) if not np.isnan(nse_val) else np.nan, "n": len(y_true)}

def benchmark_recent_up_telemetry():
    print("=" * 80)
    print("EVALUATING GENUINELY NEW UP HYDROGRAPH DATASET (2023-2025 CGWB TELEMETRY)")
    print("=" * 80)
    
    file_path = "data/sources/up_cgwb_telemetry_2021_2025.csv"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return None
        
    df = pd.read_csv(file_path, low_memory=False)
    print(f"Raw records: {len(df)} across {df['Station'].nunique()} stations in {df['District'].nunique()} districts")
    
    df['date'] = pd.to_datetime(df['Data Acquisition Time'], errors='coerce', dayfirst=True)
    raw_wl = pd.to_numeric(df['Groundwater Level Telemetry 6 Hourly (meter)'], errors='coerce')
    
    # In telemetry, water levels are recorded with negative values representing depth below ground level
    # or erroneous -9999 spikes. Filter physical depth range [0.0, 150.0] mbgl.
    depth_mbgl = raw_wl.abs()
    df['water_level_mbgl'] = np.where((depth_mbgl >= 0.0) & (depth_mbgl <= 150.0), depth_mbgl, np.nan)
    df = df.dropna(subset=['Station', 'date', 'water_level_mbgl'])
    df = df.rename(columns={'Station': 'station'})
    
    # Aggregate to daily station medians to smooth out sub-daily diurnal barometric noise
    daily = df.groupby(['station', df['date'].dt.date])['water_level_mbgl'].median().reset_index()
    daily['date'] = pd.to_datetime(daily['date'])
    daily = daily.sort_values(['station', 'date'])
    
    print(f"Cleaned daily observations: {len(daily)} across {daily['station'].nunique()} stations")
    print(f"Temporal span: {daily['date'].min().strftime('%Y-%m-%d')} to {daily['date'].max().strftime('%Y-%m-%d')}")
    
    # Build semi-annual (150 to 210 days) pairs using high-speed integer day arithmetic
    base_epoch = np.datetime64('2020-01-01')
    records = []
    for st, g in daily.groupby('station'):
        d_vals = g['date'].values
        d_days = ((d_vals - base_epoch) / np.timedelta64(1, 'D')).astype(int)
        w_vals = g['water_level_mbgl'].values
        n = len(d_vals)
        if n < 4:
            continue
            
        for i in range(1, n - 1):
            t0 = d_vals[i]
            t0_day = d_days[i]
            y0 = w_vals[i]
            y_prev = w_vals[i-1]
            dt_prev = t0_day - d_days[i-1]
            
            # Find year-ago lag (315 to 415 days)
            y_seasonal = np.nan
            for k in range(i - 1, -1, -1):
                dt_k = t0_day - d_days[k]
                if 315 <= dt_k <= 415:
                    y_seasonal = w_vals[k]
                    break
                elif dt_k > 415:
                    break
                    
            # Target at ~6 months (150 to 210 days)
            for j in range(i + 1, n):
                dt_j = d_days[j] - t0_day
                if dt_j > 210:
                    break
                if 150 <= dt_j <= 210:
                    records.append({
                        'station': st,
                        'origin_date': pd.Timestamp(t0),
                        'target_date': pd.Timestamp(d_vals[j]),
                        'elapsed_days': dt_j,
                        'wl_origin': y0,
                        'wl_prev': y_prev,
                        'wl_seasonal': y_seasonal,
                        'drawdown_velocity': (y0 - y_prev) / max(1.0, dt_prev),
                        'season_code': pd.Timestamp(t0).month % 4,
                        'target': w_vals[j]
                    })
                    break


                    
    matrix = pd.DataFrame(records)
    print(f"Total valid semi-annual pairs in recent UP telemetry: {len(matrix)} across {matrix['station'].nunique()} stations")
    
    if len(matrix) < 50:
        print("Insufficient pairs for recent semi-annual holdout; checking quarterly horizon...")
        return None
        
    # Strictly chronological walk-forward split (train on early 2023-2024, test on late 2024-2025)
    matrix = matrix.sort_values('target_date').reset_index(drop=True)
    split_idx = int(len(matrix) * 0.75)
    train_df = matrix.iloc[:split_idx].copy()
    test_df = matrix.iloc[split_idx:].copy()
    
    # Embargo isolation
    min_test_origin = test_df['origin_date'].min()
    train_df = train_df[train_df['target_date'] <= min_test_origin].copy()
    
    print(f"Train samples: {len(train_df)} | Recent Test holdout samples: {len(test_df)}")
    print(f"Test prediction targets: {test_df['target_date'].min().strftime('%Y-%m-%d')} to {test_df['target_date'].max().strftime('%Y-%m-%d')}")
    
    feature_cols = ['wl_origin', 'wl_prev', 'drawdown_velocity', 'season_code']
    for c in feature_cols:
        med = train_df[c].median()
        train_df[c] = train_df[c].fillna(med)
        test_df[c] = test_df[c].fillna(med)
        
    X_train = train_df[feature_cols]
    y_train = train_df['target']
    X_test = test_df[feature_cols]
    y_test = test_df['target'].values
    
    # 1. Persistence
    y_persist = test_df['wl_origin'].values
    m_persist = eval_metrics(y_test, y_persist)
    
    # 2. Seasonal Persistence (fallback to persistence if year-ago lag missing)
    y_seasonal = np.where(test_df['wl_seasonal'].notnull(), test_df['wl_seasonal'].values, test_df['wl_origin'].values)
    m_seasonal = eval_metrics(y_test, y_seasonal)
    
    # 3. Ridge Regression
    ridge = Ridge(alpha=10.0)
    ridge.fit(X_train, y_train)
    y_ridge = ridge.predict(X_test)
    m_ridge = eval_metrics(y_test, y_ridge)
    
    # 4. Quantile Gradient Boosting
    q_model = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
    q_model.fit(X_train, y_train)
    preds_q = q_model.predict(X_test, enforce_ordering=True)
    m_qgb = eval_metrics(y_test, preds_q['p50'])
    
    cov = interval_coverage(y_test, preds_q['p10'], preds_q['p90'])
    width = mean_interval_width(preds_q['p10'], preds_q['p90'])
    crossings = float(np.mean(quantile_crossings(preds_q['p10'], preds_q['p50'], preds_q['p90'])))
    
    print("-" * 80)
    print("BENCHMARK RESULTS ON RECENT UP OUT-OF-TIME HOLDOUT (2024-2025):")
    print(f"  [1] Persistence:       RMSE = {m_persist['rmse']:.3f}m | MAE = {m_persist['mae']:.3f}m | NSE = {m_persist['nse']}")
    print(f"  [2] Seasonal Baseline: RMSE = {m_seasonal['rmse']:.3f}m | MAE = {m_seasonal['mae']:.3f}m | NSE = {m_seasonal['nse']}")
    print(f"  [3] Ridge Regression:  RMSE = {m_ridge['rmse']:.3f}m | MAE = {m_ridge['mae']:.3f}m | NSE = {m_ridge['nse']}")
    print(f"  [4] Quantile GB (P50): RMSE = {m_qgb['rmse']:.3f}m | MAE = {m_qgb['mae']:.3f}m | NSE = {m_qgb['nse']}")
    print(f"  --> QGB vs Persistence: {rmse_improvement_pct(m_qgb['rmse'], m_persist['rmse']):+.1f}%")
    print(f"  --> Ridge vs Persistence: {rmse_improvement_pct(m_ridge['rmse'], m_persist['rmse']):+.1f}%")
    print(f"  --> Coverage (80%):    {cov*100:.1f}% | Width: {width:.2f}m | Crossings: {crossings*100:.1f}%")
    
    result = {
        'state': 'Uttar Pradesh',
        'network': 'UPGW / CGWB Telemetry Network (NWIC)',
        'source_url': 'https://nwdp.nwic.gov.in/dataset/e6a8307d-de95-4773-8e9f-a84d7a177d53/resource/84bfda45-8ead-436d-9c8e-f7a93ee57522/download/gwl_tel_6_hourly_upgw_up_2021_2025.csv',
        'sha256': '44f35251df0b98e9acb3072dc343113b02388d3d3619db4dc2a09b1300f11814',
        'horizon': 'Semi-Annual (h=6m)',
        'test_target_window': f"{test_df['target_date'].min().strftime('%Y-%m-%d')} to {test_df['target_date'].max().strftime('%Y-%m-%d')}",
        'train_samples': len(X_train),
        'test_samples': len(X_test),
        'test_stations': int(test_df['station'].nunique()),
        'metrics': {
            'persistence': m_persist,
            'seasonal': m_seasonal,
            'ridge': m_ridge,
            'quantile_gb_p50': m_qgb,
            'qgb_improvement_over_persist_pct': round(float(rmse_improvement_pct(m_qgb['rmse'], m_persist['rmse'])), 2),
            'interval_coverage_80': round(float(cov), 4),
            'mean_interval_width': round(float(width), 3),
            'quantile_crossings_rate': round(float(crossings), 4)
        }
    }
    
    os.makedirs('ml/artifacts', exist_ok=True)
    out_path = 'ml/artifacts/up_telemetry_holdout_benchmark.json'
    with open(out_path, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"Saved benchmark artifact to {out_path}")
    
    return result

if __name__ == '__main__':
    benchmark_recent_up_telemetry()

