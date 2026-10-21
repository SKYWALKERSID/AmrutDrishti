"""
Acquire and audit official Haryana & Rajasthan Ground Water Department datasets from NWIC.
Saves raw files with SHA-256, validates physical depth ranges, and checks station coverage.
"""
import os
import sys
import ssl
import urllib.request
import hashlib
import pandas as pd
import numpy as np

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

sources = [
    {
        "id": "haryana_gw_manual_2021_2025",
        "url": "https://nwdp.nwic.gov.in/dataset/d4a41ce6-8bc9-4aa0-8c5f-9fdfa8702345/resource/0b9c2234-76e9-49a2-adc9-d677db306e53/download/gwl_manual_quarterly_haryana_gw_hr_2021_2025.csv",
        "target": os.path.join("data", "sources", "haryana_gw_manual_2021_2025.csv"),
        "dt_col": "Data Acquisition Time",
        "val_col": "Groundwater Level Quarterly Manual (meter)"
    },
    {
        "id": "rajasthan_gw_manual_2021_2025",
        "url": "https://nwdp.nwic.gov.in/dataset/80a4d746-34b5-419d-abb3-97ea3ee76085/resource/7437288d-42bb-4997-bb9b-8b3137632143/download/gwl_manual_quarterly_rajasthan_gw_rj_2021_2025.csv",
        "target": os.path.join("data", "sources", "rajasthan_gw_manual_2021_2025.csv"),
        "dt_col": "Data Acquisition Time",
        "val_col": "Groundwater Level Quarterly Manual (meter)"
    }
]

print("=== INGESTING HARYANA & RAJASTHAN STATE GROUND WATER DATASETS FROM NWIC ===")

for src in sources:
    url = src["url"]
    target_file = src["target"]
    print(f"\nFetching {src['id']} from: {url}")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    
    try:
        with urllib.request.urlopen(req, timeout=90, context=ctx) as resp:
            content = resp.read()
            sha256 = hashlib.sha256(content).hexdigest()
            print(f"  Downloaded {len(content)} bytes ({len(content)/(1024*1024):.2f} MB). SHA-256: {sha256}")
            
            with open(target_file, "wb") as f:
                f.write(content)
                
            print(f"  Saved to {target_file}")
            
            df = pd.read_csv(target_file, low_memory=False)
            total_rows = len(df)
            print(f"  Total raw rows: {total_rows}")
            
            dt_col = src["dt_col"]
            val_col = src["val_col"]
            
            df['dt'] = pd.to_datetime(df[dt_col], errors='coerce', dayfirst=True)
            df['val'] = pd.to_numeric(df[val_col], errors='coerce')
            
            valid = df.dropna(subset=['Station', 'dt', 'val'])
            phys_valid = valid[(valid['val'] >= 0.0) & (valid['val'] <= 150.0)]
            rejected_count = total_rows - len(phys_valid)
            
            stations = phys_valid['Station'].unique().tolist()
            districts = phys_valid['District'].unique().tolist() if 'District' in phys_valid.columns else []
            min_date = phys_valid['dt'].min()
            max_date = phys_valid['dt'].max()
            
            print(f"  Valid observations: {len(phys_valid):,} (Rejected: {rejected_count})")
            print(f"  Date range: {min_date} to {max_date}")
            print(f"  Stations count: {len(stations)}")
            print(f"  Districts count: {len(districts)} -> {districts[:5]}")
            
    except Exception as e:
        print(f"  FAILED to acquire {src['id']}: {e}")

print("\nIngestion of Haryana & Rajasthan complete.")
