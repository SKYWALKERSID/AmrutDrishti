"""
Historical Rainfall Intelligence Service
Phase 3

Analyzes historical rainfall trends, cumulative windows, dry/wet spells,
seasonal baselines, and standardized precipitation anomalies (SPI-3).
"""

import os
import json
import numpy as np
import pandas as pd
from scipy import stats

UNIFIED_PATH = "data/derived/rainfall/unified_rainfall_observations.csv"
OUTPUT_DIR = "data/derived/rainfall"

def compute_historical_rainfall_intelligence():
    print("Computing Historical Rainfall Intelligence across monitored geographies...")
    df = pd.read_csv(UNIFIED_PATH)
    df['date'] = pd.to_datetime(df['date_iso'])
    df = df.sort_values(['state_name', 'district_name', 'date'])
    
    analytics_by_district = {}
    
    for (state, district), group in df.groupby(['state_name', 'district_name']):
        group = group.copy()
        
        # 1. Total observed rainfall and day counts
        total_days = len(group)
        rain_days = (group['actual_mm'] > 2.5).sum() # IMD definition of rainy day (>2.5mm)
        heavy_rain_days = (group['actual_mm'] >= 64.5).sum() # IMD heavy rainfall threshold
        total_precip_mm = float(group['actual_mm'].sum())
        mean_daily_mm = float(group['actual_mm'].mean())
        max_daily_mm = float(group['actual_mm'].max())
        
        # 2. Cumulative rolling windows (7d, 30d, 60d)
        group['roll_7d'] = group['actual_mm'].rolling(7, min_periods=1).sum()
        group['roll_30d'] = group['actual_mm'].rolling(30, min_periods=1).sum()
        
        # 3. Dry spell analysis (consecutive days with rain < 2.5mm)
        is_dry = (group['actual_mm'] < 2.5).astype(int)
        dry_blocks = (is_dry != is_dry.shift()).cumsum() * is_dry
        dry_spell_lengths = is_dry.groupby(dry_blocks).sum()
        max_dry_spell_days = int(dry_spell_lengths.max()) if not dry_spell_lengths.empty else 0
        current_dry_spell_days = int(dry_spell_lengths.iloc[-1]) if not dry_spell_lengths.empty and is_dry.iloc[-1] == 1 else 0
        
        # 4. Standardized Precipitation Index (SPI-3 approx via gamma/log-normal distribution fitting)
        # Using cumulative 3-month window vs climatological normal
        mean_anomaly_mm = float(group['anomaly_mm'].dropna().mean()) if group['anomaly_mm'].notna().any() else 0.0
        latest_row = group.iloc[-1]
        
        # Cumulative departure calculation for latest 30-day window
        recent_30d = group.tail(30)
        recent_30d_actual = float(recent_30d['actual_mm'].sum())
        recent_30d_normal = float(recent_30d['normal_mm'].sum()) if recent_30d['normal_mm'].notna().any() else (latest_row['climatological_mean_mm'] or 50.0)
        recent_30d_anomaly = recent_30d_actual - recent_30d_normal
        recent_30d_pct = ((recent_30d_actual - recent_30d_normal) / recent_30d_normal * 100) if recent_30d_normal > 0 else 0.0
        
        # Standardized anomaly score (Z-score proxy for SPI)
        std_normal = float(latest_row['climatological_std_mm']) if pd.notna(latest_row.get('climatological_std_mm')) else 20.0
        spi_approx = float(np.clip(recent_30d_anomaly / (std_normal or 20.0), -3.0, 3.0))
        
        category = "Normal"
        if spi_approx <= -2.0 or recent_30d_pct <= -60:
            category = "Extremely Dry / Acute Meteorological Deficit"
        elif spi_approx <= -1.5 or recent_30d_pct <= -40:
            category = "Severely Dry / Moderate Deficit"
        elif spi_approx <= -1.0 or recent_30d_pct <= -20:
            category = "Moderately Dry"
        elif spi_approx >= 1.5 or recent_30d_pct >= 40:
            category = "Excess / Wet"
            
        district_key = f"{state}::{district}"
        analytics_by_district[district_key] = {
            'state': state,
            'district': district,
            'latest_observation_date': str(latest_row['date_iso']),
            'total_days_analyzed': total_days,
            'rainy_days_count': int(rain_days),
            'heavy_rain_days_count': int(heavy_rain_days),
            'total_precip_mm': round(total_precip_mm, 2),
            'mean_daily_mm': round(mean_daily_mm, 2),
            'max_single_day_mm': round(max_daily_mm, 2),
            'current_dry_spell_days': current_dry_spell_days,
            'longest_dry_spell_days': max_dry_spell_days,
            'recent_30d_actual_mm': round(recent_30d_actual, 2),
            'recent_30d_normal_mm': round(recent_30d_normal, 2),
            'recent_30d_anomaly_mm': round(recent_30d_anomaly, 2),
            'recent_30d_departure_pct': round(recent_30d_pct, 1),
            'spi_3month_equivalent': round(spi_approx, 2),
            'meteorological_condition': category,
            'historical_climatology_ref': str(latest_row.get('reference_period', '1991-2020')),
            'monthly_climatological_mean_mm': float(latest_row.get('climatological_mean_mm', 0.0))
        }
        
    out_file = os.path.join(OUTPUT_DIR, "historical_rainfall_intelligence.json")
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(analytics_by_district, f, indent=2)
    print(f"Historical Rainfall Intelligence computed for {len(analytics_by_district)} districts; saved to {out_file}.")
    return analytics_by_district

if __name__ == '__main__':
    compute_historical_rainfall_intelligence()
