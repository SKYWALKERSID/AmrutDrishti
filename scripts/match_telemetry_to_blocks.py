"""
JalDrishti — NWDP Telemetry to Canonical Block Crosswalk & Daily Aggregation
=============================================================================
Maps the normalized NWDP telemetry stations into the 56 canonical blocks.
For each matched block:
- Resolves high-confidence, non-conflicting station mapping.
- Isolates distinct physical monitoring wells (e.g. TN Coimbatore shallow vs deep).
- Aggregates multi-reading six-hourly data into robust daily median groundwater depth (m bgl)
  to eliminate diurnal/sensor noise while preserving daily timestamp fidelity.
- Generates data/derived/nwdp_block_telemetry_series.json for high-performance server-side loading.
"""

import json
import os
import re
from collections import defaultdict
from statistics import median
from typing import Dict, Any, List, Optional

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
READINESS_PATH = os.path.join(WORKSPACE_ROOT, 'audit', 'global_model_block_readiness.json')
NORMALIZED_PATH = os.path.join(WORKSPACE_ROOT, 'data', 'derived', 'nwdp_telemetry_normalized.json')
OUTPUT_PATH = os.path.join(WORKSPACE_ROOT, 'data', 'derived', 'nwdp_block_telemetry_series.json')

def clean_name(s: str) -> str:
    if not s:
        return ""
    cleaned = re.sub(r'[\(\)\.\,\-_]', ' ', str(s).lower())
    return ' '.join(cleaned.split())

def norm_s(s: str) -> str:
    if not s:
        return ""
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

STATION_ALIASES = {
    'chochrapz': 'chochrapz',
    'chocftrapz': 'chochrapz',
    'chocftra': 'chochrapz',
    'chochra': 'chochrapz',
    'jatara1': 'jatara',
    'jatara': 'jatara',
    'nawgaongow': 'nowgaon',
    'nowgaon': 'nowgaon',
    'uthandi1': 'uthandi',
    'uthandi': 'uthandi',
    'tigaria1': 'tigaria',
    'tigaria': 'tigaria',
    'bapipz1': 'bapi',
    'bapi': 'bapi',
}

