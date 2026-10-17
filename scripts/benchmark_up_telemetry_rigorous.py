"""
JAL DRISHTI — Rigorous Temporal & Spatial UP Telemetry Validation Engine
Authoritative Evaluation Protocol:
1. Global Cutoff: Train origins strictly < 2025-01-01 with targets <= 2024-12-31.
   Test origins strictly >= 2025-01-01 with targets in 2025.
2. Complete Temporal Isolation & Embargo: Zero training targets overlap with test period.
3. Preprocessing Isolation: Imputers and scalers fitted strictly on training data.
4. Paired Comparisons: All models (Persistence, Seasonal Persistence, Ridge, Quantile GB)
   evaluated on the EXACT same eligible test pairs.
5. Multi-Horizon Coverage: Evaluates 1-Month (20-40d), 3-Month (75-105d), and 6-Month (150-210d).
6. Multi-Population Analysis:
   - Population A: All eligible stations.
   - Population B: Sensitivity analysis excluding confirmed/probable co-located stations.
   - Population C: Spatial holdout on 20% unseen stations excluded entirely from training.
7. Station-Level and Temporal Breakdown: Evaluates per-station distributions and quarterly sub-periods.
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

GLOBAL_CUTOFF = pd.Timestamp('2025-01-01')
TELEMETRY_PATH = "data/sources/up_cgwb_telemetry_2021_2025.csv"
RECONCILIATION_PATH = "data/derived/up_station_identity_reconciliation.csv"

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
    return {
        "mae": round(a, 3),
        "rmse": round(r, 3),
        "nse": round(nse_val, 3) if not np.isnan(nse_val) else np.nan,
        "n": len(y_true)
    }

def load_clean_daily_telemetry():
    assert os.path.exists(TELEMETRY_PATH), f"Missing {TELEMETRY_PATH}"
    df = pd.read_csv(TELEMETRY_PATH, low_memory=False)
    df['date'] = pd.to_datetime(df['Data Acquisition Time'], format='%d-%m-%Y %H:%M', errors='coerce')
    raw_wl = pd.to_numeric(df['Groundwater Level Telemetry 6 Hourly (meter)'], errors='coerce')
    depth_mbgl = raw_wl.abs()
    
    # Filter physical depths [0.0, 150.0] mbgl
    df['water_level_mbgl'] = np.where((depth_mbgl >= 0.0) & (depth_mbgl <= 150.0), depth_mbgl, np.nan)
    df = df.dropna(subset=['Station', 'date', 'water_level_mbgl']).rename(columns={'Station': 'station'})
    
    # Daily station medians to smooth diurnal transducer noise
    daily = df.groupby(['station', df['date'].dt.date])['water_level_mbgl'].median().reset_index()
    daily['date'] = pd.to_datetime(daily['date'])
    return daily.sort_values(['station', 'date'])

def build_horizon_pairs(daily, min_days, max_days):
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
            t0 = pd.Timestamp(d_vals[i])
            t0_day = d_days[i]
            y0 = w_vals[i]
            y_prev = w_vals[i-1]
            dt_prev = t0_day - d_days[i-1]
            
            # Find year-ago seasonal lag (315 to 415 days)
            y_seasonal = np.nan
            for k in range(i - 1, -1, -1):
                dt_k = t0_day - d_days[k]
                if 315 <= dt_k <= 415:
                    y_seasonal = w_vals[k]
                    break
                elif dt_k > 415:
                    break
                    
            # Find target in horizon window
            for j in range(i + 1, n):
                dt_j = d_days[j] - t0_day
                if dt_j > max_days:
                    break
                if min_days <= dt_j <= max_days:
                    target_date = pd.Timestamp(d_vals[j])
                    records.append({
                        'station': st,
                        'origin_date': t0,
                        'target_date': target_date,
                        'elapsed_days': dt_j,
                        'wl_origin': y0,
                        'wl_prev': y_prev,
                        'wl_seasonal': y_seasonal,
                        'drawdown_velocity': (y0 - y_prev) / max(1.0, float(dt_prev)),
                        'season_month': t0.month,
                        'target': w_vals[j]
                    })
                    break
                    
    matrix = pd.DataFrame(records)
    return matrix

def evaluate_paired_models(train_df, test_df, horizon_name):
    # Leakage assertions
    assert train_df['target_date'].max() < GLOBAL_CUTOFF, "LEAKAGE: Train target crosses global cutoff!"
    assert test_df['origin_date'].min() >= GLOBAL_CUTOFF, "LEAKAGE: Test origin precedes global cutoff!"
    assert train_df['target_date'].max() < test_df['origin_date'].min(), "LEAKAGE: Train target overlaps test origin!"
    
    feature_cols = ['wl_origin', 'wl_prev', 'drawdown_velocity', 'season_month']
    
    # Fit preprocessing on training data only
    meds = train_df[feature_cols].median()
    train_clean = train_df.copy()
    test_clean = test_df.copy()
    
    for c in feature_cols:
        train_clean[c] = train_clean[c].fillna(meds[c])
        test_clean[c] = test_clean[c].fillna(meds[c])
        
    X_train = train_clean[feature_cols]
    y_train = train_clean['target']
    X_test = test_clean[feature_cols]
    y_test = test_clean['target'].values
    
    # 1. Baseline: Last-Observation Persistence
    y_persist = test_clean['wl_origin'].values
    m_persist = eval_metrics(y_test, y_persist)
    
    # 2. Baseline: Seasonal Persistence (fallback to wl_origin if year-ago unavailable)
    y_seasonal = np.where(test_clean['wl_seasonal'].notnull(), test_clean['wl_seasonal'].values, test_clean['wl_origin'].values)
    m_seasonal = eval_metrics(y_test, y_seasonal)
    
    # 3. Model: Ridge Regression
    ridge = Ridge(alpha=10.0)
    ridge.fit(X_train, y_train)
    y_ridge = ridge.predict(X_test)
    m_ridge = eval_metrics(y_test, y_ridge)
    
    # 4. Model: Quantile Gradient Boosting
    q_model = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
    q_model.fit(X_train, y_train)
    preds_q = q_model.predict(X_test, enforce_ordering=True)
    m_qgb = eval_metrics(y_test, preds_q['p50'])
    
    cov = interval_coverage(y_test, preds_q['p10'], preds_q['p90'])
    width = mean_interval_width(preds_q['p10'], preds_q['p90'])
    crossings = float(np.mean(quantile_crossings(preds_q['p10'], preds_q['p50'], preds_q['p90'])))
    
    # Station-level distribution analysis (stations with >= 10 test samples)
    test_clean['pred_persist'] = y_persist
    test_clean['pred_seasonal'] = y_seasonal
    test_clean['pred_ridge'] = y_ridge
    test_clean['pred_qgb'] = preds_q['p50']
    test_clean['p10'] = preds_q['p10']
    test_clean['p90'] = preds_q['p90']
    
    st_persist_rmse, st_qgb_rmse, st_cov = [], [], []
    for st, g in test_clean.groupby('station'):
        if len(g) >= 10:
            yt_st = g['target'].values
            st_persist_rmse.append(np.sqrt(mean_squared_error(yt_st, g['pred_persist'].values)))
            st_qgb_rmse.append(np.sqrt(mean_squared_error(yt_st, g['pred_qgb'].values)))
            st_cov.append(interval_coverage(yt_st, g['p10'].values, g['p90'].values))
            
    # Temporal breakdown (Quarterly targets in 2025)
    temporal_breakdown = {}
    test_clean['target_quarter'] = test_clean['target_date'].dt.to_period('Q').astype(str)
    for qtr, g in test_clean.groupby('target_quarter'):
        yt_q = g['target'].values
        temporal_breakdown[qtr] = {
            'samples': len(g),
            'stations': int(g['station'].nunique()),
            'persistence_rmse': round(float(np.sqrt(mean_squared_error(yt_q, g['pred_persist'].values))), 3),
            'qgb_rmse': round(float(np.sqrt(mean_squared_error(yt_q, g['pred_qgb'].values))), 3),
            'qgb_improvement_pct': round(float(rmse_improvement_pct(
                np.sqrt(mean_squared_error(yt_q, g['pred_qgb'].values)),
                np.sqrt(mean_squared_error(yt_q, g['pred_persist'].values))
            )), 2)
        }
        
    result = {
        'horizon': horizon_name,
        'protocol': 'Strict Global Cutoff (Train < 2025-01-01, Test >= 2025-01-01)',
        'train_samples': len(train_clean),
        'train_stations': int(train_clean['station'].nunique()),
        'train_target_span': f"{train_clean['target_date'].min().strftime('%Y-%m-%d')} to {train_clean['target_date'].max().strftime('%Y-%m-%d')}",
        'test_samples': len(test_clean),
        'test_stations': int(test_clean['station'].nunique()),
        'test_target_span': f"{test_clean['target_date'].min().strftime('%Y-%m-%d')} to {test_clean['target_date'].max().strftime('%Y-%m-%d')}",
        'metrics_pooled': {
            'persistence': m_persist,
            'seasonal': m_seasonal,
            'ridge': m_ridge,
            'quantile_gb_p50': m_qgb,
            'qgb_improvement_over_persist_pct': round(float(rmse_improvement_pct(m_qgb['rmse'], m_persist['rmse'])), 2),
            'interval_coverage_80': round(float(cov), 4),
            'mean_interval_width': round(float(width), 3),
            'quantile_crossings_rate': round(float(crossings), 4)
        },
        'station_distribution': {
            'qualifying_stations_count': len(st_persist_rmse),
            'persistence_rmse_median': round(float(np.median(st_persist_rmse)), 3) if st_persist_rmse else np.nan,
            'persistence_rmse_iqr': [round(float(np.quantile(st_persist_rmse, 0.25)), 3), round(float(np.quantile(st_persist_rmse, 0.75)), 3)] if st_persist_rmse else [],
            'qgb_rmse_median': round(float(np.median(st_qgb_rmse)), 3) if st_qgb_rmse else np.nan,
            'qgb_rmse_iqr': [round(float(np.quantile(st_qgb_rmse, 0.25)), 3), round(float(np.quantile(st_qgb_rmse, 0.75)), 3)] if st_qgb_rmse else [],
            'station_coverage_median': round(float(np.median(st_cov)), 4) if st_cov else np.nan
        },
        'temporal_breakdown_2025': temporal_breakdown
    }
    
    return result

def run_all_rigorous_evaluations():
    print("=" * 80)
    print("JAL DRISHTI — RIGOROUS UP TELEMETRY VALIDATION WITH GLOBAL CUTOFF")
    print("=" * 80)
    
    daily = load_clean_daily_telemetry()
    print(f"Loaded {len(daily)} daily station medians across {daily['station'].nunique()} stations.")
    
    # Load reconciliation for Population B
    reconcil = pd.read_csv(RECONCILIATION_PATH)
    co_located = set(reconcil[reconcil['status'].isin(['confirmed_match', 'probable_match'])]['telemetry_station'].unique())
    print(f"Identified {len(co_located)} confirmed/probable co-located stations to isolate for sensitivity audit.")
    
    horizons = [
        ('1M (h=30d)', (20, 40), 'up_telemetry_1m_benchmark.json'),
        ('3M (h=90d)', (75, 105), 'up_telemetry_3m_benchmark.json'),
        ('6M (h=180d)', (150, 210), 'up_telemetry_6m_benchmark.json')
    ]
    
    all_results = {}
    os.makedirs('ml/artifacts', exist_ok=True)
    
    for h_name, (min_d, max_d), json_name in horizons:
        print(f"\n---> Evaluating Horizon: {h_name} [Elapsed: {min_d} to {max_d} days]")
        matrix = build_horizon_pairs(daily, min_d, max_d)
        
        train_df = matrix[(matrix['origin_date'] < GLOBAL_CUTOFF) & (matrix['target_date'] <= '2024-12-31')].copy()
        test_df = matrix[matrix['origin_date'] >= GLOBAL_CUTOFF].copy()
        
        res = evaluate_paired_models(train_df, test_df, h_name)
        all_results[h_name] = res
        
        out_file = os.path.join('ml/artifacts', json_name)
        with open(out_file, 'w') as f:
            json.dump(res, f, indent=2)
            
        print(f"  [Pooled] Persistence: RMSE = {res['metrics_pooled']['persistence']['rmse']:.3f}m | QGB: RMSE = {res['metrics_pooled']['quantile_gb_p50']['rmse']:.3f}m ({res['metrics_pooled']['qgb_improvement_over_persist_pct']:+.1f}%)")
        print(f"  [Station Median] Persistence RMSE: {res['station_distribution']['persistence_rmse_median']}m | QGB RMSE: {res['station_distribution']['qgb_rmse_median']}m")
        print(f"  [Uncertainty] 80% Coverage: {res['metrics_pooled']['interval_coverage_80']*100:.1f}% | Width: {res['metrics_pooled']['mean_interval_width']}m")
        print(f"  Saved artifact: {out_file}")
        
    # Population B: Sensitivity Analysis on 6M excluding co-located stations
    print("\n---> Evaluating Population B Sensitivity (6M Horizon excluding 18 co-located stations)")
    matrix_6m = build_horizon_pairs(daily, 150, 210)
    clean_matrix = matrix_6m[~matrix_6m['station'].isin(co_located)].copy()
    
    train_clean = clean_matrix[(clean_matrix['origin_date'] < GLOBAL_CUTOFF) & (clean_matrix['target_date'] <= '2024-12-31')].copy()
    test_clean = clean_matrix[clean_matrix['origin_date'] >= GLOBAL_CUTOFF].copy()
    
    res_b = evaluate_paired_models(train_clean, test_clean, "6M (Co-located Excluded)")
    res_b['co_located_stations_excluded_count'] = len(co_located)
    res_b['co_located_stations_excluded_list'] = sorted(list(co_located))
    
    out_b = os.path.join('ml/artifacts', 'up_telemetry_sensitivity_clean_stations.json')
    with open(out_b, 'w') as f:
        json.dump(res_b, f, indent=2)
    print(f"  [Clean Stations] Persistence RMSE: {res_b['metrics_pooled']['persistence']['rmse']:.3f}m | QGB RMSE: {res_b['metrics_pooled']['quantile_gb_p50']['rmse']:.3f}m ({res_b['metrics_pooled']['qgb_improvement_over_persist_pct']:+.1f}%)")
    print(f"  Saved artifact: {out_b}")
    
    # Population C: Spatial Generalization (Unseen Stations Holdout)
    print("\n---> Evaluating Spatial Generalization (Training on 80% stations, testing on 20% unseen stations)")
    all_stations = sorted(list(matrix_6m['station'].unique()))
    np.random.seed(42)
    np.random.shuffle(all_stations)
    n_train_st = int(len(all_stations) * 0.80)
    train_stations = set(all_stations[:n_train_st])
    unseen_stations = set(all_stations[n_train_st:])
    
    train_spatial = matrix_6m[(matrix_6m['station'].isin(train_stations)) & (matrix_6m['origin_date'] < GLOBAL_CUTOFF) & (matrix_6m['target_date'] <= '2024-12-31')].copy()
    test_spatial = matrix_6m[(matrix_6m['station'].isin(unseen_stations)) & (matrix_6m['origin_date'] >= GLOBAL_CUTOFF)].copy()
    
    res_c = evaluate_paired_models(train_spatial, test_spatial, "6M (Spatial Holdout on Unseen Stations)")
    res_c['unseen_stations_count'] = len(unseen_stations)
    res_c['unseen_stations_list'] = sorted(list(unseen_stations))
    
    out_c = os.path.join('ml/artifacts', 'up_telemetry_spatial_generalization.json')
    with open(out_c, 'w') as f:
        json.dump(res_c, f, indent=2)
    print(f"  [Unseen Stations] Persistence RMSE: {res_c['metrics_pooled']['persistence']['rmse']:.3f}m | QGB RMSE: {res_c['metrics_pooled']['quantile_gb_p50']['rmse']:.3f}m ({res_c['metrics_pooled']['qgb_improvement_over_persist_pct']:+.1f}%)")
    print(f"  Saved artifact: {out_c}")
    
    return all_results

if __name__ == '__main__':
    run_all_rigorous_evaluations()
