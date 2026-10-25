import json

with open('data/derived/verified_cgwb_block_series.json', 'r', encoding='utf-8') as f:
    vc = json.load(f)
with open('data/derived/nwdp_block_telemetry_series.json', 'r', encoding='utf-8') as f:
    tb = json.load(f)

print("=== 56 BLOCKS PROVENANCE & DUAL SOURCE INVESTIGATION ===")
same_obs_data = 0
for k in sorted(tb.keys()):
    v = tb[k]
    cg = vc.get(k, {})
    src = v.get('source_type')
    stn_tb = v.get('station_name')
    stn_cg = cg.get('station_id')
    cnt_tb = v.get('count')
    cnt_cg = cg.get('count')
    dates_tb = f"{v.get('start_date')}..{v.get('end_date')}"
    dates_cg = f"{cg.get('start_date')}..{cg.get('end_date')}"
    
    tb_vals = [o.get('depthMbgl') for o in v.get('observations', [])[:3]]
    cg_vals = [o.get('depthMbgl') for o in cg.get('observations', [])[:3]]
    vals_identical = (tb_vals == cg_vals)
    if vals_identical:
        same_obs_data += 1
        
    print(f"{k:32} | src: {src:15} | same_vals: {str(vals_identical):5} | TB: {cnt_tb:2} obs ({dates_tb}) | CG: {cnt_cg:2} obs ({dates_cg})")

print(f"\nTotal blocks with identical observation values: {same_obs_data} / 56")
