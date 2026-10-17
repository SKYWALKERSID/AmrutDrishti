"""
Acquire and audit Madhya Pradesh Ground Water Department manual monthly dataset from NWIC.
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

url = "https://nwdp.nwic.gov.in/dataset/7573bf5e-5be5-4558-ae02-b7291fed47bd/resource/189b09f1-b9c5-408a-a447-a3b6a90592d0/download/ground_water_level_manual_monthly_madhya_pradesh_1974_2025.csv"
target_file = os.path.join("data", "sources", "mp_gwd_manual_monthly.csv")

print(f"Connecting to NWIC for MP GWD manual monthly dataset: {url}...")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

try:
    with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
        content = resp.read()
        sha256 = hashlib.sha256(content).hexdigest()
        print(f"Downloaded {len(content)} bytes. SHA-256: {sha256}")
        
        with open(target_file, "wb") as f:
            f.write(content)
            
        print(f"Saved to {target_file}")
        
        df = pd.read_csv(target_file, low_memory=False)
        print("\nMP GWD Manual Monthly Summary:")
        print("  Total rows:", len(df))
        print("  Columns:", df.columns.tolist())
        print("  Stations:", df['Station'].nunique() if 'Station' in df.columns else 'N/A')
        print("  Districts:", df['District'].nunique() if 'District' in df.columns else 'N/A')
        
        dt_col = 'Data Acquisition Time' if 'Data Acquisition Time' in df.columns else df.columns[-2]
        vl_col = df.columns[-1]
        print(f"  Using Date Col: '{dt_col}', Val Col: '{vl_col}'")
        df['dt'] = pd.to_datetime(df[dt_col], errors='coerce', dayfirst=True)
        df['val'] = pd.to_numeric(df[vl_col], errors='coerce')
        valid = df.dropna(subset=['dt', 'val'])
        valid = valid[(valid['val'] >= 0.0) & (valid['val'] <= 150.0)]
        print("  Valid observations:", len(valid))
        print("  Date range:", valid['dt'].min().date(), "to", valid['dt'].max().date())
        
        st_col = 'Station' if 'Station' in valid.columns else valid.columns[1]
        clean = valid.groupby([st_col, 'dt'])['val'].mean().reset_index().sort_values([st_col, 'dt'])
        gaps = []
        for _, g in clean.groupby(st_col):
            d_vals = g['dt'].values
            for k in range(len(d_vals) - 1):
                gaps.append((d_vals[k+1] - d_vals[k]) / np.timedelta64(1, 'D'))
        print("  Median consecutive gap:", np.median(gaps), "days")
        print("  P25 gap:", np.percentile(gaps, 25), "days; P75 gap:", np.percentile(gaps, 75), "days")
        
except Exception as e:
    print(f"Failed to acquire MP GWD manual monthly dataset: {e}")
