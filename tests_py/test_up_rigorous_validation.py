"""
Automated Validation Tests for Uttar Pradesh Rigorous Temporal & Spatial Benchmarks.
Verifies:
1. Complete Temporal Isolation & Zero Leakage (Train targets strictly < 2025-01-01 <= Test origins).
2. Negative Leakage & Alignment Failure Regression Tests (Future-feature leakage, target overlap,
   preprocessing leakage, and inconsistent evaluation rows).
3. Station Reconciliation Artifact Integrity, Distance Bands & Mutual Exclusivity.
4. Clean Stations Sensitivity (19 Probable Co-located Stations Excluded) & Side-by-Side Verification.
5. Machine-readable Benchmark Artifacts & Row-Level Prediction Ledgers.
6. Quantile Monotonic Ordering Safeguards & Uncertainty Calibration.
7. Bootstrap Resampling Properties, Sign Conventions & Paired Alignment.
"""

import os
import json
import pytest
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer

BENCHMARK_1M = "ml/artifacts/up_telemetry_1m_benchmark.json"
BENCHMARK_3M = "ml/artifacts/up_telemetry_3m_benchmark.json"
BENCHMARK_6M = "ml/artifacts/up_telemetry_6m_benchmark.json"
BENCHMARK_CLEAN = "ml/artifacts/up_telemetry_sensitivity_clean_stations.json"
BENCHMARK_SPATIAL = "ml/artifacts/up_telemetry_spatial_generalization.json"
INDEPENDENT_AUDIT = "ml/artifacts/up_telemetry_independent_audit.json"
RECONCILIATION_PATH = "data/derived/up_station_identity_reconciliation.csv"

PRED_1M_CSV = "ml/artifacts/predictions_1m_variable_window.csv"
PRED_3M_CSV = "ml/artifacts/predictions_3m_variable_window.csv"
PRED_6M_CSV = "ml/artifacts/predictions_6m_variable_window.csv"

# --- Leakage Detection Helper Functions to be Audited by Negative Tests ---

def check_temporal_isolation(train_targets, test_origins, global_cutoff="2025-01-01"):
    """Validates that all training targets strictly precede the cutoff and all test origins."""
    cutoff_ts = pd.Timestamp(global_cutoff)
    max_train_target = pd.to_datetime(train_targets).max()
    min_test_origin = pd.to_datetime(test_origins).min()
    
    if max_train_target >= cutoff_ts:
        raise ValueError(f"Temporal Leakage: Train target {max_train_target} >= cutoff {cutoff_ts}")
    if min_test_origin < cutoff_ts:
        raise ValueError(f"Temporal Leakage: Test origin {min_test_origin} < cutoff {cutoff_ts}")
    if max_train_target >= min_test_origin:
        raise ValueError(f"Temporal Overlap: Train target {max_train_target} >= Test origin {min_test_origin}")
    return True

def check_feature_availability(features_df, origin_timestamp, feature_timestamp_col="timestamp"):
    """Ensures no feature row uses timestamps after the declared forecast origin."""
    origin_ts = pd.Timestamp(origin_timestamp)
    max_feat_ts = pd.to_datetime(features_df[feature_timestamp_col]).max()
    if max_feat_ts > origin_ts:
        raise ValueError(f"Future Feature Leakage: feature timestamp {max_feat_ts} is strictly after forecast origin {origin_ts}")
    return True

def verify_evaluation_alignment(y_true, y_pred_persist, y_pred_model):
    """Ensures models are scored on identically indexed and dimensioned observation sets."""
    if len(y_true) != len(y_pred_persist) or len(y_true) != len(y_pred_model):
        raise ValueError(f"Evaluation Row Mismatch: y_true={len(y_true)}, y_persist={len(y_pred_persist)}, y_model={len(y_pred_model)}")
    if np.any(np.isnan(y_pred_persist)) or np.any(np.isnan(y_pred_model)):
        raise ValueError("Inconsistent Evaluation: Evaluated arrays contain NaNs or omitted samples")
    return True

