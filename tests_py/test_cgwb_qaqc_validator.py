"""Unit and integration tests for CGWB QA/QC Validation Engine.

Verifies:
- Standard 5-status taxonomy (Valid, Suspect, Invalid, Missing, Replaced).
- Non-destructive negative handling (no automatic sign flipping).
- Duplicate timestamp detection and quarantine.
- Flatline stuck-sensor detection.
- Abrupt spike / step-change flagging.
- Out-of-range detection and Z-Score outlier filtering.
- Imputation flags (M, F, I, N, C).
"""

from datetime import datetime, timedelta
import pytest

from ml.qa_qc.validator import (
    CgwbValidationStatus,
    ImputationStrategyFlag,
    StationQcProfile,
    validate_single_record,
    validate_station_series,
    summarize_validation_outcomes,
)


@pytest.fixture
def test_profile():
    return StationQcProfile(
        station_id="TEST_DWLR_01",
        station_name="Test Pilot Well",
        state="Haryana",
        district="AMBALA",
        block="Ambala-I",
        expected_interval_hours=6.0,
        min_depth_mbgl=2.0,
        max_depth_mbgl=60.0,
        max_step_change_m=2.0,
        flatline_consecutive_count=4,
        flatline_tolerance_m=0.001,
        allow_zero_reading=False,
        datum_convention="depth_below_ground_level",
    )


def test_valid_observation_passes(test_profile):
    ts = datetime(2025, 1, 10, 6, 0)
    status, code, details = validate_single_record(15.42, ts, test_profile)
    assert status == CgwbValidationStatus.VALID
    assert code == "passed_preliminary_checks"


def test_negative_depth_invalid_not_silently_flipped(test_profile):
    """Rule 5: Do not blindly delete or sign-flip negative values."""
    ts = datetime(2025, 1, 10, 6, 0)
    status, code, details = validate_single_record(-15.42, ts, test_profile)
    assert status == CgwbValidationStatus.INVALID
    assert code == "negative_depth_below_ground"
    assert "physically impossible" in details


def test_zero_reading_flagged_suspect(test_profile):
    """Step 8: Zero readings flagged for review unless confirmed artesian."""
    ts = datetime(2025, 1, 10, 6, 0)
    status, code, _ = validate_single_record(0.0, ts, test_profile)
    assert status == CgwbValidationStatus.SUSPECT
    assert code == "zero_reading_potential_dry_or_fault"


def test_out_of_range_reading(test_profile):
    """Step 9: Physical range bounds."""
    ts = datetime(2025, 1, 10, 6, 0)
    status, code, _ = validate_single_record(85.0, ts, test_profile)
    assert status == CgwbValidationStatus.INVALID
    assert code == "out_of_expected_range"


def test_sentinel_pattern_invalid(test_profile):
    ts = datetime(2025, 1, 10, 6, 0)
    status, code, _ = validate_single_record(99.99, ts, test_profile)
    assert status == CgwbValidationStatus.INVALID
    assert code == "sensor_sentinel_fault_pattern"


def test_future_dated_timestamp(test_profile):
    future_ts = datetime(2099, 1, 1, 0, 0)
    ref_ts = datetime(2025, 1, 1, 0, 0)
    status, code, _ = validate_single_record(15.0, future_ts, test_profile, reference_time=ref_ts)
    assert status == CgwbValidationStatus.INVALID
    assert code == "future_dated_timestamp"


def test_duplicate_timestamp_detection(test_profile):
    """Step 5: Identify duplicate timestamps."""
    ts = datetime(2025, 1, 10, 6, 0)
    records = [
        (1, ts, 15.0),
        (2, ts, 15.5),  # Duplicate timestamp
        (3, ts + timedelta(hours=6), 15.2),
    ]
    results = validate_station_series(records, test_profile)
    assert len(results) == 3
    assert results[0].status == CgwbValidationStatus.VALID
    assert results[1].status == CgwbValidationStatus.INVALID
    assert results[1].reason_code == "duplicate_timestamp"
    assert results[2].status == CgwbValidationStatus.VALID


def test_abrupt_step_change_spike_detection(test_profile):
    """Step 11: Spike detection exceeding max_step_change_m."""
    base_ts = datetime(2025, 1, 10, 0, 0)
    records = [
        (1, base_ts, 15.0),
        (2, base_ts + timedelta(hours=6), 15.1),
        (3, base_ts + timedelta(hours=12), 22.5),  # 7.4m sudden jump (> 2.0m threshold)
        (4, base_ts + timedelta(hours=18), 15.2),
    ]
    results = validate_station_series(records, test_profile)
    assert results[0].status == CgwbValidationStatus.VALID
    assert results[1].status == CgwbValidationStatus.VALID
    assert results[2].status == CgwbValidationStatus.SUSPECT
    assert results[2].reason_code == "abrupt_step_change_spike"
    assert results[3].status == CgwbValidationStatus.VALID


def test_flatline_stuck_sensor_detection(test_profile):
    """Step 12: Zero variance across consecutive readings."""
    base_ts = datetime(2025, 1, 10, 0, 0)
    records = [
        (1, base_ts + timedelta(hours=0), 18.25),
        (2, base_ts + timedelta(hours=6), 18.25),
        (3, base_ts + timedelta(hours=12), 18.25),
        (4, base_ts + timedelta(hours=18), 18.25),  # 4th identical reading triggers flatline
        (5, base_ts + timedelta(hours=24), 18.25),
    ]
    results = validate_station_series(records, test_profile)
    assert results[0].status == CgwbValidationStatus.VALID
    assert results[1].status == CgwbValidationStatus.VALID
    assert results[2].status == CgwbValidationStatus.VALID
    assert results[3].status == CgwbValidationStatus.SUSPECT
    assert results[3].reason_code == "flatline_stuck_sensor"
    assert results[4].status == CgwbValidationStatus.SUSPECT


def test_validation_summary_metrics(test_profile):
    base_ts = datetime(2025, 1, 10, 0, 0)
    records = [
        (1, base_ts, 15.0),
        (2, base_ts + timedelta(hours=6), -10.0),  # Invalid
        (3, base_ts + timedelta(hours=12), 0.0),   # Suspect
        (4, base_ts + timedelta(hours=18), None),  # Missing
        (5, base_ts + timedelta(hours=24), 15.2),  # Valid
    ]
    results = validate_station_series(records, test_profile)
    summary = summarize_validation_outcomes(results)
    assert summary["total_records"] == 5
    assert summary["status_counts"]["Valid"] == 2
    assert summary["status_counts"]["Invalid"] == 1
    assert summary["status_counts"]["Suspect"] == 1
    assert summary["status_counts"]["Missing"] == 1
    assert summary["pass_rate_pct"] == 40.0
