"""
Acquire and audit official Uttar Pradesh Ground Water dataset from NWIC.
Saves to data/sources/up_nwic_manual.csv with checksum and provenance tracking.
"""
import os
import sys
import ssl
import urllib.request
import hashlib
import pandas as pd

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://nwdp.nwic.gov.in/dataset/c248b509-769e-43e4-953c-409bc715d5e8/resource/e5831942-ac52-4025-a69e-0fc2f725446d/download/gwl_manual_quarterly_upgw_up_1991_2020.csv"
target_file = os.path.join("data", "sources", "up_nwic_manual.csv")

print(f"Connecting to NWIC for Uttar Pradesh dataset: {url}...")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

try:
    with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
        content = resp.read()
        sha256 = hashlib.sha256(content).hexdigest()
        print(f"Downloaded {len(content)} bytes. SHA-256: {sha256}")
        
        with open(target_file, "wb") as f:
            f.write(content)
            
        print(f"Saved to {target_file}")
        
        # Analyze content
        df = pd.read_csv(target_file, low_memory=False)
        print("\nUP Dataset Summary:")
        print("  Total rows:", len(df))
        print("  Columns:", df.columns.tolist())
        print("  Districts:", df['District'].nunique() if 'District' in df.columns else 'N/A')
        print("  Stations:", df['Station'].nunique() if 'Station' in df.columns else 'N/A')
        
        dt_col = 'Data Acquisition Time'
        vl_col = 'Groundwater Level Quarterly Manual (meter)'
        df['dt'] = pd.to_datetime(df[dt_col], errors='coerce', dayfirst=True)
        df['val'] = pd.to_numeric(df[vl_col], errors='coerce')
        valid = df.dropna(subset=['Station', 'dt', 'val'])
        valid = valid[(valid['val'] >= 0.0) & (valid['val'] <= 150.0)]
        print("  Valid observations:", len(valid))
        print("  Date range:", valid['dt'].min().date(), "to", valid['dt'].max().date())
        print("  Sample districts:", valid['District'].value_counts().head(5).to_dict())
        
except Exception as e:
    print(f"Failed to acquire UP dataset: {e}")
