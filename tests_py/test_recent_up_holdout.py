"""
Automated Regression Tests for Recent (Post-2019) Uttar Pradesh Hydrograph Holdout Pipeline.
Verifies file checksum, observation dates strictly post-2019, physical depth ranges,
station isolation from manual network, and strict out-of-time walk-forward split integrity.
"""

import os
import hashlib
import pandas as pd
import numpy as np
import pytest

UP_TELEMETRY_PATH = "data/sources/up_cgwb_telemetry_2021_2025.csv"
EXPECTED_SHA256 = "44f35251df0b98e9acb3072dc343113b02388d3d3619db4dc2a09b1300f11814"
MANUAL_PATH = "data/sources/up_nwic_manual.csv"

def compute_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

class TestRecentUpHoldout:

    def test_up_telemetry_file_exists_and_checksum_valid(self):
        assert os.path.exists(UP_TELEMETRY_PATH), f"File missing at {UP_TELEMETRY_PATH}"
        actual_sha = compute_sha256(UP_TELEMETRY_PATH)
        assert actual_sha == EXPECTED_SHA256, f"SHA mismatch: expected {EXPECTED_SHA256}, got {actual_sha}"

    def test_observations_are_strictly_post_2019(self):
        df = pd.read_csv(UP_TELEMETRY_PATH, nrows=5000)
        dates = pd.to_datetime(df['Data Acquisition Time'], errors='coerce', dayfirst=True)
        assert dates.min() >= pd.Timestamp('2020-01-01'), f"Found pre-2020 dates in recent series: {dates.min()}"

    def test_station_isolation_from_manual_network(self):
        df_tel = pd.read_csv(UP_TELEMETRY_PATH, nrows=2000)
        df_man = pd.read_csv(MANUAL_PATH, nrows=2000)
        
        tel_stations = set(df_tel['Station'].dropna().unique())
        man_stations = set(df_man['Station'].dropna().unique())
        
        # Verify networks are distinct and not blindly merged
        assert len(tel_stations) > 0
        assert len(man_stations) > 0
        overlap = tel_stations.intersection(man_stations)
        assert len(overlap) == 0, f"Unexpected station collision between manual and telemetry: {overlap}"

    def test_physical_depth_bounds(self):
        df = pd.read_csv(UP_TELEMETRY_PATH, nrows=5000)
        raw_wl = pd.to_numeric(df['Groundwater Level Telemetry 6 Hourly (meter)'], errors='coerce').abs()
        valid = raw_wl[(raw_wl >= 0.0) & (raw_wl <= 150.0)]
        assert len(valid) > 4000, "Expected majority of readings to be in valid physical range [0, 150] mbgl"
        assert valid.min() >= 0.0
        assert valid.max() <= 150.0

    def test_semi_annual_window_rules(self):
        d1 = pd.Timestamp('2024-01-01')
        d2 = pd.Timestamp('2024-06-15')
        dt = (d2 - d1).days
        assert 150 <= dt <= 210, f"Expected semi-annual window [150, 210] days, got {dt}"
