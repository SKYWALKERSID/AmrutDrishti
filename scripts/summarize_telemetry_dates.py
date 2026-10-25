import json

with open('data/derived/nwdp_block_telemetry_series.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

states = sorted(list(set(v['state'] for v in data.values())))
for st in states:
    blks = [v for v in data.values() if v['state'] == st]
    min_date = min(b['start_date'] for b in blks)
    max_date = max(b['end_date'] for b in blks)
    print(f"{st:15s}: {len(blks):2d} blocks | {min_date} to {max_date}")
