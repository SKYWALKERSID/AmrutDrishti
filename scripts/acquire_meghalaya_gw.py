"""
Acquire and audit official Meghalaya Ground Water Department datasets from NWIC.
Saves to data/sources/meghalaya_gw_manual.csv and data/sources/meghalaya_dwlr_historical.csv
with checksums, provenance tracking, and physical validation.
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
        "id": "meghalaya_manual_quarterly_2021_2025",
        "url": "https://nwdp.nwic.gov.in/dataset/1ac1e13b-98c9-4546-b211-43f5004bf531/resource/2a16af3f-3bf4-4834-a361-df4fe461b013/download/gwl_manual_quarterly_meghalaya_ml_2021_2025.csv",
        "target": os.path.join("data", "sources", "meghalaya_gw_manual.csv"),
        "dt_col": "Data Acquisition Time",
        "val_col": "Groundwater Level Quarterly Manual (meter)"
    },
    {
        "id": "meghalaya_dwlr_telemetry_1991_2020",
        "url": "https://nwdp.nwic.gov.in/dataset/6b978849-890a-4048-b231-5fc71992ac9a/resource/793e4b7b-7ccf-448e-9ee7-8e447edbd3f7/download/gwl_tel_6_hourly_meghalaya_ml_1991_2020.csv",
        "target": os.path.join("data", "sources", "meghalaya_dwlr_historical.csv"),
        "dt_col": "Data Acquisition Time",
        "val_col": "Groundwater Level Telemetry Quadridaily (meter)"
    }
]

print("=== INGESTING OFFICIAL MEGHALAYA GROUNDWATER DATASETS FROM NWIC ===")

manifest_records = []

for src in sources:
    url = src["url"]
    target_file = src["target"]
    print(f"\nFetching {src['id']} from: {url}")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    
    try:
        with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
            content = resp.read()
            sha256 = hashlib.sha256(content).hexdigest()
            print(f"  Downloaded {len(content)} bytes. SHA-256: {sha256}")
            
            with open(target_file, "wb") as f:
                f.write(content)
                
            print(f"  Saved to {target_file}")
            
            df = pd.read_csv(target_file, low_memory=False)
            total_rows = len(df)
            print(f"  Total raw rows: {total_rows}")
            print(f"  Columns: {df.columns.tolist()[:6]}")
            
            dt_col = src["dt_col"]
            val_col = src["val_col"]
            
            df['dt'] = pd.to_datetime(df[dt_col], errors='coerce', dayfirst=True)
            df['val'] = pd.to_numeric(df[val_col], errors='coerce')
            
            # Validation
            valid = df.dropna(subset=['Station', 'dt', 'val'])
            # Range check [0.0, 150.0] m bgl
            phys_valid = valid[(valid['val'] >= 0.0) & (valid['val'] <= 150.0)]
            rejected_count = total_rows - len(phys_valid)
            
            stations = phys_valid['Station'].unique().tolist()
            districts = phys_valid['District'].unique().tolist() if 'District' in phys_valid.columns else []
            min_date = phys_valid['dt'].min()
            max_date = phys_valid['dt'].max()
            
            print(f"  Valid observations: {len(phys_valid)} (Rejected: {rejected_count})")
            print(f"  Date range: {min_date} to {max_date}")
            print(f"  Stations ({len(stations)}): {stations[:5]}")
            print(f"  Districts ({len(districts)}): {districts}")
            
            manifest_records.append({
                "dataset_id": src["id"],
                "target_file": target_file,
                "url": url,
                "sha256": sha256,
                "raw_rows": total_rows,
                "valid_rows": len(phys_valid),
                "rejected_rows": rejected_count,
                "min_date": str(min_date),
                "max_date": str(max_date),
                "station_count": len(stations),
                "stations": stations,
                "districts": districts
            })
            
    except Exception as e:
        print(f"  FAILED to acquire {src['id']}: {e}")

print("\nIngestion of Meghalaya datasets complete.")
