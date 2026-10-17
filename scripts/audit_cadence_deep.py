"""
Exhaustive Cadence and Temporal Gap Distribution Audit for 8 States.
Analyzes:
- Exact time gap percentiles between consecutive readings per station
- Usable 1-month (20-40d), 3-month (45-135d), and 12-month (315-415d) pairs
- Observed calendar months vs total possible calendar months (missing-month rate)
- Measurement method (manual vs telemetric)
"""
import os
import sys
import numpy as np
import pandas as pd
import requests

sys.path.insert(0, os.path.abspath('.'))

DATASETS = [
    {
        'state': 'Arunachal Pradesh',
        'file': 'data/sources/cgwb_contrast/AR.csv',
        'method': 'Manual Piezometer',
        'source': 'CGWB National Hydrograph Network via NWIC'
    },
    {
        'state': 'Assam',
        'file': 'data/sources/cgwb_contrast/AS.csv',
        'method': 'Manual Piezometer',
        'source': 'CGWB National Hydrograph Network via NWIC'
    },
    {
        'state': 'Haryana',
        'file': 'data/sources/cgwb_contrast/HR.csv',
        'method': 'Manual Piezometer',
        'source': 'CGWB National Hydrograph Network via NWIC'
    },
    {
        'state': 'Madhya Pradesh (Manual)',
        'file': 'data/sources/cgwb_mp_cleaned_proper.csv',
        'method': 'Manual Dug/Tube Well',
        'source': 'CGWB Regional Directorate, Bhopal'
    },
    {
        'state': 'Punjab',
        'file': 'data/sources/cgwb_contrast/PB.csv',
        'method': 'Manual Piezometer',
        'source': 'CGWB National Hydrograph Network via NWIC'
    },
    {
        'state': 'Rajasthan',
        'file': 'data/sources/cgwb_contrast/RJ.csv',
        'method': 'Manual Piezometer',
        'source': 'CGWB National Hydrograph Network via NWIC'
    },
    {
        'state': 'Sikkim',
        'file': 'data/sources/cgwb_contrast/SK.csv',
        'method': 'Springshed Discharge',
        'source': 'None in repository'
    },
    {
        'state': 'Uttar Pradesh',
        'file': 'data/sources/cgwb_contrast/UP.csv',
        'method': 'Manual Piezometer',
        'source': 'None in repository'
    }
]

