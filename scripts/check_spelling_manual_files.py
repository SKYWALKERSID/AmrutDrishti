import pandas as pd
import json

# Check MP cleaned file: data/sources/cgwb_mp_cleaned_proper.csv
mp_df = pd.read_csv("data/sources/cgwb_mp_cleaned_proper.csv")
print("MP Cleaned blocks in Chhatarpur and Sagar:")
for dist in ["Chhatarpur", "Sagar"]:
    sub = mp_df[mp_df["District"].str.title() == dist]
    blks = sub["Block"].dropna().unique()
    print(f"  {dist}: {sorted(blks)}")

# Check Tamil Nadu files for Thoothukudi and Chengalpattu
tn_df = pd.read_csv("data/sources/cgwb_regional/TN_2021_2025.csv")
print("\nTN districts in TN_2021_2025.csv:")
matching_dists = [d for d in tn_df["District"].dropna().unique() if "thoothu" in d.lower() or "tuticorin" in d.lower() or "chengal" in d.lower() or "kanchee" in d.lower()]
print("  Matching district spellings:", matching_dists)
for md in matching_dists:
    blks = tn_df[tn_df["District"] == md]["Block"].dropna().unique()
    print(f"    {md}: {sorted(blks)}")

# Check Tripura files for Gomati, Dhalai, West Tripura
tr_df = pd.read_csv("data/sources/cgwb_regional/TR_2021_2025.csv")
print("\nTripura districts in TR_2021_2025.csv:")
for d in tr_df["District"].dropna().unique():
    blks = tr_df[tr_df["District"] == d]["Block"].dropna().unique()
    print(f"  {d}: {sorted(blks)}")
