"""Improved station-level model selection with persistence fallback.

Implements station-specific model selection using training-only validation.
Models are selected only when they demonstrably improve on persistence baseline
according to predefined metric and minimum improvement threshold.

Key improvements over v1.0.0-experimental:
1. Ridge regression baseline alongside gradient boosting
2. Proper train/validation/test three-way chronological split
3. Station-specific model selection on validation (NOT test) set
4. Persistence fallback: if no model beats persistence, persistence is selected
5. Minimum improvement threshold to avoid selecting fragile improvements
6. Per-station and aggregate reporting of which model was selected and why
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import date
from statistics import mean, pstdev
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ml.nwdp_features import FEATURE_COLUMNS, FORECAST_HORIZON_DAYS

# Minimum relative RMSE improvement over persistence to select a model
MIN_IMPROVEMENT_THRESHOLD = 0.03   # 3%

# Minimum absolute improvement in MAE (source units) to avoid selecting
# models that only marginally improve on near-constant series
MIN_ABSOLUTE_MAE_IMPROVEMENT = 0.005


def chronological_three_way_split(
    rows: list[dict[str, Any]],
    train_frac: float = 0.6,
    val_frac: float = 0.2,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Split into train/val/test with strict temporal ordering and no leakage.

    The train set is the first ~60%, validation is the next ~20%, and test
    is the final ~20%. Additionally, training examples whose target date
    reaches into the validation period are removed, and validation examples
    whose target reaches into the test period are removed.
    """
    ordered = sorted(rows, key=lambda r: (r["origin_date"], r["target_date"]))
    n = len(ordered)
    if n < 30:
        raise ValueError("insufficient_horizon_pairs_for_three_way_split")

    split_train = max(1, int(n * train_frac))
    split_val = max(split_train + 1, int(n * (train_frac + val_frac)))
    split_val = min(split_val, n - 1)  # Ensure at least 1 test row

    first_val_origin = ordered[split_train]["origin_date"]
    first_test_origin = ordered[split_val]["origin_date"]

    # Purge: remove train rows whose target >= first_val_origin
    train = [r for r in ordered[:split_train] if r["target_date"] < first_val_origin]
    # Purge: remove val rows whose target >= first_test_origin
    val = [r for r in ordered[split_train:split_val]
           if r["origin_date"] >= first_val_origin and r["target_date"] < first_test_origin]
    test = [r for r in ordered[split_val:] if r["origin_date"] >= first_test_origin]

    if not train or not val or not test:
        raise ValueError("chronological_three_way_split_empty_partition")

    # Final leakage check
    max_train_target = max(r["target_date"] for r in train)
    min_val_origin = min(r["origin_date"] for r in val)
    max_val_target = max(r["target_date"] for r in val)
    min_test_origin = min(r["origin_date"] for r in test)

    if max_train_target >= min_val_origin:
        raise ValueError("train_val_temporal_leakage")
    if max_val_target >= min_test_origin:
        raise ValueError("val_test_temporal_leakage")

    return train, val, test


def _make_arrays(rows: list[dict[str, Any]]):
    """Convert example rows to feature matrix and target/persistence arrays."""
    x = pd.DataFrame([r["features"] for r in rows], columns=FEATURE_COLUMNS)
    y = np.asarray([r["target_value"] for r in rows], dtype=float)
    persistence = np.asarray([r["origin_value"] for r in rows], dtype=float)
    return x, y, persistence


def _rmse(actual, predicted):
    return float(np.sqrt(mean_squared_error(actual, predicted)))


