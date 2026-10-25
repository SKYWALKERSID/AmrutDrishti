"""Train the reproducible, station-isolated NWDP experimental model."""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ml.nwdp_training import train


if __name__ == "__main__":
    result = train()
    print(json.dumps({
        "status": "trained_experimental_station_models",
        "stations": result["station_count_trained"],
        "skipped": result["station_count_skipped"],
        "artifact": result["model_artifact"],
        "raw_source_rows": result["raw_source_rows"],
    }, indent=2))
