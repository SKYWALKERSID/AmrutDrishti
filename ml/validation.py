"""
JalDrishti ML - Independent validation utilities (pure functions, no I/O, no persistence).

Defines a station-aware one-campaign-ahead forecasting task:
  origin   = an observation of station s at date t
  target   = the NEXT observation of the SAME station s, only if it falls 45-135 days after t
             (CGWB manual campaigns run Jan/May/Aug/Nov, so "next quarter" spans ~2-4.5 months)
  features = information available at t only (current level, previous level of the same station,
             same-station level ~1 year before the target date, target season)
Undefined metrics return None instead of an invented number.
"""
from typing import Dict, Optional, Sequence
import numpy as np
import pandas as pd

MIN_HORIZON_DAYS = 45
MAX_HORIZON_DAYS = 135
YEAR_LAG_TOLERANCE_DAYS = 45
FEATURES = ["wl_origin", "wl_prev", "wl_year_before_target", "target_season"]


def build_station_horizon_matrix(obs: pd.DataFrame, station_col: str = "station",
                                 date_col: str = "observation_date",
                                 value_col: str = "water_level_mbgl") -> pd.DataFrame:
    """One row per (station, origin) with a valid same-station target inside the horizon window."""
    required = {station_col, date_col, value_col}
    missing = required - set(obs.columns)
    if missing:
        raise ValueError(f"missing columns: {sorted(missing)}")
    df = obs[[station_col, date_col, value_col]].copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")  # NaN stays NaN, never zero
    df = df.dropna(subset=[station_col, date_col])
    # Explicit duplicate rule: multiple readings for the same station/date are averaged.
    df = df.groupby([station_col, date_col], as_index=False)[value_col].mean()

    rows = []
    for st, g in df.sort_values([station_col, date_col]).groupby(station_col, sort=False):
        g = g.reset_index(drop=True)
        dates, vals = g[date_col].tolist(), g[value_col].tolist()
        for i in range(len(g) - 1):
            gap = (dates[i + 1] - dates[i]).days
            if not (MIN_HORIZON_DAYS <= gap <= MAX_HORIZON_DAYS):
                continue  # a missing campaign must not become a "one quarter" target
            tgt_date = dates[i + 1]
            year_ref = tgt_date - pd.Timedelta(days=365)
            yb = np.nan
            for j in range(i + 1):  # only dates <= origin are eligible
                if abs((dates[j] - year_ref).days) <= YEAR_LAG_TOLERANCE_DAYS:
                    yb = vals[j]
            rows.append({
                "station": st, "origin_date": dates[i], "target_date": tgt_date,
                "horizon_days": gap, "wl_origin": vals[i],
                "wl_prev": vals[i - 1] if i >= 1 else np.nan,
                "wl_year_before_target": yb,
                "target_season": int(tgt_date.quarter - 1),
                "target": vals[i + 1],
            })
    out = pd.DataFrame(rows, columns=["station", "origin_date", "target_date", "horizon_days", *FEATURES, "target"])
    return out.sort_values(["origin_date", "station"]).reset_index(drop=True)


def chronological_split(matrix: pd.DataFrame, n_test_target_dates: int = 2):
    """Test = rows whose target falls in the last n distinct target dates.
    Train = rows whose TARGET date is <= the earliest test ORIGIN date (no target overlap)."""
    tdates = sorted(matrix["target_date"].unique())
    if len(tdates) <= n_test_target_dates:
        return matrix.iloc[0:0], matrix.iloc[0:0]
    test = matrix[matrix["target_date"].isin(tdates[-n_test_target_dates:])]
    cutoff = test["origin_date"].min()
    train = matrix[matrix["target_date"] <= cutoff]
    return train, test


def _clean(y_true, y_pred):
    a, b = np.asarray(y_true, float), np.asarray(y_pred, float)
    if a.shape != b.shape:
        raise ValueError("length mismatch")
    m = np.isfinite(a) & np.isfinite(b)
    return a[m], b[m]


def mae(y, p) -> Optional[float]:
    a, b = _clean(y, p)
    return float(np.mean(np.abs(b - a))) if a.size else None


def rmse(y, p) -> Optional[float]:
    a, b = _clean(y, p)
    return float(np.sqrt(np.mean((b - a) ** 2))) if a.size else None


def bias(y, p) -> Optional[float]:
    """Mean signed error (pred - obs). Positive = predicts deeper than observed."""
    a, b = _clean(y, p)
    return float(np.mean(b - a)) if a.size else None


def nse(y, p) -> Optional[float]:
    """Standard Nash-Sutcliffe; undefined (None) for <2 points or constant observations."""
    a, b = _clean(y, p)
    if a.size < 2:
        return None
    den = float(np.sum((a - a.mean()) ** 2))
    if den == 0:
        return None
    return float(1 - np.sum((a - b) ** 2) / den)


def pinball(y, p, q: float) -> Optional[float]:
    a, b = _clean(y, p)
    if not a.size:
        return None
    d = a - b
    return float(np.mean(np.maximum(q * d, (q - 1) * d)))


def interval_coverage(y, lo, hi) -> Optional[float]:
    a, l, h = (np.asarray(v, float) for v in (y, lo, hi))
    if not (a.shape == l.shape == h.shape):
        raise ValueError("length mismatch")
    m = np.isfinite(a) & np.isfinite(l) & np.isfinite(h)
    if not m.any():
        return None
    return float(np.mean((a[m] >= l[m]) & (a[m] <= h[m])))


def rmse_improvement_pct(rmse_model: Optional[float], rmse_baseline: Optional[float]) -> Optional[float]:
    if rmse_model is None or rmse_baseline is None or rmse_baseline == 0:
        return None
    return float(100 * (1 - rmse_model / rmse_baseline))


def quantile_crossings(p10: Sequence[float], p50: Sequence[float], p90: Sequence[float]) -> np.ndarray:
    """Boolean mask of predictions violating P10 <= P50 <= P90."""
    a, b, c = (np.asarray(v, float) for v in (p10, p50, p90))
    return ~((a <= b) & (b <= c))


def order_quantiles(p10, p50, p90):
    """Ordering SAFEGUARD only (row-wise sort). This is NOT calibration and does not fix coverage."""
    stacked = np.sort(np.vstack([p10, p50, p90]).astype(float), axis=0)
    return stacked[0], stacked[1], stacked[2]


def summarize(y, preds: Dict[str, np.ndarray]) -> Dict[str, Optional[float]]:
    p10, p50, p90 = preds["p10"], preds["p50"], preds["p90"]
    cross = quantile_crossings(p10, p50, p90)
    return {
        "mae": mae(y, p50), "rmse": rmse(y, p50), "bias": bias(y, p50), "nse": nse(y, p50),
        "pinball_p10": pinball(y, p10, 0.10), "pinball_p50": pinball(y, p50, 0.50),
        "pinball_p90": pinball(y, p90, 0.90),
        "coverage_p10_p90": interval_coverage(y, p10, p90),
        "mean_width": float(np.mean(np.asarray(p90) - np.asarray(p10))) if len(y) else None,
        "crossing_rate": float(cross.mean()) if len(y) else None,
    }
