"""
Regression tests for ML inference pipeline, feature validation, quantile monotonicity,
baseline persistence preservation, and fail-closed safeguard behavior.
"""
import os
import unittest
import numpy as np
import pandas as pd
from ml.inference import (
    REQUIRED_FEATURES,
    validate_feature_vector,
    predict_single_horizon,
    forecast_from_observation_series,
)


class TestInferencePipeline(unittest.TestCase):
    def setUp(self):
        self.valid_features = {
            "wl_origin": 15.5,
            "wl_prev": 15.2,
            "wl_year_before_target": 14.8,
            "drawdown_velocity_q1": 0.3,
            "season_code": 1,
        }

    def test_feature_schema_validation_success(self):
        df = validate_feature_vector(self.valid_features)
        self.assertEqual(list(df.columns), REQUIRED_FEATURES)
        self.assertEqual(df.shape, (1, len(REQUIRED_FEATURES)))
        self.assertFalse(df.isna().any().any())

    def test_feature_schema_validation_missing_key(self):
        incomplete = self.valid_features.copy()
        del incomplete["season_code"]
        with self.assertRaises(ValueError) as ctx:
            validate_feature_vector(incomplete)
        self.assertIn("missing required schema fields", str(ctx.exception).lower())

    def test_feature_schema_validation_non_finite(self):
        with_nan = self.valid_features.copy()
        with_nan["wl_origin"] = np.nan
        with self.assertRaises(ValueError) as ctx:
            validate_feature_vector(with_nan)
        self.assertIn("non-finite value", str(ctx.exception).lower())

        with_inf = self.valid_features.copy()
        with_inf["drawdown_velocity_q1"] = np.inf
        with self.assertRaises(ValueError) as ctx:
            validate_feature_vector(with_inf)
        self.assertIn("non-finite value", str(ctx.exception).lower())

    def test_predict_single_horizon_quantile_ordering(self):
        res = predict_single_horizon(
            self.valid_features, state="Punjab", district_name="HOSHIARPUR", block_name="MUKERIAN"
        )
        self.assertIn("expected_depth_mbgl", res)
        self.assertIn("lower_bound_p10_mbgl", res)
        self.assertIn("upper_bound_p90_mbgl", res)

        p10 = res["lower_bound_p10_mbgl"]
        p50 = res["expected_depth_mbgl"]
        p90 = res["upper_bound_p90_mbgl"]

        # Non-crossing quantiles
        self.assertLessEqual(p10, p50)
        self.assertLessEqual(p50, p90)
        self.assertEqual(res["interval_width_m"], round(p90 - p10, 2))
        self.assertEqual(res["interval_status"], "ordered_uncalibrated")

    def test_insufficient_history_returns_unavailable(self):
        # < 2 records fails closed
        sparse_series = [
            {"date": "2023-05-15", "wellDepth": 12.4}
        ]
        result = forecast_from_observation_series(
            observations=sparse_series,
            state="Punjab",
            block_id="blk_ludhiana_1",
            block_name="MUKERIAN",
            district_name="HOSHIARPUR"
        )
        self.assertEqual(result["modelStatus"], "unavailable")
        self.assertEqual(len(result["forecasts"]), 0)
        self.assertFalse(result["operationalEligibility"])
        self.assertIn("insufficient", result["safeguardDisclaimer"].lower())

    def test_valid_observation_series_multi_horizon(self):
        series = [
            {"date": "2022-01-15", "wellDepth": 21.0},
            {"date": "2022-05-15", "wellDepth": 22.5},
            {"date": "2022-08-15", "wellDepth": 20.8},
            {"date": "2022-11-15", "wellDepth": 21.8},
            {"date": "2023-01-15", "wellDepth": 22.1},
            {"date": "2023-05-15", "wellDepth": 23.4},
        ]
        result = forecast_from_observation_series(
            observations=series,
            state="Punjab",
            block_id="blk_ludhiana_1",
            block_name="MUKERIAN",
            district_name="HOSHIARPUR"
        )

        self.assertEqual(result["modelStatus"], "research_prototype")
        self.assertFalse(result["operationalEligibility"])
        self.assertEqual(result["baselineHistoricalDepthMbgl"], 23.4)
        self.assertEqual(len(result["forecasts"]), 4)

        for fc in result["forecasts"]:
            self.assertIn(fc["horizonQuarter"], [1, 2, 3, 4])
            self.assertEqual(fc["units"], "m bgl")
            self.assertIn("targetDate", fc)
            self.assertIn("targetSeason", fc)
            self.assertEqual(fc["forecastHorizonMonths"], fc["horizonQuarter"] * 3)
            # Check quantiles
            unc = fc["uncertaintyInterval"]
            self.assertLessEqual(unc["lowerBoundP10Mbgl"], fc["expectedDepthMbgl"])
            self.assertLessEqual(fc["expectedDepthMbgl"], unc["upperBoundP90Mbgl"])
            # Check baseline persistence is preserved and distinct
            self.assertIn("baselinePersistence", fc)
            self.assertEqual(fc["baselinePersistence"]["lastObservationPersistenceMbgl"], 23.4)

    def test_missing_model_artifact_fails_closed(self):
        # Unsupported state raises ValueError
        with self.assertRaises(ValueError):
            predict_single_horizon(self.valid_features, state="NonExistentState123")

        # Non-existent artifacts directory raises FileNotFoundError
        with self.assertRaises(FileNotFoundError):
            predict_single_horizon(
                self.valid_features, state="Punjab", district_name="HOSHIARPUR",
                block_name="MUKERIAN", artifacts_dir="non_existent_dir_xyz"
            )


if __name__ == "__main__":
    unittest.main()
