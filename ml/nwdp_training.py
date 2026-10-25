"""Reproducible station-isolated training from the retained 18 NWDP CSVs only."""
from __future__ import annotations

import csv
import gzip
import hashlib
import json
import math
import platform
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import median
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ml.nwdp_features import FEATURE_COLUMNS, FORECAST_HORIZON_DAYS, build_examples, chronological_split, make_features
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "sources" / "nwdp_telemetry_raw"
SOURCE_MANIFEST = RAW / "nwdp_telemetry_download_manifest.json"
SOURCE_REGISTRY = RAW / "nwdp_telemetry_source_registry.json"
ARTIFACT_DIR = ROOT / "ml" / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "nwdp_station_telemetry_model.joblib"
METRICS_PATH = ARTIFACT_DIR / "nwdp_station_telemetry_metrics.json"
SCHEMA_PATH = ARTIFACT_DIR / "nwdp_station_telemetry_feature_schema.json"
METADATA_PATH = ARTIFACT_DIR / "nwdp_station_telemetry_metadata.json"
CONFIG_PATH = ARTIFACT_DIR / "nwdp_station_telemetry_training_config.json"
LINEAGE_PATH = ROOT / "data" / "derived" / "nwdp_station_training_lineage.json"
RAW_LINEAGE_PATH = ROOT / "data" / "derived" / "nwdp_telemetry_record_lineage.csv.gz"
BENCHMARK_PATH = ROOT / "audit" / "station_telemetry_forecast_benchmark.json"
ACTIVE_STATES = {
    "Madhya Pradesh", "Rajasthan", "Punjab", "Haryana", "Karnataka",
    "Telangana", "Tamil Nadu", "Meghalaya", "Tripura",
}
MIN_DAILY_OBSERVATIONS = 250
MIN_TRAIN_EXAMPLES = 100
MIN_TEST_EXAMPLES = 30
UNRESOLVED_SENTINELS = {99.0, 99.99, 999.0, 999.99}
VALUE_COLUMN = "Groundwater Level Telemetry 6 Hourly (meter)"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_and_validate_registry(verify_raw_hashes: bool = True) -> tuple[dict[str, Any], dict[str, Any]]:
    source = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    if len(source.get("resources", [])) != 18:
        raise ValueError("expected_exactly_18_retained_nwdp_resources")
    states = {item.get("state") for item in source["resources"]}
    if states != ACTIVE_STATES:
        raise ValueError("raw_source_state_scope_mismatch")
    periods = defaultdict(set)
    registry = json.loads(SOURCE_REGISTRY.read_text(encoding="utf-8"))
    by_name = {item["filename"]: item for item in registry.get("resources", [])}
    if len(by_name) != 18:
        raise ValueError("authoritative_source_registry_must_have_18_resources")
    for item in source["resources"]:
        name = item["filename"]
        if item.get("validation_outcome") != "PASSED" or name not in by_name:
            raise ValueError(f"source_not_approved:{name}")
        if by_name[name].get("row_count") != item.get("row_count"):
            raise ValueError(f"source_registry_row_count_mismatch:{name}")
        path = RAW / name
        if not path.is_file() or path.stat().st_size != item["byte_count"]:
            raise ValueError(f"raw_source_size_mismatch:{name}")
        actual_hash = sha256_file(path) if verify_raw_hashes else item["sha256"]
        if actual_hash != item["sha256"] or actual_hash != by_name[name].get("sha256"):
            raise ValueError(f"raw_source_hash_mismatch:{name}")
        if by_name[name].get("relative_path") != path.relative_to(ROOT).as_posix():
            raise ValueError(f"registry_path_mismatch:{name}")
        periods[item["state"]].add(item["period"])
    if any(values != {"2021-2025", "2026-2030"} for values in periods.values()):
        raise ValueError("each_active_state_must_have_both_source_periods")
    return source, registry


