import urllib.request
import csv
import io
import json

STATE_URLS = {
    'PUNJAB': 'https://nwdp.nwic.gov.in/dataset/956add67-cba9-41a5-9d5c-96d73db44aef/resource/862305d4-0384-4af2-9dca-122e6db0a1c2/download/gwl_manual_quarterly_cgwb_pb_2021_2025.csv',
    'RAJASTHAN': 'https://nwdp.nwic.gov.in/dataset/956add67-cba9-41a5-9d5c-96d73db44aef/resource/8111c3ef-5dc3-4aa9-9f37-f4f13d6099d5/download/gwl_manual_quarterly_cgwb_rj_2021_2025.csv',
    'HARYANA': 'https://nwdp.nwic.gov.in/dataset/956add67-cba9-41a5-9d5c-96d73db44aef/resource/62fe9597-ddd1-4372-a7f5-bd62481beab3/download/gwl_manual_quarterly_cgwb_hr_2021_2025.csv',
    'ASSAM': 'https://nwdp.nwic.gov.in/dataset/956add67-cba9-41a5-9d5c-96d73db44aef/resource/7e054f9d-8161-455b-8c09-8a918e32f5ac/download/gwl_manual_quarterly_cgwb_as_2021_2025.csv',
    'ARUNACHAL': 'https://nwdp.nwic.gov.in/dataset/956add67-cba9-41a5-9d5c-96d73db44aef/resource/721a9ff5-cd1b-470c-875b-a381e1306392/download/gwl_manual_quarterly_cgwb_ar_2021_2025.csv'
}

TARGET_BLOCKS = {
    'PUNJAB': ['KHANNA', 'PHILLAUR', 'MAJITHA', 'PATRAN'],
    'RAJASTHAN': ['LALSOT', 'BANDIKUI', 'SIKRAI', 'MAHUWA', 'BONLI', 'KHANDAR', 'BARWARA', 'MANDORE', 'OSIAN', 'SAM', 'AMER', 'GOVINDGARH', 'SANGANER'],
    'HARYANA': ['PEHOWA', 'RAJOUR', 'ASSANDH', 'KANINA'],
    'ASSAM': ['BOKO', 'CHAYGAON', 'HAJO', 'BARBARUAH', 'TINGKHONG', 'JOYPUR', 'BALIPARA', 'GABHARU', 'DHEKIAJULI', 'LAKHIPUR', 'SONAI'],
    'ARUNACHAL': ['YUPIA', 'DOIMUKH', 'SAGALEE', 'MIAO', 'JAIRAMPUR', 'BORDUMSA', 'ZIRO', 'YACHULI', 'CHANGLANG', 'PAPUM PARE']
}

req_headers = {'User-Agent': 'Mozilla/5.0'}
block_stats = {}

for state, url in STATE_URLS.items():
    print(f"Streaming {state}...")
    req = urllib.request.Request(url, headers=req_headers)
    targets = TARGET_BLOCKS.get(state, [])
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            reader = csv.reader(io.TextIOWrapper(resp, encoding='utf-8', errors='ignore'))
            header = next(reader)
            val_idx = header.index('Groundwater Level Quarterly Manual (meter)')
            dist_idx = header.index('District')
            blk_idx = header.index('Block')
            lat_idx = header.index('Latitude')
            lng_idx = header.index('Longitude')
            date_idx = header.index('Data Acquisition Time')
            st_idx = header.index('Station')

            for row in reader:
                blk = row[blk_idx].strip().upper()
                dist = row[dist_idx].strip().upper()
                matched_target = None
                for t in targets:
                    if t in blk or blk in t:
                        matched_target = t
                        break
                if not matched_target:
                    for t in targets:
                        if t in dist:
                            matched_target = t
                            break

                if matched_target:
                    v = row[val_idx].strip()
                    if v and v != '-' and v.lower() != 'null':
                        try:
                            fv = float(v)
                            key = f"{state}::{matched_target}"
                            if key not in block_stats:
                                block_stats[key] = {
                                    'state': state,
                                    'block': matched_target,
                                    'district': dist,
                                    'depths': [],
                                    'dates': [],
                                    'lats': [],
                                    'lngs': [],
                                    'stations': set()
                                }
                            block_stats[key]['depths'].append(fv)
                            block_stats[key]['dates'].append(row[date_idx].strip())
                            block_stats[key]['stations'].add(row[st_idx].strip())
                            if row[lat_idx].strip() and row[lng_idx].strip():
                                try:
                                    block_stats[key]['lats'].append(float(row[lat_idx]))
                                    block_stats[key]['lngs'].append(float(row[lng_idx]))
                                except:
                                    pass
                        except:
                            pass
    except Exception as e:
        print(f"Error reading {state}: {e}")

output_summary = {}
for k, v in block_stats.items():
    depths = v['depths']
    depths.sort()
    med = round(depths[len(depths)//2], 2) if depths else 0
    mean = round(sum(depths)/len(depths), 2) if depths else 0
    min_d = round(depths[0], 2) if depths else 0
    max_d = round(depths[-1], 2) if depths else 0
    avg_lat = round(sum(v['lats'])/len(v['lats']), 4) if v['lats'] else 0
    avg_lng = round(sum(v['lngs'])/len(v['lngs']), 4) if v['lngs'] else 0
    latest_date = sorted(v['dates'])[-1] if v['dates'] else ''
    output_summary[k] = {
        'state': v['state'],
        'block': v['block'],
        'district': v['district'],
        'obs_count': len(depths),
        'well_count': len(v['stations']),
        'median_depth_mbgl': med,
        'mean_depth_mbgl': mean,
        'min_depth_mbgl': min_d,
        'max_depth_mbgl': max_d,
        'avg_lat': avg_lat,
        'avg_lng': avg_lng,
        'latest_observation_date': latest_date
    }
    print(f"{k}: obs={len(depths)}, wells={len(v['stations'])}, median={med}m, mean={mean}m, range=[{min_d}, {max_d}], lat={avg_lat}, lng={avg_lng}")

with open('scripts/extracted_cgwb_real_stats.json', 'w', encoding='utf-8') as f:
    json.dump(output_summary, f, indent=2)

print("\nSaved extracted empirical stats to scripts/extracted_cgwb_real_stats.json")