def run_crosswalk():
    # This legacy name/district fuzzy matcher is deliberately disabled. The
    # retained NWDP records have no official station-to-block evidence and
    # source-reported values have no verified groundwater-depth convention.
    # It must never overwrite the fail-closed trusted series.
    with open(os.path.join(WORKSPACE_ROOT, 'data', 'derived', 'nwdp_station_block_mapping_evidence.json'), 'r', encoding='utf-8') as evidence_file:
        evidence = json.load(evidence_file)
    if not any(
        station.get('verified') is True and station.get('measurement_semantics_verified') is True
        and station.get('block_id')
        for station in evidence.get('stations', [])
    ):
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as output_file:
            json.dump({}, output_file)
        print("No station has both official block containment and measurement-semantics evidence; published series remains empty.")
        return
    raise RuntimeError("Heuristic crosswalk is retired; publish from reviewed mapping evidence and validated record lineage only.")

    # Unreachable legacy heuristic implementation retained for audit history.
    print("Loading readiness ledger and normalized telemetry...")
    with open(READINESS_PATH, 'r', encoding='utf-8') as f:
        readiness = json.load(f)
    with open(NORMALIZED_PATH, 'r', encoding='utf-8') as f:
        normalized = json.load(f)

    blocks = readiness.get('blocks', [])
    stations = normalized.get('stations', {})
    print(f"Loaded {len(blocks)} canonical blocks and {len(stations)} telemetry stations.")

    # Group stations by normalized state
    stations_by_state = defaultdict(list)
    for stn_id, sdata in stations.items():
        meta = sdata.get('metadata', {})
        state = meta.get('state', '')
        stations_by_state[clean_name(state)].append((stn_id, sdata))

    block_telemetry = {}
    matched_count = 0

    for b in blocks:
        bid = b['block_id']
        b_state = clean_name(b['state'])
        b_dist = clean_name(b['district'])
        b_name = clean_name(b['block_name'])
        b_name_norm = norm_s(b['block_name'])
        known_stn_ids = [clean_name(s) for s in b.get('station_identifiers', [])]
        known_norms = [norm_s(s.split('::')[-1]) for s in b.get('station_identifiers', [])]

        candidate_stations = []
        for stn_id, sdata in stations_by_state.get(b_state, []):
            smeta = sdata.get('metadata', {})
            s_dist = clean_name(smeta.get('district', ''))
            s_block = clean_name(smeta.get('block', ''))
            s_name = clean_name(smeta.get('station_name', ''))
            s_name_norm = norm_s(smeta.get('station_name', ''))
            s_alias = STATION_ALIASES.get(s_name_norm, s_name_norm)

            # Rule: Tamil Nadu aquifer isolation
            # Kalviramapalayam is deep fractured rock; P.N.Palayam is shallow alluvium.
            # Never cross-mix.
            if 'tamil nadu' in b_state:
                if 'kalviramapalayam' in b_name and 'p n palayam' in s_name:
                    continue
                if 'p n palayam' in b_name and 'kalviramapalayam' in s_name:
                    continue

            # Zero and exact-one are not universal sentinels.  The normalizer has
            # already quarantined documented fault codes; retain these readings
            # unless station-specific evidence is added to a reviewed rule.
            raw_obs = sdata.get('observations', [])
            clean_obs = raw_obs
            if not clean_obs:
                continue
            vals = [o['depthMbgl'] for o in clean_obs]
            if len(set(vals)) == 1 and vals[0] in (0.0, 1.0) and len(clean_obs) > 2:
                continue

            # District boundary validation: must match district
            dist_matched = (b_dist == s_dist or b_dist in s_dist or s_dist in b_dist)

            score = 0
            matched_on = ""

            # Check known identifiers & aliases
            for k_norm in known_norms:
                k_alias = STATION_ALIASES.get(k_norm, k_norm)
                if s_name_norm == k_norm or s_alias == k_alias:
                    score = 10
                    matched_on = f"exact_known:{k_norm}"
                    break
                elif dist_matched and ((len(k_norm) >= 4 and k_norm in s_name_norm) or (len(s_name_norm) >= 4 and s_name_norm in k_norm)):
                    score = 9
                    matched_on = f"sub_known:{k_norm}"
                    break

            # Check block name matches within district
            if score == 0 and dist_matched:
                b_alias = STATION_ALIASES.get(b_name_norm, b_name_norm)
                if s_name_norm == b_name_norm or s_alias == b_alias:
                    score = 9
                    matched_on = f"exact_block:{b_name}"
                elif (b_name == s_block or b_name in s_block or s_block in b_name):
                    score = 8
                    matched_on = f"block_col:{s_block}"
                elif (b_name in s_name or s_name in b_name or (len(b_name_norm) >= 4 and b_name_norm in s_name_norm)):
                    score = 7
                    matched_on = f"sub_block:{b_name}"

            if score > 0:
                latest_ts = clean_obs[-1]['timestamp'] if clean_obs else ''
                candidate_stations.append((stn_id, sdata, score, matched_on, latest_ts, len(clean_obs), clean_obs))

        if candidate_stations:
            # Sort candidate stations:
            # 1. Exact known identifier match (score 10) OR exact block match (score 9) with 2026 data
            # 2. Score >= 8 (high confidence match)
            # 3. Score
            # 4. Latest observation timestamp
            # 5. Total clean observations
            candidate_stations.sort(key=lambda x: (
                x[2] >= 9 and (x[4] or '') >= '2026-01-01',
                x[2] >= 8,
                x[2],
                (x[4] or '') >= '2025-09-19',
                x[4] or '',
                x[5]
            ), reverse=True)
            chosen_stn_id, chosen_sdata, score, matched_on, latest_ts, total_obs, clean_obs = candidate_stations[0]

            # Group clean observations by observationDate (YYYY-MM-DD) and compute daily median
            obs_by_date = defaultdict(list)
            for obs in clean_obs:
                d = obs.get('observationDate')
                val = obs.get('depthMbgl')
                if d and val is not None and isinstance(val, (int, float)) and 0.0 <= val <= 150.0:
                    obs_by_date[d].append(val)

            source_file = chosen_sdata.get('metadata', {}).get('source_file', '')
            is_historical = source_file == 'cgwb_mp_cleaned_proper.csv'
            source_tag = "CGWB_historical" if is_historical else "NWDP_telemetry"

            daily_obs = []
            for d in sorted(obs_by_date.keys()):
                vals = obs_by_date[d]
                med_val = round(median(vals), 2)
                daily_obs.append({
                    "stationId": chosen_stn_id,
                    "observationDate": d,
                    "depthMbgl": med_val,
                    "units": "m bgl",
                    "readingsCount": len(vals),
                    "source": source_tag
                })

            if len(daily_obs) >= 2:
                matched_count += 1
                meta = chosen_sdata.get('metadata', {})
                block_telemetry[bid] = {
                    "block_id": bid,
                    "state": b['state'],
                    "district": b['district'],
                    "block": b['block_name'],
                    "station_id": chosen_stn_id,
                    "station_name": meta.get('station_name', chosen_stn_id),
                    "agency": meta.get('agency', 'NWDP/CGWB'),
                    "aquifer_type": meta.get('aquifer_type', 'standard_telemetry_station'),
                    "latitude": meta.get('latitude'),
                    "longitude": meta.get('longitude'),
                    "count": len(daily_obs),
                    "start_date": daily_obs[0]["observationDate"],
                    "end_date": daily_obs[-1]["observationDate"],
                    "source_type": source_tag,
                    "match_confidence": "high" if score >= 7 else "medium",
                    "observations": daily_obs
                }

    print(f"Matched {matched_count} of {len(blocks)} canonical blocks to valid NWDP telemetry series.")

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(block_telemetry, f, indent=2)

    print(f"Saved block-mapped telemetry series to {OUTPUT_PATH}")

if __name__ == '__main__':
    run_crosswalk()
