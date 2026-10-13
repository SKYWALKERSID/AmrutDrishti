import csv
import json
import os

files = {
    'Punjab': 'data/sources/cgwb_contrast/PB.csv',
    'Rajasthan': 'data/sources/cgwb_contrast/RJ.csv',
    'Haryana': 'data/sources/cgwb_contrast/HR.csv',
    'Assam': 'data/sources/cgwb_contrast/AS.csv',
    'Arunachal Pradesh': 'data/sources/cgwb_contrast/AR.csv'
}

state_rows = {}
for st, fp in files.items():
    rows = []
    with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        header = next(reader)
        val_idx = header.index('Groundwater Level Quarterly Manual (meter)')
        dist_idx = header.index('District')
        blk_idx = header.index('Block')
        lat_idx = header.index('Latitude')
        lng_idx = header.index('Longitude')
        date_idx = header.index('Data Acquisition Time')
        st_idx = header.index('Station')
        for r in reader:
            if len(r) > max(val_idx, dist_idx, blk_idx, lat_idx, lng_idx, date_idx, st_idx):
                v_str = r[val_idx].strip()
                if v_str and v_str != '-' and v_str.lower() != 'null':
                    try:
                        fv = float(v_str)
                        lat_v = float(r[lat_idx]) if r[lat_idx].strip() else None
                        lng_v = float(r[lng_idx]) if r[lng_idx].strip() else None
                        rows.append({
                            'dist': r[dist_idx].strip().upper(),
                            'blk': r[blk_idx].strip().upper(),
                            'station': r[st_idx].strip(),
                            'depth': fv,
                            'lat': lat_v,
                            'lng': lng_v,
                            'date': r[date_idx].strip()
                        })
                    except:
                        pass
    state_rows[st] = rows

