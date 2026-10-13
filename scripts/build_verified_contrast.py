import csv
import json
import os

dataset_files = {
    'Punjab': 'data/sources/cgwb_contrast/PB.csv',
    'Rajasthan': 'data/sources/cgwb_contrast/RJ.csv',
    'Haryana': 'data/sources/cgwb_contrast/HR.csv',
    'Assam': 'data/sources/cgwb_contrast/AS.csv',
    'Arunachal Pradesh': 'data/sources/cgwb_contrast/AR.csv'
}

target_blocks_mapping = [
    # Punjab (Over-exploited Red Zones)
    {'state': 'Punjab', 'district': 'Ludhiana', 'block': 'Khanna', 'match_dist': 'LUDHIANA', 'match_blk': 'KHANNA'},
    {'state': 'Punjab', 'district': 'Jalandhar', 'block': 'Phillaur', 'match_dist': 'JALANDHAR', 'match_blk': 'PHILLAUR'},
    {'state': 'Punjab', 'district': 'Amritsar', 'block': 'Majitha', 'match_dist': 'AMRITSAR', 'match_blk': 'MAJITHA'},
    {'state': 'Punjab', 'district': 'Patiala', 'block': 'Patran', 'match_dist': 'PATIALA', 'match_blk': 'PATRAN'},
    
    # Rajasthan (Extreme Over-extraction Arid Basins)
    {'state': 'Rajasthan', 'district': 'Jaipur', 'block': 'Govindgarh', 'match_dist': 'JAIPUR', 'match_blk': 'GOVINDGARH'},
    {'state': 'Rajasthan', 'district': 'Jaipur', 'block': 'Amer', 'match_dist': 'JAIPUR', 'match_blk': 'AMER'},
    {'state': 'Rajasthan', 'district': 'Jaipur', 'block': 'Sanganer', 'match_dist': 'JAIPUR', 'match_blk': 'SANGANER'},
    {'state': 'Rajasthan', 'district': 'Dausa', 'block': 'Bandikui', 'match_dist': 'DAUSA', 'match_blk': 'BANDIKUI'},
    {'state': 'Rajasthan', 'district': 'Dausa', 'block': 'Mahuwa', 'match_dist': 'DAUSA', 'match_blk': 'MAHUWA'},
    {'state': 'Rajasthan', 'district': 'Dausa', 'block': 'Dausa (HQ)', 'match_dist': 'DAUSA', 'match_blk': 'DAUSA'},
    {'state': 'Rajasthan', 'district': 'Sawai Madhopur', 'block': 'Bonli', 'match_dist': 'SAWAI MADHOPUR', 'match_blk': 'BONLI'},
    {'state': 'Rajasthan', 'district': 'Sawai Madhopur', 'block': 'Khandar', 'match_dist': 'SAWAI MADHOPUR', 'match_blk': 'KHANDAR'},
    {'state': 'Rajasthan', 'district': 'Sawai Madhopur', 'block': 'Sawai Madhopur (HQ)', 'match_dist': 'SAWAI MADHOPUR', 'match_blk': 'SAWAI MADHOPUR'},
    {'state': 'Rajasthan', 'district': 'Jodhpur', 'block': 'Mandore', 'match_dist': 'JODHPUR', 'match_blk': 'MANDORE'},
    {'state': 'Rajasthan', 'district': 'Jodhpur', 'block': 'Osian', 'match_dist': 'JODHPUR', 'match_blk': 'OSIAN'},
    {'state': 'Rajasthan', 'district': 'Jaisalmer', 'block': 'Sam', 'match_dist': 'JAISALMER', 'match_blk': 'SAM'},
    
    # Haryana (Critical Alluvial & Hard-Rock Depletion)
    {'state': 'Haryana', 'district': 'Kurukshetra', 'block': 'Pehowa', 'match_dist': 'KURUKSHETRA', 'match_blk': 'PEHOWA'},
    {'state': 'Haryana', 'district': 'Kaithal', 'block': 'Rajound', 'match_dist': 'KAITHAL', 'match_blk': 'RAJOUND'},
    {'state': 'Haryana', 'district': 'Karnal', 'block': 'Assandh', 'match_dist': 'KARNAL', 'match_blk': 'ASSANDH'},
    {'state': 'Haryana', 'district': 'Mahendragarh', 'block': 'Narnaul', 'match_dist': 'MAHENDRAGARH', 'match_blk': 'NARNAUL'},
    {'state': 'Haryana', 'district': 'Mahendragarh', 'block': 'Mahendragarh (HQ)', 'match_dist': 'MAHENDRAGARH', 'match_blk': 'MAHENDARGARH'},
    
    # Assam (Brahmaputra / Barak Alluvial High-Recharge Plains)
    {'state': 'Assam', 'district': 'Kamrup', 'block': 'Hajo', 'match_dist': 'KAMRUP', 'match_blk': 'HAJO'},
    {'state': 'Assam', 'district': 'Kamrup', 'block': 'Boko', 'match_dist': 'KAMRUP', 'match_blk': 'BOKO'},
    {'state': 'Assam', 'district': 'Kamrup', 'block': 'Chhaygaon', 'match_dist': 'KAMRUP', 'match_blk': 'CHHAYGAON'},
    {'state': 'Assam', 'district': 'Dibrugarh', 'block': 'Moran', 'match_dist': 'DIBRUGARH', 'match_blk': 'MORAN'},
    {'state': 'Assam', 'district': 'Dibrugarh', 'block': 'Naharkatiya', 'match_dist': 'DIBRUGARH', 'match_blk': 'NAHARKATIYA'},
    {'state': 'Assam', 'district': 'Sonitpur', 'block': 'Dhekiajuli', 'match_dist': 'SONITPUR', 'match_blk': 'DHEKIAJULI'},
    {'state': 'Assam', 'district': 'Sonitpur', 'block': 'Chariduar (Balipara)', 'match_dist': 'SONITPUR', 'match_blk': 'CHARIDUAR'},
    {'state': 'Assam', 'district': 'Cachar', 'block': 'Sonai', 'match_dist': 'CACHAR', 'match_blk': 'SONAI'},
    {'state': 'Assam', 'district': 'Cachar', 'block': 'Silchar', 'match_dist': 'CACHAR', 'match_blk': 'SILCHAR'},
    
    # Arunachal Pradesh (Eastern Himalayan Foreland Springs & High Aquifer Water Table)
    {'state': 'Arunachal Pradesh', 'district': 'Papum Pare', 'block': 'Yupia / Doimukh', 'match_dist': 'PAPUM PARE', 'match_blk': ''},
    {'state': 'Arunachal Pradesh', 'district': 'Changlang', 'block': 'Miao (Khagam)', 'match_dist': 'CHANGLANG', 'match_blk': 'KHAGAM(MIAO)'},
    {'state': 'Arunachal Pradesh', 'district': 'Changlang', 'block': 'Changlang (HQ)', 'match_dist': 'CHANGLANG', 'match_blk': 'CHANGLANG'},
    {'state': 'Arunachal Pradesh', 'district': 'Lower Subansiri', 'block': 'Ziro Valley', 'match_dist': 'LOWER SUBANSIRI', 'match_blk': ''}
]

