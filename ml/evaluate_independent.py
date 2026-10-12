"""
JalDrishti ML - Independent, NON-PERSISTING evaluation.
No network access, no database writes, no artifact writes. Prints results to stdout only.

  python -m ml.evaluate_independent

Part A reproduces the existing ml/train.py protocol (pooled rows, iloc 80/20, Palera fallback) so
its historical numbers can be checked. Part B uses the station-aware protocol in ml/validation.py.
"""
import numpy as np
import pandas as pd

from ml.config import PILOT_BLOCKS
from ml.feature_engineering import load_cgwb_groundwater_raw, clean_and_harmonize_observations, build_block_training_matrix
from ml.baselines import SeasonalPersistenceBaseline
from ml.models import QuantileGroundwaterModel
from ml import validation as V

DATA = "data/sources/cgwb_mp_cleaned_proper.csv"
F = lambda x, d=3: "n/a" if x is None or (isinstance(x, float) and not np.isfinite(x)) else f"{x:.{d}f}"


def part_a(df):
    print("\n=== PART A: reproduction of existing train.py protocol (no persistence) ===")
    feats = ["water_level_lag_1", "water_level_lag_2", "water_level_lag_4", "drawdown_velocity_q1", "season_code"]
    for bid, meta in PILOT_BLOCKS.items():
        m = build_block_training_matrix(bid, df)
        k = int(len(m) * 0.8)
        tr = m.iloc[:k].dropna(subset=feats + ["target_h1"])
        te = m.iloc[k:].dropna(subset=feats + ["target_h1"])
        fallback = len(tr) < 5 or len(te) < 2
        if fallback:  # identical to train.py lines 102-105
            tr = m.dropna(subset=feats + ["target_h1"])
            te = tr.tail(max(3, int(len(tr) * 0.25)))
        overlap = len(set(tr.index) & set(te.index))
        zero_h = int((te["observation_date"].values == te["observation_date"].shift(-1).values).sum())
        mdl = QuantileGroundwaterModel().fit(tr[feats], tr["target_h1"])
        p = mdl.predict(te[feats])
        b = SeasonalPersistenceBaseline().fit(tr).predict(te)
        s = V.summarize(te["target_h1"].values, p)
        print(f"{meta['name']:<11} trainN={len(tr):>3} testN={len(te):>2} fallback={fallback} train/test overlap rows={overlap} "
              f"ML_RMSE={F(s['rmse'])} BASE_RMSE={F(V.rmse(te['target_h1'], b))} NSE={F(s['nse'])} crossing={F(s['crossing_rate'],2)}")


def part_b(df):
    print("\n=== PART B: station-aware one-campaign-ahead protocol ===")
    rows = []
    for bid, meta in PILOT_BLOCKS.items():
        sub = df[df["block_name"].str.lower() == meta["name"].lower()]
        mat = V.build_station_horizon_matrix(sub)
        elig = mat.dropna(subset=V.FEATURES + ["target"])  # same rows for ML and both baselines
        tr, te = V.chronological_split(elig, n_test_target_dates=2)
        r = {"block": meta["name"], "eligible": len(elig), "train": len(tr), "test": len(te),
             "stations_test": te["station"].nunique() if len(te) else 0}
        if len(tr) < 8 or len(te) < 3:
            r["status"] = "INSUFFICIENT DATA"
            rows.append(r); continue
        assert tr["target_date"].max() <= te["origin_date"].min(), "temporal overlap"
        r["test_period"] = f"{te['target_date'].min().date()}..{te['target_date'].max().date()}"
        r["horizon"] = f"{te['horizon_days'].min()}-{te['horizon_days'].max()}d"
        mdl = QuantileGroundwaterModel().fit(tr[V.FEATURES], tr["target"])
        p = mdl.predict(te[V.FEATURES])
        y = te["target"].values
        s = V.summarize(y, p)
        persist = te["wl_origin"].values
        seasonal = te["wl_year_before_target"].values
        r.update(s)
        r["persist_mae"], r["persist_rmse"] = V.mae(y, persist), V.rmse(y, persist)
        r["seasonal_rmse"] = V.rmse(y, seasonal)
        r["impr_vs_persist"] = V.rmse_improvement_pct(s["rmse"], r["persist_rmse"])
        r["impr_vs_seasonal"] = V.rmse_improvement_pct(s["rmse"], r["seasonal_rmse"])
        r["status"] = "LOW CONFIDENCE (test N<10)" if len(te) < 10 else "evaluated"
        rows.append(r)

    for r in rows:
        print(f"\n{r['block']}: eligible={r['eligible']} train={r['train']} test={r['test']} status={r['status']}")
        if "rmse" in r:
            print(f"  test_period={r['test_period']} horizon={r['horizon']} stations_in_test={r['stations_test']}")
            print(f"  ML  MAE={F(r['mae'])} RMSE={F(r['rmse'])} bias={F(r['bias'])} NSE={F(r['nse'])}")
            print(f"  Persistence MAE={F(r['persist_mae'])} RMSE={F(r['persist_rmse'])} | Seasonal-naive RMSE={F(r['seasonal_rmse'])}")
            print(f"  RMSE improvement vs persistence={F(r['impr_vs_persist'],1)}% vs seasonal={F(r['impr_vs_seasonal'],1)}%")
            print(f"  pinball p10/p50/p90={F(r['pinball_p10'])}/{F(r['pinball_p50'])}/{F(r['pinball_p90'])} "
                  f"coverage(P10-P90, nominal 0.80)={F(r['coverage_p10_p90'],2)} width={F(r['mean_width'],2)}m crossing={F(r['crossing_rate'],2)}")
            gates = {"RMSE<=1.50": r["rmse"] <= 1.5, "NSE>=0.65": (r["nse"] or -9) >= 0.65,
                     "impr>=15% vs persistence": (r["impr_vs_persist"] or -999) >= 15}
            print("  gates:", ", ".join(f"{k}={'PASS' if v else 'FAIL'}" for k, v in gates.items()))


if __name__ == "__main__":
    df = clean_and_harmonize_observations(load_cgwb_groundwater_raw(DATA))
    part_a(df)
    part_b(df)
