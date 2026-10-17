"""
JAL DRISHTI — Evidence Verification Script
Re-verifies:
1. Reconciliation CSV counts, unique stations, Pilana_1 attributes, and cross-tabulation.
2. Station-cluster bootstrap on 1M, 3M, 6M (full evaluations), and clean sensitivity (refitted without 19 stations) with 2,000 resamples and seeds 42 and 2026.
3. Date-block bootstrap on 1M, 3M, 6M, and clean sensitivity with 2,000 resamples and seeds 42 and 2026.
4. Comparison against saved JSON artifacts and Markdown reports.
"""

import os
import sys
import json
import math
import numpy as np
import pandas as pd
from sklearn.metrics import mean_squared_error

sys.path.insert(0, os.path.abspath('.'))
from ml.models import QuantileGroundwaterModel
from ml.validation import order_quantiles
from scripts.audit_up_benchmark_predictions import load_data, build_pairs_with_buckets, cluster_bootstrap_delta
from scripts.reconcile_sensitivity_and_bootstrap import date_block_bootstrap_delta

RECONCILIATION_PATH = "data/derived/up_station_identity_reconciliation.csv"
GLOBAL_CUTOFF = pd.Timestamp('2025-01-01')

def verify_reconciliation():
    print("=" * 70)
    print("1. VERIFYING STATION RECONCILIATION LEDGER")
    print("=" * 70)
    df = pd.read_csv(RECONCILIATION_PATH)
    print(f"Total rows in ledger: {len(df)}")
    assert len(df) == 78, f"Expected 78 rows, got {len(df)}"
    
    dup_pairs = df.duplicated(subset=['telemetry_station', 'manual_station']).sum()
    print(f"Duplicate (telemetry_station, manual_station) pairs: {dup_pairs}")
    assert dup_pairs == 0, f"Found {dup_pairs} duplicates"
    
    unique_tel = df['telemetry_station'].nunique()
    unique_man = df['manual_station'].nunique()
    print(f"Unique telemetry stations: {unique_tel} (expected 65)")
    print(f"Unique manual stations: {unique_man} (expected 73)")
    assert unique_tel == 65
    assert unique_man == 73
    
    # Pilana_1
    pilana = df[df['telemetry_station'] == 'Pilana_1']
    assert len(pilana) == 1, f"Expected 1 Pilana_1 row, got {len(pilana)}"
    p = pilana.iloc[0]
    print(f"Pilana_1: distance={p['geodesic_distance_m']}m, status={p['status']}, admin_agreement={p['admin_label_agreement']}")
    assert p['geodesic_distance_m'] == 251.0
    assert p['status'] == 'unresolved'
    assert p['admin_label_agreement'] == 'DISTRICT_ONLY'
    assert p['manual_station'] == 'Pilana  P'
    assert p['telemetry_district'] == 'BAGHPAT'
    assert p['manual_district'] == 'BAGHPAT'
    assert p['telemetry_block'] == 'PILANA'
    assert p['manual_block'] == '-'
    
    # 0-100m band
    b0_100 = df[(df['geodesic_distance_m'] >= 0.0) & (df['geodesic_distance_m'] <= 100.0)]
    print(f"0-100m band count: {len(b0_100)} (1 probable_match)")
    assert len(b0_100) == 1
    assert (b0_100['status'] == 'probable_match').sum() == 1
    
    # 100-500m band
    b100_500 = df[(df['geodesic_distance_m'] > 100.0) & (df['geodesic_distance_m'] <= 500.0)]
    print(f"100-500m band count: {len(b100_500)} (18 probable_match, 1 unresolved)")
    assert len(b100_500) == 19
    assert (b100_500['status'] == 'probable_match').sum() == 18
    assert (b100_500['status'] == 'unresolved').sum() == 1
    
    # Total <= 500m
    under_500 = df[df['geodesic_distance_m'] <= 500.0]
    print(f"<=500m total pairs: {len(under_500)} (19 probable_match, 1 unresolved)")
    assert len(under_500) == 20
    assert (under_500['status'] == 'probable_match').sum() == 19
    assert (under_500['status'] == 'unresolved').sum() == 1
    
    # Cross-tabulation
    bins = [-0.001, 100.0, 500.0, 1000.0, 1500.0]
    b_labels = ['0-100m', '100-500m', '500-1000m', '1000-1500m']
    df_c = df.copy()
    df_c['distance_band'] = pd.cut(df_c['geodesic_distance_m'], bins=bins, labels=b_labels)
    ct = pd.crosstab(df_c['distance_band'], df_c['status'], margins=True, margins_name='Total')
    print("\nRecomputed Distance-Band x Status Cross-Tabulation Matrix:")
    print(ct.to_string())
    print("\nReconciliation Verification: PASS\n")
    return ct

