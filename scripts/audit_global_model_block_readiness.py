"""Produce a legacy 56-block manual-model evidence ledger.

This is deliberately an audit, not a forecasting batch. It only treats an
exact state/district/block source match as station mapping evidence and never
substitutes district-level observations for a block.
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.inference import load_global_model_artifact, predict_single_horizon, resolve_global_geographic_context
from scripts.train_global_groundwater_model import SOURCES, _load_source

# Never overwrite the active 43-block NWDP readiness ledger consumed at runtime.
LEDGER = ROOT / "audit" / "global_model_block_readiness_56_legacy.json"


def norm(value):
    return re.sub(r"[^a-z0-9]+", "", str(value).strip().lower())


def source_data():
    frames = []
    for state, relative in SOURCES:
        frame = _load_source(state, str(ROOT / relative))
        frame["source_path"] = relative
        frames.append(frame)
    return pd.concat(frames, ignore_index=True)


def main():
    blocks = json.loads((ROOT / "audit" / "coverage_matrix_56_blocks.json").read_text(encoding="utf-8"))
    observations = source_data()
    artifact = load_global_model_artifact()
    now = pd.Timestamp.now(tz="UTC").tz_localize(None)
    freshness_cutoff = now - pd.Timedelta(days=400)
    rows = []

    for block in blocks:
        state, district, name = block["state"], block["district"], block["block"]
        matching = observations[
            (observations["state"].map(norm) == norm(state))
            & (observations["district_name"].map(norm) == norm(district))
            & (observations["block_name"].map(norm) == norm(name))
        ].copy()
        source_paths = sorted(matching["source_path"].unique().tolist())
        station_counts = matching.groupby("station").size().sort_values(ascending=False) if not matching.empty else pd.Series(dtype=int)
        eligible_stations = station_counts[station_counts >= 2]
        latest = matching["dt"].max() if not matching.empty else pd.NaT
        try:
            categories = resolve_global_geographic_context(artifact, state, district, name)
            geography_status = "encoded_category_verified"
        except ValueError as error:
            categories, geography_status = None, f"unverified_station_mapping: {error}"

        base = {
            "block_id": block["id"], "state": state, "district": district,
            "block_name": name, "source_organization": "CGWB",
            "measurement_type": "quarterly_manual_groundwater_depth",
            "units": "m bgl", "source_paths": source_paths,
            "eligible_historical_observations": int(len(matching)),
            "distinct_eligible_stations": int(len(eligible_stations)),
            "station_identifiers": eligible_stations.index.tolist()[:25],
            "station_identifiers_truncated": bool(len(eligible_stations) > 25),
            "latest_verified_observation_date": None if pd.isna(latest) else latest.strftime("%Y-%m-%d"),
            "data_quality_flags": ["manual_only", "range_checked_0_to_150_mbgl", "telemetry_excluded"],
            "geographic_category_status": geography_status,
            "model_artifact_status": "available",
            "operational_eligibility": False,
            "api_current_forecast_status": "unavailable: bundled projections are freshness-gated and no raw-source-to-API ingestion path is implemented",
        }
        if matching.empty:
            base.update({
                "readiness_status": "unverified_station_mapping",
                "freshness_status": "unavailable",
                "global_model_can_technically_run": False,
                "research_prediction_input_integrity": "not_run",
                "exclusion_reason": "No exact canonical state/district/block match in approved manual CGWB source files.",
            })
        elif len(eligible_stations) == 0:
            base.update({
                "readiness_status": "insufficient_data",
                "freshness_status": "stale" if latest < freshness_cutoff else "fresh",
                "global_model_can_technically_run": False,
                "research_prediction_input_integrity": "not_run",
                "exclusion_reason": "No matched station has the project-required minimum of two valid observations for causal feature extraction.",
            })
        elif latest < freshness_cutoff:
            base.update({
                "readiness_status": "stale",
                "freshness_status": "stale",
                "global_model_can_technically_run": categories is not None,
                "research_prediction_input_integrity": "not_run: current forecast blocked by 400-day freshness gate",
                "exclusion_reason": "Latest exact block-matched manual observation exceeds the 400-day freshness threshold.",
            })
        elif categories is None:
            base.update({
                "readiness_status": "unverified_station_mapping",
                "freshness_status": "fresh",
                "global_model_can_technically_run": False,
                "research_prediction_input_integrity": "not_run",
                "exclusion_reason": "Canonical geography cannot be resolved uniquely against promoted artifact categories.",
            })
        else:
            station = eligible_stations.index[0]
            series = matching[matching["station"] == station].sort_values("dt")
            latest_pair = series.tail(2)
            features = {
                "wl_origin": float(latest_pair["val"].iloc[-1]),
                "wl_prev": float(latest_pair["val"].iloc[-2]),
                "wl_year_before_target": None,
                "drawdown_velocity_q1": float(latest_pair["val"].iloc[-1] - latest_pair["val"].iloc[-2]),
                "season_code": int(latest_pair["dt"].iloc[-1].quarter - 1),
            }
            try:
                prediction = predict_single_horizon(features, state, district, name)
                ordered = prediction["lower_bound_p10_mbgl"] <= prediction["expected_depth_mbgl"] <= prediction["upper_bound_p90_mbgl"]
                base.update({
                    "readiness_status": "eligible_for_research_prediction" if ordered else "prediction_integrity_failure",
                    "freshness_status": "fresh",
                    "global_model_can_technically_run": True,
                    "research_prediction_input_integrity": "passed" if ordered else "failed_quantile_ordering",
                    "model_identifier": prediction["model_identifier"],
                    "interval_status": prediction["interval_status"],
                    "exclusion_reason": None if ordered else "Predicted quantiles were not ordered.",
                })
            except Exception as error:
                base.update({
                    "readiness_status": "prediction_integrity_failure",
                    "freshness_status": "fresh",
                    "global_model_can_technically_run": False,
                    "research_prediction_input_integrity": f"failed: {type(error).__name__}",
                    "exclusion_reason": str(error),
                })
        rows.append(base)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": {"states": 10, "districts": 34, "blocks": 56, "active": False, "legacy": True},
        "artifact": "ml/artifacts/global_block_aware_qgb_v1.joblib",
        "freshness_policy": {"max_observation_age_days": 400, "reference_time_utc": now.isoformat()},
        "method": "Exact normalized state/district/block matching only; no district-level substitution; station requires at least two valid manual observations.",
        "limitations": [
            "This ledger verifies local source-file evidence, not publication or API ingestion.",
            "A technically valid research prediction is not a current API forecast or operational approval.",
            "Intervals are ordered_uncalibrated and operational eligibility is always false.",
        ],
        "blocks": rows,
    }
    LEDGER.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    counts = pd.Series([row["readiness_status"] for row in rows]).value_counts().to_dict()
    print(json.dumps({"ledger": str(LEDGER), "readiness_counts": counts}, indent=2))


if __name__ == "__main__":
    main()
