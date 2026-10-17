import os
import requests
import pandas as pd

env = {}
if os.path.exists('.env.local'):
    with open('.env.local', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('\'"')

url = env.get('NEXT_PUBLIC_SUPABASE_URL')
key = env.get('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print("Supabase credentials not available")
    exit(0)

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Prefer': 'count=exact'
}

tables = ['historical_observations', 'dwlr_telemetry', 'monitoring_stations', 'districts', 'blocks']

for t in tables:
    r = requests.get(f"{url}/rest/v1/{t}?select=*&limit=1", headers=headers)
    cr = r.headers.get('content-range', 'unknown')
    print(f"Table '{t}': Content-Range={cr}, Status={r.status_code}")

# Check distinct states in monitoring_stations and historical_observations
r_st = requests.get(f"{url}/rest/v1/monitoring_stations?select=state_name,station_type,id&limit=5000", headers=headers)
if r_st.status_code == 200:
    df_st = pd.DataFrame(r_st.json())
    print("\nMonitoring Stations Breakdown by State and Type:")
    if not df_st.empty and 'state_name' in df_st.columns:
        print(df_st.groupby(['state_name', 'station_type']).size())
    else:
        print("Empty or missing state_name in monitoring_stations")