def evaluate_and_select_model(
    station_id: str,
    examples: list[dict[str, Any]],
    daily_observations: list[dict[str, Any]] | None = None,
    min_train: int = 60,
    min_val: int = 15,
    min_test: int = 15,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Train, validate, and select best model for one station.

    Returns a tuple of (metrics_dict, artifact_package_dict).
    """
    train, val, test = chronological_three_way_split(examples)

    if len(train) < min_train or len(val) < min_val or len(test) < min_test:
        raise ValueError("insufficient_split_sizes")

    x_train, y_train, _ = _make_arrays(train)
    x_val, y_val, persistence_val = _make_arrays(val)
    x_test, y_test, persistence_test = _make_arrays(test)

    persistence_val_rmse = _rmse(y_val, persistence_val)
    persistence_val_mae = float(mean_absolute_error(y_val, persistence_val))

    candidates = {}

    # --- Candidate 1: Ridge regression (regularized linear) ---
    try:
        ridge = Ridge(alpha=10.0)
        ridge.fit(x_train, y_train)
        ridge_pred_val = ridge.predict(x_val)
        ridge_val_rmse = _rmse(y_val, ridge_pred_val)
        ridge_val_mae = float(mean_absolute_error(y_val, ridge_pred_val))
        candidates["ridge"] = {
            "model": ridge,
            "val_rmse": ridge_val_rmse,
            "val_mae": ridge_val_mae,
            "type": "ridge_regression",
        }
    except Exception:
        pass

    # --- Candidate 2: GBR (lighter than v1 to reduce overfitting) ---
    try:
        gbr = GradientBoostingRegressor(
            loss="squared_error",
            n_estimators=50,
            max_depth=2,
            learning_rate=0.03,
            min_samples_leaf=10,
            subsample=0.8,
            random_state=42,
        )
        gbr.fit(x_train, y_train)
        gbr_pred_val = gbr.predict(x_val)
        gbr_val_rmse = _rmse(y_val, gbr_pred_val)
        gbr_val_mae = float(mean_absolute_error(y_val, gbr_pred_val))
        candidates["gbr_light"] = {
            "model": gbr,
            "val_rmse": gbr_val_rmse,
            "val_mae": gbr_val_mae,
            "type": "gradient_boosting_light",
        }
    except Exception:
        pass

    # --- Model Selection on Validation Set ---
    # Find best candidate that beats persistence by the minimum threshold
    selected_name = "persistence"
    selected_model = None
    selection_reason = "no_candidate_beats_persistence_threshold"

    best_val_rmse = persistence_val_rmse
    for name, cand in sorted(candidates.items(), key=lambda x: x[1]["val_rmse"]):
        if persistence_val_rmse > 0:
            rel_improvement = (persistence_val_rmse - cand["val_rmse"]) / persistence_val_rmse
        else:
            rel_improvement = 0.0
        abs_mae_improvement = persistence_val_mae - cand["val_mae"]

        if (rel_improvement >= MIN_IMPROVEMENT_THRESHOLD and
                abs_mae_improvement >= MIN_ABSOLUTE_MAE_IMPROVEMENT and
                cand["val_rmse"] < best_val_rmse):
            selected_name = name
            selected_model = cand["model"]
            best_val_rmse = cand["val_rmse"]
            selection_reason = (
                f"val_rmse_improvement={rel_improvement*100:.2f}%, "
                f"abs_mae_improvement={abs_mae_improvement:.4f}"
            )

    # --- Quantile Models (for prediction intervals) ---
    # Only train quantile models if we selected a non-persistence model
    quantile_models = {}
    if selected_name != "persistence":
        for alpha in (0.1, 0.9):
            qmodel = GradientBoostingRegressor(
                loss="quantile",
                alpha=alpha,
                n_estimators=50,
                max_depth=2,
                learning_rate=0.03,
                min_samples_leaf=10,
                subsample=0.8,
                random_state=42,
            )
            qmodel.fit(x_train, y_train)
            quantile_models[str(alpha)] = qmodel

    # --- Test Set Evaluation (reporting only, not used for selection) ---
    persistence_test_rmse = _rmse(y_test, persistence_test)
    persistence_test_mae = float(mean_absolute_error(y_test, persistence_test))

    if selected_name == "persistence":
        model_test_rmse = persistence_test_rmse
        model_test_mae = persistence_test_mae
        model_test_predictions = persistence_test
    else:
        model_test_predictions = selected_model.predict(x_test)
        model_test_rmse = _rmse(y_test, model_test_predictions)
        model_test_mae = float(mean_absolute_error(y_test, model_test_predictions))

    test_gain = (
        (persistence_test_rmse - model_test_rmse) / persistence_test_rmse * 100.0
        if persistence_test_rmse > 0 else None
    )

    # Quantile coverage on test
    coverage = None
    interval_width = None
    if quantile_models:
        p10_test = quantile_models["0.1"].predict(x_test)
        p90_test = quantile_models["0.9"].predict(x_test)
        # Enforce ordering
        p10_sorted = np.minimum(p10_test, model_test_predictions)
        p90_sorted = np.maximum(p90_test, model_test_predictions)
        covered = (y_test >= p10_sorted) & (y_test <= p90_sorted)
        coverage = float(np.mean(covered) * 100.0)
        interval_width = float(np.mean(p90_sorted - p10_sorted))

    # Validation-set metrics for all candidates (for reporting)
    val_comparison = {
        "persistence": {"val_rmse": persistence_val_rmse, "val_mae": persistence_val_mae}
    }
    for name, cand in candidates.items():
        val_comparison[name] = {"val_rmse": cand["val_rmse"], "val_mae": cand["val_mae"]}

    result = {
        "station_id": station_id,
        "selected_model": selected_name,
        "selection_reason": selection_reason,
        "horizon_days": FORECAST_HORIZON_DAYS,
        "n_train": len(train),
        "n_val": len(val),
        "n_test": len(test),
        "train_range": [train[0]["origin_date"].isoformat(), train[-1]["origin_date"].isoformat()],
        "val_range": [val[0]["origin_date"].isoformat(), val[-1]["origin_date"].isoformat()],
        "test_range": [test[0]["origin_date"].isoformat(), test[-1]["origin_date"].isoformat()],
        "validation_comparison": val_comparison,
        "test_persistence": {"mae": persistence_test_mae, "rmse": persistence_test_rmse},
        "test_selected": {"mae": model_test_mae, "rmse": model_test_rmse},
        "test_gain_over_persistence_pct": test_gain,
        "quantile_coverage_pct": coverage,
        "interval_width": interval_width,
        "interval_status": "ordered_uncalibrated",
        "operational_eligibility": False,
    }

    # Package for artifact
    models_dict = {}
    if selected_name != "persistence":
        models_dict["0.5"] = selected_model
        models_dict.update(quantile_models)

    package = {
        "selected_model_name": selected_name,
        "models": models_dict,  # Empty if persistence
        "feature_columns": FEATURE_COLUMNS,
        "horizon_days": FORECAST_HORIZON_DAYS,
    }

    return result, package
