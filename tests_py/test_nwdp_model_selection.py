"""Unit and contract tests for nwdp_model_selection module."""
from datetime import date, timedelta
import numpy as np
import pytest

from ml.nwdp_features import build_examples, FEATURE_COLUMNS
from ml.nwdp_model_selection import (
    chronological_three_way_split,
    evaluate_and_select_model,
    MIN_IMPROVEMENT_THRESHOLD,
    MIN_ABSOLUTE_MAE_IMPROVEMENT,
)


def make_synthetic_daily(n_days=100, trend=0.01, noise=0.05):
    base_date = date(2025, 1, 1)
    records = []
    rng = np.random.RandomState(42)
    for i in range(n_days):
        val = 10.0 + trend * i + noise * rng.randn()
        records.append({
            "date": base_date + timedelta(days=i),
            "value": float(val),
            "source_record_ids": [f"rec_{i}"],
            "source_files": ["synthetic.csv"],
        })
    return records


def test_chronological_three_way_split_ordering_and_no_leakage():
    records = make_synthetic_daily(120)
    examples = build_examples(records)
    train, val, test = chronological_three_way_split(examples, 0.6, 0.2)

    assert len(train) > 0
    assert len(val) > 0
    assert len(test) > 0

    max_train_target = max(r["target_date"] for r in train)
    min_val_origin = min(r["origin_date"] for r in val)
    assert max_train_target < min_val_origin

    max_val_target = max(r["target_date"] for r in val)
    min_test_origin = min(r["origin_date"] for r in test)
    assert max_val_target < min_test_origin


def test_model_selection_constant_or_noisy_falls_back_to_persistence():
    records = make_synthetic_daily(150, trend=0.0, noise=0.001)
    examples = build_examples(records)

    res, pkg = evaluate_and_select_model(
        "test::station::noisy",
        examples,
        daily_observations=records,
        min_train=30,
        min_val=10,
        min_test=10,
    )

    assert res["selected_model"] == "persistence"
    assert "no_candidate_beats_persistence_threshold" in res["selection_reason"]
    assert pkg["selected_model_name"] == "persistence"
    assert res["operational_eligibility"] is False
    assert res["interval_status"] == "ordered_uncalibrated"


def test_model_selection_on_predictable_signal_selects_model():
    records = make_synthetic_daily(200, trend=0.1, noise=0.001)
    examples = build_examples(records)

    res, pkg = evaluate_and_select_model(
        "test::station::predictable",
        examples,
        daily_observations=records,
        min_train=30,
        min_val=10,
        min_test=10,
    )

    assert res["selected_model"] in ("ridge", "gbr_light")
    assert "val_rmse_improvement" in res["selection_reason"]
    assert "0.5" in pkg["models"]
    assert "0.1" in pkg["models"]
    assert "0.9" in pkg["models"]