def analyze_dataset(ds):
    path = ds['file']
    state = ds['state']
    
    if not os.path.exists(path):
        return {
            'State': state,
            'Method': ds['method'],
            'Source': ds['source'],
            'Stations': 0,
            'Valid Obs': 0,
            'Date Min': 'N/A',
            'Date Max': 'N/A',
            'Total Span Months': 0,
            'Active Months': 0,
            'Missing Month %': 100.0,
            'Gap Median (d)': np.nan,
            'Gap P25 (d)': np.nan,
            'Gap P75 (d)': np.nan,
            'Pairs 1M (20-40d)': 0,
            'Pairs 3M (45-135d)': 0,
            'Pairs 12M (315-415d)': 0,
            'Actual Cadence': 'No Data',
            'Supports Monthly': False,
            'Supports Quarterly': False,
            'Supports Annual': False
        }
        
    df = pd.read_csv(path, low_memory=False)
    st_col = 'Station' if 'Station' in df.columns else 'station_id'
    dt_col = 'Data Acquisition Time' if 'Data Acquisition Time' in df.columns else 'observation_date'
    vl_col = 'Groundwater Level Quarterly Manual (meter)' if 'Groundwater Level Quarterly Manual (meter)' in df.columns else 'water_level_mbgl'
    
    parsed_date = pd.to_datetime(df[dt_col], errors='coerce', dayfirst=True)
    parsed_val = pd.to_numeric(df[vl_col], errors='coerce')
    
    valid_mask = (parsed_val >= 0.0) & (parsed_val <= 150.0) & parsed_date.notnull() & df[st_col].notnull()
    valid_df = df[valid_mask].copy()
    valid_df['dt'] = parsed_date[valid_mask]
    valid_df['val'] = parsed_val[valid_mask]
    valid_df['st'] = df[st_col][valid_mask].astype(str).str.strip()
    
    # Deduplicate same station, same date
    clean = valid_df.groupby(['st', 'dt'])['val'].mean().reset_index().sort_values(['st', 'dt'])
    
    stations = clean['st'].nunique()
    valid_obs = len(clean)
    min_date = clean['dt'].min()
    max_date = clean['dt'].max()
    
    # Calculate span in months
    all_months = pd.date_range(min_date.replace(day=1), max_date.replace(day=1), freq='MS')
    active_months = clean['dt'].dt.to_period('M').nunique()
    total_span_months = len(all_months)
    missing_month_pct = round((1.0 - (active_months / total_span_months)) * 100.0, 1) if total_span_months > 0 else 100.0
    
    # Consecutive gap analysis
    consec_gaps = []
    pairs_1m = 0
    pairs_3m = 0
    pairs_12m = 0
    
    for _, g in clean.groupby('st'):
        d_vals = g['dt'].values
        n = len(d_vals)
        if n < 2:
            continue
        for k in range(n - 1):
            diff = (d_vals[k+1] - d_vals[k]) / np.timedelta64(1, 'D')
            consec_gaps.append(diff)
            
        for i in range(n):
            d0 = d_vals[i]
            for j in range(i + 1, n):
                diff = (d_vals[j] - d0) / np.timedelta64(1, 'D')
                if 20 <= diff <= 40:
                    pairs_1m += 1
                elif 45 <= diff <= 135:
                    pairs_3m += 1
                elif 315 <= diff <= 415:
                    pairs_12m += 1
                elif diff > 415:
                    break
                    
    med_gap = round(float(np.median(consec_gaps)), 1) if consec_gaps else np.nan
    p25_gap = round(float(np.percentile(consec_gaps, 25)), 1) if consec_gaps else np.nan
    p75_gap = round(float(np.percentile(consec_gaps, 75)), 1) if consec_gaps else np.nan
    
    if med_gap <= 40:
        cadence = f"Monthly (med={med_gap:.0f}d)"
    elif 60 <= med_gap <= 120:
        cadence = f"Quarterly (med={med_gap:.0f}d)"
    elif med_gap >= 300:
        cadence = f"Annual (med={med_gap:.0f}d)"
    else:
        cadence = f"Irregular (med={med_gap:.0f}d)"
        
    return {
        'State': state,
        'Method': ds['method'],
        'Source': ds['source'],
        'Stations': stations,
        'Valid Obs': valid_obs,
        'Date Min': min_date.strftime('%Y-%m-%d'),
        'Date Max': max_date.strftime('%Y-%m-%d'),
        'Total Span Months': total_span_months,
        'Active Months': active_months,
        'Missing Month %': missing_month_pct,
        'Gap Median (d)': med_gap,
        'Gap P25 (d)': p25_gap,
        'Gap P75 (d)': p75_gap,
        'Pairs 1M (20-40d)': pairs_1m,
        'Pairs 3M (45-135d)': pairs_3m,
        'Pairs 12M (315-415d)': pairs_12m,
        'Actual Cadence': cadence,
        'Supports Monthly': pairs_1m >= 100,
        'Supports Quarterly': pairs_3m >= 100,
        'Supports Annual': pairs_12m >= 100
    }

