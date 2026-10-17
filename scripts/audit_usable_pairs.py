import os
import pandas as pd
import numpy as np

DATA_PATHS = {
    'Madhya Pradesh': 'data/sources/cgwb_mp_cleaned_proper.csv',
    'Punjab': 'data/sources/cgwb_contrast/PB.csv',
    'Haryana': 'data/sources/cgwb_contrast/HR.csv',
    'Rajasthan': 'data/sources/cgwb_contrast/RJ.csv',
    'Assam': 'data/sources/cgwb_contrast/AS.csv',
}

HORIZONS = {
    'h1 (1Q / ~90d)': (45, 135),
    'h2 (2Q / ~180d)': (135, 225),
    'h4 (4Q / ~365d)': (315, 415),
}

results = []

for state, path in DATA_PATHS.items():
    if not os.path.exists(path):
        continue
    df = pd.read_csv(path, low_memory=False)
    
    # Standardize columns
    date_col = 'Data Acquisition Time'
    val_col = 'Groundwater Level Quarterly Manual (meter)'
    st_col = 'Station'
    dist_col = 'District'
    blk_col = 'Block'
    
    df['parsed_date'] = pd.to_datetime(df[date_col], errors='coerce', dayfirst=True)
    df['parsed_val'] = pd.to_numeric(df[val_col], errors='coerce')
    
    # Filter physical depths
    clean = df.dropna(subset=['parsed_date', 'parsed_val', st_col]).copy()
    clean = clean[(clean['parsed_val'] >= 0.0) & (clean['parsed_val'] <= 150.0)]
    
    # Sort by station and date
    clean = clean.sort_values(by=[st_col, 'parsed_date'])
    
    # Compute station-level consecutive diffs
    clean['prev_date'] = clean.groupby(st_col)['parsed_date'].shift(1)
    clean['days_since_prev'] = (clean['parsed_date'] - clean['prev_date']).dt.days
    
    # Count usable pairs per horizon
    # A pair (t, t+h) is valid if observation at t has a future observation at t+h within [min_d, max_d]
    h1_count = 0
    h2_count = 0
    h4_count = 0
    
    for _, group in clean.groupby(st_col):
        n = len(group)
        if n < 2:
            continue
        g_dates = group['parsed_date'].values
        
        for i in range(n):
            t_date = g_dates[i]
            for j in range(i + 1, n):
                diff_days = (g_dates[j] - t_date) / np.timedelta64(1, 'D')
                if 45 <= diff_days <= 135:
                    h1_count += 1
                elif 135 < diff_days <= 225:
                    h2_count += 1
                elif 315 <= diff_days <= 415:
                    h4_count += 1
                elif diff_days > 415:
                    break
                    
    median_delta = clean['days_since_prev'].dropna().median()
    iqr_delta = clean['days_since_prev'].dropna().quantile(0.75) - clean['days_since_prev'].dropna().quantile(0.25)
    
    results.append({
        'State': state,
        'Stations': clean[st_col].nunique(),
        'Total Obs': len(clean),
        'Median Interval (days)': round(float(median_delta), 1) if pd.notnull(median_delta) else None,
        'IQR Interval (days)': round(float(iqr_delta), 1) if pd.notnull(iqr_delta) else None,
        'Usable Pairs (h1: 1Q)': h1_count,
        'Usable Pairs (h2: 2Q)': h2_count,
        'Usable Pairs (h4: 4Q)': h4_count,
    })

res_df = pd.DataFrame(results)
print(res_df.to_string(index=False))
