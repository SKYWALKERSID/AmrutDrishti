import os
import requests
import json
import collections

env = {}
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('\'"')

url = env['NEXT_PUBLIC_SUPABASE_URL']
key = env['SUPABASE_SERVICE_ROLE_KEY']
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

# Get monitoring_stations count and prefix
r = requests.get(f"{url}/rest/v1/monitoring_stations?select=station_id,is_telemetric,agency&limit=5000", headers=headers)
stations = r.json()
print("Total stations in DB:", len(stations))
c_prefix = collections.Counter('_'.join(s['station_id'].split('_')[:2]) if '_' in s['station_id'] else 'other' for s in stations)
print("Station prefixes:", dict(c_prefix))

c_tele = collections.Counter(s['is_telemetric'] for s in stations)
print("Is telemetric:", dict(c_tele))

# Check administrative_units names
r_adm = requests.get(f"{url}/rest/v1/administrative_units?select=unit_id,unit_level,unit_name,parent_id&limit=50", headers=headers)
print("\nAdministrative units count:", len(r_adm.json()))
for u in r_adm.json():
    print(f"  {u['unit_level']}: {u['unit_name']} (ID: {u['unit_id']})")
