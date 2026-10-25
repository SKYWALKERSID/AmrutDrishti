"""Train and evaluate the single block-aware Jal Drishti groundwater model.

Only CGWB quarterly *manual* observations with a traceable source file are
accepted.  Telemetry snapshots (including negative Telangana telemetry) are
deliberately not in this source manifest.  Promotion is evidence-gated: a
candidate artifact is saved for reproducibility, but inference continues to
use the existing regional artifacts unless both evaluation protocols pass.
"""

import hashlib
import json
import os
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

sys.path.insert(0, os.path.abspath("."))
from ml.feature_engineering import build_station_training_matrix
from ml.models import GlobalBlockAwareQuantileModel
from ml.validation import interval_coverage, quantile_crossings

NUMERIC_FEATURES = GlobalBlockAwareQuantileModel.numeric_features
CATEGORICAL_FEATURES = GlobalBlockAwareQuantileModel.categorical_features
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
ARTIFACT = "ml/artifacts/global_block_aware_qgb_v1.joblib"
REPORT = "audit/global_groundwater_model_validation.json"

# These are all quarterly manual CGWB files.  Do not add files with a
# telemetry column here without a separate QA and calibration review.
SOURCES = [
    ("Punjab", "data/sources/cgwb_contrast/PB.csv"),
    ("Haryana", "data/sources/cgwb_contrast/HR.csv"),
    ("Rajasthan", "data/sources/cgwb_contrast/RJ.csv"),
    ("Assam", "data/sources/cgwb_contrast/AS.csv"),
    ("Madhya Pradesh", "data/sources/cgwb_mp_cleaned_proper.csv"),
    ("Karnataka", "data/sources/cgwb_regional/KA_1991_2020.csv"),
    ("Karnataka", "data/sources/cgwb_regional/KA_2021_2025.csv"),
    ("Telangana", "data/sources/cgwb_regional/TS_1991_2020.csv"),
    ("Telangana", "data/sources/cgwb_regional/TS_2021_2025.csv"),
    ("Tamil Nadu", "data/sources/cgwb_regional/TN_1991_2020.csv"),
    ("Tamil Nadu", "data/sources/cgwb_regional/TN_2021_2025.csv"),
    ("Tripura", "data/sources/cgwb_regional/TR_1991_2020.csv"),
    ("Tripura", "data/sources/cgwb_regional/TR_2021_2025.csv"),
    ("Meghalaya", "data/sources/cgwb_regional/ML_1991_2020.csv"),
    ("Meghalaya", "data/sources/cgwb_regional/ML_2021_2025.csv"),
]


def _metric(y_true, y_pred):
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae = float(mean_absolute_error(y_true, y_pred))
    denom = float(np.sum((y_true - np.mean(y_true)) ** 2))
    nse = float(1 - np.sum((y_true - y_pred) ** 2) / denom) if denom > 1e-9 else None
    return {"n": int(len(y_true)), "mae_m": round(mae, 4), "rmse_m": round(rmse, 4), "nse": None if nse is None else round(nse, 4)}


def _stable_holdout(station: str) -> bool:
    return int(hashlib.sha256(station.encode("utf-8")).hexdigest()[:8], 16) % 5 == 0


def _load_source(state, path):
    raw = pd.read_csv(path, low_memory=False)
    expected = {"Station", "Data Acquisition Time", "Groundwater Level Quarterly Manual (meter)"}
    if not expected.issubset(raw.columns):
        raise ValueError(f"{path} is not a supported CGWB manual schema; missing {expected - set(raw.columns)}")
    # Explicit source-level guard against accidental telemetry mixing.
    if any("telemetry" in str(column).lower() for column in raw.columns):
        raise ValueError(f"{path} has telemetry fields and is excluded from this manual-observation model")
    raw["dt"] = pd.to_datetime(raw["Data Acquisition Time"], errors="coerce", format="mixed", dayfirst=True)
    raw["val"] = pd.to_numeric(raw["Groundwater Level Quarterly Manual (meter)"], errors="coerce")
    raw = raw.dropna(subset=["Station", "dt", "val"]).copy()
    raw = raw[(raw["dt"] >= pd.Timestamp("2010-01-01")) & raw["val"].between(0, 150)].copy()
    raw["state"] = state
    raw["station"] = state + "::" + raw["Station"].astype(str).str.strip()
    raw["district_name"] = raw.get("District", "Unknown district").fillna("Unknown district").astype(str).str.strip()
    raw["block_name"] = raw.get("Block", "Unknown block").fillna("Unknown block").astype(str).str.strip()
    return raw[["station", "dt", "val", "state", "district_name", "block_name"]]


def _evaluate(train, test):
    model = GlobalBlockAwareQuantileModel().fit(train[FEATURES], train["target_h1"])
    pred = model.predict(test[FEATURES])
    baseline = _metric(test["target_h1"].to_numpy(), test["wl_origin"].to_numpy())
    p50 = _metric(test["target_h1"].to_numpy(), pred["p50"])
    coverage = float(interval_coverage(test["target_h1"].to_numpy(), pred["p10"], pred["p90"])) * 100
    crossings = int(np.sum(quantile_crossings(pred["p10"], pred["p50"], pred["p90"])))
    return model, {
        "model": p50,
        "persistence": baseline,
        "gain_over_persistence_rmse_pct": round(100 * (baseline["rmse_m"] - p50["rmse_m"]) / baseline["rmse_m"], 3) if baseline["rmse_m"] else None,
        "interval_coverage_80pct": round(coverage, 3),
        "mean_interval_width_m": round(float(np.mean(pred["p90"] - pred["p10"])), 4),
        "quantile_crossings": crossings,
    }


