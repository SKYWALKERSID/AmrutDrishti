import pandas as pd
from ml.config import PILOT_BLOCKS
from ml.feature_engineering import load_cgwb_groundwater_raw, clean_and_harmonize_observations, build_block_training_matrix

raw = load_cgwb_groundwater_raw('data/sources/cgwb_mp_cleaned_proper.csv')
clean = clean_and_harmonize_observations(raw)
print("Latest observation date in feature matrix per block:")
for bid, meta in PILOT_BLOCKS.items():
    m = build_block_training_matrix(bid, clean)
    d = m['observation_date'].iloc[-1]
    print(f"  {meta['name']:<12}: latest matrix date = {str(d)[:10]}, row count = {len(m)}")
