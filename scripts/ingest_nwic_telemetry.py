"""
Ingests 2023-2025 DWLR Telemetry Observations for Pilot Districts (Tikamgarh & Chhatarpur).
Aggregates 6-hourly telemetry readings to monthly medians per station to preserve DB quotas.
Inserts into `monitoring_stations` and `station_observations`.
"""

import csv
import io
import math
import os
import re
import urllib.request
from collections import defaultdict
from datetime import datetime
import requests
# Parse .env.local without requiring external dotenv package
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
SUPABASE_URL = None
SUPABASE_KEY = None

if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('NEXT_PUBLIC_SUPABASE_URL='):
                SUPABASE_URL = line.split('=', 1)[1].strip().strip('"').strip("'")
            elif line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                SUPABASE_KEY = line.split('=', 1)[1].strip().strip('"').strip("'")

if not SUPABASE_URL:
    SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
if not SUPABASE_KEY:
    SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
}

# Pilot Block centroids in DB
PILOT_BLOCKS = {
    'CHHATARPUR': [
        {'id': '3783', 'name': 'BIJAWAR', 'lat': 24.65, 'lng': 79.498},
        {'id': '3788', 'name': 'RAJNAGAR', 'lat': 24.85, 'lng': 79.93}
    ],
    'TIKAMGARH': [
        {'id': '4027', 'name': 'BALDEOGARH', 'lat': 24.756, 'lng': 79.05},
        {'id': '4028', 'name': 'JATARA', 'lat': 25.00, 'lng': 79.047},
        {'id': '4030', 'name': 'PALERA', 'lat': 25.12, 'lng': 79.09},
        {'id': '4032', 'name': 'TIKAMGARH', 'lat': 24.74, 'lng': 78.838}
    ]
}

DISTRICT_IDS = {
    'CHHATARPUR': '398',
    'TIKAMGARH': '434'
}

def find_nearest_block(district: str, lat: float, lng: float) -> str:
    blocks = PILOT_BLOCKS.get(district, [])
    if not blocks:
        return None
    best_id = None
    min_dist = float('inf')
    for b in blocks:
        d = (b['lat'] - lat)**2 + (b['lng'] - lng)**2
        if d < min_dist:
            min_dist = d
            best_id = b['id']
    return best_id

def sanitize_station_id(st_name: str) -> str:
    clean = re.sub(r'[^a-zA-Z0-9_]', '_', st_name.strip())
    return f"DWLR_MP_{clean}"

def run_ingestion():
    url = "https://nwdp.nwic.gov.in/dataset/6ce86611-221a-416b-bb2b-9190c85f38b7/resource/2bd22563-54b0-4f41-ac93-f5a5bb1fa86a/download/gwl_tel_6_hourly_madhya_pradesh_gw_mp_2021_2025.csv"
    print(f"Connecting to live telemetry stream: {url}...")

    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    
    # Structure: station_id -> {meta}
    station_meta = {}
    # Structure: (station_id, year_month) -> list of readings
    station_monthly_readings = defaultdict(list)

    total_rows = 0
    matched_rows = 0

    with urllib.request.urlopen(req, timeout=90) as resp:
        text_stream = io.TextIOWrapper(resp, encoding='utf-8', errors='ignore')
        reader = csv.reader(text_stream)
        header = next(reader)
        
        st_idx = header.index('Station')
        dist_idx = header.index('District')
        lat_idx = header.index('Latitude')
        lng_idx = header.index('Longitude')
        date_idx = header.index('Data Acquisition Time')
        val_idx = header.index('Groundwater Level Telemetry 6 Hourly (meter)')

        for row in reader:
            total_rows += 1
            if total_rows % 250000 == 0:
                print(f"Processed {total_rows} rows from stream... matched {matched_rows} telemetry points in pilot districts.", flush=True)

            district = row[dist_idx].strip().upper()
            if district not in DISTRICT_IDS:
                continue

            try:
                lat = float(row[lat_idx])
                lng = float(row[lng_idx])
                val_str = row[val_idx].strip()
                if not val_str or val_str == '-' or val_str.lower() == 'null':
                    continue
                val = float(val_str)
                # Physical groundwater depth mbgl: depth is positive distance beneath surface
                depth_mbgl = abs(val)
                # Filter obvious sensor errors (-999, extreme noise)
                if depth_mbgl > 150.0 or depth_mbgl < 0.01:
                    continue

                date_raw = row[date_idx].strip()
                # Parse date format: DD-MM-YYYY HH:MM
                dt = datetime.strptime(date_raw, "%d-%m-%Y %H:%M")
                
                # Only keep observations from Sept 2023 onwards (after manual CGWB ends)
                if dt < datetime(2023, 9, 1):
                    continue

                raw_st_name = row[st_idx].strip()
                st_id = sanitize_station_id(raw_st_name)

                if st_id not in station_meta:
                    nearest_block_id = find_nearest_block(district, lat, lng)
                    station_meta[st_id] = {
                        'station_id': st_id,
                        'station_name': raw_st_name,
                        'district_id': DISTRICT_IDS[district],
                        'block_id': nearest_block_id,
                        'coordinates': {
                            'type': 'Point',
                            'crs': {'type': 'name', 'properties': {'name': 'EPSG:4326'}},
                            'coordinates': [lng, lat]
                        },
                        'agency': 'Madhya Pradesh GW',
                        'is_telemetric': True
                    }

                ym = dt.strftime("%Y-%m")
                station_monthly_readings[(st_id, ym)].append(depth_mbgl)
                matched_rows += 1

            except Exception:
                continue

    print(f"\nStream complete! Examined {total_rows} rows.")
    print(f"Found {len(station_meta)} unique telemetry stations across Tikamgarh & Chhatarpur.")
    print(f"Found {len(station_monthly_readings)} monthly aggregated observation bins.")

    # 1. Upsert monitoring_stations
    stations_list = list(station_meta.values())
    print(f"Upserting {len(stations_list)} stations into `monitoring_stations`...")
    for i in range(0, len(stations_list), 50):
        batch = stations_list[i:i+50]
        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/monitoring_stations",
            headers=HEADERS,
            json=batch
        )
        if res.status_code >= 400:
            print(f"Station upsert error ({res.status_code}):", res.text)
        else:
            print(f"  Upserted batch {i}..{i+len(batch)}")

    # 2. Prepare monthly aggregated station_observations (median reading mid-month)
    observations_to_insert = []
    for (st_id, ym), readings in station_monthly_readings.items():
        if not readings:
            continue
        readings.sort()
        mid = len(readings) // 2
        median_val = round(readings[mid], 2)
        # Mid-month date
        obs_date = f"{ym}-15"
        
        observations_to_insert.append({
            'station_id': st_id,
            'observation_date': obs_date,
            'water_level_mbgl': median_val,
            'data_status': 'observed',
            'quality_flag': 'passed'
        })

    print(f"Inserting {len(observations_to_insert)} monthly observations into `station_observations`...")
    inserted_obs = 0
    for i in range(0, len(observations_to_insert), 100):
        batch = observations_to_insert[i:i+100]
        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/station_observations",
            headers=HEADERS,
            json=batch
        )
        if res.status_code >= 400:
            print(f"Obs insert error ({res.status_code}):", res.text)
        else:
            inserted_obs += len(batch)
            if i % 300 == 0:
                print(f"  Inserted {inserted_obs}/{len(observations_to_insert)} observations...", flush=True)

    print(f"\nAll telemetry ingested successfully! Total observations stored: {inserted_obs}")

if __name__ == "__main__":
    run_ingestion()
