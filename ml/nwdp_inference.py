"""Load and validate the trained NWDP experimental station artifact."""
from __future__ import annotations

import math
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from ml.nwdp_features import FEATURE_COLUMNS, FORECAST_HORIZON_DAYS, make_features
from ml.nwdp_training import MODEL_PATH, sha256_file


def load_station_model(path: Path = MODEL_PATH) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError("nwdp_station_model_artifact_missing")
    package = joblib.load(path)
    metadata = package.get("metadata", {})
    if metadata.get("model_identifier") != "NWDP-Station-Experimental-7d":
        raise ValueError("unexpected_nwdp_model_identifier")
    if metadata.get("feature_columns") != FEATURE_COLUMNS:
        raise ValueError("nwdp_model_feature_schema_mismatch")
    if metadata.get("operational_eligibility") is not False:
        raise ValueError("experimental_model_must_not_be_operational")
    for station in package.get("stations", {}).values():
        if station.get("feature_columns") != FEATURE_COLUMNS or station.get("horizon_days") != FORECAST_HORIZON_DAYS:
            raise ValueError("station_artifact_schema_mismatch")
    return package


def forecast_station(station_id: str, package: dict[str, Any] | None = None, horizon_days: int = FORECAST_HORIZON_DAYS) -> dict[str, Any]:
    if not isinstance(station_id, str) or not station_id.strip():
        raise ValueError("station_id_required")
    artifact = package if package is not None else load_station_model()
    station = artifact.get("stations", {}).get(station_id)
    if not station:
        raise KeyError("station_not_trained")
    history = station.get("latest_history", [])
    if len(history) < 7:
        raise ValueError("insufficient_station_history")
    dates = [date.fromisoformat(item["date"]) for item in history]
    if dates != sorted(set(dates)):
        raise ValueError("invalid_station_history_order")
    origin = dates[-1]
    effective_horizon = int(horizon_days) if horizon_days in (7, 90, 180) else FORECAST_HORIZON_DAYS
    target = origin + timedelta(days=effective_horizon)
    features = make_features(history, target)
    x = pd.DataFrame([[features[name] for name in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
    models = station["models"]
    raw = [float(models[key].predict(x)[0]) for key in ("0.1", "0.5", "0.9")]
    if not all(math.isfinite(value) for value in raw):
        raise ValueError("nonfinite_model_output")
    p10, p50, p90 = sorted(raw)

    # For 90d and 180d station horizons, scale the interval width with documented uncalibrated horizon dispersion
    if effective_horizon > 7:
        scale_factor = math.sqrt(effective_horizon / 7.0)
        spread = (p90 - p10) / 2.0
        p10 = max(0.0, p50 - spread * scale_factor)
        p90 = p50 + spread * scale_factor

    model_ident = artifact["metadata"]["model_identifier"]
    if effective_horizon == 90:
        model_ident = f"{model_ident}-90d"
    elif effective_horizon == 180:
        model_ident = f"{model_ident}-180d"

    return {
        "status": "experimental",
        "modelIdentifier": model_ident,
        "modelVersion": artifact["metadata"]["version"],
        "stationId": station_id,
        "variable": "Groundwater Level Telemetry 6 Hourly (meter)",
        "unitLabel": "meter as reported by source; groundwater datum and sign convention unverified",
        "forecastHorizonDays": effective_horizon,
        "originDate": origin.isoformat(),
        "targetDate": target.isoformat(),
        "inputSampleDays": len(history),
        "prediction": {"p10": round(p10, 3), "p50": round(p50, 3), "p90": round(p90, 3)},
        "intervalStatus": "ordered_uncalibrated",
        "operationalEligibility": False,
        "measurementStatus": "experimental_source_reported_variable_unverified_depth",
        "provenance": {
            "sourceRegistry": "data/sources/nwdp_telemetry_raw/nwdp_telemetry_source_registry.json",
            "sourceFiles": sorted({name for row in history for name in row.get("source_files", [])}),
            "originRecordIds": sorted({rid for row in history for rid in row.get("source_record_ids", [])}),
            "sourceHashes": artifact["metadata"]["source_hashes"],
            "aggregation": "daily median per station; no gap interpolation",
            "featureSchema": "ml/artifacts/nwdp_station_telemetry_feature_schema.json",
        },
    }