def main():
    loaded = []
    for state, path in SOURCES:
        source = _load_source(state, path)
        print(f"Loaded {path}: {len(source)} valid manual observations", flush=True)
        loaded.append(source)
    observations = pd.concat(loaded, ignore_index=True)
    print(f"Building station-autonomous matrix from {len(observations)} observations...", flush=True)
    matrix = build_station_training_matrix(
        observations, station_col="station", date_col="dt", value_col="val",
        state_col="state", district_col="district_name", block_col="block_name",
    ).dropna(subset=["wl_origin", "wl_prev", "target_h1"]).copy()
    if matrix.empty:
        raise RuntimeError("No valid leak-free 1-quarter training rows were produced")

    print(f"Built {len(matrix)} causal 1-quarter pairs across {matrix['station'].nunique()} stations.", flush=True)
    # A single chronological boundary is shared by all states; no random pooled split.
    cutoff = pd.Timestamp(matrix["target_h1_date"].quantile(0.80)).normalize()
    chronological_train = matrix[matrix["target_h1_date"] < cutoff].copy()
    chronological_test = matrix[matrix["origin_date"] >= cutoff].copy()
    print("Running chronological held-out validation...", flush=True)
    chronological_model, chronological = _evaluate(chronological_train, chronological_test)

    # A deterministic station holdout prevents a station identifier from leaking
    # into training and tests generalisation to previously unseen stations.
    heldout = matrix[matrix["station"].map(_stable_holdout)].copy()
    station_train = matrix[~matrix["station"].map(_stable_holdout)].copy()
    station_train = station_train[station_train["target_h1_date"] < cutoff].copy()
    heldout = heldout[heldout["origin_date"] >= cutoff].copy()
    print("Running station-held-out validation...", flush=True)
    _, station_heldout = _evaluate(station_train, heldout)

    acceptance = {
        "minimum_test_rows": 100,
        "no_quantile_crossings": True,
        "minimum_rmse_improvement_pct": 0.0,
        "minimum_station_holdout_rmse_improvement_pct": 0.0,
        "coverage_range_pct": [60.0, 95.0],
    }
    passes = (
        chronological["model"]["n"] >= acceptance["minimum_test_rows"]
        and station_heldout["model"]["n"] >= acceptance["minimum_test_rows"]
        and chronological["quantile_crossings"] == 0
        and station_heldout["quantile_crossings"] == 0
        and chronological["gain_over_persistence_rmse_pct"] >= acceptance["minimum_rmse_improvement_pct"]
        and station_heldout["gain_over_persistence_rmse_pct"] >= acceptance["minimum_station_holdout_rmse_improvement_pct"]
        and acceptance["coverage_range_pct"][0] <= chronological["interval_coverage_80pct"] <= acceptance["coverage_range_pct"][1]
        and acceptance["coverage_range_pct"][0] <= station_heldout["interval_coverage_80pct"] <= acceptance["coverage_range_pct"][1]
    )

    # Fit final artifact on all rows only after evaluation.  Candidate artifacts
    # remain traceable even when promotion fails; the manifest prevents serving it.
    print("Fitting final shared artifact...", flush=True)
    final_model = GlobalBlockAwareQuantileModel().fit(matrix[FEATURES], matrix["target_h1"])
    os.makedirs(os.path.dirname(ARTIFACT), exist_ok=True)
    joblib.dump(final_model, ARTIFACT)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_identifier": "GlobalBlockAwareQuantileGB-v1",
        "artifact": ARTIFACT,
        "data_policy": "CGWB quarterly manual observations only; telemetry files excluded; values restricted to 0-150 m bgl. Station identifiers are grouping and held-out validation keys, not ordinal predictor values.",
        "source_files": [{"state": state, "path": path} for state, path in SOURCES],
        "rows": {"observations": int(len(observations)), "station_matrix": int(len(matrix)), "stations": int(matrix["station"].nunique())},
        "chronological_cutoff": cutoff.strftime("%Y-%m-%d"),
        "chronological_validation": chronological,
        "station_heldout_validation": station_heldout,
        "acceptance_criteria": acceptance,
        "promotion_status": "promoted_research_prototype" if passes else "candidate_not_promoted",
        "operational_eligibility": False,
        "limitations": "Intervals are ordered quantiles, not statistically calibrated prediction intervals. Fresh, reviewed observations are required before any block forecast is served.",
    }
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    with open(REPORT, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    manifest_path = "ml/artifacts/manifest.json"
    with open(manifest_path, encoding="utf-8") as handle:
        manifest = json.load(handle)
    manifest["global_model"] = {
        "model_identifier": report["model_identifier"], "artifact": ARTIFACT,
        "status": report["promotion_status"], "features": FEATURES,
        "validation_report": REPORT, "operational_eligibility": False,
        "interval_status": "ordered_uncalibrated", "source_policy": report["data_policy"],
    }
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
