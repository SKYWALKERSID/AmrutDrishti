import pandas as pd
from scripts.train_global_groundwater_model import SOURCES, _load_source
from pathlib import Path

ROOT = Path(".")
frames = []
for state, rel in SOURCES:
    df = _load_source(state, str(ROOT / rel))
    frames.append(df)
all_df = pd.concat(frames, ignore_index=True)
print(f"Total rows in SOURCES: {len(all_df)}")

# Check candidates for replacement
tests = [
    ("Assam", "Cachar", "Silchar"),
    ("Assam", "Dibrugarh", "Moran"),
    ("Assam", "Dibrugarh", "Naharkatiya"),
    ("Assam", "Dibrugarh", "Dibrugarh East"),
    ("Assam", "Sonitpur", "Tezpur"),
    ("Assam", "Sonitpur", "Chariduar"),
    ("Haryana", "Mahendragarh", "Narnaul"),
    ("Madhya Pradesh", "Chhatarpur", "Nowgaon"),
    ("Rajasthan", "Dausa", "Dausa"),
    ("Tripura", "Dhalai", "Salema"),
    ("Tripura", "West Tripura", "Jirania"),
]

print("\n--- Testing 11 replacement blocks in SOURCES ---")
for st, dist, blk in tests:
    m = all_df[(all_df["state"] == st) & (all_df["district_name"].str.upper() == dist.upper()) & (all_df["block_name"].str.upper() == blk.upper())]
    stn_cnt = m["station"].nunique() if not m.empty else 0
    dmin = m["dt"].min().strftime("%Y-%m") if not m.empty else "N/A"
    dmax = m["dt"].max().strftime("%Y-%m") if not m.empty else "N/A"
    print(f"  {st:15} | {dist:15} | {blk:15} -> {len(m):4} rows | {stn_cnt:2} stations | {dmin} to {dmax}")

# Also check 11 Category A alias blocks
aliases = [
    ("Karnataka", "Shivamogga", "Shimoga"),
    ("Madhya Pradesh", "Sagar", "BANDA"),
    ("Meghalaya", "West Jaintia Hills", "Thadleskein"),
    ("Meghalaya", "Ri Bhoi", "Umling"),
    ("Assam", "Kamrup", "Chhaygaon"),
    ("Rajasthan", "Sawai Madhopur", "Chauth Ka Barwara"),
    ("Tamil Nadu", "Coimbatore", "P.N.Palayam"),
    ("Tamil Nadu", "Tuticorin", "OTTAPIDARAM"),
    ("Tamil Nadu", "Kancheepuram", "St.Thomas"),
    ("Tripura", "South Tripura", "AMARPUR"),
    ("Rajasthan", "Dausa", "Sikrai"),
]

print("\n--- Testing 11 Category A alias blocks in SOURCES ---")
for st, dist, blk in aliases:
    m = all_df[(all_df["state"] == st) & (all_df["district_name"].str.upper() == dist.upper()) & (all_df["block_name"].str.upper() == blk.upper())]
    stn_cnt = m["station"].nunique() if not m.empty else 0
    dmin = m["dt"].min().strftime("%Y-%m") if not m.empty else "N/A"
    dmax = m["dt"].max().strftime("%Y-%m") if not m.empty else "N/A"
    print(f"  {st:15} | {dist:15} | {blk:20} -> {len(m):4} rows | {stn_cnt:2} stations | {dmin} to {dmax}")
