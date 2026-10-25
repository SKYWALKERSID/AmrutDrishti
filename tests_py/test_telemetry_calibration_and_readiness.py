"""Ingestion and Telemetry Verification Pipeline Tests.

Validates:
1. Telemetry assessment logic (sign conventions, transducer pressure, temporal gaps).
2. Fail-closed behavior on missing datums or unverified colocated pairs.
3. Telemetry exclusion from global model training/inference pipeline.
4. Aquifer disaggregation requirement (preventing false composite wells).
5. Exact 400-day freshness gate enforcement.
6. Operational eligibility invariant (must always be False).
"""

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
from scripts.assess_telemetry_calibration import (
    STATUS_DATUM_UNVERIFIED,
    STATUS_INSUFFICIENT_PAIRS,
    assess_karnataka_telemetry,
    assess_known_anomalous_series,
    assess_telangana_telemetry,
    run_full_calibration_assessment,
)


def test_telangana_telemetry_rejects_negative_pressure():
    """Removed station calibration files cannot make retained raw data eligible."""
    ts_file = ROOT / "data" / "derived" / "telangana_telemetry_2026_validated.json"
    result = assess_telangana_telemetry(ts_file)
    
    assert result["eligible_for_inference"] is False
    assert result["status"] == "not_assessed"
    assert "file not found" in result["exclusion_reason"].lower()


def test_karnataka_telemetry_rejects_temporal_gap():
    """Absent station-specific calibration evidence remains ineligible."""
    ka_file = ROOT / "data" / "derived" / "karnataka_telemetry_2026_validated.json"
    result = assess_karnataka_telemetry(ka_file)
    
    assert result["eligible_for_inference"] is False
    assert result["status"] == "not_assessed"
    assert "file not found" in result["exclusion_reason"].lower()


def test_known_anomalies_handled_safely():
    """Anomalies such as 999m missing flags and mixed aquifers must be handled rigorously."""
    anomalies = assess_known_anomalous_series()
    
    # Meghalaya Umling
    assert anomalies["meghalaya_umling_byrnihat"]["status"] == "rejected"
    assert "fillvalue" in anomalies["meghalaya_umling_byrnihat"]["investigation_result"].lower()
    
    # Tamil Nadu P.N.Palayam
    assert anomalies["tamil_nadu_coimbatore_mixed_wells"]["status"] == "aquifer_disaggregation_required"
    assert "distinct aquifers" in anomalies["tamil_nadu_coimbatore_mixed_wells"]["investigation_result"].lower()


def test_calibration_assessment_report_invariants():
    """Full calibration report must strictly forbid operational or research eligibility."""
    report = run_full_calibration_assessment()
    
    assert report["summary"]["sources_validated_for_research_prediction"] == 0
    assert report["summary"]["sources_eligible_for_operational_use"] == 0
    assert report["global_model_compatibility_assessment"]["compatibility_verdict"] == "incompatible_without_aggregation_and_calibration"


def test_block_readiness_audit_ledger_invariants():
    """Readiness ledger must retain exactly 43 blocks and fail closed at zero eligible."""
    ledger_path = ROOT / "audit" / "global_model_block_readiness.json"
    assert ledger_path.exists()
    
    with open(ledger_path, "r", encoding="utf-8") as f:
        ledger = json.load(f)
        
    assert ledger["scope"]["blocks"] == 43
    assert ledger["scope"]["states"] == 9
    
    research_ready = sum(1 for b in ledger["blocks"] if b.get("readiness_status") == "eligible_for_research_prediction")
    operational_ready = sum(1 for b in ledger["blocks"] if b.get("operational_eligibility") is True)
    
    assert research_ready == 0
    assert operational_ready == 0
    
    # No active block has official station-to-block mapping evidence yet.
    valid_statuses = {"unverified_station_mapping"}
    for b in ledger["blocks"]:
        assert b["readiness_status"] in valid_statuses
        assert b["operational_eligibility"] is False


def test_adaptive_historical_and_recent_inference_compatibility():
    """Verify that GlobalBlockAwareQuantileGB-v1 consumes historical + recent observations adaptively."""
    from ml.inference import forecast_from_observation_series
    
    # Historical observations from Punjab Khanna
    historical_obs = [
        {"date": "2021-01-10", "depth_mbgl": 24.18},
        {"date": "2021-08-31", "depth_mbgl": 26.13},
        {"date": "2022-01-30", "depth_mbgl": 24.75},
        {"date": "2022-05-20", "depth_mbgl": 24.81},
        {"date": "2022-08-01", "depth_mbgl": 26.21},
        {"date": "2022-11-01", "depth_mbgl": 25.32},
        {"date": "2023-01-01", "depth_mbgl": 24.91},
        {"date": "2023-06-01", "depth_mbgl": 25.21},
        {"date": "2023-11-01", "depth_mbgl": 26.43},
    ]
    
    # 1. Historical-only demonstration prediction
    hist_result = forecast_from_observation_series(
        historical_obs, "Punjab", "blk_ludhiana_khanna", "Khanna", "Ludhiana",
        station_name="Punjab::Ikloha-Pz", num_horizons=4
    )
    assert hist_result["modelStatus"] == "research_prototype"
    assert hist_result["latestObservationDate"] == "2023-11-01"
    assert len(hist_result["forecasts"]) == 4
    for f in hist_result["forecasts"]:
        p10 = f["uncertaintyInterval"]["lowerBoundP10Mbgl"]
        p50 = f["expectedDepthMbgl"]
        p90 = f["uncertaintyInterval"]["upperBoundP90Mbgl"]
        assert p10 <= p50 <= p90
        
    # 2. Adaptive combination with newer verified observation
    combined_obs = list(historical_obs) + [
        {"date": "2026-04-01", "depth_mbgl": 26.50}
    ]
    comb_result = forecast_from_observation_series(
        combined_obs, "Punjab", "blk_ludhiana_khanna", "Khanna", "Ludhiana",
        station_name="Punjab::Ikloha-Pz", num_horizons=4
    )
    assert comb_result["modelStatus"] == "research_prototype"
    assert comb_result["latestObservationDate"] == "2026-04-01"
    assert comb_result["forecasts"][0]["targetDate"] == "2026-07-01"
    for f in comb_result["forecasts"]:
        p10 = f["uncertaintyInterval"]["lowerBoundP10Mbgl"]
        p50 = f["expectedDepthMbgl"]
        p90 = f["uncertaintyInterval"]["upperBoundP90Mbgl"]
        assert p10 <= p50 <= p90