def collect_station_daily(source: dict[str, Any]) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Consume only records in the verified raw-to-derived lineage ledger."""
    daily_values: dict[tuple[str, str, str, date], list[tuple[float, str, str]]] = defaultdict(list)
    counts: dict[str, Any] = {item["filename"]: defaultdict(int) for item in source["resources"]}
    file_hashes = {item["filename"]: item["sha256"] for item in source["resources"]}
    if not RAW_LINEAGE_PATH.is_file():
        raise FileNotFoundError("verified_raw_lineage_missing; run scripts/nwdp_pipeline.py")
    approved = set(file_hashes)
    with gzip.open(RAW_LINEAGE_PATH, "rt", encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream):
            filename = row["source_file"]
            if filename not in approved or row["source_sha256"] != file_hashes[filename]:
                raise ValueError(f"lineage_source_not_in_approved_manifest:{filename}")
            file_count = counts[filename]
            file_count["rows"] += 1
            if row["normalized_timestamp"]:
                file_count["valid_timestamp"] += 1
            if row["parsed_measurement_m"] != "":
                file_count["numeric_value"] += 1
            reason = row["validation_reason"]
            status = row["validation_status"]
            if reason == "negative_unconverted_undocumented_datum":
                file_count["negative_unconverted"] += 1
                if row["original_measurement"] == "-999.0":
                    file_count["minus_999_unresolved"] += 1
            if reason == "outside_unreviewed_0_to_150_candidate_range":
                file_count["outside_candidate_range"] += 1
            if reason == "sentinel_pattern_retained_pending_station_qc":
                file_count["unresolved_sentinel_candidate_excluded_from_training"] += 1
            if status != "candidate_not_verified" or reason == "sentinel_pattern_retained_pending_station_qc":
                continue
            try:
                value = float(row["parsed_measurement_m"])
                timestamp = datetime.strptime(row["normalized_timestamp"], "%Y-%m-%d %H:%M:%S")
            except (TypeError, ValueError):
                continue
            if not math.isfinite(value):
                continue
            if value == 0:
                file_count["zero_retained"] += 1
            if value == 1:
                file_count["one_retained"] += 1
            parts = row["station_key"].split("::", 2)
            if len(parts) != 3 or parts[0] not in ACTIVE_STATES or not all(parts):
                file_count["quarantined_station_identity"] += 1
                continue
            key = (*parts, timestamp.date())
            daily_values[key].append((value, filename, row["source_record_id"]))
            file_count["candidate_raw_reading"] += 1

    stations: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for (state, district, station, day), values in daily_values.items():
        station_id = f"{state}::{district}::{station}"
        ordered = sorted(values, key=lambda item: (item[1], item[2]))
        stations[station_id].append({
            "date": day,
            "value": float(median(item[0] for item in ordered)),
            "source_record_ids": [item[2] for item in ordered],
            "source_files": sorted({item[1] for item in ordered}),
            "duplicate_raw_records": len(ordered),
        })
    for records in stations.values():
        records.sort(key=lambda item: item["date"])
    return dict(stations), {name: dict(value) for name, value in counts.items()}


def _fit_one_station(station_id: str, daily: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    examples = build_examples(daily)
    if len(daily) < MIN_DAILY_OBSERVATIONS or len(examples) < MIN_TRAIN_EXAMPLES + MIN_TEST_EXAMPLES:
        raise ValueError("insufficient_station_history")
    train, test = chronological_split(examples)
    if len(train) < MIN_TRAIN_EXAMPLES or len(test) < MIN_TEST_EXAMPLES:
        raise ValueError("insufficient_chronological_split")
    x_train = pd.DataFrame([row["features"] for row in train], columns=FEATURE_COLUMNS)
    x_test = pd.DataFrame([row["features"] for row in test], columns=FEATURE_COLUMNS)
    y_train = np.asarray([row["target_value"] for row in train], dtype=float)
    y_test = np.asarray([row["target_value"] for row in test], dtype=float)
    persistence = np.asarray([row["origin_value"] for row in test], dtype=float)
    models = {}
    predictions = {}
    for quantile in (0.1, 0.5, 0.9):
        model = GradientBoostingRegressor(
            loss="quantile", alpha=quantile, n_estimators=80,
            max_depth=2, learning_rate=0.04, random_state=41,
        )
        model.fit(x_train, y_train)
        models[str(quantile)] = model
        predictions[str(quantile)] = model.predict(x_test)
    raw_crossings = int(np.sum(
        (predictions["0.1"] > predictions["0.5"]) |
        (predictions["0.5"] > predictions["0.9"])
    ))
    p10, p50, p90 = np.sort(
        np.vstack([predictions["0.1"], predictions["0.5"], predictions["0.9"]]),
        axis=0,
    )
    rmse = lambda actual, predicted: float(np.sqrt(mean_squared_error(actual, predicted)))
    baseline_rmse = rmse(y_test, persistence)
    model_rmse = rmse(y_test, p50)
    dates = [item["date"] for item in daily]
    metrics = {
        "station_id": station_id,
        "daily_observations": len(daily),
        "horizon_pairs": len(examples),
        "n_train": len(train),
        "n_test": len(test),
        "train_origin_range": [train[0]["origin_date"].isoformat(), train[-1]["origin_date"].isoformat()],
        "test_origin_range": [test[0]["origin_date"].isoformat(), test[-1]["origin_date"].isoformat()],
        "test_target_range": [test[0]["target_date"].isoformat(), test[-1]["target_date"].isoformat()],
        "horizon_days": FORECAST_HORIZON_DAYS,
        "target_variable": VALUE_COLUMN,
        "unit_interpretation": "source header says meter; groundwater datum and sign convention are unverified",
        "persistence": {"mae": float(mean_absolute_error(y_test, persistence)), "rmse": baseline_rmse},
        "gradient_boosting_p50": {"mae": float(mean_absolute_error(y_test, p50)), "rmse": model_rmse},
        "rmse_gain_over_persistence_pct": (
            float((baseline_rmse - model_rmse) / baseline_rmse * 100.0)
            if baseline_rmse > 0 else None
        ),
        "quantile_p10_p90_empirical_coverage_pct": float(np.mean((y_test >= p10) & (y_test <= p90)) * 100.0),
        "raw_quantile_crossings": raw_crossings,
        "interval_status": "ordered_uncalibrated",
        "operational_eligibility": False,
        "measurement_status": "experimental_source_reported_variable_unverified_depth",
        "daily_aggregation": "median of eligible same-station raw rows per calendar day; every contributing source record retained",
        "missing_dates": "not interpolated; a supervised pair exists only when an observation exists exactly seven calendar days after origin",
    }
    training_lineage = []
    for split_name, rows in (("train", train), ("test", test)):
        for row in rows:
            training_lineage.append({
                "station_id": station_id,
                "split": split_name,
                "origin_date": row["origin_date"].isoformat(),
                "target_date": row["target_date"].isoformat(),
                "target_record_ids": row["target_source_record_ids"],
                "feature_record_ids": row["feature_source_record_ids"],
            })
    latest = daily[-1]
    last_seven = daily[-7:]
    station_package = {
        "station_id": station_id,
        "models": models,
        "feature_columns": FEATURE_COLUMNS,
        "horizon_days": FORECAST_HORIZON_DAYS,
        "latest_history": [
            {"date": item["date"].isoformat(), "value": item["value"], "source_record_ids": item["source_record_ids"], "source_files": item["source_files"]}
            for item in last_seven
        ],
        "latest_date": latest["date"].isoformat(),
        "daily_observation_count": len(daily),
        "date_range": [dates[0].isoformat(), dates[-1].isoformat()],
        "training_evaluation": {key: metrics[key] for key in ("n_train", "n_test", "train_origin_range", "test_origin_range", "test_target_range")},
    }
    return station_package, metrics, training_lineage


def train(output_dir: Path = ARTIFACT_DIR, ensure_outputs: bool = True) -> dict[str, Any]:
    if ensure_outputs:
        from scripts.nwdp_pipeline import ensure_current

        ensure_current()
    source, registry = load_and_validate_registry(verify_raw_hashes=False)
    stations, file_counts = collect_station_daily(source)
    trained: dict[str, Any] = {}
    summaries: dict[str, Any] = {}
    lineage: list[dict[str, Any]] = []
    rejected: dict[str, str] = {}
    for station_id, daily in sorted(stations.items()):
        try:
            package, metrics, station_lineage = _fit_one_station(station_id, daily)
        except ValueError as error:
            rejected[station_id] = str(error)
            continue
        trained[station_id] = package
        summaries[station_id] = metrics
        lineage.extend(station_lineage)
    if not trained:
        raise RuntimeError("no_station_series_passed_minimum_experimental_training_requirements")

    generated = datetime.now(timezone.utc).isoformat()
    hashes = {item["filename"]: item["sha256"] for item in source["resources"]}
    artifact = {
        "metadata": {
            "model_family": "NWDP_station_isolated_gradient_boosting_residual",
            "model_identifier": "NWDP-Station-Experimental-7d",
            "version": "1.0.0-experimental",
            "generated_at": generated,
            "horizon_days": FORECAST_HORIZON_DAYS,
            "feature_columns": FEATURE_COLUMNS,
            "source_registry": "data/sources/nwdp_telemetry_raw/nwdp_telemetry_source_registry.json",
            "source_hashes": hashes,
            "raw_source_rows": sum(item.get("row_count", 0) for item in source["resources"]),
            "training_scope": "18 retained NWDP CSVs only; each station modeled independently; no CGWB/manual/rainfall data",
            "measurement_status": "experimental source-reported telemetry variable; groundwater datum/sign convention unverified",
            "operational_eligibility": False,
            "interval_status": "ordered_uncalibrated",
            "python_version": platform.python_version(),
            "numpy_version": np.__version__,
            "pandas_version": pd.__version__,
            "scikit_learn_version": sklearn.__version__,
            "joblib_version": joblib.__version__,
        },
        "stations": trained,
    }
    metrics_doc = {
        "generated_at": generated,
        "model_artifact": MODEL_PATH.relative_to(ROOT).as_posix(),
        "model_identifier": artifact["metadata"]["model_identifier"],
        "model_version": artifact["metadata"]["version"],
        "training_source_policy": artifact["metadata"]["training_scope"],
        "source_hashes": hashes,
        "resource_rows": {item["filename"]: item["row_count"] for item in source["resources"]},
        "raw_source_rows": sum(item["row_count"] for item in source["resources"]),
        "quality_counts_by_file": file_counts,
        "evaluation_protocol": {
            "split": "chronological 80/20 by origin; remove train rows whose target date is on/after first test origin",
            "horizon_days": FORECAST_HORIZON_DAYS,
            "missing_dates": "no interpolation; targets only paired at exact +7 calendar days",
            "baseline": "persistence: predicted target equals origin value",
            "model": "per-station GradientBoostingRegressor quantiles 0.1/0.5/0.9",
            "interval_status": "ordered_uncalibrated",
            "operational_eligibility": False,
        },
        "station_count_trained": len(trained),
        "station_count_skipped": len(rejected),
        "skipped_station_reasons": rejected,
        "benchmark_summary": summaries,
    }
    schema = {
        "model_identifier": artifact["metadata"]["model_identifier"],
        "version": artifact["metadata"]["version"],
        "feature_columns": FEATURE_COLUMNS,
        "feature_semantics": {
            "origin_value": "latest observed daily median at forecast origin",
            "lag_1_observation": "previous observed daily median, not necessarily previous calendar day",
            "lag_2_observations": "second previous observed daily median",
            "lag_7_observations": "seventh previous observed daily median",
            "rolling_mean_7_observations": "mean over seven observed daily medians through origin",
            "rolling_std_7_observations": "population standard deviation over same seven values",
            "change_over_7_observations": "origin minus seventh previous observed value",
            "target_sin_doy": "sine of target calendar day-of-year",
            "target_cos_doy": "cosine of target calendar day-of-year",
        },
        "target": VALUE_COLUMN,
        "horizon_days": FORECAST_HORIZON_DAYS,
        "unit_status": "source header reports meter; depth datum and sign convention unverified",
        "missing_policy": "no imputation; no missing date fill",
        "deduplication": "median within exact state/district/station/calendar date; all source IDs retained",
    }
    config = {
        "minimum_daily_observations": MIN_DAILY_OBSERVATIONS,
        "minimum_train_examples": MIN_TRAIN_EXAMPLES,
        "minimum_test_examples": MIN_TEST_EXAMPLES,
        "train_fraction": 0.8,
        "horizon_days": FORECAST_HORIZON_DAYS,
        "model": {"class": "sklearn.ensemble.GradientBoostingRegressor", "quantiles": [0.1, 0.5, 0.9], "n_estimators": 80, "max_depth": 2, "learning_rate": 0.04, "random_state": 41},
        "eligible_range": "finite 0..150 source-reported values, no unit/datum interpretation",
        "negative": "quarantined unconverted",
        "minus_999": "remains in negative quarantine; no local official sentinel definition asserted",
        "zero_one": "retained, not auto-excluded",
        "99_999_patterns": "retained in raw/lineage as unresolved candidates but excluded from model fit pending station QC",
        "deduplication": "daily station median, retaining contributing record IDs",
        "rainfall_covariates": "not used",
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    LINEAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    BENCHMARK_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, output_dir / MODEL_PATH.name)
    (output_dir / METRICS_PATH.name).write_text(json.dumps(metrics_doc, indent=2), encoding="utf-8")
    (output_dir / SCHEMA_PATH.name).write_text(json.dumps(schema, indent=2), encoding="utf-8")
    (output_dir / METADATA_PATH.name).write_text(json.dumps(artifact["metadata"] | {"trained_station_ids": sorted(trained)}, indent=2), encoding="utf-8")
    (output_dir / CONFIG_PATH.name).write_text(json.dumps(config, indent=2), encoding="utf-8")
    with LINEAGE_PATH.open("w", encoding="utf-8") as f:
        f.write('{"generated_at":' + json.dumps(generated) + ',"source_hashes":' + json.dumps(hashes) + ',"lineage":[')
        for i, item in enumerate(lineage):
            if i > 0:
                f.write(",")
            f.write(json.dumps(item, separators=(",", ":")))
        f.write(']}')
    BENCHMARK_PATH.write_text(json.dumps(metrics_doc, indent=2), encoding="utf-8")
    return metrics_doc
