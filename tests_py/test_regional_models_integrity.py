"""
JalDrishti ML Pipeline — Regional Artifacts & Transfer Integrity Tests
=======================================================================
Verifies:
1. Artifact loading for all 5 regional models (Karnataka, Telangana, Tamil Nadu, Tripura, Meghalaya).
2. Manifest registration and completeness (metrics, sample sizes, cutoffs).
3. Monotonic non-crossing quantile ordering (P10 <= P50 <= P90).
4. Feature schema compatibility and strict missing/non-finite validation.
5. Fails closed on insufficient history (< 2 quarters).
6. Missing/corrupted artifact error handling.
"""

import unittest
import os
import json
import numpy as np
import pandas as pd
from ml.inference import (
    load_model_artifacts,
    load_global_model_artifact,
    load_manifest,
    predict_single_horizon,
    validate_feature_vector,
    normalize_state_key,
    forecast_from_observation_series,
)

class TestRegionalModelsIntegrity(unittest.TestCase):
    def setUp(self):
        self.regional_states = [
            ("Karnataka", "karnataka"),
            ("Telangana", "telangana"),
            ("Tamil Nadu", "tamil_nadu"),
            ("Tripura", "tripura"),
            ("Meghalaya", "meghalaya"),
        ]
        self.valid_features = {
            "wl_origin": 12.5,
            "wl_prev": 11.2,
            "wl_year_before_target": 12.0,
            "drawdown_velocity_q1": 0.014,
            "season_code": 1
        }

    def test_regional_artifacts_load_successfully(self):
        for state_name, state_code in self.regional_states:
            qgb, ridge = load_model_artifacts(state_name)
            self.assertIsNotNone(qgb, f"QGB artifact missing for {state_name}")
            self.assertIsNotNone(ridge, f"Ridge artifact missing for {state_name}")

    def test_regional_manifest_entries_and_metrics(self):
        manifest = load_manifest()
        self.assertIn("models", manifest)
        for state_name, _ in self.regional_states:
            self.assertIn(state_name, manifest["models"])
            entry = manifest["models"][state_name]
            self.assertGreater(entry["n_train"], 0)
            self.assertGreater(entry["n_test"], 0)
            self.assertEqual(len(entry["test_dates"]), 2)
            metrics = entry["metrics"]
            self.assertIn("qgb_mae", metrics)
            self.assertIn("qgb_rmse", metrics)
            self.assertIn("coverage_80pct", metrics)
            self.assertEqual(metrics["crossing_rate"], 0.0)

    def test_regional_prediction_quantile_ordering(self):
        global_model = load_global_model_artifact()
        encoder = global_model.preprocessor_.named_transformers_["geography"].named_steps["one_hot"]
        known_states, known_districts, known_blocks = encoder.categories_
        for state_name, _ in self.regional_states:
            state = next(item for item in known_states if item.lower() == state_name.lower())
            res = predict_single_horizon(
                self.valid_features, state=state, district_name=known_districts[0], block_name=known_blocks[0]
            )
            p10 = res["lower_bound_p10_mbgl"]
            p50 = res["expected_depth_mbgl"]
            p90 = res["upper_bound_p90_mbgl"]

            self.assertLessEqual(p10, p50, f"P10 > P50 in {state_name}")
            self.assertLessEqual(p50, p90, f"P50 > P90 in {state_name}")
            self.assertEqual(res["interval_status"], "ordered_uncalibrated")

    def test_feature_compatibility_and_validation(self):
        # Missing feature must fail closed
        incomplete = {"wl_origin": 10.0}
        with self.assertRaises(ValueError):
            validate_feature_vector(incomplete)

        # Non-finite feature must fail closed
        infinite = {**self.valid_features, "wl_origin": float("inf")}
        with self.assertRaises(ValueError):
            validate_feature_vector(infinite)

    def test_insufficient_history_fails_closed(self):
        single_obs = [{"date": "2024-01-15", "wellDepth": 10.5}]
        res = forecast_from_observation_series(
            observations=single_obs,
            state="Karnataka",
            block_id="blk_shivamogga_main",
            block_name="Shivamogga",
            district_name="Shivamogga"
        )
        self.assertEqual(res["modelStatus"], "unavailable")
        self.assertEqual(len(res["forecasts"]), 0)

    def test_unsupported_or_corrupted_state_fails_safely(self):
        with self.assertRaises(ValueError):
            normalize_state_key("Antarctica")

        with self.assertRaises(FileNotFoundError):
            load_model_artifacts("Punjab", artifacts_dir="non_existent_dir")

if __name__ == "__main__":
    unittest.main()