def analyze_mp_telemetry():
    env = {}
    if os.path.exists('.env.local'):
        with open('.env.local', 'r', encoding='utf-8') as f:
            for l in f:
                if '=' in l and not l.strip().startswith('#'):
                    k, v = l.strip().split('=', 1)
                    env[k.strip()] = v.strip().strip('\'"')
    url = env.get('NEXT_PUBLIC_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        return None
    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    r = requests.get(f"{url}/rest/v1/station_observations?select=station_id,observation_date,water_level_mbgl&limit=10000", headers=headers)
    if r.status_code != 200:
        return None
    df = pd.DataFrame(r.json())
    df['dt'] = pd.to_datetime(df['observation_date'])
    df['val'] = pd.to_numeric(df['water_level_mbgl'], errors='coerce')
    clean = df.dropna(subset=['station_id', 'dt', 'val']).sort_values(['station_id', 'dt'])
    
    stations = clean['station_id'].nunique()
    valid_obs = len(clean)
    min_date = clean['dt'].min()
    max_date = clean['dt'].max()
    
    all_months = pd.date_range(min_date.replace(day=1), max_date.replace(day=1), freq='MS')
    active_months = clean['dt'].dt.to_period('M').nunique()
    total_span_months = len(all_months)
    missing_month_pct = round((1.0 - (active_months / total_span_months)) * 100.0, 1)
    
    consec_gaps = []
    pairs_1m = 0
    pairs_3m = 0
    pairs_12m = 0
    
    for _, g in clean.groupby('station_id'):
        d_vals = g['dt'].values
        n = len(d_vals)
        if n < 2:
            continue
        for k in range(n - 1):
            consec_gaps.append((d_vals[k+1] - d_vals[k]) / np.timedelta64(1, 'D'))
        for i in range(n):
            d0 = d_vals[i]
            for j in range(i + 1, n):
                diff = (d_vals[j] - d0) / np.timedelta64(1, 'D')
                if 20 <= diff <= 40:
                    pairs_1m += 1
                elif 45 <= diff <= 135:
                    pairs_3m += 1
                elif 315 <= diff <= 415:
                    pairs_12m += 1
                elif diff > 415:
                    break
                    
    med_gap = round(float(np.median(consec_gaps)), 1) if consec_gaps else np.nan
    p25_gap = round(float(np.percentile(consec_gaps, 25)), 1) if consec_gaps else np.nan
    p75_gap = round(float(np.percentile(consec_gaps, 75)), 1) if consec_gaps else np.nan
    
    return {
        'State': 'Madhya Pradesh (DWLR Telemetry)',
        'Method': 'Automated DWLR Telemetry',
        'Source': 'NWIC National Water Data Portal (6-hourly aggregated to monthly)',
        'Stations': stations,
        'Valid Obs': valid_obs,
        'Date Min': min_date.strftime('%Y-%m-%d'),
        'Date Max': max_date.strftime('%Y-%m-%d'),
        'Total Span Months': total_span_months,
        'Active Months': active_months,
        'Missing Month %': missing_month_pct,
        'Gap Median (d)': med_gap,
        'Gap P25 (d)': p25_gap,
        'Gap P75 (d)': p75_gap,
        'Pairs 1M (20-40d)': pairs_1m,
        'Pairs 3M (45-135d)': pairs_3m,
        'Pairs 12M (315-415d)': pairs_12m,
        'Actual Cadence': f"Monthly (med={med_gap:.0f}d)",
        'Supports Monthly': pairs_1m >= 100,
        'Supports Quarterly': pairs_3m >= 100,
        'Supports Annual': pairs_12m >= 100
    }

if __name__ == '__main__':
    rows = [analyze_dataset(ds) for ds in DATASETS]
    mp_tel = analyze_mp_telemetry()
    if mp_tel:
        rows.append(mp_tel)
    df_res = pd.DataFrame(rows)
    print(df_res[['State', 'Method', 'Stations', 'Valid Obs', 'Actual Cadence', 'Gap Median (d)', 'Pairs 1M (20-40d)', 'Pairs 3M (45-135d)', 'Pairs 12M (315-415d)', 'Supports Monthly', 'Supports Quarterly']].to_string(index=False))
    os.makedirs('audit', exist_ok=True)
    df_res.to_csv('audit/eight_states_cadence_audit.csv', index=False)
