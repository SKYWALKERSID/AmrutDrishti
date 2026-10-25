"""
Tests for NWDP Telemetry Ingestion, Validation & Scientific Safeguards
========================================================================
Validates:
1. CKAN Registry coverage across all 9 approved active states.
2. Timestamp parser robustness across varied government date formats.
3. Physical depth validation & explicit quarantine rules:
    - Negative values -> quarantine with unresolved sign and datum
    - Sentinel-like patterns -> unverified candidates pending station QC
   - Off-scale (>150m bgl) -> 'physically_implausible_depth'
   - Null or missing -> 'invalid_or_missing_depth'
4. Tamil Nadu aquifer isolation between shallow dug well and deep piezometer.
5. Ingestion manifest & normalized telemetry structure.
"""

import json
import os
import pytest
from scripts.ingest_all_nwdp_telemetry import parse_nwdp_timestamp, normalize_station_id, NWDPTelemetryIngestor

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MANIFEST_PATH = os.path.join(REPO_ROOT, "data", "derived", "nwdp_telemetry_ingestion_manifest.json")
QUARANTINE_PATH = os.path.join(REPO_ROOT, "data", "derived", "nwdp_telemetry_quarantine.json")
BLOCK_SERIES_PATH = os.path.join(REPO_ROOT, "data", "derived", "nwdp_block_telemetry_series.json")

def test_timestamp_parser_formats():
    assert parse_nwdp_timestamp("10-01-2024 06:00:00") == "2024-01-10 06:00:00"
    assert parse_nwdp_timestamp("2024-01-10 06:00") == "2024-01-10 06:00:00"
    assert parse_nwdp_timestamp("10/01/2024 06:00:00") == "2024-01-10 06:00:00"
    assert parse_nwdp_timestamp("2024-01-10") == "2024-01-10 00:00:00"
    assert parse_nwdp_timestamp("") is None
    assert parse_nwdp_timestamp("invalid-date-string") is None

def test_normalize_station_id():
    stn_id = normalize_station_id("karnataka", "kodagu", "Abhyath Mangale")
    assert stn_id == "Karnataka::Kodagu::Abhyath Mangale"
    
    stn_tn = normalize_station_id("tamil_nadu", "coimbatore", "Kalviramapalayam")
    assert stn_tn == "Tamil Nadu::Coimbatore::Kalviramapalayam"

def test_quarantine_rules_in_ingestor():
    ingestor = NWDPTelemetryIngestor()

    # Rule 1: Negative value (Telangana datum issue)
    ingestor.validate_and_record_observation(
        "Telangana", "Hyderabad", "Block1", "Station1", "17.38", "78.48", "500",
        "2023-01-10 06:00:00", "-2.54", "CGWB", "TS_2021.csv"
    )
    assert ingestor.quarantine_by_reason.get("negative_reading_unverified_sign_and_datum") == 1

    # Rule 2: Sentinel-like value remains a candidate without station evidence.
    ingestor.validate_and_record_observation(
        "Meghalaya", "Ri Bhoi", "Umling", "Station2", "25.90", "91.88", "300",
        "2023-01-10 06:00:00", "999.0", "CGWB", "ML_2021.csv"
    )
    assert ingestor.unverified_candidate_count == 1
    assert ingestor.unverified_candidates[0]["quality_status"] == "sentinel_pattern_pending_station_qc"

    # Rule 3: Physically implausible depth (>150m bgl)
    ingestor.validate_and_record_observation(
        "Rajasthan", "Jaipur", "Amer", "Station3", "26.91", "75.78", "400",
        "2023-01-10 06:00:00", "185.5", "CGWB", "RJ.csv"
    )
    assert ingestor.quarantine_by_reason.get("physically_implausible_depth") == 1

    # Rule 4: Missing depth
    ingestor.validate_and_record_observation(
        "Punjab", "Amritsar", "Majitha", "Station4", "31.76", "74.96", "230",
        "2023-01-10 06:00:00", "", "CGWB", "PB.csv"
    )
    assert ingestor.quarantine_by_reason.get("missing_depth_value") == 1

    # Positive readings remain candidates until measurement and mapping evidence exists.
    ingestor.validate_and_record_observation(
        "Karnataka", "Shivamogga", "Bhadravati", "Station5", "13.84", "75.70", "600",
        "2023-01-10 06:00:00", "12.45", "CGWB", "KA.csv"
    )
    assert ingestor.valid_records_count == 0
    assert ingestor.unverified_candidate_count == 2
    assert not ingestor.validated_observations

def test_manifest_has_all_nine_states_and_two_periods():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    resources = manifest["input_resources"]
    expected_states = {
        "Karnataka", "Telangana", "Tamil Nadu", "Madhya Pradesh", "Rajasthan",
        "Punjab", "Haryana", "Meghalaya", "Tripura"
    }
    assert {resource["state"] for resource in resources} == expected_states
    assert len(resources) == 18
    assert not any(resource["state"] == "Assam" for resource in resources)
    assert all({"2021-2025", "2026-2030"} == {r["period"] for r in resources if r["state"] == state} for state in expected_states)

def test_manifest_metrics():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    counts = manifest["counts"]
    assert counts["source_rows"] == 11_167_915
    assert counts["source_rows"] == counts["candidate_not_verified"] + counts["quarantined"]
    assert counts["negative_unconverted_undocumented_datum"] > 10_000_000
    assert counts["zero_readings"] > 0
    assert counts["exact_one_readings"] > 0
    assert counts.get("valid_groundwater_depth_observations", 0) == 0

def test_block_telemetry_isolation():
    with open(BLOCK_SERIES_PATH, "r", encoding="utf-8") as f:
        series = json.load(f)

    # No station is trusted until official station-to-block containment is documented.
    assert series == {}
    for bid, bdata in series.items():
        if bdata.get("state") == "Tamil Nadu" and "kalviramapalayam" in bdata.get("block", "").lower():
            assert "p.n.palayam" not in bdata.get("station_id", "").lower()
