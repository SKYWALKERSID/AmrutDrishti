import os
import requests
import pandas as pd

env = {}
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('\'"')

url = env.get('NEXT_PUBLIC_SUPABASE_URL')
key = env.get('SUPABASE_SERVICE_ROLE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

res = requests.get(f"{url}/rest/v1/v_published_historical_observations?select=station_id,district_name,block_name,observation_date,water_level_mbgl&limit=10000", headers=headers)
data = res.json()
df = pd.DataFrame(data)
df['observation_date'] = pd.to_datetime(df['observation_date'])
print('Total rows from Supabase view:', len(df))
print('Date monthly distribution in Supabase:')
print(df['observation_date'].dt.to_period('M').value_counts().sort_index())
