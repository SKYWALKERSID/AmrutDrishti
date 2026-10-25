import pandas as pd
from scripts.train_global_groundwater_model import _load_source

print("--- MEGHALAYA INVESTIGATION ---")
ml_df = _load_source('Meghalaya', 'data/sources/cgwb_regional/ML_2021_2025.csv')
for d in sorted(ml_df['district_name'].dropna().unique()):
    blks = ml_df[ml_df['district_name'] == d]['block_name'].dropna().unique()
    print(f"  Dist {d:20}: {sorted(blks)}")

print("\n--- RAJASTHAN SAWAI MADHOPUR & DAUSA INVESTIGATION ---")
rj_df = _load_source('Rajasthan', 'data/sources/cgwb_contrast/RJ.csv')
for dist in ["Sawai Madhopur", "Dausa"]:
    sub = rj_df[rj_df['district_name'].str.upper() == dist.upper()]
    print(f"  Dist {dist:20}: {sorted(sub['block_name'].dropna().unique())}")