extracted = {}

for st_name, file_path in dataset_files.items():
    if not os.path.exists(file_path):
        print(f"Skipping {st_name}, file not found: {file_path}")
        continue
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        header = next(reader)
        val_idx = header.index('Groundwater Level Quarterly Manual (meter)')
        dist_idx = header.index('District')
        blk_idx = header.index('Block')
        lat_idx = header.index('Latitude')
        lng_idx = header.index('Longitude')
        date_idx = header.index('Data Acquisition Time')
        st_idx = header.index('Station')

        for row in reader:
            if len(row) <= max(val_idx, dist_idx, blk_idx, lat_idx, lng_idx, date_idx, st_idx):
                continue
            r_dist = row[dist_idx].strip().upper()
            r_blk = row[blk_idx].strip().upper()
            val_str = row[val_idx].strip()
            if not val_str or val_str == '-' or val_str.lower() == 'null':
                continue
            try:
                val = float(val_str)
            except:
                continue

            for t in target_blocks_mapping:
                if t['state'] != st_name:
                    continue
                if t['match_dist'] not in r_dist:
                    continue
                if t['match_blk'] and t['match_blk'] not in r_blk:
                    continue

                key = f"{t['state']}::{t['district']}::{t['block']}"
                if key not in extracted:
                    extracted[key] = {
                        'state': t['state'],
                        'district': t['district'],
                        'block': t['block'],
                        'depths': [],
                        'dates': [],
                        'stations': set(),
                        'lats': [],
                        'lngs': []
                    }
                extracted[key]['depths'].append(val)
                extracted[key]['dates'].append(row[date_idx].strip())
                extracted[key]['stations'].add(row[st_idx].strip())
                try:
                    lat_f = float(row[lat_idx])
                    lng_f = float(row[lng_idx])
                    if 8.0 < lat_f < 37.0 and 68.0 < lng_f < 98.0:
                        extracted[key]['lats'].append(lat_f)
                        extracted[key]['lngs'].append(lng_f)
                except:
                    pass

print(f"Total blocks successfully matched with empirical data: {len(extracted)}")
summary_records = {}
for k, v in extracted.items():
    depths = sorted(v['depths'])
    n = len(depths)
    med = round(depths[n//2], 2)
    mean = round(sum(depths)/n, 2)
    p10 = round(depths[int(n*0.1)], 2)
    p90 = round(depths[int(n*0.9)], 2)
    min_d = round(depths[0], 2)
    max_d = round(depths[-1], 2)
    avg_lat = round(sum(v['lats'])/len(v['lats']), 4) if v['lats'] else None
    avg_lng = round(sum(v['lngs'])/len(v['lngs']), 4) if v['lngs'] else None
    latest_date = sorted(v['dates'])[-1] if v['dates'] else None
    stations = sorted(list(v['stations']))
    
    summary_records[k] = {
        'state': v['state'],
        'district': v['district'],
        'block': v['block'],
        'observation_count': n,
        'station_count': len(stations),
        'median_depth_mbgl': med,
        'mean_depth_mbgl': mean,
        'p10_depth_mbgl': p10,
        'p90_depth_mbgl': p90,
        'min_depth_mbgl': min_d,
        'max_depth_mbgl': max_d,
        'avg_lat': avg_lat,
        'avg_lng': avg_lng,
        'latest_date': latest_date,
        'sample_stations': stations[:5]
    }
    print(f"{k}: {n} obs, {len(stations)} stations | med={med}m, mean={mean}m, range=[{min_d}-{max_d}]m | coords=({avg_lat}, {avg_lng}) | latest={latest_date}")

with open('scripts/cgwb_verified_contrast_data.json', 'w', encoding='utf-8') as out:
    json.dump(summary_records, out, indent=2)

print("\nSuccessfully saved verified contrast data to scripts/cgwb_verified_contrast_data.json")
