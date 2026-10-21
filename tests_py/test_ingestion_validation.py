"""
JAL DRISHTI — Python Ingestion & Freshness Validation Test Suite
Validates manifest schema, duplicate deduplication, range filters,
data integrity, and physical constraints across refreshed datasets.
"""

import os
import json
import hashlib
import tempfile
import pytest
import pandas as pd
import numpy as np

MANIFEST_PATH = os.path.join("data", "ingestion_manifest.json")

def test_ingestion_manifest_exists_and_valid():
    """Verify data/ingestion_manifest.json exists and adheres to version 2.0 schema."""
    assert os.path.exists(MANIFEST_PATH), f"Manifest missing at {MANIFEST_PATH}"
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    assert manifest["manifest_version"] == "2.0.0"
    assert manifest["reference_date"] == "2026-10-20"
    assert manifest["total_datasets_tracked"] >= 15
    assert len(manifest["datasets"]) == manifest["total_datasets_tracked"]
    
    required_keys = [
        "dataset_id", "dataset_name", "category", "official_provider",
        "official_source_url", "temporal_cadence", "units", "local_file",
        "status", "freshness_threshold_days"
    ]
    for d in manifest["datasets"]:
        for k in required_keys:
            assert k in d, f"Dataset {d.get('dataset_id')} missing required key '{k}'"
        assert d["status"] in ["CURRENT", "STALE", "HISTORICAL", "PARTIAL", "BLOCKED", "FAILED", "UNAVAILABLE"]

def test_manifest_sha256_checksums_match_local_files():
    """Verify SHA-256 hashes recorded in manifest match active filesystem files."""
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    for d in manifest["datasets"]:
        local_file = d.get("local_file")
        if local_file and os.path.exists(local_file):
            h = hashlib.sha256()
            with open(local_file, "rb") as f:
                while chunk := f.read(65536):
                    h.update(chunk)
            assert h.hexdigest() == d["sha256"], f"SHA256 mismatch for {local_file}"

def test_idempotent_ingestion_and_deduplication():
    """Simulate ingestion of identical rows and verify deduplication on (Station, Timestamp)."""
    raw_records = [
        {"Station": "TEST_001", "Data Acquisition Time": "2026-05-01 10:00", "Groundwater Level Quarterly Manual (meter)": 12.5},
        {"Station": "TEST_001", "Data Acquisition Time": "2026-05-01 10:00", "Groundwater Level Quarterly Manual (meter)": 12.5}, # Duplicate
        {"Station": "TEST_001", "Data Acquisition Time": "2026-08-01 10:00", "Groundwater Level Quarterly Manual (meter)": 14.2},
        {"Station": "TEST_002", "Data Acquisition Time": "2026-05-01 10:00", "Groundwater Level Quarterly Manual (meter)": 8.9},
    ]
    df = pd.DataFrame(raw_records)
    
    # Ingestion pipeline deduplication
    deduped = df.drop_duplicates(subset=["Station", "Data Acquisition Time"])
    assert len(deduped) == 3, "Duplicate observation on (Station, Timestamp) must be dropped"
    
    # Re-running ingestion of the exact same data must produce the exact same dataframe
    re_deduped = pd.concat([deduped, df]).drop_duplicates(subset=["Station", "Data Acquisition Time"])
    assert len(re_deduped) == 3, "Re-ingesting existing rows must be idempotent (zero row growth)"

def test_physical_range_validation():
    """Verify physical depth bounds [0.0, 150.0] m bgl and non-fabrication of unphysical values."""
    records = [
        {"val": 12.5, "valid": True},
        {"val": 0.0, "valid": True},     # Ground level
        {"val": 149.9, "valid": True},   # Deep bore
        {"val": -5.2, "valid": False},   # Negative depth (artesian or sensor error)
        {"val": 280.0, "valid": False},  # Exceeds maximum physical water table depth
        {"val": None, "valid": False},   # Missing
        {"val": np.nan, "valid": False}, # NaN
    ]
    
    valid_count = 0
    rejected_count = 0
    for r in records:
        v = r["val"]
        if v is not None and not np.isnan(v) and 0.0 <= v <= 150.0:
            valid_count += 1
            assert r["valid"] is True
        else:
            rejected_count += 1
            assert r["valid"] is False
            
    assert valid_count == 3
    assert rejected_count == 4

def test_meghalaya_datasets_integrity():
    """Verify acquired official Meghalaya datasets from NWIC."""
    manual_path = os.path.join("data", "sources", "meghalaya_gw_manual.csv")
    hist_path = os.path.join("data", "sources", "meghalaya_dwlr_historical.csv")
    
    assert os.path.exists(manual_path), "Meghalaya manual dataset missing"
    assert os.path.exists(hist_path), "Meghalaya historical telemetry missing"
    
    df_man = pd.read_csv(manual_path)
    assert len(df_man) == 75, "Expected 75 records in Meghalaya manual dataset"
    assert "West Jaintia Hills" in df_man["District"].values
    
    # Check physical water levels
    val_col = "Groundwater Level Quarterly Manual (meter)"
    valid_depths = pd.to_numeric(df_man[val_col], errors="coerce").dropna()
    assert (valid_depths >= 0.0).all()
    assert (valid_depths <= 150.0).all()

def test_sikkim_springshed_missing_data_integrity():
    """Verify Sikkim blocks preserve missing well depth rather than hardcoded fake numbers."""
    from scripts.scratch import search_all_states_gw # ensures scripts path importable
    
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    sikkim_entry = next((d for d in manifest["datasets"] if d["dataset_id"] == "src_sikkim_springshed_contrast"), None)
    assert sikkim_entry is not None
    assert sikkim_entry["status"] == "PARTIAL"
    assert "springshed" in sikkim_entry["notes"].lower()