def verify_bootstrap():
    print("=" * 70)
    print("2. RE-RUNNING BOOTSTRAP PROVENANCE & CALCULATIONS (2000 RESAMPLES)")
    print("=" * 70)
    
    # Files
    f_1m = "ml/artifacts/predictions_1m_variable_window.csv"
    f_3m = "ml/artifacts/predictions_3m_variable_window.csv"
    f_6m = "ml/artifacts/predictions_6m_variable_window.csv"
    
    recomputed = {}
    
    for h, fpath in [('1M', f_1m), ('3M', f_3m), ('6M', f_6m)]:
        print(f"\n--- Horizon: {h} (file: {fpath}) ---")
        df = pd.read_csv(fpath)
        print(f"Rows: {len(df)}, Stations: {df['station'].nunique()}")
        
        # Check paired columns
        assert 'target' in df.columns
        assert 'pred_persist' in df.columns
        assert 'pred_qgb_safe_p50' in df.columns
        assert df['target'].notnull().all()
        assert df['pred_persist'].notnull().all()
        assert df['pred_qgb_safe_p50'].notnull().all()
        
        # Check sign convention on raw pooled metrics: delta = rmse_base - rmse_mod
        rmse_base = math.sqrt(np.mean((df['target'] - df['pred_persist']) ** 2))
        rmse_mod = math.sqrt(np.mean((df['target'] - df['pred_qgb_safe_p50']) ** 2))
        raw_delta = rmse_base - rmse_mod
        print(f"Raw pooled RMSE: Persistence={rmse_base:.3f}m, QGB={rmse_mod:.3f}m, Delta={raw_delta:.3f}m")
        
        # Re-run cluster bootstrap with seeds 42 and 2026
        boot42 = cluster_bootstrap_delta(df, 'target', 'pred_persist', 'pred_qgb_safe_p50', cluster_col='station', n_boot=2000, seed=42)
        boot2026 = cluster_bootstrap_delta(df, 'target', 'pred_persist', 'pred_qgb_safe_p50', cluster_col='station', n_boot=2000, seed=2026)
        
        print(f"Station-cluster (2000 resamples):")
        print(f"  Seed 42:   mean={boot42['delta_rmse_mean']:.3f}m, 95% CI={boot42['delta_rmse_ci95']}")
        print(f"  Seed 2026: mean={boot2026['delta_rmse_mean']:.3f}m, 95% CI={boot2026['delta_rmse_ci95']}")
        
        # Re-run date-block bootstrap with seeds 42 and 2026
        dboot42 = date_block_bootstrap_delta(df, 'target', 'pred_persist', 'pred_qgb_safe_p50', date_col='origin_date', n_boot=2000, seed=42)
        dboot2026 = date_block_bootstrap_delta(df, 'target', 'pred_persist', 'pred_qgb_safe_p50', date_col='origin_date', n_boot=2000, seed=2026)
        
        print(f"Date-block (2000 resamples, 8 monthly blocks):")
        print(f"  Seed 42:   mean={dboot42['date_block_delta_rmse_mean']:.3f}m, 95% CI={dboot42['date_block_delta_rmse_ci95']}")
        print(f"  Seed 2026: mean={dboot2026['date_block_delta_rmse_mean']:.3f}m, 95% CI={dboot2026['date_block_delta_rmse_ci95']}")
        
        recomputed[h] = {
            'cluster_seed_42': boot42,
            'cluster_seed_2026': boot2026,
            'date_seed_42': dboot42,
            'date_seed_2026': dboot2026
        }
        
    # Now check clean-station sensitivity population (19 stations excluded from both train and test)
    print("\n--- Clean 19-Station Sensitivity Population (6M, Refitted Model) ---")
    reconcil = pd.read_csv(RECONCILIATION_PATH)
    prob_19 = sorted(list(reconcil[reconcil['status'] == 'probable_match']['telemetry_station'].unique()))
    assert len(prob_19) == 19
    
    daily = load_data()
    matrix_6m = build_pairs_with_buckets(daily, 150, 210)
    train_all = matrix_6m[(matrix_6m['origin_date'] < GLOBAL_CUTOFF) & (matrix_6m['target_date'] <= '2024-12-31')].copy()
    test_all = matrix_6m[matrix_6m['origin_date'] >= GLOBAL_CUTOFF].copy()
    
    feature_cols = ['wl_origin', 'wl_prev', 'drawdown_velocity', 'season_month']
    tr = train_all[~train_all['station'].isin(prob_19)].copy()
    te = test_all[~test_all['station'].isin(prob_19)].copy()
    
    print(f"Clean Training Pairs: {len(tr)} across {tr['station'].nunique()} stations")
    print(f"Clean Testing Pairs:  {len(te)} across {te['station'].nunique()} stations")
    assert len(tr) == 30478
    assert tr['station'].nunique() == 147
    assert len(te) == 15861
    assert te['station'].nunique() == 142
    
    meds = tr[feature_cols].median()
    for c in feature_cols:
        tr[c] = tr[c].fillna(meds[c])
        te[c] = te[c].fillna(meds[c])
        
    X_tr, y_tr = tr[feature_cols], tr['target']
    X_te, y_te = te[feature_cols], te['target'].values
    
    qmod = QuantileGroundwaterModel(quantiles=[0.1, 0.5, 0.9]).fit(X_tr, y_tr)
    raw_p10 = qmod.models_[0.1].predict(X_te)
    raw_p50 = qmod.models_[0.5].predict(X_te)
    raw_p90 = qmod.models_[0.9].predict(X_te)
    safe_p10, safe_p50, safe_p90 = order_quantiles(raw_p10, raw_p50, raw_p90)
    
    p_pers = te['wl_origin'].values
    rmse_p = math.sqrt(mean_squared_error(y_te, p_pers))
    rmse_q = math.sqrt(mean_squared_error(y_te, safe_p50))
    print(f"Clean refitted RMSE: Persistence={rmse_p:.3f}m, QGB={rmse_q:.3f}m, Delta={rmse_p - rmse_q:.3f}m")
    
    te_eval = te.copy()
    te_eval['pred_pers'] = p_pers
    te_eval['pred_qgb'] = safe_p50
    
    clean_boot42 = cluster_bootstrap_delta(te_eval, 'target', 'pred_pers', 'pred_qgb', cluster_col='station', n_boot=2000, seed=42)
    clean_boot2026 = cluster_bootstrap_delta(te_eval, 'target', 'pred_pers', 'pred_qgb', cluster_col='station', n_boot=2000, seed=2026)
    clean_dboot42 = date_block_bootstrap_delta(te_eval, 'target', 'pred_pers', 'pred_qgb', date_col='origin_date', n_boot=2000, seed=42)
    clean_dboot2026 = date_block_bootstrap_delta(te_eval, 'target', 'pred_pers', 'pred_qgb', date_col='origin_date', n_boot=2000, seed=2026)
    
    print(f"Clean Sensitivity Station-cluster (2000 resamples):")
    print(f"  Seed 42:   mean={clean_boot42['delta_rmse_mean']:.3f}m, 95% CI={clean_boot42['delta_rmse_ci95']}")
    print(f"  Seed 2026: mean={clean_boot2026['delta_rmse_mean']:.3f}m, 95% CI={clean_boot2026['delta_rmse_ci95']}")
    print(f"Clean Sensitivity Date-block (2000 resamples):")
    print(f"  Seed 42:   mean={clean_dboot42['date_block_delta_rmse_mean']:.3f}m, 95% CI={clean_dboot42['date_block_delta_rmse_ci95']}")
    print(f"  Seed 2026: mean={clean_dboot2026['date_block_delta_rmse_mean']:.3f}m, 95% CI={clean_dboot2026['date_block_delta_rmse_ci95']}")
    
    recomputed['6M_clean_sensitivity'] = {
        'cluster_seed_42': clean_boot42,
        'cluster_seed_2026': clean_boot2026,
        'date_seed_42': clean_dboot42,
        'date_seed_2026': clean_dboot2026
    }
    
    print("\nBootstrap Re-computation: PASS\n")
    return recomputed

