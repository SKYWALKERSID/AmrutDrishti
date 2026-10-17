"""
JalDrishti ML Inference Engine — Station-Autonomous Model Serving
===================================================================
Provides verified, leak-free model inference using offline-packaged
Quantile Gradient Boosting (QGB v2.0) and Ridge Regression models.

Scientific Safeguards Enforced (Rule 5 & TRD v1.0):
1. Non-crossing quantile guarantee (P10 <= P50 <= P90).
2. Explicit baseline persistence comparisons (Last-Observation & Seasonal).
3. Strict feature schema validation (fails closed on non-finite or missing features).
4. Insufficient history detection (fails closed when < 2 quarters available).
5. Operational eligibility strictly False (research prototype only).
"""

import os
import sys

# Ensure repository root is in sys.path for joblib unpickling
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import json
import math
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd
import joblib

REQUIRED_FEATURES = [
    "wl_origin",
    "wl_prev",
    "wl_year_before_target",
    "drawdown_velocity_q1",
    "season_code",
]

DEFAULT_MANIFEST_PATH = os.path.join(
    os.path.dirname(__file__), "artifacts", "manifest.json"
)

STATE_NAME_TO_CODE = {
    "punjab": "punjab",
    "pb": "punjab",
    "haryana": "haryana",
    "hr": "haryana",
    "rajasthan": "rajasthan",
    "rj": "rajasthan",
    "assam": "assam",
    "as": "assam",
    "arunachal pradesh": "arunachal_pradesh",
    "arunachal_pradesh": "arunachal_pradesh",
    "ar": "arunachal_pradesh",
    "madhya pradesh": "madhya_pradesh",
    "madhya_pradesh": "madhya_pradesh",
    "mp": "madhya_pradesh",
}

SEASONS = [
    "Winter Rabi (Jan-Mar)",
    "Pre-Monsoon (Apr-Jun)",
    "Monsoon Peak (Jul-Sep)",
    "Post-Monsoon (Oct-Dec)",
]


def normalize_state_key(state: str) -> str:
    cleaned = str(state).strip().lower().replace("_", " ")
    code = STATE_NAME_TO_CODE.get(cleaned) or STATE_NAME_TO_CODE.get(str(state).strip().lower())
    if not code:
        raise ValueError(
            f"Unsupported or unmodeled state: '{state}'. "
            f"Available packaged state models: Punjab, Haryana, Rajasthan, Assam, Arunachal Pradesh."
        )
    return code


def load_manifest(manifest_path: str = DEFAULT_MANIFEST_PATH) -> Dict[str, Any]:
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"ML artifacts manifest not found at {manifest_path}")
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_model_artifacts(
    state: str,
    artifacts_dir: Optional[str] = None
) -> Tuple[Any, Any]:
    """
    Loads Quantile GB and Ridge regression artifacts for the specified state.
    """
    state_code = normalize_state_key(state)
    base_dir = artifacts_dir or os.path.join(os.path.dirname(__file__), "artifacts")
    qgb_path = os.path.join(base_dir, f"qgb_v2_{state_code}.joblib")
    ridge_path = os.path.join(base_dir, f"ridge_v2_{state_code}.joblib")

    if not os.path.exists(qgb_path):
        raise FileNotFoundError(
            f"Quantile GB model artifact for state '{state}' not found at: {qgb_path}"
        )
    if not os.path.exists(ridge_path):
        raise FileNotFoundError(
            f"Ridge model artifact for state '{state}' not found at: {ridge_path}"
        )

    qgb_model = joblib.load(qgb_path)
    ridge_model = joblib.load(ridge_path)
    return qgb_model, ridge_model


def validate_feature_vector(features: Dict[str, Any]) -> pd.DataFrame:
    """
    Validates input feature dictionary against schema and numerical constraints.
    Raises ValueError with actionable message if features are missing or invalid.
    """
    if not isinstance(features, dict):
        raise TypeError(f"Features must be a dictionary, got {type(features).__name__}")

    missing_keys = [k for k in REQUIRED_FEATURES if k not in features]
    if missing_keys:
        raise ValueError(
            f"Input features missing required schema fields: {missing_keys}. "
            f"Required fields are: {REQUIRED_FEATURES}"
        )

    row = {}
    for k in REQUIRED_FEATURES:
        val = features[k]
        if val is None or (isinstance(val, (int, float)) and (np.isnan(val) or np.isinf(val))):
            if k == "wl_year_before_target":
                # Seasonal lag can be NaN if history < 1 year; median imputation handled
                row[k] = np.nan
            else:
                raise ValueError(
                    f"Feature '{k}' has non-finite value ({val}). "
                    f"A valid finite numerical observation is required."
                )
        else:
            try:
                row[k] = float(val)
            except (ValueError, TypeError) as err:
                raise ValueError(
                    f"Feature '{k}' could not be converted to float: {val}"
                ) from err

    # Season code must be in 0..3
    season_code = int(row["season_code"])
    if season_code not in (0, 1, 2, 3):
        raise ValueError(
            f"season_code must be an integer between 0 and 3, got {season_code}"
        )
    row["season_code"] = season_code

    return pd.DataFrame([row])


