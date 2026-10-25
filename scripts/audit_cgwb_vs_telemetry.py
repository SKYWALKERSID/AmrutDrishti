import json

with open('data/derived/verified_cgwb_block_series.json', 'r', encoding='utf-8') as f:
    cgwb = json.load(f)
with open('data/derived/nwdp_block_telemetry_series.json', 'r', encoding='utf-8') as f:
    tel = json.load(f)

same_station = 0
same_counts = 0
same_dates = 0

for k in cgwb:
    c_stn = cgwb[k].get('station_id')
    t_stn = tel[k].get('station_id')
    c_cnt = cgwb[k].get('count')
    t_cnt = tel[k].get('count')
    c_dates = (cgwb[k].get('start_date'), cgwb[k].get('end_date'))
    t_dates = (tel[k].get('start_date'), tel[k].get('end_date'))
    
    if c_stn == t_stn:
        same_station += 1
    if c_cnt == t_cnt:
        same_counts += 1
    if c_dates == t_dates:
        same_dates += 1

print(f"Total blocks: {len(cgwb)}")
print(f"Same station ID: {same_station}")
print(f"Same count: {same_counts}")
print(f"Same start/end dates: {same_dates}")

print("\nSample comparison (first 10 blocks):")
for k in list(cgwb.keys())[:10]:
    c = cgwb[k]
    t = tel[k]
    print(f"Block: {k}")
    print(f"  CGWB: stn={c.get('station_id')} | cnt={c.get('count')} | dates={c.get('start_date')}..{c.get('end_date')}")
    print(f"  TEL : stn={t.get('station_id')} | cnt={t.get('count')} | dates={t.get('start_date')}..{t.get('end_date')} | src={t.get('source_type')}")