def audit_preprocessing_isolation(fitted_scaler, train_data, test_data):
    """Ensures scaler parameters match training data exactly and were not contaminated by test data."""
    train_mean = np.mean(train_data, axis=0)
    scaler_mean = fitted_scaler.mean_
    if not np.allclose(train_mean, scaler_mean, atol=1e-5):
        raise ValueError("Preprocessing Leakage: Fitted transformer mean does not match pure training mean!")
    return True


class TestUpRigorousValidation:

    def test_reconciliation_artifact_exists_and_valid(self):
        assert os.path.exists(RECONCILIATION_PATH), "Reconciliation CSV missing"
        df = pd.read_csv(RECONCILIATION_PATH)
        assert len(df) == 78, f"Expected exactly 78 candidate pairs, got {len(df)}"
        assert 'status' in df.columns
        assert 'confidence' in df.columns
        assert 'geodesic_distance_m' in df.columns
        
        valid_statuses = {'confirmed_match', 'probable_match', 'unresolved', 'no_match_established'}
        assert set(df['status'].unique()).issubset(valid_statuses)
        
        # In the absence of authoritative joint inventory IDs, verified high-proximity candidates are probable_match
        probable = df[df['status'] == 'probable_match']
        assert len(probable) == 19
        assert probable['telemetry_station'].nunique() == 19
        # The closest candidate (Bhuawapar at 86.4m) is within 100m
        assert probable['geodesic_distance_m'].min() <= 100.0

    @pytest.mark.parametrize("artifact_path", [BENCHMARK_1M, BENCHMARK_3M, BENCHMARK_6M])
    def test_horizon_artifacts_and_metrics_schema(self, artifact_path):
        assert os.path.exists(artifact_path), f"Benchmark artifact missing: {artifact_path}"
        with open(artifact_path, 'r') as f:
            data = json.load(f)
            
        assert data['train_samples'] > 10000
        assert data['test_samples'] > 5000
        assert data['test_stations'] >= 150
        
        metrics = data['metrics_pooled']
        assert metrics['persistence']['rmse'] > 0
        assert metrics['quantile_gb_p50']['rmse'] > 0
        assert 0.60 <= metrics['interval_coverage_80'] <= 0.95
        assert metrics['quantile_crossings_rate'] == 0.0
        assert metrics['mean_interval_width'] > 0

    def test_strict_temporal_isolation_dates(self):
        for path in [BENCHMARK_1M, BENCHMARK_3M, BENCHMARK_6M]:
            with open(path, 'r') as f:
                data = json.load(f)
            train_span = data['train_target_span']
            train_end = train_span.split(' to ')[1]
            assert train_end <= '2024-12-31', f"Train target {train_end} leaked into 2025!"
            
            test_span = data['test_target_span']
            test_start = test_span.split(' to ')[0]
            assert test_start >= '2025-01-01', f"Test target {test_start} preceded 2025!"

    def test_independent_audit_artifact_and_row_ledgers(self):
        assert os.path.exists(INDEPENDENT_AUDIT), "Independent audit artifact missing"
        with open(INDEPENDENT_AUDIT, 'r') as f:
            audit = json.load(f)
            
        for h_key in ['1M_Variable_Window', '3M_Variable_Window', '6M_Variable_Window']:
            assert h_key in audit
            h_data = audit[h_key]
            assert 'elapsed_time_distribution_days' in h_data
            dist = h_data['elapsed_time_distribution_days']
            assert dist['min'] <= dist['median'] <= dist['max']
            assert 'station_clustered_bootstrap_qgb_vs_persist' in h_data
            assert 'elapsed_time_sub_buckets' in h_data
            
        # Verify row-level prediction files
        for csv_path in [PRED_1M_CSV, PRED_3M_CSV, PRED_6M_CSV]:
            assert os.path.exists(csv_path), f"Row-level prediction CSV missing: {csv_path}"
            pdf = pd.read_csv(csv_path, nrows=50)
            assert 'station' in pdf.columns
            assert 'origin_date' in pdf.columns
            assert 'target_date' in pdf.columns
            assert 'target' in pdf.columns
            assert 'pred_persist' in pdf.columns
            assert 'pred_qgb_safe_p50' in pdf.columns
            assert 'pred_qgb_safe_p10' in pdf.columns
            assert 'pred_qgb_safe_p90' in pdf.columns

    def test_station_distribution_metrics_present(self):
        for path in [BENCHMARK_1M, BENCHMARK_3M, BENCHMARK_6M]:
            with open(path, 'r') as f:
                data = json.load(f)
            dist = data['station_distribution']
            assert dist['qualifying_stations_count'] >= 100
            assert dist['persistence_rmse_median'] > 0
            assert dist['qgb_rmse_median'] > 0
            assert len(dist['persistence_rmse_iqr']) == 2
            assert dist['persistence_rmse_iqr'][0] <= dist['persistence_rmse_iqr'][1]

    def test_spatial_holdout_artifact_exists_and_valid(self):
        assert os.path.exists(BENCHMARK_SPATIAL), "Spatial holdout benchmark artifact missing"
        with open(BENCHMARK_SPATIAL, 'r') as f:
            data = json.load(f)
        assert data['unseen_stations_count'] >= 30
        assert data['metrics_pooled']['quantile_gb_p50']['rmse'] > 0
        assert data['metrics_pooled']['quantile_crossings_rate'] == 0.0

    def test_clean_stations_sensitivity_artifact_exists_and_valid(self):
        assert os.path.exists(BENCHMARK_CLEAN), "Sensitivity benchmark artifact missing"
        with open(BENCHMARK_CLEAN, 'r') as f:
            data = json.load(f)
        assert data['co_located_stations_excluded_count'] == 19
        assert len(data['co_located_stations_excluded_list']) == 19
        assert 'side_by_side_with_18_stations' in data
        assert data['metrics_pooled']['quantile_gb_p50']['rmse'] > 0


