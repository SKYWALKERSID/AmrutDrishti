"""
Regression tests for forecast provenance, horizon validity, and quantile crossing integrity.
Verifies:
1. P50 preservation and immutability.
2. Quantile crossing detection and interval status labeling.
3. Inconsistent forecast horizon detection (e.g., training cutoff vs future target date).
4. Distinguishing existing prediction records from operationally eligible forecasts.
"""
import unittest
from datetime import datetime, timedelta
import numpy as np
from ml.validation import quantile_crossings, order_quantiles


def audit_prediction_record(
    unit_id: str,
    model_id: str,
    training_cutoff: str,
    target_date: str,
    created_at: str,
    p10: float,
    p50: float,
    p90: float
):
    """
    Pure audit function replicating API decision logic for forecast records.
    """
    # 1. P50 immutability
    preserved_p50 = float(p50)

    # 2. Horizon consistency: target cannot be > 180 days after training cutoff for a quarterly model
    cutoff_dt = datetime.strptime(training_cutoff, "%Y-%m-%d")
    target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    days_from_cutoff = (target_dt - cutoff_dt).days

    is_horizon_inconsistent = days_from_cutoff > 180 or days_from_cutoff < 45

    # 3. Quantile crossing audit
    has_crossing = (p10 > p50) or (p90 < p50) or (p10 > p90)

    interval_status = "invalid_crossing" if has_crossing else "uncalibrated"
    safe_p10 = None if has_crossing else p10
    safe_p90 = None if has_crossing else p90

    # 4. Operational eligibility: requires valid horizon AND verified calibration
    # Research prototype with inconsistent horizon or uncalibrated quantiles is ineligible
    operational_eligibility = (not is_horizon_inconsistent) and (not has_crossing) and False  # False until calibrated

    status = "unavailable" if is_horizon_inconsistent else "research_prototype"

    return {
        "unit_id": unit_id,
        "model_id": model_id,
        "modelStatus": status,
        "provenanceStatus": "unverifiable" if is_horizon_inconsistent else "verified",
        "horizonStatus": "inconsistent_origin" if is_horizon_inconsistent else "valid",
        "operationalEligibility": operational_eligibility,
        "preserved_p50": preserved_p50,
        "safe_p10": safe_p10,
        "safe_p90": safe_p90,
        "intervalStatus": interval_status,
        "has_crossing": has_crossing,
        "days_from_cutoff": days_from_cutoff
    }


class TestForecastProvenanceAndHorizonAudit(unittest.TestCase):
    def test_p50_preservation_and_immutability(self):
        # Regardless of whether P10/P90 cross, P50 must never change
        res = audit_prediction_record(
            unit_id="3783",
            model_id="quantile_gb_v1.0",
            training_cutoff="2023-08-20",
            target_date="2023-11-20",
            created_at="2023-08-21T00:00:00Z",
            p10=6.0,
            p50=4.5,  # Crossing: P10 > P50
            p90=8.0
        )
        self.assertEqual(res["preserved_p50"], 4.5)
        self.assertTrue(res["has_crossing"])
        self.assertEqual(res["intervalStatus"], "invalid_crossing")
        # Bounds are invalidated, never falsely presented as calibrated
        self.assertIsNone(res["safe_p10"])
        self.assertIsNone(res["safe_p90"])

    def test_quantile_crossings_invalidate_interval_without_changing_p50(self):
        # Upper crossing: P50 > P90
        res = audit_prediction_record(
            unit_id="3788",
            model_id="quantile_gb_v1.0",
            training_cutoff="2023-08-20",
            target_date="2023-11-20",
            created_at="2023-08-21T00:00:00Z",
            p10=2.0,
            p50=7.5,
            p90=5.0  # Crossing: P50 > P90
        )
        self.assertEqual(res["preserved_p50"], 7.5)
        self.assertTrue(res["has_crossing"])
        self.assertEqual(res["intervalStatus"], "invalid_crossing")
        self.assertIsNone(res["safe_p10"])
        self.assertIsNone(res["safe_p90"])

    def test_training_cutoff_inconsistent_with_claimed_horizon(self):
        # Historical training cutoff 2023-08-20 vs target date 2027-01-11 (~1240 days later)
        res = audit_prediction_record(
            unit_id="4032",
            model_id="quantile_gb_v1.0",
            training_cutoff="2023-08-20",
            target_date="2027-01-11",
            created_at="2026-10-12T18:39:00Z",
            p10=3.02,
            p50=3.46,
            p90=10.0
        )
        # Provenance audit must catch the temporal decoupling
        self.assertEqual(res["horizonStatus"], "inconsistent_origin")
        self.assertEqual(res["provenanceStatus"], "unverifiable")
        self.assertEqual(res["modelStatus"], "unavailable")
        self.assertFalse(res["operationalEligibility"])

    def test_valid_prediction_record_distinguishable_from_operationally_eligible(self):
        # A record with valid horizon and no crossings is still NOT operationally eligible
        # because research prototype models lack field calibration and independent validation.
        res = audit_prediction_record(
            unit_id="3783",
            model_id="quantile_gb_v1.0",
            training_cutoff="2023-08-20",
            target_date="2023-11-15",
            created_at="2023-08-21T00:00:00Z",
            p10=3.12,
            p50=8.07,
            p90=13.12
        )
        self.assertEqual(res["horizonStatus"], "valid")
        self.assertEqual(res["modelStatus"], "research_prototype")
        self.assertEqual(res["intervalStatus"], "uncalibrated")
        # Must still be blocked from operational eligibility
        self.assertFalse(res["operationalEligibility"])


if __name__ == "__main__":
    unittest.main()
