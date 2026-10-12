"""
JalDrishti ML Pipeline - Baseline Models & Hydrological Benchmarks
Implements:
1. Seasonal Climatological Mean Baseline
2. Naive Persistence Baseline (t = t-1)
3. Seasonal Persistence Baseline (t = t-4 with historical seasonal delta)
4. Autoregressive SARIMAX Baseline with exogenous rainfall

Per Section 5 of JalDrishti Workspace Rules, deep learning models are only
valid if they demonstrably beat these baselines on held-out test splits.
"""

from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
from sklearn.metrics import root_mean_squared_error, mean_absolute_error


def calculate_hydrological_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Computes standard hydrology and time-series evaluation metrics:
    - RMSE: Root Mean Squared Error (m)
    - MAE: Mean Absolute Error (m)
    - NSE: Nash-Sutcliffe Efficiency (dimensionless, 1.0 is perfect, < 0 means baseline mean is better)
    """
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    y_t = y_true[mask]
    y_p = y_pred[mask]
    
    if len(y_t) == 0:
        return {"rmse": float("nan"), "mae": float("nan"), "nse": float("nan")}
        
    rmse = float(root_mean_squared_error(y_t, y_p))
    mae = float(mean_absolute_error(y_t, y_p))
    
    # Nash-Sutcliffe Efficiency (NSE)
    denominator = np.sum((y_t - np.mean(y_t)) ** 2)
    if denominator == 0:
        nse = 0.0
    else:
        nse = float(1.0 - (np.sum((y_t - y_p) ** 2) / denominator))
        
    return {
        "rmse": round(rmse, 3),
        "mae": round(mae, 3),
        "nse": round(nse, 3)
    }


class SeasonalPersistenceBaseline:
    """
    Seasonal Persistence Baseline:
    Estimates depth at time t by taking previous year's depth for the same quarter (t-4)
    plus the rolling multi-year trend delta.
    """
    def __init__(self):
        self.seasonal_deltas_: Dict[int, float] = {}

    def fit(self, df: pd.DataFrame, target_col: str = "water_level_mbgl", season_col: str = "season_code") -> "SeasonalPersistenceBaseline":
        # Calculate mean quarterly difference
        for season in range(4):
            subset = df[df[season_col] == season]
            if not subset.empty and "water_level_lag_4" in subset.columns:
                diff = subset[target_col] - subset["water_level_lag_4"]
                self.seasonal_deltas_[season] = float(diff.mean()) if not diff.dropna().empty else 0.0
            else:
                self.seasonal_deltas_[season] = 0.0
        return self

    def predict(self, df: pd.DataFrame, lag_col: str = "water_level_lag_4", season_col: str = "season_code") -> np.ndarray:
        predictions = []
        for _, row in df.iterrows():
            lag_val = row.get(lag_col, np.nan)
            season = int(row.get(season_col, 0))
            delta = self.seasonal_deltas_.get(season, 0.0)
            if np.isnan(lag_val):
                # Fallback to lag_1 if 4-quarter lag is missing
                lag_val = row.get("water_level_lag_1", np.nan)
            predictions.append(lag_val + delta if not np.isnan(lag_val) else np.nan)
        return np.array(predictions)
