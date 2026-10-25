import os
import json
import pytest
import numpy as np
import pandas as pd
from ml.nwdp_station_inference import (
    load_station_model_artifact,
    predict_station_telemetry,
    DEFAULT_STATION_MODEL_PATH
)

def test_nwdp_station_model_artifact_exists_and_loads():
    assert os.path.exists(DEFAULT_STATION_MODEL_PATH), "NWDP station model artifact missing"
    pkg = load_station_model_artifact()
    assert "stations" in pkg
    assert "metadata" in pkg
    assert pkg["metadata"]["operational_eligibility"] is False
    assert pkg["metadata"]["interval_status"] == "ordered_uncalibrated"
    assert any(key.endswith("::ChocftraPz") for key in pkg["stations"])
    assert any(key.endswith("::KaulapurPz") for key in pkg["stations"])

def test_nwdp_station_prediction_monotonic_ordering():
    res = predict_station_telemetry("ChocftraPz")
    assert res["status"] == "experimental_station_prototype"
    assert res["operationalEligibility"] is False
    assert res["stationName"] == "ChocftraPz"
    fc = res["forecast"]
    assert fc["p10"] <= fc["p50"] <= fc["p90"], f"Quantile crossing violated: {fc}"
    assert res["uncertaintyInterval"]["intervalStatus"] == "ordered_uncalibrated"
    assert res["uncertaintyInterval"]["isCalibrated"] is False
    assert "safeguardNotice" in res
    assert "block" not in res.get("district", "").lower()

def test_unsupported_station_fails_closed():
    res = predict_station_telemetry("NonExistentStation_999")
    assert res["status"] == "unavailable"
    assert "not supported" in res["error"]
    assert res["operationalEligibility"] is False

def test_untrusted_custom_history_fails_closed():
    insufficient_series = [{"date": f"2026-01-0{i}", "depth": 10.0} for i in range(1, 8)]
    res = predict_station_telemetry("ChocftraPz", recent_observations=insufficient_series)
    assert res["status"] == "unavailable"
    assert "Custom observations are not accepted" in res["error"]
    assert res["operationalEligibility"] is False

def test_missing_model_file_fails_closed():
    res = predict_station_telemetry("ChocftraPz", artifact_path="non_existent_model.joblib")
    assert res["status"] == "unavailable"
    assert "Model artifact unavailable" in res["error"]
    assert res["operationalEligibility"] is False
