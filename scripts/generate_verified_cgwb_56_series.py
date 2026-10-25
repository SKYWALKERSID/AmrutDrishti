import json
import re
import sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.train_global_groundwater_model import SOURCES, _load_source

COHORT_PATH = ROOT / "audit" / "canonical_56_blocks_final.json"
OUTPUT_SERIES_PATH = ROOT / "data" / "derived" / "verified_cgwb_block_series.json"

def norm(value):
    return re.sub(r"[^a-z0-9]+", "", str(value).strip().lower())

def generate_verified_series():
    print(f"Loading final 56-block cohort from {COHORT_PATH}...")
    blocks = json.loads(COHORT_PATH.read_text(encoding="utf-8"))
    
    print("Loading CGWB SOURCES datasets...")
    frames = []
    for state, relative in SOURCES:
        frame = _load_source(state, str(ROOT / relative))
        frame["source_path"] = relative
        frames.append(frame)
    all_df = pd.concat(frames, ignore_index=True)
    print(f"Loaded {len(all_df)} total observations across {all_df['station'].nunique()} stations.")

    series_by_block = {}
    total_obs_mapped = 0

    for b in blocks:
        bid = b["id"]
        st = b["state"]
        dist = b["district"]
        blk = b["block"]

        matching = all_df[
            (all_df["state"].map(norm) == norm(st))
            & (all_df["district_name"].map(norm) == norm(dist))
            & (all_df["block_name"].map(norm) == norm(blk))
        ].copy()

        if matching.empty:
            print(f"ERROR: No observations found for {bid} ({st} | {dist} | {blk})")
            continue

        # Choose the station with the most observations
        station_counts = matching.groupby("station").size().sort_values(ascending=False)
        best_station = station_counts.index[0]
        
        station_df = matching[matching["station"] == best_station].sort_values("dt")
        
        obs_list = []
        for _, row in station_df.iterrows():
            obs_list.append({
                "stationId": str(row["station"]),
                "observationDate": row["dt"].strftime("%Y-%m-%d"),
                "depthMbgl": round(float(row["val"]), 2),
                "units": "m bgl"
            })

        series_by_block[bid] = {
            "station_id": best_station,
            "count": len(obs_list),
            "start_date": obs_list[0]["observationDate"],
            "end_date": obs_list[-1]["observationDate"],
            "observations": obs_list
        }
        total_obs_mapped += len(obs_list)

    print(f"\nSuccessfully generated verified series for {len(series_by_block)} of {len(blocks)} blocks.")
    print(f"Total mapped observation count: {total_obs_mapped}")

    with open(OUTPUT_SERIES_PATH, "w", encoding="utf-8") as f:
        json.dump(series_by_block, f, indent=2)

    print(f"Saved complete 56-block verified series to {OUTPUT_SERIES_PATH}")

if __name__ == "__main__":
    generate_verified_series()
