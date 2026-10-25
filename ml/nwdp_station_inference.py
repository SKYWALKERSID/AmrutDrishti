"""
NWDP Experimental Station-Level Telemetry ML Inference Engine
============================================================
Provides real, reproducible inference for physical monitoring stations
trained exclusively on retained NWDP telemetry datasets.

Key Principles (Rule 5 & TRD v1.0):
1. Station-Autonomous: Operates at the physical monitoring station level.
   Never routes through or masquerades as verified block-level predictions.
2. Fails closed when model or station artifact is missing.
3. Monotonic Quantile Ordering: Enforces P10 <= P50 <= P90.
4. Interval status labeled 'ordered_uncalibrated'.
5. Operational eligibility strictly False (experimental research prototype).
"""

import os
import sys
import math
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
import joblib

DEFAULT_STATION_MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "artifacts", "nwdp_station_telemetry_model.joblib"
)

FEATURE_COLS = [
    "lag_1", "lag_7", "lag_14", "lag_30",
    "rolling_mean_7", "rolling_std_7", "rolling_mean_30",
    "drawdown_velocity_7", "sin_doy", "cos_doy"
]


def load_station_model_artifact(artifact_path: Optional[str] = None) -> Dict[str, Any]:
    from pathlib import Path
    from ml.nwdp_inference import load_station_model

    return load_station_model(Path(artifact_path) if artifact_path else Path(DEFAULT_STATION_MODEL_PATH))


def predict_station_telemetry(
    station_name: str,
    recent_observations: Optional[List[Dict[str, Any]]] = None,
    artifact_path: Optional[str] = None
) -> Dict[str, Any]:
    """Compatibility wrapper for the source-variable experimental station API.

    Custom observation lists are not accepted because they would bypass source
    validation and record lineage. Use the retained-source artifact only.
    """
    try:
        if recent_observations is not None:
            return {"status": "unavailable", "stationName": station_name,
                    "error": "Custom observations are not accepted; use retained-source lineage",
                    "operationalEligibility": False, "intervalStatus": "ordered_uncalibrated"}
        from ml.nwdp_inference import forecast_station
        pkg = load_station_model_artifact(artifact_path)
    except Exception as e:
        return {
            "status": "unavailable",
            "stationName": station_name,
            "error": f"Model artifact unavailable: {str(e)}",
            "operationalEligibility": False,
            "intervalStatus": "ordered_uncalibrated"
        }

    stations = pkg.get("stations", {})
    matching = [key for key in stations if key == station_name or key.endswith(f"::{station_name}")]
    if len(matching) != 1:
        return {
            "status": "unavailable",
            "stationName": station_name,
            "error": f"Station '{station_name}' not supported by current NWDP station model",
            "operationalEligibility": False,
            "intervalStatus": "ordered_uncalibrated"
        }

    result = forecast_station(matching[0], pkg)
    return {
        "status": "experimental_station_prototype",
        "stationName": station_name,
        "stationId": result["stationId"],
        "state": matching[0].split("::", 1)[0],
        "district": matching[0].split("::", 2)[1],
        "modelIdentifier": result["modelIdentifier"],
        "modelVersion": result["modelVersion"],
        "horizonDays": result["forecastHorizonDays"],
        "originDate": result["originDate"],
        "targetForecastDate": result["targetDate"],
        "forecast": result["prediction"],
        "uncertaintyInterval": {"lowerBoundP10": result["prediction"]["p10"],
                                "upperBoundP90": result["prediction"]["p90"],
                                "intervalStatus": "ordered_uncalibrated", "isCalibrated": False},
        "measurementStatus": result["measurementStatus"],
        "provenance": result["provenance"],
        "operationalEligibility": False,
        "safeguardNotice": result["unitLabel"],
    }
