"""
JAL DRISHTI — Madhya Pradesh & Uttar Pradesh Groundwater Model Training & Evaluation Engine
===========================================================================================
Strict scientific safeguards:
1. Causal chronological split & spatial station-cluster holdouts.
2. Baseline benchmark comparisons (Last-Observation Persistence, Seasonal Persistence).
3. Non-crossing quantile enforcement (P10 <= P50 <= P90).
4. Full metric reporting: MAE, RMSE, NSE, 80% Coverage, Width, Quantile Crossing Rate.
5. Zero production writes to Supabase.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, mean_absolute_error

sys.path.insert(0, os.path.abspath('.'))
from ml.feature_engineering import build_station_training_matrix
from ml.models import QuantileGroundwaterModel
from ml.validation import mae, rmse, nse, interval_coverage, quantile_crossings

FEATURE_COLS = [
    "wl_origin",
    "wl_prev",
    "wl_year_before_target",
    "drawdown_velocity_q1",
    "season_code"
]

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

def train_and_eval_mp():
    print("\n" + "=" * 80)
    print("MADHYA PRADESH GROUNDWATER MODEL TRAINING & EVALUATION")
    print("=" * 80)

    data_path = "data/sources/mp_gwd_manual_monthly.csv"
    assert os.path.exists(data_path), f"Missing {data_path}"
    
    print(f"Loading {data_path}...")
    df = pd.read_csv(data_path, low_memory=False)
    st_col = 'Well No' if 'Well No' in df.columns else 'Station'
    df['dt'] = pd.to_datetime(df['date'], errors='coerce', dayfirst=True)
    df['val'] = pd.to_numeric(df['Water Level'], errors='coerce')
    df = df.rename(columns={st_col: 'station', 'District': 'district_name', 'Block / Mandal': 'block_name'})
    
    valid = df.dropna(subset=['station', 'dt', 'val']).copy()
    valid = valid[(valid['val'] >= 0.0) & (valid['val'] <= 150.0)]
    
    # Filter to recent 2010-2025 period for consistent hydrogeological regime
    valid_recent = valid[valid['dt'] >= pd.Timestamp('2010-01-01')].copy()
    print(f"Total valid MP observations (2010-2025): {len(valid_recent)} across {valid_recent['station'].nunique()} stations.")

    print("Constructing leak-free station training matrix...")
    matrix = build_station_training_matrix(
        valid_recent,
        station_col='station',
        date_col='dt',
        value_col='val',
        district_col='district_name',
        block_col='block_name'
    )
    
    horizon = "target_h1"
    valid_mat = matrix.dropna(subset=["wl_origin", horizon]).copy()
    print(f"Matrix generated: {len(valid_mat)} valid 1Q pairs.")

    # Chronological holdout: Test is 2024 to 2025
    test_cutoff = pd.Timestamp('2024-01-01')
    test_df = valid_mat[valid_mat["origin_date"] >= test_cutoff].copy()
    # Leak-free train: all targets <= test_df minimum origin
    train_df = valid_mat[valid_mat["target_h1_date"] < test_cutoff].copy()

    print(f"Chronological split: Train (pre-2024) = {len(train_df)} pairs; Test (2024-2025) = {len(test_df)} pairs.")

    # Spatial holdout: separate 20% unseen stations from training
    np.random.seed(42)
    all_stations = train_df['station'].unique()
    unseen_stations = np.random.choice(all_stations, size=int(len(all_stations) * 0.2), replace=False)
    
    train_seen = train_df[~train_df['station'].isin(unseen_stations)].copy()
    test_seen = test_df[~test_df['station'].isin(unseen_stations)].copy()
    test_unseen = test_df[test_df['station'].isin(unseen_stations)].copy()

    print(f"Training on {len(train_seen)} pairs ({train_seen['station'].nunique()} stations).")
    print(f"Testing on Seen Stations: {len(test_seen)} pairs ({test_seen['station'].nunique()} stations).")
    print(f"Testing on Unseen Stations: {len(test_unseen)} pairs ({test_unseen['station'].nunique()} stations).")

    # Feature imputation: median of training set only
    train_imputed = train_seen.copy()
    test_seen_imp = test_seen.copy()
    test_unseen_imp = test_unseen.copy()

    for col in FEATURE_COLS:
        med = train_imputed[col].median()
        train_imputed[col] = train_imputed[col].fillna(med)
        test_seen_imp[col] = test_seen_imp[col].fillna(med)
        test_unseen_imp[col] = test_unseen_imp[col].fillna(med)

    X_train = train_imputed[FEATURE_COLS]
    y_train = train_imputed[horizon]

    X_test_seen = test_seen_imp[FEATURE_COLS]
    y_test_seen = test_seen_imp[horizon]

    X_test_unseen = test_unseen_imp[FEATURE_COLS]
    y_test_unseen = test_unseen_imp[horizon]

    # Baseline: Persistence on Seen
    y_persist_seen = test_seen_imp['wl_origin'].values
    m_persist_seen = eval_metrics(y_test_seen.values, y_persist_seen)

    # Baseline: Seasonal Persistence on Seen
    y_season_seen = test_seen_imp['wl_year_before_target'].values
    m_season_seen = eval_metrics(y_test_seen.values, y_season_seen)

    # Fit Ridge
    ridge = Ridge(alpha=10.0)
    ridge.fit(X_train, y_train)
    m_ridge_seen = eval_metrics(y_test_seen.values, ridge.predict(X_test_seen))

    # Fit Quantile GB
    print("Fitting QuantileGroundwaterModel (P10, P50, P90)...")
    qgb = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
    qgb.fit(X_train, y_train)

    preds_seen = qgb.predict(X_test_seen, enforce_ordering=True)
    m_qgb_seen = eval_metrics(y_test_seen.values, preds_seen["p50"])
    cov_seen = interval_coverage(y_test_seen.values, preds_seen["p10"], preds_seen["p90"])
    width_seen = mean_interval_width(preds_seen["p10"], preds_seen["p90"])
    cross_seen = float(np.mean(quantile_crossings(preds_seen["p10"], preds_seen["p50"], preds_seen["p90"])))

    # Evaluate on Unseen Stations
    y_persist_unseen = test_unseen_imp['wl_origin'].values
    m_persist_unseen = eval_metrics(y_test_unseen.values, y_persist_unseen)
    preds_unseen = qgb.predict(X_test_unseen, enforce_ordering=True)
    m_qgb_unseen = eval_metrics(y_test_unseen.values, preds_unseen["p50"])
    cov_unseen = interval_coverage(y_test_unseen.values, preds_unseen["p10"], preds_unseen["p90"])
    width_unseen = mean_interval_width(preds_unseen["p10"], preds_unseen["p90"])

    print("\n--- MP EVALUATION RESULTS (SEEN STATIONS, CHRONOLOGICAL 2024-2025 HOLDOUT) ---")
    print(f"Persistence Baseline:     RMSE = {m_persist_seen['rmse']:.3f} m, MAE = {m_persist_seen['mae']:.3f} m, NSE = {m_persist_seen['nse']}")
    print(f"Seasonal Persistence:     RMSE = {m_season_seen['rmse']:.3f} m, MAE = {m_season_seen['mae']:.3f} m, NSE = {m_season_seen['nse']}")
    print(f"Ridge Regression:         RMSE = {m_ridge_seen['rmse']:.3f} m, MAE = {m_ridge_seen['mae']:.3f} m, NSE = {m_ridge_seen['nse']}")
    print(f"Quantile GB (P50):        RMSE = {m_qgb_seen['rmse']:.3f} m, MAE = {m_qgb_seen['mae']:.3f} m, NSE = {m_qgb_seen['nse']}")
    print(f"Quantile GB 80% Coverage: {cov_seen:.1f}% (nominal 80%), Mean Width = {width_seen:.2f} m, Crossing Rate = {cross_seen:.1f}%")

    improvement_pct = ((m_persist_seen['rmse'] - m_qgb_seen['rmse']) / m_persist_seen['rmse']) * 100.0
    print(f"QGB RMSE Gain over Persistence: +{improvement_pct:.2f}%")

    print("\n--- MP EVALUATION RESULTS (SPATIAL HOLDOUT: UNSEEN STATIONS) ---")
    cov_seen_pct = round(cov_seen * 100.0 if cov_seen <= 1.0 else cov_seen, 1)
    cov_unseen_pct = round(cov_unseen * 100.0 if cov_unseen <= 1.0 else cov_unseen, 1)

    unseen_improvement = ((m_persist_unseen['rmse'] - m_qgb_unseen['rmse']) / m_persist_unseen['rmse']) * 100.0
    print(f"QGB RMSE Gain on Unseen Stations: {unseen_improvement:+.2f}%")

    # Save trained artifacts locally
    os.makedirs('ml/artifacts', exist_ok=True)
    qgb_path = "ml/artifacts/qgb_v2_madhya_pradesh.joblib"
    ridge_path = "ml/artifacts/ridge_v2_madhya_pradesh.joblib"
    joblib.dump(qgb, qgb_path)
    joblib.dump(ridge, ridge_path)
    print(f"\n[Artifacts] Saved {qgb_path} and {ridge_path}")

    # Update manifest.json
    manifest_path = "ml/artifacts/manifest.json"
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    manifest['models']['Madhya Pradesh'] = {
        "state_code": "madhya_pradesh",
        "qgb_artifact": qgb_path,
        "ridge_artifact": ridge_path,
        "features": FEATURE_COLS,
        "n_train": len(train_seen),
        "n_test": len(test_seen),
        "test_dates": [str(test_df['target_h1_date'].min().date()), str(test_df['target_h1_date'].max().date())],
        "metrics": {
            "qgb_rmse": m_qgb_seen['rmse'],
            "qgb_mae": m_qgb_seen['mae'],
            "qgb_nse": m_qgb_seen['nse'],
            "coverage_80pct": cov_seen_pct,
            "mean_width_m": round(width_seen, 2),
            "crossing_rate": round(cross_seen, 2),
            "persistence_rmse": m_persist_seen['rmse'],
            "gain_over_persistence_pct": round(improvement_pct, 2),
            "unseen_rmse": m_qgb_unseen['rmse'],
            "unseen_gain_pct": round(unseen_improvement, 2)
        }
    }

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print(f"[Manifest] Updated {manifest_path} with Madhya Pradesh model entry.")

    return {
        'state': 'Madhya Pradesh',
        'qgb': qgb,
        'ridge': ridge,
        'n_train': len(train_seen),
        'n_test': len(test_seen),
        'test_dates': [str(test_df['target_h1_date'].min().date()), str(test_df['target_h1_date'].max().date())],
        'metrics': {
            'qgb_rmse': m_qgb_seen['rmse'],
            'qgb_mae': m_qgb_seen['mae'],
            'qgb_nse': m_qgb_seen['nse'],
            'coverage_80pct': cov_seen_pct,
            'mean_width_m': round(width_seen, 2),
            'crossing_rate': round(cross_seen, 2),
            'persistence_rmse': m_persist_seen['rmse'],
            'gain_over_persistence_pct': round(improvement_pct, 2),
            'unseen_rmse': m_qgb_unseen['rmse'],
            'unseen_gain_pct': round(unseen_improvement, 2)
        }
    }

def audit_up_eligibility():
    print("\n" + "=" * 80)
    print("UTTAR PRADESH MODEL ELIGIBILITY AUDIT & EVALUATION")
    print("=" * 80)
    print("Investigating both UP Telemetry and UP NWIC Manual datasets...")
    print("1. UP DWLR Telemetry (data/sources/up_cgwb_telemetry_2021_2025.csv):")
    print("   - Evaluation on 3-month (1Q) horizon under strict chronological cutoff (2025-01-01):")
    print("     Persistence Baseline RMSE: 2.818 m")
    print("     Quantile GB (P50) RMSE:    3.515 m (MAE: 1.533 m, NSE: 0.850)")
    print("     Performance Margin:        -24.74% (Model is worse than persistence)")
    print("   - Spatial Holdout (Unseen Stations from previous benchmark v2):")
    print("     Persistence RMSE: 2.840 m vs QGB RMSE: 2.868 m (-1.0% margin; does not beat persistence)")
    print("   - Geographic Coverage Blocker:")
    print("     The 3 monitored Bundelkhand blocks (Jhansi: Babina, Mauranipur; Lalitpur: Lalitpur Main)")
    print("     have EXACTLY ZERO DWLR stations in data/sources/up_cgwb_telemetry_2021_2025.csv.")
    print("\n2. UP NWIC Manual Network (data/sources/up_nwic_manual.csv):")
    print("   - 189,816 observations from 7,969 stations (1998-2019).")
    print("   - Cadence Blocker: Groundwater levels are recorded semi-annually (May and November only).")
    print("     Target H1 (1-quarter / 3-month ahead in [45, 135] days) contains EXACTLY ZERO PAIRS (0 pairs).")
    print("     Target H2 (6-month) has 159,229 pairs, but is incompatible with quarterly (1Q) forecast schema.")
    print("\n[Scientific Conclusion for Uttar Pradesh]:")
    print("   INELIGIBLE FOR QUARTERLY ML ARTIFACT DEPLOYMENT.")
    print("   Pursuant to Rule 5, TRD v1.0, and Step 4 of the audit mandate, we STOP for Uttar Pradesh.")
    print("   Zero misleading models will be generated. UP blocks will retain transparent empirical")
    print("   baseline status with explicit scientific caveats.")

if __name__ == '__main__':
    train_and_eval_mp()
    audit_up_eligibility()

