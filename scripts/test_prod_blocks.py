import urllib.request
import json

blocks = [
    {"id": "blk_tikamgarh_main", "name": "Tikamgarh", "state": "Madhya Pradesh"},
    {"id": "blk_davanagere_main", "name": "Davanagere", "state": "Karnataka"},
    {"id": "blk_jaipur_amer", "name": "Amer", "state": "Rajasthan"},
    {"id": "blk_adilabad_main", "name": "Adilabad", "state": "Telangana"},
    {"id": "blk_mylliem", "name": "Mylliem", "state": "Meghalaya"},
    {"id": "blk_unknown_nonexistent", "name": "Unavailable Block", "state": "None"}
]

print("=== ACTUAL PRODUCTION API AND OBSERVATION VERIFICATION ===")
for b in blocks:
    bid = b["id"]
    print(f"\n--- {bid} ({b['name']}, {b['state']}) ---")
    url = f"http://localhost:3000/api/historical-observations?block={bid}&limit=50"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            obs = data.get("observations", [])
            print(f"  Source: {data.get('source')}")
            print(f"  Total count: {data.get('totalCount')}, returned: {len(obs)}")
            if obs:
                first = obs[-1]
                latest = obs[0]
                print(f"  Earliest observation: {first.get('observation_date')} ({first.get('water_level_mbgl')} {first.get('unit')})")
                print(f"  Latest observation: {latest.get('observation_date')} ({latest.get('water_level_mbgl')} {latest.get('unit')})")
                print(f"  Station: {latest.get('station_name')} [{latest.get('station_id')}]")
                print(f"  Provider: {latest.get('source_provider')}")
            else:
                print(f"  No database observations returned.")
    except Exception as e:
        print(f"  API Error: {e}")
