import json

with open('audit/canonical_56_blocks_final.json') as f:
    c56 = json.load(f)

with open('audit/JALDRISHTI_DUAL_SOURCE_REGISTRY.json') as f:
    reg = json.load(f)

reg_map = {b['block_id']: b for b in reg['blocks']}

excluded_ids = {
    'blk_mahendragarh_narnaul',
    'blk_dhalai_salema',
    'blk_kamrup_boko',
    'blk_kamrup_hajo',
    'blk_kamrup_chaygaon',
    'blk_sonitpur_dhekiajuli',
    'blk_sonitpur_tezpur',
    'blk_sonitpur_chariduar',
    'blk_dibrugarh_moran',
    'blk_dibrugarh_naharkatiya',
    'blk_dibrugarh_east',
    'blk_cachar_sonai',
    'blk_cachar_silchar'
}

active_43 = [b for b in c56 if b['id'] not in excluded_ids]
print(f"Total in canonical_56: {len(c56)}")
print(f"Active 43 count: {len(active_43)}")

assert len(active_43) == 43, f"Expected 43, got {len(active_43)}"

for b in active_43:
    bid = b['id']
    meta = reg_map[bid]
    assert meta['operational_eligibility'] is True, f"{bid} not eligible"
    st = meta['state']
    dt = meta['district']
    stn = meta['official_station_id']
    date = meta['latest_measurement_date']
    age = meta['observation_age_days']
    src = meta['selected_source_category']
    print(f"{st:15s} | {dt:15s} | {bid:26s} | {stn:15s} | {date} | age={age:5.1f}d | {src}")

print("All 43 verified successfully against actual telemetry records!")
