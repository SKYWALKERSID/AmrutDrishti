"""Regression tests for the promoted shared groundwater model.

These checks intentionally test metadata and safety contracts rather than
claiming that a prediction is current: bundled block forecasts remain subject
to the web application's 400-day freshness gate.
"""
import json
import os
import unittest

from ml.inference import load_global_model_artifact, load_manifest, predict_single_horizon


class TestGlobalModelIntegration(unittest.TestCase):
    def setUp(self):
        with open("audit/coverage_matrix_56_blocks.json", encoding="utf-8") as handle:
            self.blocks = json.load(handle)
        with open("audit/global_groundwater_model_validation.json", encoding="utf-8") as handle:
            self.validation = json.load(handle)
        self.features = {
            "wl_origin": 12.5, "wl_prev": 12.2,
            "wl_year_before_target": 12.0, "drawdown_velocity_q1": 0.3,
            "season_code": 1,
        }

    def test_canonical_coverage_has_all_56_blocks_in_supported_states(self):
        self.assertEqual(len(self.blocks), 56)
        self.assertEqual(len({row["id"] for row in self.blocks}), 56)
        expected_states = {
            "Punjab", "Haryana", "Rajasthan", "Assam", "Madhya Pradesh",
            "Karnataka", "Telangana", "Tamil Nadu", "Tripura", "Meghalaya",
        }
        self.assertEqual({row["state"] for row in self.blocks}, expected_states)

    def test_global_artifact_is_promoted_and_has_audit_evidence(self):
        manifest = load_manifest()
        entry = manifest["global_model"]
        self.assertEqual(entry["status"], "promoted_research_prototype")
        self.assertFalse(entry["operational_eligibility"])
        self.assertEqual(entry["interval_status"], "ordered_uncalibrated")
        self.assertTrue(os.path.exists(entry["artifact"]))
        self.assertIsNotNone(load_global_model_artifact())
        self.assertEqual(self.validation["promotion_status"], "promoted_research_prototype")
        self.assertEqual(self.validation["chronological_validation"]["quantile_crossings"], 0)
        self.assertEqual(self.validation["station_heldout_validation"]["quantile_crossings"], 0)

    def test_only_manual_sources_are_used_and_telemetry_is_excluded(self):
        sources = self.validation["source_files"]
        self.assertEqual({source["state"] for source in sources}, {row["state"] for row in self.blocks})
        self.assertTrue(all("telemetry" not in source["path"].lower() for source in sources))
        self.assertIn("Station identifiers are grouping", self.validation["data_policy"])

    def test_one_shared_model_serves_each_supported_state_with_ordered_quantiles(self):
        model = load_global_model_artifact()
        encoder = model.preprocessor_.named_transformers_["geography"].named_steps["one_hot"]
        known_states, known_districts, known_blocks = encoder.categories_
        active_states = [s for s in sorted({row["state"] for row in self.blocks}) if s != "Assam"]
        for state in active_states:
            matching_state = next(item for item in known_states if item.lower() == state.lower())
            prediction = predict_single_horizon(
                self.features, matching_state, district_name=known_districts[0], block_name=known_blocks[0],
            )
            self.assertEqual(prediction["model_identifier"], "GlobalBlockAwareQuantileGB-v1")
            self.assertFalse(prediction["operational_eligibility"])
            self.assertEqual(prediction["interval_status"], "ordered_uncalibrated")
            self.assertLessEqual(prediction["lower_bound_p10_mbgl"], prediction["expected_depth_mbgl"])
            self.assertLessEqual(prediction["expected_depth_mbgl"], prediction["upper_bound_p90_mbgl"])

        # Assam must strictly fail as unsupported/out-of-scope
        with self.assertRaises(ValueError):
            predict_single_horizon(
                self.features, "Assam", district_name=known_districts[0], block_name=known_blocks[0]
            )

    def test_unknown_geographic_context_fails_closed(self):
        with self.assertRaises(ValueError):
            predict_single_horizon(
                self.features, "Punjab", district_name="Not A District", block_name="Not A Block"
            )

    def test_block_readiness_ledger_is_complete_and_fail_closed(self):
        with open("audit/global_model_block_readiness.json", encoding="utf-8") as handle:
            ledger = json.load(handle)
        self.assertEqual(ledger["scope"]["blocks"], 43)
        self.assertEqual(len(ledger["blocks"]), 43)
        self.assertTrue(all(not row["operational_eligibility"] for row in ledger["blocks"]))
        self.assertTrue(all(row["readiness_status"] in {"stale", "unverified_station_mapping", "insufficient_data", "eligible_for_research_prediction", "prediction_integrity_failure"} for row in ledger["blocks"]))
        self.assertTrue(all(row["api_current_forecast_status"].startswith("unavailable") for row in ledger["blocks"]))


if __name__ == "__main__":
    unittest.main()
