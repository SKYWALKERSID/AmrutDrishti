"""Station-isolated direct 90-day and 180-day training from the retained NWDP telemetry.

Reuses the verified raw-to-derived lineage, sentinel quarantine and daily-median
aggregation from ml.nwdp_training. Each station/horizon is a separate model fitted
on genuine observed pairs (origin value -> value observed exactly h days later).
Evaluation is chronological with purged splits and compared against persistence.
"""
from __future__ import annotations

import json
import platform
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ml.nwdp_features import chronological_split
from ml.nwdp_horizon_features import FEATURE_COLUMNS, HISTORY_DAYS, HORIZONS, build_horizon_examples
from ml.nwdp_training import (
    ARTIFACT_DIR, MIN_TEST_EXAMPLES, MIN_TRAIN_EXAMPLES, ROOT, collect_station_daily,
    load_and_validate_registry,
)

HORIZON_MODEL_PATH = ARTIFACT_DIR / "nwdp_station_horizon_model.joblib"
HORIZON_METRICS_PATH = ARTIFACT_DIR / "nwdp_station_horizon_metrics.json"
MODEL_IDENTIFIER = "NWDP-Station-Experimental"
MODEL_VERSION = "2.0.0-experimental"


def _fit_horizon(daily: list[dict[str, Any]], horizon: int) -> tuple[dict[str, Any], dict[str, Any]]:
    examples = build_horizon_examples(daily, horizon)
    if len(examples) < MIN_TRAIN_EXAMPLES + MIN_TEST_EXAMPLES:
        raise ValueError("insufficient_horizon_pairs")
    train, test = chronological_split(examples)
    if len(train) < MIN_TRAIN_EXAMPLES or len(test) < MIN_TEST_EXAMPLES:
        raise ValueError("insufficient_chronological_split")
    x_train = pd.DataFrame([r["features"] for r in train], columns=FEATURE_COLUMNS)
    x_test = pd.DataFrame([r["features"] for r in test], columns=FEATURE_COLUMNS)
    y_train = np.asarray([r["target_value"] for r in train], dtype=float)
    y_test = np.asarray([r["target_value"] for r in test], dtype=float)
    persistence = np.asarray([r["origin_value"] for r in test], dtype=float)
    models, preds = {}, {}
    for q in (0.1, 0.5, 0.9):
        m = GradientBoostingRegressor(loss="quantile", alpha=q, n_estimators=60, max_depth=2,
                                      learning_rate=0.05, subsample=0.8, random_state=41)
        m.fit(x_train, y_train)
        models[str(q)] = m
        preds[q] = m.predict(x_test)
    crossings = int(np.sum((preds[0.1] > preds[0.5]) | (preds[0.5] > preds[0.9])))
    rmse = lambda a, b: float(np.sqrt(mean_squared_error(a, b)))
    base_rmse, model_rmse = rmse(y_test, persistence), rmse(y_test, preds[0.5])
    evaluation = {
        "horizonDays": horizon,
        "nTrain": len(train), "nTest": len(test),
        "trainOriginRange": [train[0]["origin_date"].isoformat(), train[-1]["origin_date"].isoformat()],
        "testOriginRange": [test[0]["origin_date"].isoformat(), test[-1]["origin_date"].isoformat()],
        "persistenceMae": float(mean_absolute_error(y_test, persistence)),
        "persistenceRmse": base_rmse,
        "modelMae": float(mean_absolute_error(y_test, preds[0.5])),
        "modelRmse": model_rmse,
        "rmseGainOverPersistencePct": float((base_rmse - model_rmse) / base_rmse * 100.0) if base_rmse > 0 else None,
        "p10P90EmpiricalCoveragePct": float(np.mean((y_test >= preds[0.1]) & (y_test <= preds[0.9])) * 100.0),
        "testQuantileCrossings": crossings,
    }
    return {"models": models, "evaluation": evaluation}, evaluation


