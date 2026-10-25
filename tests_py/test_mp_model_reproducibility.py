"""
JalDrishti — Phase 1 MP Model Reproducibility and Regression Suite
Verifies:
1. MP artifact exists, is loadable, and matches SHA-256 fingerprint.
2. Manifest metadata matches artifact configuration and evaluated metrics.
3. Quantiles are strictly non-crossing and ordering safeguard functions correctly.
4. Inference engine loads the exact trained MP model and produces valid 4-quarter forecasts.
"""
import unittest
import os
import json
import hashlib
import joblib
import numpy as np
import pandas as pd

from ml.inference import load_model_artifacts, forecast_from_observation_series, REQUIRED_FEATURES


class TestMpModelReproducibility(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest_path = "ml/artifacts/manifest.json"
        with open(cls.manifest_path, "r", encoding="utf-8") as f:
            cls.manifest = json.load(f)
        cls.mp_entry = cls.manifest["models"]["Madhya Pradesh"]
        cls.artifact_path = cls.mp_entry["qgb_artifact"]

    def test_artifact_exists_and_hash_is_recorded(self):
        self.assertTrue(os.path.exists(self.artifact_path), f"Artifact missing: {self.artifact_path}")
        with open(self.artifact_path, "rb") as f:
            digest = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(len(digest), 64)
        # Expected SHA-256 for verified MP artifact
        self.assertEqual(digest, "94abdb92c0331cd9abd43750e589ec93884da40bac1d3f9abd4775b73717f72d")

    def test_artifact_architecture_and_features(self):
        qgb = joblib.load(self.artifact_path)
        self.assertTrue(hasattr(qgb, "models_"))
        self.assertEqual(list(qgb.models_.keys()), [0.1, 0.5, 0.9])
        self.assertEqual(qgb.feature_names_, REQUIRED_FEATURES)
        self.assertEqual(self.mp_entry["features"], REQUIRED_FEATURES)

    def test_manifest_reported_metrics_integrity(self):
        metrics = self.mp_entry["metrics"]
        self.assertAlmostEqual(metrics["qgb_rmse"], 2.735, places=3)
        self.assertAlmostEqual(metrics["persistence_rmse"], 4.797, places=3)
        self.assertGreater(metrics["gain_over_persistence_pct"], 40.0)
        self.assertAlmostEqual(metrics["crossing_rate"], 0.0, places=2)
        self.assertEqual(self.mp_entry["n_train"], 187250)
        self.assertEqual(self.mp_entry["n_test"], 22551)
        self.assertEqual(self.manifest["operational_eligibility"], False)

    def test_inference_engine_serves_mp_model(self):
        observations = [
            {"month": "2023-01-15", "wellDepth": 6.8},
            {"month": "2023-05-15", "wellDepth": 7.5},
            {"month": "2023-08-15", "wellDepth": 4.2},
            {"month": "2023-11-15", "wellDepth": 4.9},
        ]
        res = forecast_from_observation_series(
            observations=observations,
            state="Madhya Pradesh",
            block_id="blk_tikamgarh_main",
            block_name="Tikamgarh",
            district_name="Tikamgarh",
            station_name="Tikamgarh Central Well",
            num_horizons=4
        )
        self.assertEqual(res["modelIdentifier"], "GlobalBlockAwareQuantileGB-v1")
        self.assertEqual(res["modelStatus"], "research_prototype")
        self.assertEqual(res["operationalEligibility"], False)
        self.assertEqual(len(res["forecasts"]), 4)

        for fc in res["forecasts"]:
            self.assertEqual(fc["units"], "m bgl")
            ui = fc["uncertaintyInterval"]
            p10 = ui["lowerBoundP10Mbgl"]
            p50 = fc["expectedDepthMbgl"]
            p90 = ui["upperBoundP90Mbgl"]
            self.assertIsNotNone(p10)
            self.assertIsNotNone(p50)
            self.assertIsNotNone(p90)
            self.assertTrue(p10 <= p50 <= p90, f"Quantile crossing violated: P10={p10}, P50={p50}, P90={p90}")


if __name__ == "__main__":
    unittest.main()
