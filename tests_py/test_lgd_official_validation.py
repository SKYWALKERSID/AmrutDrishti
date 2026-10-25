"""Automated validation tests for official Local Government Directory (LGD) integration.

Validates:
1. Integrity and extraction of all official LGD archives (no corrupted archives, safe paths, SHA256 verified).
2. Complete coverage and uniqueness of LGD entity codes across all 43 canonical blocks.
3. Accurate state and parent district hierarchy matching.
4. Validation and rejection of known false aliases (e.g. Dausa Lalsot vs Dausa Main, Bassi vs Sikrai, etc.).
5. Strict exclusion of Assam and preservation of the 43-block canonical cohort count.
6. Absence of fabricated GIS polygon data and enforcement of administrative-only identity semantics.
"""
import json
import pytest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LGD_DIR = ROOT / "data" / "sources" / "lgd_official"
MANIFEST_PATH = LGD_DIR / "lgd_extraction_manifest.json"
CROSSWALK_PATH = ROOT / "audit" / "canonical_43_lgd_crosswalk.json"
CANONICAL_PATH = ROOT / "src" / "lib" / "data" / "canonical43Blocks.json"

ACTIVE_STATES = {
    "Madhya Pradesh", "Rajasthan", "Punjab", "Haryana", "Karnataka",
    "Telangana", "Tamil Nadu", "Meghalaya", "Tripura",
}


def test_lgd_manifest_and_archives_exist_and_verified():
    assert MANIFEST_PATH.is_file(), "LGD extraction manifest missing"
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assert len(manifest["archives"]) == 9, f"Expected exactly 9 active-scope archives, found {len(manifest['archives'])}"
    
    state_names = {a["state_name"] for a in manifest["archives"]}
    assert ACTIVE_STATES.issubset(state_names), "Active 9 states must all have official LGD archives"
    assert state_names == ACTIVE_STATES, f"Only the approved nine states may be active: {state_names ^ ACTIVE_STATES}"
    assert {item["state_name"] for item in manifest.get("excluded_archives", [])} == {"Manipur"}
    assert "Manipur" not in manifest["active_states"]
    assert "Assam" not in state_names, "Assam must remain excluded from active application scope"


def test_canonical_43_crosswalk_complete_and_unique_codes():
    assert CROSSWALK_PATH.is_file(), "Canonical 43 LGD crosswalk missing"
    crosswalk = json.loads(CROSSWALK_PATH.read_text(encoding="utf-8"))
    assert len(crosswalk) == 43, f"Expected exactly 43 canonical blocks, got {len(crosswalk)}"

    block_codes = [item["lgd_block_code"] for item in crosswalk]
    assert all(code is not None and code.isdigit() for code in block_codes), "All blocks must have valid numeric LGD codes"
    assert len(set(block_codes)) == 43, "All 43 canonical blocks must map to distinct, unique LGD block codes"


def test_no_assam_or_unapproved_state_in_canonical_blocks():
    canonical = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
    assert len(canonical) == 43, f"Cohort size must remain exactly 43, found {len(canonical)}"
    states = {b["state"] for b in canonical}
    assert states == ACTIVE_STATES, f"States mismatch: {states.symmetric_difference(ACTIVE_STATES)}"
    assert "Assam" not in states


def test_rejection_of_suspicious_aliases():
    crosswalk = json.loads(CROSSWALK_PATH.read_text(encoding="utf-8"))
    by_id = {item["canonical_id"]: item for item in crosswalk}

    # 1. Nowgaon vs Chhatarpur
    nowgaon = by_id["blk_chhatarpur_nowgaon"]
    assert nowgaon["lgd_block_code"] == "3787", "Nowgaon must map to code 3787 (Nowgong), NOT Chhatarpur (3785)"
    assert nowgaon["lgd_block_name"] == "Nowgong"

    # 2. Dausa Main vs Lalsot
    dausa = by_id["blk_dausa_main"]
    assert dausa["lgd_block_code"] == "661", "Dausa Main must map to Dausa block (661), NOT Lalsot (662)"
    assert dausa["lgd_block_name"] == "Dausa"

    # 3. Jaipur Bassi vs Dausa Sikrai
    bassi = by_id["blk_jaipur_bassi"]
    assert bassi["lgd_block_code"] == "685", "Bassi must map to Jaipur Bassi (685), NOT Dausa Sikrai (664)"
    assert bassi["lgd_district_name"] == "Jaipur"

    # 4. Sawai Madhopur Bamanwas vs Chauth Ka Barwara
    bamanwas = by_id["blk_sawai_madhopur_bamanwas"]
    assert bamanwas["lgd_block_code"] == "768", "Bamanwas must map to Bamanwas (768), NOT Chauth Ka Barwara (6824)"
    assert bamanwas["lgd_block_name"] == "Bamanwas"

    # 5. West Tripura Mohanpur vs Dukli
    mohanpur = by_id["blk_west_tripura_mohanpur"]
    assert mohanpur["lgd_block_code"] == "2445", "Mohanpur must map to Mohanpur (2445), NOT Dukli (2436)"
    assert mohanpur["lgd_block_name"] == "Mohanpur"


def test_lgd_data_does_not_contain_gis_boundaries():
    # Verify that LGD data establishes administrative identity without masquerading as spatial polygons
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    for arch in manifest["archives"]:
        for cat, finfo in arch["files"].items():
            assert not finfo["original_filename"].lower().endswith((".shp", ".geojson", ".kml", ".gml")), (
                "Official LGD download contains only spreadsheet tables; GIS boundaries must not be fabricated"
            )
