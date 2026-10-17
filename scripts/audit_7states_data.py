import os
import glob
import pandas as pd
import numpy as np

STATES_CONFIG = {
    'Madhya Pradesh': {
        'files': ['data/sources/cgwb_mp_cleaned_proper.csv', 'data/sources/cgwb_cleaned_processed.csv'],
        'date_col': 'Data Acquisition Time',
        'val_col': 'Groundwater Level Quarterly Manual (meter)',
        'st_col': 'Station',
        'dist_col': 'District',
        'blk_col': 'Block'
    },
    'Punjab': {
        'files': ['data/sources/cgwb_contrast/PB.csv'],
        'date_col': 'Data Acquisition Time',
        'val_col': 'Groundwater Level Quarterly Manual (meter)',
        'st_col': 'Station',
        'dist_col': 'District',
        'blk_col': 'Block'
    },
    'Haryana': {
        'files': ['data/sources/cgwb_contrast/HR.csv'],
        'date_col': 'Data Acquisition Time',
        'val_col': 'Groundwater Level Quarterly Manual (meter)',
        'st_col': 'Station',
        'dist_col': 'District',
        'blk_col': 'Block'
    },
    'Rajasthan': {
        'files': ['data/sources/cgwb_contrast/RJ.csv'],
        'date_col': 'Data Acquisition Time',
        'val_col': 'Groundwater Level Quarterly Manual (meter)',
        'st_col': 'Station',
        'dist_col': 'District',
        'blk_col': 'Block'
    },
    'Assam': {
        'files': ['data/sources/cgwb_contrast/AS.csv'],
        'date_col': 'Data Acquisition Time',
        'val_col': 'Groundwater Level Quarterly Manual (meter)',
        'st_col': 'Station',
        'dist_col': 'District',
        'blk_col': 'Block'
    },
    'Sikkim': {
        'files': ['data/sources/cgwb_contrast/SK.csv'],
        'date_col': 'Data Acquisition Time',
        'val_col': 'Groundwater Level Quarterly Manual (meter)',
        'st_col': 'Station',
        'dist_col': 'District',
        'blk_col': 'Block'
    },
    'Meghalaya': {
        'files': ['data/sources/cgwb_contrast/ML.csv'],
        'date_col': 'Data Acquisition Time',
        'val_col': 'Groundwater Level Quarterly Manual (meter)',
        'st_col': 'Station',
        'dist_col': 'District',
        'blk_col': 'Block'
    }
}

print("=" * 80)
print("JAL DRISHTI — GROUNDWATER OBSERVATION DATA COVERAGE AUDIT (7 STATES)")
print("=" * 80)

summary = []

for state, cfg in STATES_CONFIG.items():
    found_file = None
    for f in cfg['files']:
        if os.path.exists(f):
            found_file = f
            break
            
    if not found_file:
        summary.append({
            'state': state,
            'status': 'NO DATA FILE (Pending Ingestion)',
            'file': None,
            'rows': 0,
            'stations': 0,
            'districts': 0,
            'blocks': 0,
            'min_date': None,
            'max_date': None,
            'missing_val_pct': 100.0,
            'median_mbgl': None,
            'usable_lag_targets': 0
        })
        continue

    try:
        df = pd.read_csv(found_file, low_memory=False)
        total_rows = len(df)
        
        # Parse dates
        dates = pd.to_datetime(df[cfg['date_col']], errors='coerce')
        min_date = dates.min()
        max_date = dates.max()
        
        # Water levels
        vals = pd.to_numeric(df[cfg['val_col']], errors='coerce')
        # Physical filter
        valid_mask = (vals >= 0.0) & (vals <= 150.0)
        valid_vals = vals[valid_mask]
        missing_pct = round((1.0 - (len(valid_vals) / total_rows)) * 100.0, 2)
        median_val = round(float(valid_vals.median()), 2) if not valid_vals.empty else None
        
        # Groupings
        stations = df[cfg['st_col']].dropna().nunique()
        districts = df[cfg['dist_col']].dropna().nunique()
        blocks = df[cfg['blk_col']].dropna().nunique()
        
        # Calculate usable lag/target pairs (at station level)
        # To be usable for 1-step ahead forecasting: station must have >= 3 temporal observations
        df['parsed_date'] = dates
        df['valid_val'] = np.where(valid_mask, vals, np.nan)
        st_counts = df.dropna(subset=['parsed_date', 'valid_val']).groupby(cfg['st_col']).size()
        usable_stations_3plus = (st_counts >= 3).sum()
        usable_stations_8plus = (st_counts >= 8).sum()
        
        summary.append({
            'state': state,
            'status': 'VERIFIED LOCAL OBSERVATIONS',
            'file': found_file,
            'rows': total_rows,
            'stations': stations,
            'districts': districts,
            'blocks': blocks,
            'min_date': str(min_date.date()) if pd.notnull(min_date) else None,
            'max_date': str(max_date.date()) if pd.notnull(max_date) else None,
            'missing_val_pct': missing_pct,
            'median_mbgl': median_val,
            'stations_ge_3_obs': int(usable_stations_3plus),
            'stations_ge_8_obs': int(usable_stations_8plus),
            'approx_usable_pairs': int(st_counts[st_counts >= 2].sum() - len(st_counts[st_counts >= 2]))
        })
    except Exception as e:
        summary.append({
            'state': state,
            'status': f'ERROR READING FILE: {e}',
            'file': found_file
        })

summary_df = pd.DataFrame(summary)
print(summary_df.to_string())