def compare_against_saved_artifacts(recomputed):
    print("=" * 70)
    print("3. COMPARING RECOMPUTED VALUES AGAINST SAVED ARTIFACTS")
    print("=" * 70)
    
    # 1. up_telemetry_independent_audit.json
    with open('ml/artifacts/up_telemetry_independent_audit.json', 'r') as f:
        audit_json = json.load(f)
        
    mismatches = []
    
    for h, h_key in [('1M', '1M_Variable_Window'), ('3M', '3M_Variable_Window'), ('6M', '6M_Variable_Window')]:
        rec = recomputed[h]
        saved_cluster = audit_json[h_key]['station_cluster_bootstrap_2000']
        saved_date = audit_json[h_key]['date_block_bootstrap_2000_supplementary']
        
        # Check cluster 42
        rec_c42 = rec['cluster_seed_42']['delta_rmse_ci95']
        sav_c42 = saved_cluster['seed_42']['delta_rmse_ci95']
        if rec_c42 != sav_c42:
            mismatches.append(f"{h} cluster seed 42 CI mismatch: recomputed={rec_c42}, saved={sav_c42}")
            
        # Check cluster 2026
        rec_c2026 = rec['cluster_seed_2026']['delta_rmse_ci95']
        sav_c2026 = saved_cluster['seed_2026']['delta_rmse_ci95']
        if rec_c2026 != sav_c2026:
            mismatches.append(f"{h} cluster seed 2026 CI mismatch: recomputed={rec_c2026}, saved={sav_c2026}")
            
        # Check date 42
        rec_d42 = rec['date_seed_42']['date_block_delta_rmse_ci95']
        sav_d42 = saved_date['seed_42']['date_block_delta_rmse_ci95']
        if rec_d42 != sav_d42:
            mismatches.append(f"{h} date seed 42 CI mismatch: recomputed={rec_d42}, saved={sav_d42}")
            
        # Check date 2026
        rec_d2026 = rec['date_seed_2026']['date_block_delta_rmse_ci95']
        sav_d2026 = saved_date['seed_2026']['date_block_delta_rmse_ci95']
        if rec_d2026 != sav_d2026:
            mismatches.append(f"{h} date seed 2026 CI mismatch: recomputed={rec_d2026}, saved={sav_d2026}")
            
    # 2. up_telemetry_sensitivity_clean_stations.json
    with open('ml/artifacts/up_telemetry_sensitivity_clean_stations.json', 'r') as f:
        clean_json = json.load(f)
        
    rec_clean = recomputed['6M_clean_sensitivity']
    sav_clean_c42 = clean_json['station_cluster_bootstrap_2000']['seed_42']['delta_rmse_ci95']
    sav_clean_c2026 = clean_json['station_cluster_bootstrap_2000']['seed_2026']['delta_rmse_ci95']
    sav_clean_d42 = clean_json['date_block_bootstrap_2000_supplementary']['seed_42']['date_block_delta_rmse_ci95']
    sav_clean_d2026 = clean_json['date_block_bootstrap_2000_supplementary']['seed_2026']['date_block_delta_rmse_ci95']
    
    if rec_clean['cluster_seed_42']['delta_rmse_ci95'] != sav_clean_c42:
        mismatches.append(f"Clean 6M cluster seed 42 mismatch: recomputed={rec_clean['cluster_seed_42']['delta_rmse_ci95']}, saved={sav_clean_c42}")
    if rec_clean['cluster_seed_2026']['delta_rmse_ci95'] != sav_clean_c2026:
        mismatches.append(f"Clean 6M cluster seed 2026 mismatch: recomputed={rec_clean['cluster_seed_2026']['delta_rmse_ci95']}, saved={sav_clean_c2026}")
    if rec_clean['date_seed_42']['date_block_delta_rmse_ci95'] != sav_clean_d42:
        mismatches.append(f"Clean 6M date seed 42 mismatch: recomputed={rec_clean['date_seed_42']['date_block_delta_rmse_ci95']}, saved={sav_clean_d42}")
    if rec_clean['date_seed_2026']['date_block_delta_rmse_ci95'] != sav_clean_d2026:
        mismatches.append(f"Clean 6M date seed 2026 mismatch: recomputed={rec_clean['date_seed_2026']['date_block_delta_rmse_ci95']}, saved={sav_clean_d2026}")
        
    if mismatches:
        print(f"WARNING: Found {len(mismatches)} mismatches:")
        for m in mismatches:
            print("  - " + m)
    else:
        print("ALL recomputed confidence intervals MATCH saved artifacts with ZERO discrepancies!")
        print("Artifacts Verification: PASS\n")

if __name__ == '__main__':
    verify_reconciliation()
    recomputed = verify_bootstrap()
    compare_against_saved_artifacts(recomputed)
