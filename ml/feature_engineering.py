"""
JalDrishti ML Pipeline - Feature Engineering & Temporal Curation
Extracts, aligns, and transforms CGWB well measurements and IMD gridded rainfall
into leak-free training matrices with strictly causal temporal lag windows.
"""

import os
import json
from typing import Dict, Any, Tuple, Optional
import pandas as pd
import numpy as np

from ml.config import PILOT_BLOCKS, FEATURE_COLUMNS


def load_cgwb_groundwater_raw(file_path: str) -> pd.DataFrame:
    """
    Loads raw CGWB Madhya Pradesh manual quarterly Excel spreadsheet.
    Preserves nulls without replacing missing depths with zeros.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CGWB Excel file not found: {file_path}")
    
    # Read spreadsheet; skip headers if required based on source inspection
    df = pd.read_excel(file_path)
    return df


def clean_and_harmonize_observations(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalizes column names, parses observation dates, and filters
    out invalid out-of-bounds coordinates and impossible water level readings.
    """
    cleaned = df.copy()
    # Normalize headers
    cleaned.columns = [str(c).strip().lower().replace(" ", "_") for c in cleaned.columns]
    
    # Expected standard column mappings
    # Date parsing
    if "observation_date" in cleaned.columns:
        cleaned["observation_date"] = pd.to_datetime(cleaned["observation_date"], errors="coerce")
    elif "date" in cleaned.columns:
        cleaned["observation_date"] = pd.to_datetime(cleaned["date"], errors="coerce")
        
    # Preserves nulls; filter impossible depths (< -5m or > 150m)
    if "water_level_mbgl" in cleaned.columns:
        cleaned["water_level_mbgl"] = pd.to_numeric(cleaned["water_level_mbgl"], errors="coerce")
        cleaned.loc[(cleaned["water_level_mbgl"] < -5.0) | (cleaned["water_level_mbgl"] > 150.0), "water_level_mbgl"] = np.nan
        
    return cleaned


def create_lag_features_per_block(
    block_series: pd.DataFrame,
    water_col: str = "water_level_mbgl",
    date_col: str = "observation_date"
) -> pd.DataFrame:
    """
    Generates causal time-series lag features.
    Guarantees no future-leakage by applying strict shift operators.
    """
    df = block_series.sort_values(by=date_col).copy()
    
    # Lags (quarterly cadence: lag 1 = previous quarter, lag 4 = previous year same quarter)
    df["water_level_lag_1"] = df[water_col].shift(1)
    df["water_level_lag_2"] = df[water_col].shift(2)
    df["water_level_lag_4"] = df[water_col].shift(4)
    
    # Drawdown velocity (rate of change between consecutive quarters)
    df["drawdown_velocity_q1"] = df["water_level_lag_1"] - df["water_level_lag_2"]
    
    # Seasonal quarter indicator (0: Jan-Mar, 1: Apr-Jun, 2: Jul-Sep, 3: Oct-Dec)
    if np.issubdtype(df[date_col].dtype, np.datetime64):
        df["season_code"] = df[date_col].dt.quarter - 1
    else:
        df["season_code"] = 0
        
    return df


def build_block_training_matrix(
    block_id: str,
    gw_df: pd.DataFrame,
    rainfall_df: Optional[pd.DataFrame] = None
) -> pd.DataFrame:
    """
    Assembles input feature vectors and multi-horizon target labels for a specific pilot block.
    """
    if block_id not in PILOT_BLOCKS:
        raise ValueError(f"Unknown pilot block ID: {block_id}")
        
    block_meta = PILOT_BLOCKS[block_id]
    
    # Filter observations matching block
    subset = gw_df[gw_df["block_name"].str.lower() == block_meta["name"].lower()].copy()
    if subset.empty:
        # Fallback to district matching if block column has naming variance
        subset = gw_df[gw_df["district_name"].str.lower() == block_meta["district"].lower()].copy()
        
    features_df = create_lag_features_per_block(subset)
    
    # Target horizons: h=1 (next quarter), h=2 (2 quarters ahead), h=4 (1 year ahead)
    features_df["target_h1"] = features_df["water_level_mbgl"].shift(-1)
    features_df["target_h2"] = features_df["water_level_mbgl"].shift(-2)
    features_df["target_h4"] = features_df["water_level_mbgl"].shift(-4)
    
    # Drop rows without complete feature histories
    clean_matrix = features_df.dropna(subset=["water_level_lag_1", "water_level_lag_2"]).copy()
    return clean_matrix
