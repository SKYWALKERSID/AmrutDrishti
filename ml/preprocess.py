"""
JalDrishti ML Pipeline - Hydrological Feature Matrix Generator & Preprocessor
Creates standard training and test matrices from cleaned observations.
Does not start processing or training when imported.
"""

import csv
import json
from typing import Dict, List, Any

# Pilot block identifier concordance
PILOT_MAPPINGS: Dict[tuple, str] = {
    ("398", "BIJAWAR"): "blk_bijawar",
    ("398", "RAJNAGAR"): "blk_rajnagar",
    ("434", "BALDEOGARH"): "blk_baldeogarh",
    ("434", "JATARA"): "blk_jatara",
    ("434", "PALERA"): "blk_palera",
    ("434", "TIKAMGARH"): "blk_tikamgarh_main",
}

class GroundwaterDataPreprocessor:
    """
    Standard preprocessing class for JalDrishti groundwater records.
    Prepares temporal feature vectors, rolling statistics, and multi-horizon target labels.
    """
    def __init__(self, raw_csv_path: str = "data/sources/cgwb_mp_cleaned_proper.csv"):
        self.raw_csv_path = raw_csv_path
        self.block_series: Dict[str, List[Dict[str, Any]]] = {}

    def extract_block_observations(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Parses observation rows and groups by pilot block with date index.
        """
        records: Dict[str, List[Dict[str, Any]]] = {}
        try:
            with open(self.raw_csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    dist_code = row.get("District LGD Code", "").strip()
                    block_name = row.get("Block", "").strip().upper()
                    key = (dist_code, block_name)
                    if key in PILOT_MAPPINGS:
                        blk_id = PILOT_MAPPINGS[key]
                        if blk_id not in records:
                            records[blk_id] = []
                        records[blk_id].append({
                            "station_id": row.get("Station", "").strip(),
                            "date": row.get("Data Acquisition Time", "").strip(),
                            "water_level_mbgl": float(row["Groundwater Level Quarterly Manual (meter)"]) if row.get("Groundwater Level Quarterly Manual (meter)") else None,
                            "latitude": float(row["Latitude"]) if row.get("Latitude") else None,
                            "longitude": float(row["Longitude"]) if row.get("Longitude") else None,
                        })
        except Exception:
            pass
        self.block_series = records
        return records

    def compute_temporal_lags(self, observations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Extracts causal lag features without future data leakage.
        """
        sorted_obs = sorted(observations, key=lambda x: x["date"])
        processed = []
        for i, obs in enumerate(sorted_obs):
            lag_1 = sorted_obs[i - 1]["water_level_mbgl"] if i >= 1 else None
            lag_2 = sorted_obs[i - 2]["water_level_mbgl"] if i >= 2 else None
            lag_4 = sorted_obs[i - 4]["water_level_mbgl"] if i >= 4 else None
            processed.append({
                "date": obs["date"],
                "target_depth": obs["water_level_mbgl"],
                "lag_1": lag_1,
                "lag_2": lag_2,
                "lag_4": lag_4,
                "drawdown_vel": (lag_1 - lag_2) if (lag_1 is not None and lag_2 is not None) else None,
            })
        return processed
