"""
JalDrishti ML Pipeline - Feature Engineering & Temporal Curation
Extracts, aligns, and transforms CGWB well measurements and IMD gridded rainfall
into leak-free training matrices with strictly causal temporal lag windows.

Rules:
1. Station Autonomy: Features and targets are computed strictly per physical station.
   Never shift lags or forward targets across mixed stations in an unsorted DataFrame.
2. Causal Boundaries: Inputs use strictly <= origin time information.
3. Target Horizon Windows:
   - 1-quarter ahead (h=1): subsequent measurement in [45, 135] days.
   - 2-quarters ahead (h=2): subsequent measurement in [135, 225] days.
   - 4-quarters ahead (h=4): subsequent measurement in [315, 415] days.
4. Preserves nulls: NaN stays NaN, never zero-coerced or synthetically interpolated.
"""

import os
import json
from typing import Dict, Any, Tuple, Optional, List
import pandas as pd
import numpy as np

from ml.config import PILOT_BLOCKS, FEATURE_COLUMNS

MIN_HORIZON_1Q_DAYS = 45
MAX_HORIZON_1Q_DAYS = 135
MIN_HORIZON_2Q_DAYS = 135
MAX_HORIZON_2Q_DAYS = 225
MIN_HORIZON_4Q_DAYS = 315
MAX_HORIZON_4Q_DAYS = 415
YEAR_LAG_TOLERANCE_DAYS = 45


def load_cgwb_groundwater_raw(file_path: str) -> pd.DataFrame:
    """
    Loads raw CGWB manual quarterly observations (CSV or Excel).
    Preserves nulls without replacing missing depths with zeros.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CGWB data file not found: {file_path}")
    
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path, low_memory=False)
    else:
        df = pd.read_excel(file_path)
    return df


def clean_and_harmonize_observations(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalizes column names, parses observation dates, and filters
    out invalid out-of-bounds coordinates and impossible water level readings.
    """
    cleaned = df.copy()
    # Normalize headers to lowercase
    cleaned.columns = [str(c).strip().lower().replace(" ", "_") for c in cleaned.columns]

    # Column renames for standard CGWB formats
    rename_dict = {
        'station': 'station_id',
        'station_name': 'station_id',
        'block': 'block_name',
        'district': 'district_name',
        'data_acquisition_time': 'observation_date',
        'groundwater_level_quarterly_manual_(meter)': 'water_level_mbgl',
        'groundwater_level_telemetry_6_hourly_(meter)': 'water_level_mbgl'
    }
    for old_col, new_col in rename_dict.items():
        if old_col in cleaned.columns and new_col not in cleaned.columns:
            cleaned.rename(columns={old_col: new_col}, inplace=True)
            
    # Also standardize 'station' as primary identifier
    if 'station_id' in cleaned.columns and 'station' not in cleaned.columns:
        cleaned['station'] = cleaned['station_id']
    elif 'station' in cleaned.columns and 'station_id' not in cleaned.columns:
        cleaned['station_id'] = cleaned['station']
            
    # Date parsing (format='mixed' handles ISO YYYY-MM-DD and DD-MM-YYYY without NaT drops)
    if "observation_date" in cleaned.columns:
        cleaned["observation_date"] = pd.to_datetime(cleaned["observation_date"], errors="coerce", format="mixed")
    elif "date" in cleaned.columns:
        cleaned["observation_date"] = pd.to_datetime(cleaned["date"], errors="coerce", format="mixed")
        
    # Preserves nulls; filter impossible depths (< -5m or > 150m)
    if "water_level_mbgl" in cleaned.columns:
        cleaned["water_level_mbgl"] = pd.to_numeric(cleaned["water_level_mbgl"], errors="coerce")
        cleaned.loc[(cleaned["water_level_mbgl"] < -5.0) | (cleaned["water_level_mbgl"] > 150.0), "water_level_mbgl"] = np.nan
        
    return cleaned