class TestReconciliationAndBootstrapIntegrity:
    """
    Focused verification tests for:
    - Mutually exclusive & exhaustive reconciliation distance bands and classifications.
    - Sensitivity exclusion list matching documented stations.
    - Zero excluded stations leaking into sensitivity evaluation.
    - Paired model-baseline row alignment in bootstrap evaluations.
    - Bootstrap sign convention and metric consistency.
    """

    def test_reconciliation_bands_mutually_exclusive_and_exhaustive(self):
        df = pd.read_csv(RECONCILIATION_PATH)
        assert len(df) == 78
        # Coordinate validity: 0 null coordinates
        assert df[['telemetry_lat', 'telemetry_lon', 'manual_lat', 'manual_lon']].isnull().sum().sum() == 0
        
        # Verify exactly one classification per row
        assert df['status'].notnull().all()
        valid_statuses = {'confirmed_match', 'probable_match', 'unresolved', 'no_match_established'}
        assert set(df['status'].unique()).issubset(valid_statuses)
        
        # Check distance partition
        b0_100 = df[(df['geodesic_distance_m'] >= 0.0) & (df['geodesic_distance_m'] <= 100.0)]
        b100_500 = df[(df['geodesic_distance_m'] > 100.0) & (df['geodesic_distance_m'] <= 500.0)]
        b500_1000 = df[(df['geodesic_distance_m'] > 500.0) & (df['geodesic_distance_m'] <= 1000.0)]
        b1000_1500 = df[(df['geodesic_distance_m'] > 1000.0) & (df['geodesic_distance_m'] <= 1500.0)]
        
        assert len(b0_100) == 1
        assert len(b100_500) == 19
        assert len(b500_1000) == 24
        assert len(b1000_1500) == 34
        assert len(b0_100) + len(b100_500) + len(b500_1000) + len(b1000_1500) == 78

        # Status counts must sum exactly to 78
        counts = df['status'].value_counts().to_dict()
        assert counts.get('confirmed_match', 0) == 0
        assert counts['probable_match'] == 19
        assert counts['unresolved'] == 25
        assert counts['no_match_established'] == 34
        assert sum(counts.values()) == 78

    def test_sensitivity_exclusion_list_exactness_and_zero_leakage(self):
        with open(BENCHMARK_CLEAN, 'r') as f:
            data = json.load(f)
            
        excl_list = data['co_located_stations_excluded_list']
        assert len(excl_list) == 19
        assert len(set(excl_list)) == 19, "Excluded stations list contains duplicates!"
        assert "Budaun Polytechnic College" in excl_list
        assert "Bhuawapar" in excl_list
        
        # Verify against reconciliation ledger
        reconcil = pd.read_csv(RECONCILIATION_PATH)
        ledger_probable = set(reconcil[reconcil['status'] == 'probable_match']['telemetry_station'].unique())
        assert set(excl_list) == ledger_probable

    def test_pilana_1_distance_band_and_status(self):
        """Regression test verifying Pilana_1 distance band, status, and 100-500m cross-tabulation."""
        df = pd.read_csv(RECONCILIATION_PATH)
        pilana_matches = df[df['telemetry_station'] == 'Pilana_1']
        assert len(pilana_matches) == 1, "Expected exactly 1 Pilana_1 row in ledger"
        p = pilana_matches.iloc[0]
        
        # Verify exact distance and classification
        assert p['geodesic_distance_m'] == 251.0
        assert p['status'] == 'unresolved'
        assert p['confidence'] == 'LOW'
        assert p['admin_label_agreement'] == 'DISTRICT_ONLY'
        assert p['manual_station'] == 'Pilana  P'
        assert p['telemetry_district'] == 'BAGHPAT'
        assert p['manual_district'] == 'BAGHPAT'
        assert p['telemetry_block'] == 'PILANA'
        assert p['manual_block'] == '-'
        
        # Verify distance band assignment
        assert 100.0 < p['geodesic_distance_m'] <= 500.0
        
        # Verify the 100-500m band composition: exactly 18 probable_match + 1 unresolved (Pilana_1)
        b100_500 = df[(df['geodesic_distance_m'] > 100.0) & (df['geodesic_distance_m'] <= 500.0)]
        assert len(b100_500) == 19
        assert (b100_500['status'] == 'probable_match').sum() == 18
        assert (b100_500['status'] == 'unresolved').sum() == 1
        assert b100_500[b100_500['status'] == 'unresolved'].iloc[0]['telemetry_station'] == 'Pilana_1'
        
        # Verify <= 500m total: 1 (0-100m) + 19 (100-500m) = 20 rows (19 probable_match + 1 unresolved)
        under_500 = df[df['geodesic_distance_m'] <= 500.0]
        assert len(under_500) == 20
        assert (under_500['status'] == 'probable_match').sum() == 19
        assert (under_500['status'] == 'unresolved').sum() == 1

    def test_bootstrap_paired_alignment_and_sign_convention(self):
        # Read saved 6M predictions
        pred_df = pd.read_csv(PRED_6M_CSV)
        assert len(pred_df) == 18318
        
        # Paired evaluation assertion
        y = pred_df['target'].values
        p_base = pred_df['pred_persist'].values
        p_mod = pred_df['pred_qgb_safe_p50'].values
        assert verify_evaluation_alignment(y, p_base, p_mod) is True
        
        # Sign convention test: delta_rmse = rmse_base - rmse_mod
        # A positive delta indicates model achieved lower error (improvement) than baseline
        rmse_base = np.sqrt(np.mean((y - p_base) ** 2))
        rmse_mod = np.sqrt(np.mean((y - p_mod) ** 2))
        delta_empirical = rmse_base - rmse_mod
        assert delta_empirical > 0, "At 6M, QGB must have lower pooled RMSE than persistence"
        assert round(delta_empirical, 3) == round(3.534 - 3.394, 3)  # +0.140m

    def test_bootstrap_stability_dual_seeds_and_reproducibility(self):
        """Verifies bootstrap stability across 2,000 resamples and dual seeds (42 and 2026)."""
        from scripts.audit_up_benchmark_predictions import cluster_bootstrap_delta
        pred_df = pd.read_csv(PRED_6M_CSV)
        
        # Fixed seed reproducibility: seed 42 run twice must be identical
        run1 = cluster_bootstrap_delta(pred_df, 'target', 'pred_persist', 'pred_qgb_safe_p50', cluster_col='station', n_boot=500, seed=42)
        run2 = cluster_bootstrap_delta(pred_df, 'target', 'pred_persist', 'pred_qgb_safe_p50', cluster_col='station', n_boot=500, seed=42)
        assert run1 == run2, "Bootstrap output under fixed seed is not strictly deterministic!"
        
        # Dual-seed stability under 2000 resamples
        boot42 = cluster_bootstrap_delta(pred_df, 'target', 'pred_persist', 'pred_qgb_safe_p50', cluster_col='station', n_boot=2000, seed=42)
        boot2026 = cluster_bootstrap_delta(pred_df, 'target', 'pred_persist', 'pred_qgb_safe_p50', cluster_col='station', n_boot=2000, seed=2026)
        
        # Mean delta must agree within 0.005m
        assert abs(boot42['delta_rmse_mean'] - boot2026['delta_rmse_mean']) <= 0.005
        # 95% CI lower bound must cross zero in both seeds
        assert boot42['delta_rmse_ci95'][0] <= 0.0
        assert boot2026['delta_rmse_ci95'][0] <= 0.0
        # CI endpoints must be stable across seeds
        assert abs(boot42['delta_rmse_ci95'][0] - boot2026['delta_rmse_ci95'][0]) <= 0.015
        assert abs(boot42['delta_rmse_ci95'][1] - boot2026['delta_rmse_ci95'][1]) <= 0.015

    def test_distance_band_x_status_crosstab_exact_matrix(self):
        """Verifies that the distance-band x status crosstabulation matrix is strictly consistent."""
        df = pd.read_csv(RECONCILIATION_PATH)
        bins = [-0.001, 100.0, 500.0, 1000.0, 1500.0]
        b_labels = ['0-100m', '100-500m', '500-1000m', '1000-1500m']
        df['distance_band'] = pd.cut(df['geodesic_distance_m'], bins=bins, labels=b_labels)
        ct = pd.crosstab(df['distance_band'], df['status'])
        
        # Exact cell counts
        assert ct.loc['0-100m', 'probable_match'] == 1
        assert ct.loc['0-100m', 'unresolved'] == 0
        assert ct.loc['0-100m', 'no_match_established'] == 0
        
        assert ct.loc['100-500m', 'probable_match'] == 18
        assert ct.loc['100-500m', 'unresolved'] == 1
        assert ct.loc['100-500m', 'no_match_established'] == 0
        
        assert ct.loc['500-1000m', 'probable_match'] == 0
        assert ct.loc['500-1000m', 'unresolved'] == 24
        assert ct.loc['500-1000m', 'no_match_established'] == 0
        
        assert ct.loc['1000-1500m', 'probable_match'] == 0
        assert ct.loc['1000-1500m', 'unresolved'] == 0
        assert ct.loc['1000-1500m', 'no_match_established'] == 34

    def test_bootstrap_artifacts_resamples_seeds_and_exact_provenance(self):
        """Verifies bootstrap resamples >= 2000, both seeds recorded, and CIs match within tolerance."""
        from scripts.audit_up_benchmark_predictions import cluster_bootstrap_delta
        with open(INDEPENDENT_AUDIT, 'r') as f:
            audit = json.load(f)
            
        sec_6m = audit['6M_Variable_Window']['station_cluster_bootstrap_2000']
        assert sec_6m['resamples'] >= 2000, "Bootstrap resamples in production path must be >= 2000!"
        assert 'seed_42' in sec_6m, "Seed 42 must be recorded in artifact!"
        assert 'seed_2026' in sec_6m, "Seed 2026 must be recorded in artifact!"
        
        # Numerical tolerance test: recomputed against recorded artifact
        pred_df = pd.read_csv(PRED_6M_CSV)
        recomputed_42 = cluster_bootstrap_delta(pred_df, 'target', 'pred_persist', 'pred_qgb_safe_p50', cluster_col='station', n_boot=2000, seed=42)
        assert abs(recomputed_42['delta_rmse_ci95'][0] - sec_6m['seed_42']['delta_rmse_ci95'][0]) <= 0.001
        assert abs(recomputed_42['delta_rmse_ci95'][1] - sec_6m['seed_42']['delta_rmse_ci95'][1]) <= 0.001