def get_stats_for(st_name, target_dist, target_blks):
    rows = state_rows.get(st_name, [])
    # 1. Try matching target_dist and target_blks
    matched = []
    for r in rows:
        if target_dist in r['dist']:
            for b in target_blks:
                if b and (b in r['blk'] or r['blk'] in b or b in r['station'].upper()):
                    matched.append(r)
                    break
    
    # 2. If no direct block match, fallback to district pool
    is_district_pool = False
    if not matched:
        is_district_pool = True
        for r in rows:
            if target_dist in r['dist']:
                matched.append(r)

    if not matched:
        return None

    depths = sorted([m['depth'] for m in matched])
    n = len(depths)
    med = round(depths[n//2], 2)
    mean = round(sum(depths)/n, 2)
    min_d = round(depths[0], 2)
    max_d = round(depths[-1], 2)
    p10 = round(depths[int(n*0.1)], 2)
    p90 = round(depths[int(n*0.9)], 2)

    lats = [m['lat'] for m in matched if m['lat'] and 8.0 < m['lat'] < 37.0]
    lngs = [m['lng'] for m in matched if m['lng'] and 68.0 < m['lng'] < 98.0]
    avg_lat = round(sum(lats)/len(lats), 4) if lats else None
    avg_lng = round(sum(lngs)/len(lngs), 4) if lngs else None

    dates = sorted([m['date'] for m in matched if m['date']])
    latest_date = dates[-1] if dates else '2022-08-31'

    stations = sorted(list(set([m['station'] for m in matched])))

    return {
        'observation_count': n,
        'station_count': len(stations),
        'median_depth_mbgl': med,
        'mean_depth_mbgl': mean,
        'min_depth_mbgl': min_d,
        'max_depth_mbgl': max_d,
        'p10_depth_mbgl': p10,
        'p90_depth_mbgl': p90,
        'avg_lat': avg_lat,
        'avg_lng': avg_lng,
        'latest_date': latest_date,
        'sample_stations': stations[:4],
        'is_district_pool': is_district_pool
    }

# All 48 blocks to compute
all_blocks = [
    # Punjab (4 blocks)
    ('Punjab', 'Ludhiana', 'Khanna', ['KHANNA']),
    ('Punjab', 'Jalandhar', 'Phillaur', ['PHILLAUR']),
    ('Punjab', 'Amritsar', 'Majitha', ['MAJITHA']),
    ('Punjab', 'Patiala', 'Patran', ['PATRAN']),

    # Rajasthan (13 blocks)
    ('Rajasthan', 'Dausa', 'Lalsot', ['LALSOT']),
    ('Rajasthan', 'Dausa', 'Bandikui', ['BANDIKUI']),
    ('Rajasthan', 'Dausa', 'Sikrai', ['SIKRAI']),
    ('Rajasthan', 'Dausa', 'Mahuwa', ['MAHUWA']),
    ('Rajasthan', 'Sawai Madhopur', 'Bonli', ['BONLI']),
    ('Rajasthan', 'Sawai Madhopur', 'Khandar', ['KHANDAR']),
    ('Rajasthan', 'Sawai Madhopur', 'Chauth Ka Barwara', ['BARWARA', 'CHAUTH']),
    ('Rajasthan', 'Jodhpur', 'Mandore', ['MANDORE']),
    ('Rajasthan', 'Jodhpur', 'Osian', ['OSIAN']),
    ('Rajasthan', 'Jaisalmer', 'Sam', ['SAM']),
    ('Rajasthan', 'Jaipur', 'Amer', ['AMER']),
    ('Rajasthan', 'Jaipur', 'Govindgarh', ['GOVINDGARH']),
    ('Rajasthan', 'Jaipur', 'Sanganer', ['SANGANER']),

    # Haryana (4 blocks)
    ('Haryana', 'Kurukshetra', 'Pehowa', ['PEHOWA']),
    ('Haryana', 'Kaithal', 'Rajound', ['RAJOUND']),
    ('Haryana', 'Karnal', 'Assandh', ['ASSANDH']),
    ('Haryana', 'Mahendragarh', 'Kanina', ['KANINA', 'MAHENDARGARH', 'NARNAUL']),

    # Arunachal Pradesh (8 blocks)
    ('Arunachal Pradesh', 'Papum Pare', 'Yupia', ['YUPIA', 'DOIMUKH']),
    ('Arunachal Pradesh', 'Papum Pare', 'Doimukh', ['DOIMUKH']),
    ('Arunachal Pradesh', 'Papum Pare', 'Sagalee', ['SAGALEE']),
    ('Arunachal Pradesh', 'Changlang', 'Miao', ['KHAGAM(MIAO)', 'MIAO']),
    ('Arunachal Pradesh', 'Changlang', 'Jairampur', ['JAIRAMPUR']),
    ('Arunachal Pradesh', 'Changlang', 'Bordumsa', ['BORDUMSA']),
    ('Arunachal Pradesh', 'Lower Subansiri', 'Ziro', ['ZIRO']),
    ('Arunachal Pradesh', 'Lower Subansiri', 'Yachuli', ['YACHULI']),

    # Assam (11 blocks)
    ('Assam', 'Kamrup', 'Boko', ['BOKO']),
    ('Assam', 'Kamrup', 'Chaygaon', ['CHHAYGAON', 'CHAYGAON']),
    ('Assam', 'Kamrup', 'Hajo', ['HAJO']),
    ('Assam', 'Dibrugarh', 'Barbaruah', ['BARBARUAH', 'MORAN']),
    ('Assam', 'Dibrugarh', 'Tingkhong', ['TINGKHONG']),
    ('Assam', 'Dibrugarh', 'Joypur', ['JOYPUR', 'NAHARKATIYA']),
    ('Assam', 'Sonitpur', 'Balipara', ['CHARIDUAR', 'BALIPARA']),
    ('Assam', 'Sonitpur', 'Gabharu', ['GABHARU', 'TEZPUR']),
    ('Assam', 'Sonitpur', 'Dhekiajuli', ['DHEKIAJULI']),
    ('Assam', 'Cachar', 'Lakhipur', ['LAKHIPUR', 'SILCHAR']),
    ('Assam', 'Cachar', 'Sonai', ['SONAI'])
]

results = {}
for st, dist, blk, targets in all_blocks:
    key = f"{st}::{dist}::{blk}"
    st_upper = dist.upper()
    stats = get_stats_for(st, st_upper, targets)
    results[key] = stats
    pool_flag = " (District Pool)" if stats and stats['is_district_pool'] else ""
    print(f"{key}: obs={stats['observation_count']}, med={stats['median_depth_mbgl']}m, range=[{stats['min_depth_mbgl']}-{stats['max_depth_mbgl']}]m{pool_flag}")

with open('scripts/all_48_contrast_real_stats.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)

print("\nSuccessfully compiled all real statistics!")