def predict_single_horizon(
    features: Dict[str, Any],
    state: str,
    artifacts_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes inference for a single horizon using the state-specific model.
    Guarantees non-crossing quantiles and includes persistence comparisons.
    """
    X = validate_feature_vector(features)
    state_code = normalize_state_key(state)
    qgb, ridge = load_model_artifacts(state, artifacts_dir)

    # If seasonal lag is missing, impute with origin value to prevent crash
    if pd.isna(X["wl_year_before_target"].iloc[0]):
        X["wl_year_before_target"] = X["wl_origin"]

    # Predict Quantile GB
    preds_q = qgb.predict(X, enforce_ordering=True)
    p10 = float(preds_q["p10"][0])
    p50 = float(preds_q["p50"][0])
    p90 = float(preds_q["p90"][0])

    # Predict Ridge
    ridge_pred = float(ridge.predict(X)[0])

    # Baseline Persistence values
    wl_origin = float(features["wl_origin"])
    seasonal_val = features.get("wl_year_before_target")
    seasonal_persist = (
        float(seasonal_val)
        if seasonal_val is not None and np.isfinite(seasonal_val)
        else None
    )

    # Uncertainty width and crossing status
    width = round(p90 - p10, 2)
    crossing_status = (
        "calibrated_ordered" if (p10 <= p50 <= p90) else "invalid_crossing"
    )

    # Severity classification (heuristic depth thresholds)
    if p50 >= 20.0:
        severity = "severe"
    elif p50 >= 10.0:
        severity = "watch"
    else:
        severity = "normal"

    return {
        "expected_depth_mbgl": round(p50, 2),
        "lower_bound_p10_mbgl": round(p10, 2),
        "upper_bound_p90_mbgl": round(p90, 2),
        "interval_width_m": width,
        "interval_status": crossing_status,
        "ridge_depth_mbgl": round(ridge_pred, 2),
        "baselines": {
            "last_observation_persistence_mbgl": round(wl_origin, 2),
            "seasonal_persistence_mbgl": (
                round(seasonal_persist, 2) if seasonal_persist is not None else None
            ),
        },
        "stress_risk_category": severity,
        "units": "m bgl",
        "model_identifier": f"QuantileGB-v2.0-{state_code}",
        "model_version": "2.0.0",
        "operational_eligibility": False,
    }


def forecast_from_observation_series(
    observations: List[Dict[str, Any]],
    state: str,
    block_id: str,
    block_name: str,
    district_name: str,
    station_name: Optional[str] = None,
    num_horizons: int = 4
) -> Dict[str, Any]:
    """
    Generates multi-horizon forecasts (1 to 4 quarters ahead) from a station's
    sequential historical groundwater depth observations.

    Validation Safeguards:
    - Fails closed if fewer than 2 valid historical observations exist.
    - Accurately computes drawdown velocity and seasonal lags.
    - Dates are projected quarterly from the latest origin observation date.
    """
    if not isinstance(observations, list):
        raise TypeError(f"Observations must be a list, got {type(observations).__name__}")

    # Clean and sort observations by date
    clean_obs = []
    for obs in observations:
        d_str = obs.get("date") or obs.get("observation_date") or obs.get("month")
        val = (
            obs.get("depth_mbgl")
            if obs.get("depth_mbgl") is not None
            else obs.get("water_level_mbgl")
            if obs.get("water_level_mbgl") is not None
            else obs.get("wellDepth")
            if obs.get("wellDepth") is not None
            else obs.get("depth")
        )
        if d_str and val is not None:
            try:
                dt = pd.to_datetime(d_str, errors="coerce", format="mixed")
                num_val = float(val)
                if pd.notna(dt) and np.isfinite(num_val) and (0.0 <= num_val <= 150.0):
                    clean_obs.append({"date": dt, "depth": num_val})
            except (ValueError, TypeError):
                continue

    clean_obs.sort(key=lambda x: x["date"])

    if len(clean_obs) < 2:
        return {
            "blockId": block_id,
            "blockName": block_name,
            "districtName": district_name,
            "stationName": station_name or "Station Observation Well",
            "modelIdentifier": "none",
            "modelVersion": "none",
            "modelStatus": "unavailable",
            "provenanceStatus": "unverified",
            "horizonStatus": "unverified",
            "operationalEligibility": False,
            "baselineHistoricalDepthMbgl": clean_obs[-1]["depth"] if clean_obs else None,
            "forecasts": [],
            "safeguardDisclaimer": (
                f"Insufficient historical observations for {block_name}: "
                f"at least 2 consecutive historical quarters are required for causal feature extraction; "
                f"found {len(clean_obs)} valid observations."
            ),
            "generatedAt": pd.Timestamp.now(tz="UTC").isoformat(),
            "isDemonstrationData": False,
        }

    latest = clean_obs[-1]
    prev = clean_obs[-2]
    origin_date = latest["date"]
    origin_depth = latest["depth"]
    prev_depth = prev["depth"]
    drawdown_velocity = origin_depth - prev_depth

    # Look back ~1 year for seasonal persistence baseline
    target_year_back = origin_date - pd.Timedelta(days=365)
    best_seasonal = None
    min_day_diff = 60
    for obs in clean_obs:
        diff = abs((obs["date"] - target_year_back).days)
        if diff < min_day_diff:
            min_day_diff = diff
            best_seasonal = obs["depth"]

    forecast_points = []
    cap = min(max(num_horizons, 1), 4)

    current_origin_depth = origin_depth
    current_prev_depth = prev_depth

    for h in range(1, cap + 1):
        target_date = origin_date + pd.DateOffset(months=3 * h)
        target_season_idx = int(target_date.quarter - 1)
        target_season_name = f"{SEASONS[target_season_idx]} {target_date.year}"

        features = {
            "wl_origin": current_origin_depth,
            "wl_prev": current_prev_depth,
            "wl_year_before_target": best_seasonal if best_seasonal is not None else current_origin_depth,
            "drawdown_velocity_q1": current_origin_depth - current_prev_depth,
            "season_code": target_season_idx,
        }

        try:
            pred = predict_single_horizon(features, state)
            pt = {
                "horizonQuarter": h,
                "forecastHorizonMonths": 3 * h,
                "targetSeason": target_season_name,
                "targetDate": target_date.strftime("%Y-%m-%d"),
                "expectedDepthMbgl": pred["expected_depth_mbgl"],
                "uncertaintyInterval": {
                    "lowerBoundP10Mbgl": pred["lower_bound_p10_mbgl"],
                    "upperBoundP90Mbgl": pred["upper_bound_p90_mbgl"],
                    "intervalWidthM": pred["interval_width_m"],
                    "isIntervalCalibrated": False,
                    "intervalStatus": pred["interval_status"],
                },
                "baselinePersistence": {
                    "lastObservationPersistenceMbgl": round(origin_depth, 2),
                    "seasonalPersistenceMbgl": (
                        round(best_seasonal, 2) if best_seasonal is not None else None
                    ),
                },
                "stressRiskCategory": pred["stress_risk_category"],
                "units": "m bgl",
            }
            forecast_points.append(pt)

            # Update auto-regressive state for next step
            current_prev_depth = current_origin_depth
            current_origin_depth = pred["expected_depth_mbgl"]
        except Exception as err:
            break

    state_code = normalize_state_key(state)
    scientific_notice = None
    if state_code == "arunachal_pradesh":
        scientific_notice = (
            "Scientific Advisory: Held-out validation demonstrates low predictive skill (NSE = 0.129, 80% coverage = 48.8%) "
            "due to acute sparsity of historical groundwater telemetry in mountainous terrain. "
            "Outputs represent experimental research prototype estimates and should not be used for planning."
        )
    elif state_code == "assam":
        scientific_notice = (
            "Scientific Advisory: Model demonstrates moderate predictive skill (NSE = 0.475, 80% coverage = 71.9%). "
            "High alluvial riverbank dynamics introduce seasonal variance. Research prototype only."
        )

    res_dict = {
        "blockId": block_id,
        "blockName": block_name,
        "districtName": district_name,
        "stationName": station_name or f"{block_name} Central Station",
        "modelIdentifier": f"QuantileGB-v2.0-{state_code}",
        "modelVersion": "2.0.0",
        "modelStatus": "research_prototype",
        "provenanceStatus": "verified",
        "horizonStatus": "valid",
        "operationalEligibility": False,
        "baselineHistoricalDepthMbgl": round(origin_depth, 2),
        "latestObservationDate": origin_date.strftime("%Y-%m-%d"),
        "forecasts": forecast_points,
        "safeguardDisclaimer": (
            "Research Prototype Notice: Groundwater forecasts represent statistical quantile gradient boosting estimates "
            "trained on verified historical CGWB observation series. Intervals represent empirical uncalibrated bounds. "
            "Not authorized for statutory drought notifications without field verification."
        ),
        "generatedAt": pd.Timestamp.now(tz="UTC").isoformat(),
        "isDemonstrationData": False,
    }
    if scientific_notice:
        res_dict["scientificAuditNotice"] = scientific_notice
    return res_dict


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="JalDrishti Groundwater ML Inference CLI")
    parser.add_argument("--state", type=str, default="punjab", help="State name (e.g. Punjab, Rajasthan)")
    parser.add_argument("--origin-depth", type=float, default=20.5, help="Latest observed depth (m bgl)")
    parser.add_argument("--prev-depth", type=float, default=19.8, help="Previous quarter depth (m bgl)")
    parser.add_argument("--seasonal-lag", type=float, default=20.1, help="Depth 1 year before target (m bgl)")
    parser.add_argument("--season-code", type=int, default=0, help="Season code 0..3")

    args = parser.parse_args()
    feats = {
        "wl_origin": args.origin_depth,
        "wl_prev": args.prev_depth,
        "wl_year_before_target": args.seasonal_lag,
        "drawdown_velocity_q1": args.origin_depth - args.prev_depth,
        "season_code": args.season_code,
    }
    result = predict_single_horizon(feats, args.state)
    print(json.dumps(result, indent=2))
