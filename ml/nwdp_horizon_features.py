"""Leak-safe features for direct 90-day and 180-day NWDP station forecasts.

Each station is modelled independently. Windows are calendar windows over actually
observed daily medians ending at the origin date; missing days are never filled.
Values stay source-reported telemetry numbers (datum/sign convention unverified).
"""
from __future__ import annotations

import math
from bisect import bisect_left
from datetime import date, timedelta
from statistics import mean, pstdev
from typing import Any

HORIZONS = (90, 180)
HISTORY_DAYS = 90  # calendar days of history required at inference time
MIN_OBS_7D, MIN_OBS_30D, MIN_OBS_90D = 1, 5, 15
FEATURE_COLUMNS = [
    "origin_value",
    "mean_7d",
    "mean_30d",
    "mean_90d",
    "std_30d",
    "change_vs_mean_30d",
    "change_vs_mean_90d",
    "target_sin_doy",
    "target_cos_doy",
]


def _window(dates: list[date], values: list[float], origin: date, days: int) -> list[float]:
    start = origin - timedelta(days=days - 1)
    lo = bisect_left(dates, start)
    hi = bisect_left(dates, origin + timedelta(days=1))
    return values[lo:hi]


def make_horizon_features(dates: list[date], values: list[float], origin: date, target: date) -> dict[str, float] | None:
    """Return features, or None when the observed history is too sparse (never imputed)."""
    w7 = _window(dates, values, origin, 7)
    w30 = _window(dates, values, origin, 30)
    w90 = _window(dates, values, origin, 90)
    if len(w7) < MIN_OBS_7D or len(w30) < MIN_OBS_30D or len(w90) < MIN_OBS_90D:
        return None
    origin_idx = bisect_left(dates, origin)
    if origin_idx >= len(dates) or dates[origin_idx] != origin:
        return None
    origin_value = values[origin_idx]
    angle = 2.0 * math.pi * target.timetuple().tm_yday / 365.25
    out = {
        "origin_value": origin_value,
        "mean_7d": mean(w7),
        "mean_30d": mean(w30),
        "mean_90d": mean(w90),
        "std_30d": pstdev(w30),
        "change_vs_mean_30d": origin_value - mean(w30),
        "change_vs_mean_90d": origin_value - mean(w90),
        "target_sin_doy": math.sin(angle),
        "target_cos_doy": math.cos(angle),
    }
    return out if all(math.isfinite(v) for v in out.values()) else None


def build_horizon_examples(daily: list[dict[str, Any]], horizon_days: int) -> list[dict[str, Any]]:
    """Pair each origin with an actually observed value exactly `horizon_days` later."""
    ordered = sorted(daily, key=lambda item: item["date"])
    dates = [item["date"] for item in ordered]
    values = [float(item["value"]) for item in ordered]
    by_date = {d: v for d, v in zip(dates, values)}
    rows: list[dict[str, Any]] = []
    for origin, origin_value in zip(dates, values):
        target = origin + timedelta(days=horizon_days)
        if target not in by_date:
            continue
        feats = make_horizon_features(dates, values, origin, target)
        if feats is None:
            continue
        rows.append({
            "origin_date": origin, "target_date": target,
            "origin_value": origin_value, "target_value": by_date[target], "features": feats,
        })
    return rows
