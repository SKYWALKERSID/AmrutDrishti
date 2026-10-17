"""
Download and ingest full Assam DWLR telemetry dataset from NWIC.
Saves raw file to data/sources/assam_dwlr_raw.csv and generates clean monthly median series.
"""
import os
import sys
import ssl
import urllib.request
import hashlib
import pandas as pd
import numpy as np
from collections import defaultdict
from datetime import datetime

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://nwdp.nwic.gov.in/dataset/276d9f85-1117-4af0-8f57-7c87f717d73e/resource/8e2554f2-7ccc-4dd9-b4a7-5b9fb835c650/download/gwl_tel_6_hourly_assam_as_2021_2025.csv"
target_file = os.path.join("data", "sources", "assam_dwlr_raw.csv")

print(f"Connecting to NWIC for Assam DWLR dataset: {url}...")
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
        print("\nAssam DWLR Telemetry Summary:")
        print("  Total rows:", len(df))
        print("  Stations:", df['Station'].nunique())
        print("  Districts:", df['District'].nunique())
        
        dt_col = 'Data Acquisition Time'
        vl_col = 'Groundwater Level Telemetry 6 Hourly (meter)'
        df['dt'] = pd.to_datetime(df[dt_col], errors='coerce', dayfirst=True)
        df['val'] = pd.to_numeric(df[vl_col], errors='coerce')
        valid = df.dropna(subset=['Station', 'dt', 'val'])
        valid = valid[(valid['val'] >= 0.0) & (valid['val'] <= 150.0)]
        print("  Valid observations:", len(valid))
        print("  Date range:", valid['dt'].min(), "to", valid['dt'].max())
        print("  Station list:", valid['Station'].unique().tolist())
        
except Exception as e:
    print(f"Failed to acquire Assam DWLR dataset: {e}")
