"""
Generates verified offline model predictions for all monitored blocks using
the trained Quantile Gradient Boosting (QGB v2.0) models and verified historical series.

Guarantees:
- Output adheres to TRD v1.0 and Rule 5.
- Non-crossing quantiles: P10 <= P50 <= P90.
- Explicit persistence baselines included for each horizon.
- Zero mock or fabricated numbers.
"""

import os
import sys
import json
import re
import pandas as pd

sys.path.insert(0, os.path.abspath('.'))
from ml.inference import forecast_from_observation_series, normalize_state_key

def main():
    # Load historical observation series
    hist_path = 'src/lib/data/contrastHistoricalSeries.json'
    with open(hist_path, 'r', encoding='utf-8') as f:
        hist_data = json.load(f)

# Extract block metadata from all canonical registries. Unsupported state
# models must remain explicitly unavailable; never replace them with a hand
# tuned trend extrapolation.
    with open('src/lib/data/bundelkhand.ts', 'r', encoding='utf-8') as f:
        bk_text = f.read()
    with open('src/lib/data/nationalContrast.ts', 'r', encoding='utf-8') as f:
        nc_text = f.read()
    with open('src/lib/data/targetDistricts.ts', 'r', encoding='utf-8') as f:
        td_text = f.read()

    combined_text = bk_text + nc_text + td_text
    pattern = re.compile(
        r"id:\s*['\"](blk_[a-zA-Z0-9_]+)['\"],[\s\S]*?name:\s*['\"]([^'\"]+)['\"],[\s\S]*?districtName:\s*['\"]([^'\"]+)['\"],[\s\S]*?state:\s*['\"]([^'\"]+)['\"]"
    )

    blocks_meta = {}
    for m in pattern.finditer(combined_text):
        bid = m.group(1)
        blocks_meta[bid] = {
            'id': bid,
            'name': m.group(2).strip(),
            'districtName': m.group(3).strip(),
            'state': m.group(4).strip()
        }

    print(f"Loaded {len(blocks_meta)} blocks metadata.")
    print(f"Loaded {len(hist_data)} blocks with historical observations.")

    projections = {}
    evaluated_count = 0
    unavailable_count = 0

    for bid, meta in blocks_meta.items():
        obs_list = hist_data.get(bid, [])
        state = meta['state']

        # Determine if state has a trained QGB model
        try:
            state_key = normalize_state_key(state)
        except ValueError:
            # State like MP or UP where telemetry models are documented separately or quarterly manual
            state_key = None

        if state_key and len(obs_list) >= 2:
            res = forecast_from_observation_series(
                observations=obs_list,
                state=state,
                block_id=bid,
                block_name=meta['name'],
                district_name=meta['districtName'],
                station_name=f"{meta['name']} CGWB Station",
                num_horizons=4
            )
            if res.get('forecasts'):
                projections[bid] = res
                evaluated_count += 1
                continue

        # Unsupported model geography or insufficient history: fail closed.
        projections[bid] = {
            "blockId": bid,
            "blockName": meta['name'],
            "districtName": meta['districtName'],
            "stationName": f"{meta['name']} Station",
            "modelIdentifier": "none",
            "modelVersion": "none",
            "modelStatus": "unavailable",
            "provenanceStatus": "unverified",
            "horizonStatus": "unverified",
            "operationalEligibility": False,
            "baselineHistoricalDepthMbgl": None,
            "forecasts": [],
            "safeguardDisclaimer": "Notice: No packaged state model with reviewed validation and fresh, traceable input observations is available for this block. Forecast unavailable; no empirical extrapolation was generated.",
            "generatedAt": pd.Timestamp.now(tz="UTC").isoformat(),
            "isDemonstrationData": False
        }
        unavailable_count += 1

    out_path = 'src/lib/data/contrastProjections.json'
    with open(out_path, 'w', encoding='utf-8') as out:
        json.dump(projections, out, indent=2)

    print(f"Wrote {len(projections)} block projections to {out_path} ({evaluated_count} evaluated, {unavailable_count} unavailable).")

if __name__ == '__main__':
    main()
