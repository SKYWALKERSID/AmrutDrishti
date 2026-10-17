import os
import glob
import pandas as pd
import numpy as np

STATES_AUDIT = [
    {'name': 'Arunachal Pradesh', 'file': 'data/sources/cgwb_contrast/AR.csv'},
    {'name': 'Assam', 'file': 'data/sources/cgwb_contrast/AS.csv'},
    {'name': 'Haryana', 'file': 'data/sources/cgwb_contrast/HR.csv'},
    {'name': 'Madhya Pradesh', 'file': 'data/sources/cgwb_mp_cleaned_proper.csv'},
    {'name': 'Punjab', 'file': 'data/sources/cgwb_contrast/PB.csv'},
    {'name': 'Rajasthan', 'file': 'data/sources/cgwb_contrast/RJ.csv'},
    {'name': 'Sikkim', 'file': 'data/sources/cgwb_contrast/SK.csv'},
    {'name': 'Uttar Pradesh', 'file': 'data/sources/cgwb_contrast/UP.csv'},
]

print("=" * 90)
print("JAL DRISHTI — 8-STATE DATA COVERAGE & QUALITY AUDIT")
print("=" * 90)

audit_results = []

for st in STATES_AUDIT:
    name = st['name']
    path = st['file']
    
    if not os.path.exists(path):
        audit_results.append({
            'State': name,
            'Status': 'INSUFFICIENT_DATA',
            'Source Provenance': 'Not Ingested in Local Repository',
            'Stations': 0,
            'Records': 0,
            'Date Range': 'None',
            'Missing %': 100.0,
            'Usable 1Q Pairs': 0,
            'Usable 4Q Pairs': 0
        })
        continue
        
    df = pd.read_csv(path, low_memory=False)
    
    # Columns
    st_col = 'Station'
    date_col = 'Data Acquisition Time'
    val_col = 'Groundwater Level Quarterly Manual (meter)'
    dist_col = 'District'
    blk_col = 'Block'
    
    df['parsed_date'] = pd.to_datetime(df[date_col], errors='coerce', dayfirst=True)
    df['parsed_val'] = pd.to_numeric(df[val_col], errors='coerce')
    
    valid_mask = (df['parsed_val'] >= 0.0) & (df['parsed_val'] <= 150.0)
    valid_df = df[valid_mask].dropna(subset=['parsed_date', st_col]).sort_values(by=[st_col, 'parsed_date'])
    
    total_rows = len(df)
    missing_pct = round((1.0 - (len(valid_df) / total_rows)) * 100.0, 2)
    
    stations = valid_df[st_col].nunique()
    min_date = valid_df['parsed_date'].min().strftime('%Y-%m-%d')
    max_date = valid_df['parsed_date'].max().strftime('%Y-%m-%d')
    
    # Calculate usable pairs (h1: 45-135 days, h4: 315-415 days) within each station
    h1_count = 0
    h4_count = 0
    
    for _, g in valid_df.groupby(st_col):
        dates = g['parsed_date'].values
        n = len(dates)
        if n < 2:
            continue
        for i in range(n):
            d0 = dates[i]
            for j in range(i + 1, n):
                diff = (dates[j] - d0) / np.timedelta64(1, 'D')
                if 45 <= diff <= 135:
                    h1_count += 1
                elif 315 <= diff <= 415:
                    h4_count += 1
                elif diff > 415:
                    break
                    
    audit_results.append({
        'State': name,
        'Status': 'VERIFIED' if h1_count > 50 else 'INSUFFICIENT_TEMPORAL_PAIRS',
        'Source Provenance': 'CGWB / NWIC National Hydrograph Network',
        'Stations': stations,
        'Records': total_rows,
        'Date Range': f"{min_date} to {max_date}",
        'Missing %': missing_pct,
        'Usable 1Q Pairs': h1_count,
        'Usable 4Q Pairs': h4_count
    })

res_df = pd.DataFrame(audit_results)
print(res_df.to_string(index=False))
