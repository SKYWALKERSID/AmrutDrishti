"""
JalDrishti ML Pipeline - Configuration & Hyperparameter Definitions
Defines feature names, horizons, evaluation thresholds, and pilot block mappings.
"""

from typing import List, Dict, Any

PILOT_BLOCKS: Dict[str, Dict[str, Any]] = {
    "blk_bijawar": {
        "name": "Bijawar",
        "district": "Chhatarpur",
        "state": "Madhya Pradesh",
        "lithology": "Granite / Gneiss (Hard Rock)",
        "coordinates": [24.6333, 79.5000]
    },
    "blk_rajnagar": {
        "name": "Rajnagar",
        "district": "Chhatarpur",
        "state": "Madhya Pradesh",
        "lithology": "Granite / Weathered Gneiss",
        "coordinates": [24.8833, 79.9167]
    },
    "blk_baldeogarh": {
        "name": "Baldeogarh",
        "district": "Tikamgarh",
        "state": "Madhya Pradesh",
        "lithology": "Bundelkhand Gneiss Complex",
        "coordinates": [24.6042, 79.0145]
    },
    "blk_jatara": {
        "name": "Jatara",
        "district": "Tikamgarh",
        "state": "Madhya Pradesh",
        "lithology": "Granitic Weathered Mantle",
        "coordinates": [25.0125, 79.0560]
    },
    "blk_palera": {
        "name": "Palera",
        "district": "Tikamgarh",
        "state": "Madhya Pradesh",
        "lithology": "Fractured Granite Basement",
        "coordinates": [25.0245, 79.2312]
    },
    "blk_tikamgarh_main": {
        "name": "Tikamgarh",
        "district": "Tikamgarh",
        "state": "Madhya Pradesh",
        "lithology": "Bundelkhand Granite Complex",
        "coordinates": [24.7456, 78.8311]
    }
}

# Feature definitions for temporal modeling
FEATURE_COLUMNS: List[str] = [
    "water_level_lag_1",      # Depth to water level at t-1 (previous quarter)
    "water_level_lag_2",      # Depth at t-2 (2 quarters ago)
    "water_level_lag_4",      # Depth at t-4 (previous year same season)
    "drawdown_velocity_q1",   # Quarterly drawdown rate (dL / dt)
    "rainfall_cum_3m",        # 90-day cumulative rainfall from IMD 0.25° grid (mm)
    "spi_3month",             # Standardized Precipitation Index - 3 month
    "rainfall_departure_pct", # Monsoon departure from 30-year normal (%)
    "grace_twsa_cm",          # GRACE Terrestrial Water Storage Anomaly (cm)
    "season_code"             # 0: Pre-monsoon (May), 1: Monsoon (Aug), 2: Post-monsoon (Nov), 3: Winter (Jan)
]

TARGET_HORIZONS: List[int] = [1, 2, 4]  # 1 quarter ahead (~3m), 2 quarters (~6m), 4 quarters (~12m)

# Scientific Acceptance Criteria (WMO & JalDrishti TRD v1.0)
VALIDATION_CRITERIA: Dict[str, float] = {
    "max_rmse_m": 1.50,            # Maximum acceptable Root Mean Squared Error (m)
    "max_mae_m": 1.00,             # Maximum acceptable Mean Absolute Error (m)
    "min_nse": 0.65,               # Minimum Nash-Sutcliffe Efficiency (NSE > 0.65 is good hydrological model)
    "min_improvement_over_baseline": 0.15 # ML must beat seasonal persistence baseline by at least 15%
}
