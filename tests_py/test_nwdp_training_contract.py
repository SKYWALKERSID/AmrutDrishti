"""Scientific and source-lineage contract for the NWDP experimental trainer."""
from datetime import date, timedelta

import pytest

from ml.nwdp_features import build_examples, chronological_split
from ml.nwdp_inference import forecast_station, load_station_model


def daily_series(days=50):
    first = date(2026, 1, 1)
    return [
        {
            "date": first + timedelta(days=offset),
            "value": float(offset),
            "source_record_ids": [f"source:{offset}"],
        }
        for offset in range(days)
    ]


def test_training_pairs_only_observed_exact_seven_day_targets():
    records = daily_series(20)
    records = [item for item in records if item["date"] != date(2026, 1, 15)]
    examples = build_examples(records)
    assert all(row["target_date"] - row["origin_date"] == timedelta(days=7) for row in examples)
    assert not any(row["target_date"] == date(2026, 1, 15) for row in examples)
    assert all(row["target_source_record_ids"] for row in examples)


def test_chronological_split_does_not_leak_target_labels_across_boundary():
    train, test = chronological_split(build_examples(daily_series()))
    assert max(row["target_date"] for row in train) < min(row["origin_date"] for row in test)


def test_production_artifact_loads_and_inference_is_traceable_and_experimental():
    package = load_station_model()
    assert package["metadata"]["operational_eligibility"] is False
    station_id = sorted(package["stations"])[0]
    prediction = forecast_station(station_id, package)
    assert prediction["status"] == "experimental"
    assert prediction["measurementStatus"] == "experimental_source_reported_variable_unverified_depth"
    assert prediction["operationalEligibility"] is False
    assert prediction["intervalStatus"] == "ordered_uncalibrated"
    assert prediction["provenance"]["originRecordIds"]
    assert prediction["forecastHorizonDays"] == 7


def test_unknown_station_fails_closed():
    package = load_station_model()
    with pytest.raises(KeyError, match="station_not_trained"):
        forecast_station("unknown::station", package)