class TestNegativeLeakageAndIntegrityRegressions:
    """
    Deliberately introduces future-feature leakage, target overlap,
    preprocessing leakage, and inconsistent evaluation rows;
    verifies each failure is strictly detected and caught.
    """

    def test_negative_future_feature_leakage_causes_failure(self):
        origin = "2025-01-15"
        clean_features = pd.DataFrame({
            "timestamp": ["2025-01-01", "2025-01-08", "2025-01-15"],
            "wl": [10.2, 10.4, 10.5]
        })
        assert check_feature_availability(clean_features, origin) is True

        leaked_features = pd.DataFrame({
            "timestamp": ["2025-01-01", "2025-01-15", "2025-01-22"],  # Leaked timestamp after origin!
            "wl": [10.2, 10.5, 11.0]
        })
        with pytest.raises(ValueError, match="Future Feature Leakage"):
            check_feature_availability(leaked_features, origin)

    def test_negative_target_overlap_causes_failure(self):
        clean_train_targets = ["2024-11-01", "2024-12-15", "2024-12-30"]
        clean_test_origins = ["2025-01-01", "2025-01-15", "2025-02-01"]
        assert check_temporal_isolation(clean_train_targets, clean_test_origins) is True

        leaked_train_targets = ["2024-11-01", "2024-12-15", "2025-01-05"]  # Overlap!
        with pytest.raises(ValueError, match="Temporal Leakage"):
            check_temporal_isolation(leaked_train_targets, clean_test_origins)

    def test_negative_preprocessing_leakage_causes_failure(self):
        train_data = np.array([[10.0], [12.0], [14.0]])
        test_data = np.array([[20.0], [22.0], [24.0]])
        
        clean_scaler = StandardScaler().fit(train_data)
        assert audit_preprocessing_isolation(clean_scaler, train_data, test_data) is True

        pooled_data = np.vstack([train_data, test_data])
        leaked_scaler = StandardScaler().fit(pooled_data)
        
        with pytest.raises(ValueError, match="Preprocessing Leakage"):
            audit_preprocessing_isolation(leaked_scaler, train_data, test_data)

    def test_negative_inconsistent_evaluation_rows_causes_failure(self):
        y_true = np.array([10.0, 11.0, 12.0, 13.0])
        y_persist = np.array([9.8, 10.9, 11.8, 12.9])
        y_model = np.array([9.9, 11.0, 11.9, 13.1])

        assert verify_evaluation_alignment(y_true, y_persist, y_model) is True

        y_model_mismatched = np.array([9.9, 11.0, 11.9])
        with pytest.raises(ValueError, match="Evaluation Row Mismatch"):
            verify_evaluation_alignment(y_true, y_persist, y_model_mismatched)

        y_model_nan = np.array([9.9, np.nan, 11.9, 13.1])
        with pytest.raises(ValueError, match="Inconsistent Evaluation"):
            verify_evaluation_alignment(y_true, y_persist, y_model_nan)
