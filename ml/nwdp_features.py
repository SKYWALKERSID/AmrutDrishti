"""Leak-safe features for one NWDP station's reported telemetry variable.

Values remain source-reported numeric telemetry. This module does not interpret
them as metres below ground level and never combines stations.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from statistics import mean, pstdev
from typing import Any

FEATURE_COLUMNS = [
    "origin_value",
    "lag_1_observation",
    "lag_2_observations",
    "lag_7_observations",
    "rolling_mean_7_observations",
    "rolling_std_7_observations",
    "change_over_7_observations",
    "target_sin_doy",
    "target_cos_doy",
]
FORECAST_HORIZON_DAYS = 7


def make_features(history: list[dict[str, Any]], target_date: date) -> dict[str, float]:
    """Build features from the last seven observed daily values only."""
    if len(history) < 7:
        raise ValueError("insufficient_station_history")
    ordered = sorted(history, key=lambda item: item["date"])
    recent = ordered[-7:]
    values = [float(item["value"]) for item in recent]
    if not all(math.isfinite(value) for value in values):
        raise ValueError("nonfinite_station_history")
    angle = 2.0 * math.pi * target_date.timetuple().tm_yday / 365.25
    return {
        "origin_value": values[-1],
        "lag_1_observation": values[-2],
        "lag_2_observations": values[-3],
        "lag_7_observations": values[0],
        "rolling_mean_7_observations": mean(values),
        "rolling_std_7_observations": pstdev(values),
        "change_over_7_observations": values[-1] - values[0],
        "target_sin_doy": math.sin(angle),
        "target_cos_doy": math.cos(angle),
    }


def build_examples(daily: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pair origin with an actually observed value exactly seven calendar days later.

    Missing dates are not filled. Daily duplicates must already have been
    combined by the declared median rule and retain their source record IDs.
    """
    ordered = sorted(daily, key=lambda item: item["date"])
    by_date = {item["date"]: item for item in ordered}
    rows: list[dict[str, Any]] = []
    for index in range(6, len(ordered)):
        origin = ordered[index]
        target_day = origin["date"] + timedelta(days=FORECAST_HORIZON_DAYS)
        target = by_date.get(target_day)
        if target is None:
            continue
        history = ordered[index - 6:index + 1]
        features = make_features(history, target_day)
        rows.append({
            "origin_date": origin["date"],
            "target_date": target_day,
            "origin_value": float(origin["value"]),
            "target_value": float(target["value"]),
            "features": features,
            "feature_source_record_ids": sorted({
                record_id for item in history for record_id in item["source_record_ids"]
            }),
            "target_source_record_ids": list(target["source_record_ids"]),
        })
    return rows


def chronological_split(rows: list[dict[str, Any]], train_fraction: float = 0.8):
    """Split on target chronology and exclude training labels reaching test time."""
    ordered = sorted(rows, key=lambda item: (item["origin_date"], item["target_date"]))
    if len(ordered) < 10:
        raise ValueError("insufficient_horizon_pairs")
    split_at = max(1, min(len(ordered) - 1, int(len(ordered) * train_fraction)))
    first_test_origin = ordered[split_at]["origin_date"]
    train = [row for row in ordered[:split_at] if row["target_date"] < first_test_origin]
    test = [row for row in ordered[split_at:] if row["origin_date"] >= first_test_origin]
    if not train or not test or max(row["target_date"] for row in train) >= min(row["origin_date"] for row in test):
        raise ValueError("chronological_split_leakage")
    return train, test
