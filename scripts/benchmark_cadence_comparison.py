"""
Cadence Optimization Benchmark Engine:
Compares forecasting accuracy across horizons on the exact same station dataset (MP DWLR Telemetry):
1. 1-Month Horizon (h=1m, [20, 40] days)
2. 3-Month Horizon (h=3m / 1Q, [45, 135] days)
3. 12-Month Horizon (h=12m / 1Y, [315, 415] days)

Evaluated across:
- Persistence
- Seasonal Persistence
- Ridge Regression
- Quantile Gradient Boosting (P10, P50, P90)
"""
import os
import sys
import numpy as np
import pandas as pd
import requests
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
    nse_val = float(1.0 - (np.sum((y_true - y_pred) ** 2) / denom)) if denom > 0 else np.nan
    return {"mae": round(a, 3), "rmse": round(r, 3), "nse": round(nse_val, 3), "n": len(y_true)}

def build_multi_horizon_matrix(df, station_col='station', date_col='observation_date', val_col='water_level_mbgl'):
    df = df.dropna(subset=[station_col, date_col, val_col]).copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df[val_col] = pd.to_numeric(df[val_col], errors='coerce')
    clean = df.groupby([station_col, date_col])[val_col].mean().reset_index().sort_values([station_col, date_col])
    
    records = []
    for st, g in clean.groupby(station_col):
        d_vals = g[date_col].values
        w_vals = g[val_col].values
        n = len(d_vals)
        if n < 2:
            continue
            
        for i in range(n):
            t0 = d_vals[i]
            y0 = w_vals[i]
            prev_y = w_vals[i - 1] if i > 0 else np.nan
            
            # Find year-ago baseline (365 +/- 45 days)
            year_ago_y = np.nan
            for k in range(i):
                diff_yr = (t0 - d_vals[k]) / np.timedelta64(1, 'D')
                if 320 <= diff_yr <= 410:
                    year_ago_y = w_vals[k]
                    break
                    
            row = {
                'station': st,
                'origin_date': t0,
                'wl_origin': y0,
                'wl_prev': prev_y,
                'wl_year_ago': year_ago_y,
                'season_code': pd.Timestamp(t0).month % 4,
                'target_1m': np.nan,
                'target_1m_date': None,
                'target_3m': np.nan,
                'target_3m_date': None,
                'target_12m': np.nan,
                'target_12m_date': None
            }
            
            for j in range(i + 1, n):
                diff = (d_vals[j] - t0) / np.timedelta64(1, 'D')
                if 20 <= diff <= 40 and np.isnan(row['target_1m']):
                    row['target_1m'] = w_vals[j]
                    row['target_1m_date'] = d_vals[j]
                elif 45 <= diff <= 135 and np.isnan(row['target_3m']):
                    row['target_3m'] = w_vals[j]
                    row['target_3m_date'] = d_vals[j]
                elif 315 <= diff <= 415 and np.isnan(row['target_12m']):
                    row['target_12m'] = w_vals[j]
                    row['target_12m_date'] = d_vals[j]
                elif diff > 415:
                    break
                    
            records.append(row)
            
    return pd.DataFrame(records)

def run_cadence_experiment():
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
    df = pd.DataFrame(r.json()).rename(columns={'station_id': 'station'})
    
    mat = build_multi_horizon_matrix(df)
    
    horizons = [
        ('1-Month Horizon (h=1m)', 'target_1m', 'target_1m_date'),
        ('3-Month Horizon (h=3m / 1Q)', 'target_3m', 'target_3m_date'),
        ('12-Month Horizon (h=12m / 1Y)', 'target_12m', 'target_12m_date')
    ]
    
    results = []
    feature_cols = ['wl_origin', 'wl_prev', 'wl_year_ago', 'season_code']
    
    for h_name, h_col, date_col in horizons:
        valid_df = mat.dropna(subset=['wl_origin', h_col]).copy()
        if len(valid_df) < 30:
            continue
            
        target_dates = sorted(valid_df[date_col].dropna().unique())
        test_dates = target_dates[-2:]
        test_df = valid_df[valid_df[date_col].isin(test_dates)].copy()
        test_min_origin = test_df['origin_date'].min()
        train_df = valid_df[valid_df[date_col] <= test_min_origin].copy()
        
        train_imputed = train_df.copy()
        test_imputed = test_df.copy()
        for c in feature_cols:
            med = train_imputed[c].median()
            train_imputed[c] = train_imputed[c].fillna(med)
            test_imputed[c] = test_imputed[c].fillna(med)
            
        X_train = train_imputed[feature_cols]
        y_train = train_imputed[h_col]
        X_test = test_imputed[feature_cols]
        y_test = test_imputed[h_col]
        
        # 1. Persistence
        y_p = test_df['wl_origin'].values
        m_persist = eval_metrics(y_test.values, y_p)
        
        # 2. Seasonal Persistence (year-ago baseline)
        y_s = np.where(test_df['wl_year_ago'].notnull(), test_df['wl_year_ago'].values, test_df['wl_origin'].values)
        m_seasonal = eval_metrics(y_test.values, y_s)
        
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
        
        results.append({
            'Cadence Horizon': h_name,
            'N_train': len(X_train),
            'N_test': len(X_test),
            'Persistence RMSE': m_persist['rmse'],
            'Seasonal RMSE': m_seasonal['rmse'],
            'Ridge RMSE': m_ridge['rmse'],
            'Quantile GB RMSE': m_qgb['rmse'],
            'Quantile GB MAE': m_qgb['mae'],
            'Quantile GB NSE': m_qgb['nse'],
            'QGB vs Persist %': rmse_improvement_pct(m_qgb['rmse'], m_persist['rmse']),
            'QGB vs Seasonal %': rmse_improvement_pct(m_qgb['rmse'], m_seasonal['rmse']),
            '80% Coverage': round(cov * 100.0, 1),
            'Mean Width (m)': round(width, 2),
            'Crossing Inversions': round(crossings * 100.0, 1)
        })
        
    res_df = pd.DataFrame(results)
    print("\n" + "=" * 90)
    print("CADENCE OPTIMIZATION BENCHMARK — MP DWLR TELEMETRY")
    print("=" * 90)
    print(res_df.to_string(index=False))
    os.makedirs('audit', exist_ok=True)
    res_df.to_csv('audit/cadence_optimization_benchmark.csv', index=False)

if __name__ == '__main__':
    run_cadence_experiment()
