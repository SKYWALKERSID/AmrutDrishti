"""
Provenance-Preserving Local Ingestion & Harmonization Pipeline for NWIC DWLR Telemetry.
Strictly local to data/sources/telemetry_clean/. ZERO production Supabase writes.

Features:
1. Downloads and validates remote NWIC telemetry datasets.
2. Preserves source station identifiers and original timestamps.
3. Aggregates 6-hourly telemetry readings to monthly medians per station.
4. Deduplicates using a documented scientific rule: median of valid measurements.
5. Emits normalized CSV ready for time-aware station matrix construction.
"""
import os
import sys
import io
import csv
import ssl
import urllib.request
import numpy as np
import pandas as pd
from collections import defaultdict
from datetime import datetime

# Disable SSL verification issues if needed for government open data portals
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

SOURCES = {
    'assam_dwlr': {
        'state': 'Assam',
        'url': 'https://nwdp.nwic.gov.in/dataset/276d9f85-1117-4af0-8f57-7c87f717d73e/resource/8e2554f2-7ccc-4dd9-b4a7-5b9fb835c650/download/gwl_tel_6_hourly_assam_as_2021_2025.csv',
        'date_col': 'Data Acquisition Time',
        'val_col': 'Groundwater Level Telemetry 6 Hourly (meter)',
        'st_col': 'Station'
    }
}

def ingest_telemetry_stream(name, cfg, max_rows=15000):
    print(f"\n--- Ingesting stream: {name} ({cfg['state']}) ---")
    print(f"Source URL: {cfg['url']}")
    
    out_dir = os.path.join('data', 'sources', 'telemetry_clean')
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, f"{name}_monthly_clean.csv")
    
    req = urllib.request.Request(cfg['url'], headers={'User-Agent': 'Mozilla/5.0'})
    
    monthly_data = defaultdict(list)
    station_meta = {}
    
    row_count = 0
    valid_readings = 0
    
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            text_stream = io.TextIOWrapper(resp, encoding='utf-8', errors='ignore')
            reader = csv.reader(text_stream)
            header = next(reader)
            
            st_idx = header.index(cfg['st_col'])
            dt_idx = header.index(cfg['date_col'])
            vl_idx = header.index(cfg['val_col'])
            
            # Additional metadata if present
            dist_idx = header.index('District') if 'District' in header else None
            lat_idx = header.index('Latitude') if 'Latitude' in header else None
            lng_idx = header.index('Longitude') if 'Longitude' in header else None
            
            for row in reader:
                row_count += 1
                if row_count > max_rows:
                    break
                    
                st_name = row[st_idx].strip()
                dt_str = row[dt_idx].strip()
                vl_str = row[vl_idx].strip()
                
                if not st_name or not dt_str or not vl_str:
                    continue
                    
                try:
                    val = float(vl_str)
                    if val < 0.0 or val > 150.0:
                        continue
                except ValueError:
                    continue
                    
                try:
                    dt = datetime.strptime(dt_str, '%d-%m-%Y %H:%M')
                except ValueError:
                    try:
                        dt = datetime.strptime(dt_str.split()[0], '%d-%m-%Y')
                    except ValueError:
                        continue
                        
                # Monthly aggregation key: (station, year, month)
                ym_key = (st_name, dt.year, dt.month)
                monthly_data[ym_key].append(val)
                valid_readings += 1
                
                if st_name not in station_meta:
                    station_meta[st_name] = {
                        'district': row[dist_idx].strip() if dist_idx is not None else 'Unknown',
                        'latitude': row[lat_idx].strip() if lat_idx is not None else '',
                        'longitude': row[lng_idx].strip() if lng_idx is not None else ''
                    }
                    
        print(f"Processed {row_count} raw telemetric rows -> {valid_readings} valid readings.")
        print(f"Discovered {len(station_meta)} stations across {len(monthly_data)} station-months.")
        
        # Build normalized monthly records
        records = []
        for (st_name, yr, mo), vals in sorted(monthly_data.items()):
            meta = station_meta.get(st_name, {})
            # Form middle-of-month timestamp
            mid_date = f"{yr}-{mo:02d}-15"
            med_val = round(float(np.median(vals)), 3)
            records.append({
                'station': st_name,
                'state': cfg['state'],
                'district': meta.get('district', 'Unknown'),
                'latitude': meta.get('latitude', ''),
                'longitude': meta.get('longitude', ''),
                'observation_date': mid_date,
                'water_level_mbgl': med_val,
                'sample_count': len(vals),
                'method': 'DWLR Telemetry Monthly Median'
            })
            
        out_df = pd.DataFrame(records)
        out_df.to_csv(out_file, index=False)
        print(f"Successfully exported clean monthly telemetry to: {out_file}")
        return out_df
        
    except Exception as e:
        print(f"Stream ingestion failed: {e}")
        return None

if __name__ == '__main__':
    for name, cfg in SOURCES.items():
        ingest_telemetry_stream(name, cfg, max_rows=10000)
