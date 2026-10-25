"""Inference for the direct 90-day / 180-day NWDP station models (experimental)."""
from __future__ import annotations

import math
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from ml.nwdp_horizon_features import FEATURE_COLUMNS, HORIZONS, make_horizon_features

HORIZON_MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "nwdp_station_horizon_model.joblib"
VARIABLE = "Groundwater Level Telemetry 6 Hourly (meter)"
SOURCE_REGISTRY = "data/sources/nwdp_telemetry_raw/nwdp_telemetry_source_registry.json"


def load_horizon_model(path: Path = HORIZON_MODEL_PATH) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError("nwdp_horizon_model_artifact_missing")
    package = joblib.load(path)
    meta = package.get("metadata", {})
    if meta.get("model_identifier") != "NWDP-Station-Experimental" or tuple(meta.get("horizons_days", ())) != HORIZONS:
        raise ValueError("unexpected_nwdp_horizon_model")
    if meta.get("feature_columns") != FEATURE_COLUMNS:
        raise ValueError("nwdp_horizon_feature_schema_mismatch")
    if meta.get("operational_eligibility") is not False:
        raise ValueError("experimental_model_must_not_be_operational")
    return package


def list_stations(package: dict[str, Any]) -> list[dict[str, Any]]:
    rows = [
        {
            "stationId": sid, "state": st["state"], "district": st["district"],
            "stationName": st["station_name"], "latestDate": st["latest_date"],
            "horizonDays": sorted(int(h) for h in st["horizons"]),
        }
        for sid, st in package["stations"].items()
    ]
    return sorted(rows, key=lambda r: (r["state"].lower(), r["district"].lower(), r["stationName"].lower()))


def forecast_station_horizon(station_id: str, horizon_days: int, package: dict[str, Any]) -> dict[str, Any]:
    if horizon_days not in HORIZONS:
        raise ValueError("unsupported_horizon")
    station = package["stations"].get(station_id)
    if not station:
        raise KeyError("station_not_trained")
    entry = station["horizons"].get(str(horizon_days))
    if not entry:
        raise KeyError("station_horizon_not_trained")
    history = station["latest_history"]
    dates = [date.fromisoformat(item["date"]) for item in history]
    values = [float(item["value"]) for item in history]
    if not dates or dates != sorted(set(dates)):
        raise ValueError("invalid_station_history_order")
    origin = dates[-1]
    target = origin + timedelta(days=horizon_days)
    features = make_horizon_features(dates, values, origin, target)
    if features is None:
        raise ValueError("insufficient_recent_station_history")
    x = pd.DataFrame([[features[c] for c in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
    p10, p50, p90 = (float(entry["models"][k].predict(x)[0]) for k in ("0.1", "0.5", "0.9"))
    if not all(math.isfinite(v) for v in (p10, p50, p90)):
        raise ValueError("nonfinite_model_output")
    if not (p10 <= p50 <= p90):
        raise ValueError("quantile_crossing")  # never silently reordered
    evaluation = entry["evaluation"]
    return {
        "status": "experimental",
        "modelIdentifier": f"NWDP-Station-Experimental-{horizon_days}d",
        "modelVersion": package["metadata"]["version"],
        "stationId": station_id,
        "variable": VARIABLE,
        "unitLabel": "meter as reported by source; groundwater datum and sign convention unverified",
        "forecastHorizonDays": horizon_days,
        "originDate": origin.isoformat(),
        "targetDate": target.isoformat(),
        "inputSampleDays": len(history),
        "prediction": {"p10": round(p10, 3), "p50": round(p50, 3), "p90": round(p90, 3)},
        "intervalStatus": "ordered_uncalibrated",
        "operationalEligibility": False,
        "measurementStatus": "experimental_source_reported_variable_unverified_depth",
        "evaluation": {
            "heldOutPairs": evaluation["nTest"],
            "testOriginRange": evaluation["testOriginRange"],
            "rmseGainOverPersistencePct": evaluation["rmseGainOverPersistencePct"],
            "p10P90EmpiricalCoveragePct": evaluation["p10P90EmpiricalCoveragePct"],
            "note": "Held-out, per-station, uncalibrated; not evidence of operational accuracy.",
        },
        "provenance": {
            "sourceRegistry": SOURCE_REGISTRY,
            "sourceFiles": station["source_files"],
            "originRecordIds": station["origin_record_ids"],
            "sourceHashes": package["metadata"]["source_hashes"],
            "aggregation": "daily median per station; no gap interpolation",
            "targetConstruction": f"direct {horizon_days}-day model trained on observed pairs exactly {horizon_days} days apart",
        },
    }