def train_horizon_models(output_dir: Path = ARTIFACT_DIR) -> dict[str, Any]:
    source, _ = load_and_validate_registry(verify_raw_hashes=False)
    stations, _counts = collect_station_daily(source)
    trained: dict[str, Any] = {}
    skipped: dict[str, dict[str, str]] = {}
    for station_id, daily in sorted(stations.items()):
        horizons: dict[str, Any] = {}
        for h in HORIZONS:
            try:
                package, _ev = _fit_horizon(daily, h)
                horizons[str(h)] = package
            except ValueError as error:
                skipped.setdefault(station_id, {})[str(h)] = str(error)
        if not horizons:
            continue
        cutoff = daily[-1]["date"].toordinal() - (HISTORY_DAYS - 1)
        recent = [d for d in daily if d["date"].toordinal() >= cutoff]
        origin_records = daily[-1]
        trained[station_id] = {
            "state": station_id.split("::")[0], "district": station_id.split("::")[1],
            "station_name": station_id.split("::")[2],
            "latest_date": daily[-1]["date"].isoformat(),
            "daily_observation_count": len(daily),
            "date_range": [daily[0]["date"].isoformat(), daily[-1]["date"].isoformat()],
            "latest_history": [{"date": d["date"].isoformat(), "value": d["value"]} for d in recent],
            "origin_record_ids": sorted(origin_records["source_record_ids"]),
            "source_files": sorted({f for d in recent for f in d["source_files"]}),
            "horizons": horizons,
        }
    if not trained:
        raise RuntimeError("no_station_passed_horizon_training_requirements")
    hashes = {item["filename"]: item["sha256"] for item in source["resources"]}
    generated = datetime.now(timezone.utc).isoformat()
    artifact = {
        "metadata": {
            "model_identifier": MODEL_IDENTIFIER, "version": MODEL_VERSION,
            "horizons_days": list(HORIZONS), "generated_at": generated,
            "feature_columns": FEATURE_COLUMNS, "source_hashes": hashes,
            "operational_eligibility": False, "interval_status": "ordered_uncalibrated",
            "training_scope": "18 retained NWDP CSVs only; each station and horizon modelled independently; no rainfall/CGWB/manual data",
            "python_version": platform.python_version(), "scikit_learn_version": sklearn.__version__,
            "numpy_version": np.__version__, "pandas_version": pd.__version__, "joblib_version": joblib.__version__,
        },
        "stations": trained,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, output_dir / HORIZON_MODEL_PATH.name, compress=3)

    evals = {sid: {h: p["evaluation"] for h, p in st["horizons"].items()} for sid, st in trained.items()}
    summary: dict[str, Any] = {}
    for h in map(str, HORIZONS):
        rows = [e[h] for e in evals.values() if h in e]
        gains = [r["rmseGainOverPersistencePct"] for r in rows if r["rmseGainOverPersistencePct"] is not None]
        summary[h] = {
            "stationsTrained": len(rows),
            "stationsBeatingPersistence": int(sum(1 for g in gains if g > 0)),
            "medianRmseGainOverPersistencePct": float(np.median(gains)) if gains else None,
            "medianP10P90CoveragePct": float(np.median([r["p10P90EmpiricalCoveragePct"] for r in rows])),
            "totalTestQuantileCrossings": int(sum(r["testQuantileCrossings"] for r in rows)),
            "totalTestPairs": int(sum(r["nTest"] for r in rows)),
        }
    metrics = {
        "generated_at": generated, "model_identifier": MODEL_IDENTIFIER, "model_version": MODEL_VERSION,
        "model_artifact": HORIZON_MODEL_PATH.relative_to(ROOT).as_posix(),
        "protocol": "chronological 80/20 by origin with purge; direct targets exactly h days after origin; no interpolation; baseline = persistence",
        "station_count_trained": len(trained), "skipped": skipped, "summary_by_horizon": summary,
        "per_station": evals, "operational_eligibility": False,
        "latest_date_by_state": {s: max(st["latest_date"] for st in trained.values() if st["state"] == s)
                                 for s in sorted({st["state"] for st in trained.values()})},
    }
    (output_dir / HORIZON_METRICS_PATH.name).write_text(json.dumps(metrics, indent=1), encoding="utf-8")
    return metrics


if __name__ == "__main__":
    out = train_horizon_models()
    print(json.dumps({k: out[k] for k in ("station_count_trained", "summary_by_horizon", "latest_date_by_state")}, indent=1))
    print("skipped stations:", len(out["skipped"]))
    print("artifact MB:", round(HORIZON_MODEL_PATH.stat().st_size / 1048576, 2))