def build_station_training_matrix(
    df: pd.DataFrame,
    station_col: str = "station",
    date_col: str = "observation_date",
    value_col: str = "water_level_mbgl",
    state_col: str = "state",
    district_col: str = "district_name",
    block_col: str = "block_name"
) -> pd.DataFrame:
    """
    Constructs a station-grouped, leak-free training matrix.
    Guarantees:
    1. Every lag and target is computed strictly within the same physical station.
    2. Observations on the same day at the same station are averaged (duplicate resolution).
    3. Forward targets are only paired if the subsequent observation falls in the valid window.
    """
    cols_to_keep = [station_col, date_col, value_col]
    meta_cols = [c for c in [state_col, district_col, block_col] if c in df.columns]
    
    clean_df = df.dropna(subset=[station_col, date_col]).copy()
    clean_df[date_col] = pd.to_datetime(clean_df[date_col], errors="coerce")
    clean_df[value_col] = pd.to_numeric(clean_df[value_col], errors="coerce")
    clean_df = clean_df.dropna(subset=[date_col, value_col])
    
    # Duplicate resolution: average multiple readings at same station on same date
    group_cols = [station_col, date_col]
    agg_dict = {value_col: 'mean'}
    for mc in meta_cols:
        agg_dict[mc] = 'first'
        
    deduped = clean_df.groupby(group_cols, as_index=False).agg(agg_dict)
    
    records = []
    # Sort strictly by station and date
    for st, group in deduped.sort_values([station_col, date_col]).groupby(station_col, sort=False):
        group = group.reset_index(drop=True)
        n = len(group)
        if n < 2:
            continue
            
        dates = group[date_col].tolist()
        vals = group[value_col].tolist()
        
        # Station metadata
        meta = {mc: group[mc].iloc[0] for mc in meta_cols}
        
        for i in range(n):
            origin_date = dates[i]
            origin_val = vals[i]
            prev_val = vals[i - 1] if i >= 1 else np.nan
            prev2_val = vals[i - 2] if i >= 2 else np.nan
            
            # Drawdown velocity (q1)
            drawdown_q1 = (origin_val - prev_val) if (np.isfinite(origin_val) and np.isfinite(prev_val)) else np.nan
            
            # Find year lag prior to origin (~365 days before origin)
            year_ref_origin = origin_date - pd.Timedelta(days=365)
            lag_4 = np.nan
            for k in range(i):
                if abs((dates[k] - year_ref_origin).days) <= YEAR_LAG_TOLERANCE_DAYS:
                    lag_4 = vals[k]
                    break
                    
            # Search future observations of the SAME station for valid horizon targets
            target_h1 = np.nan
            target_h1_date = None
            target_h1_days = None
            target_season_h1 = None
            
            target_h2 = np.nan
            target_h2_date = None
            target_h2_days = None
            
            target_h4 = np.nan
            target_h4_date = None
            target_h4_days = None
            
            for j in range(i + 1, n):
                future_date = dates[j]
                delta_days = (future_date - origin_date).days
                
                # Check h1 (1Q / ~90d: 45-135 days)
                if np.isnan(target_h1) and (MIN_HORIZON_1Q_DAYS <= delta_days <= MAX_HORIZON_1Q_DAYS):
                    target_h1 = vals[j]
                    target_h1_date = future_date
                    target_h1_days = delta_days
                    target_season_h1 = int(future_date.quarter - 1)
                    
                # Check h2 (2Q / ~180d: 135-225 days)
                if np.isnan(target_h2) and (MIN_HORIZON_2Q_DAYS < delta_days <= MAX_HORIZON_2Q_DAYS):
                    target_h2 = vals[j]
                    target_h2_date = future_date
                    target_h2_days = delta_days
                    
                # Check h4 (4Q / ~365d: 315-415 days)
                if np.isnan(target_h4) and (MIN_HORIZON_4Q_DAYS <= delta_days <= MAX_HORIZON_4Q_DAYS):
                    target_h4 = vals[j]
                    target_h4_date = future_date
                    target_h4_days = delta_days
                    
                if delta_days > MAX_HORIZON_4Q_DAYS:
                    break
                    
            # Year before target (for seasonal persistence baseline)
            year_before_target_h1 = np.nan
            if target_h1_date is not None:
                year_ref_target = target_h1_date - pd.Timedelta(days=365)
                for k in range(i + 1):  # must be <= origin_date to be causal
                    if abs((dates[k] - year_ref_target).days) <= YEAR_LAG_TOLERANCE_DAYS:
                        year_before_target_h1 = vals[k]
                        break
                        
            # Only record row if at least one horizon target exists
            if not (np.isnan(target_h1) and np.isnan(target_h2) and np.isnan(target_h4)):
                rec = {
                    "station": st,
                    "origin_date": origin_date,
                    "observation_date": origin_date,
                    "water_level_mbgl": origin_val,
                    "wl_origin": origin_val,
                    "water_level_lag_1": prev_val,
                    "wl_prev": prev_val,
                    "water_level_lag_2": prev2_val,
                    "water_level_lag_4": lag_4,
                    "wl_year_before_target": year_before_target_h1,
                    "drawdown_velocity_q1": drawdown_q1,
                    "origin_season": int(origin_date.quarter - 1),
                    "target_season": target_season_h1 if target_season_h1 is not None else int(origin_date.quarter - 1),
                    "season_code": target_season_h1 if target_season_h1 is not None else int(origin_date.quarter - 1),
                    "target_h1": target_h1,
                    "target_h1_date": target_h1_date,
                    "target_h1_days": target_h1_days,
                    "target_h2": target_h2,
                    "target_h2_date": target_h2_date,
                    "target_h2_days": target_h2_days,
                    "target_h4": target_h4,
                    "target_h4_date": target_h4_date,
                    "target_h4_days": target_h4_days,
                    **meta
                }
                records.append(rec)
                
    out_df = pd.DataFrame(records)
    if out_df.empty:
        return out_df
    return out_df.sort_values(["origin_date", "station"]).reset_index(drop=True)


def build_block_training_matrix(
    block_id: str,
    gw_df: pd.DataFrame,
    rainfall_df: Optional[pd.DataFrame] = None
) -> pd.DataFrame:
    """
    Assembles input feature vectors and multi-horizon target labels for a specific pilot block.
    Refactored to enforce station autonomy and prevent cross-station contamination.
    """
    if block_id not in PILOT_BLOCKS:
        raise ValueError(f"Unknown pilot block ID: {block_id}")
        
    block_meta = PILOT_BLOCKS[block_id]
    
    # Filter observations matching block
    subset = gw_df[gw_df["block_name"].str.lower() == block_meta["name"].lower()].copy()
    if subset.empty:
        # Fallback to district matching if block column has naming variance
        subset = gw_df[gw_df["district_name"].str.lower() == block_meta["district"].lower()].copy()
        
    if subset.empty:
        return pd.DataFrame()
        
    # Station column identifier
    st_col = "station" if "station" in subset.columns else ("station_id" if "station_id" in subset.columns else None)
    if not st_col:
        return pd.DataFrame()
        
    # Build leak-free matrix with station grouping
    matrix = build_station_training_matrix(
        subset,
        station_col=st_col,
        date_col="observation_date",
        value_col="water_level_mbgl",
        block_col="block_name",
        district_col="district_name"
    )
    
    return matrix
