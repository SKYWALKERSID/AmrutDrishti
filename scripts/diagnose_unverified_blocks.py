import sys
from pathlib import Path
import pandas as pd
import json

ROOT = Path('.')
sys.path.insert(0, str(ROOT))
from scripts.train_global_groundwater_model import SOURCES, _load_source

frames = []
for state, relative in SOURCES:
    f = _load_source(state, str(ROOT / relative))
    f['source_path'] = relative
    frames.append(f)
obs = pd.concat(frames, ignore_index=True)

with open('audit/global_model_block_readiness.json') as f:
    d = json.load(f)
unverified = [b for b in d['blocks'] if b['readiness_status'] == 'unverified_station_mapping']

for b in unverified:
    bid, state, dist, blk = b['block_id'], b['state'], b['district'], b['block_name']
    st_df = obs[obs['state'].str.lower() == state.lower()]
    dist_matches = st_df[st_df['district_name'].str.lower() == dist.lower()]
    if dist_matches.empty:
        dist_matches = st_df[st_df['district_name'].str.contains(dist[:4], case=False, na=False)]
    
    unique_dists = list(dist_matches['district_name'].unique())
    unique_blks = list(dist_matches['block_name'].unique()) if not dist_matches.empty else []
    print(f"{bid} | {state} | {dist} (matched dist: {unique_dists}) | target: '{blk}'")
    print(f"   sample blocks: {unique_blks[:10]}")
