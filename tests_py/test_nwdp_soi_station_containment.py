"""Regression coverage for non-authoritative SOI spatial candidate evidence."""
import json
from pathlib import Path

from scripts.audit_nwdp_soi_station_containment import geometry_contains, wgs84_to_epsg7755

ROOT = Path(__file__).resolve().parents[1]
ACTIVE_STATES = {
    "Madhya Pradesh", "Rajasthan", "Punjab", "Haryana", "Karnataka",
    "Telangana", "Tamil Nadu", "Meghalaya", "Tripura",
}


def test_projection_and_point_in_polygon_contract():
    x, y = wgs84_to_epsg7755(76.627206, 29.6288053)
    assert 3_400_000 < x < 4_000_000
    assert 4_400_000 < y < 4_900_000
    square = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]
    assert geometry_contains(5, 5, {"type": "Polygon", "coordinates": square})
    assert not geometry_contains(15, 5, {"type": "Polygon", "coordinates": square})


def test_supplied_boundary_candidates_remain_non_authoritative():
    candidates = json.loads((ROOT / "data/derived/nwdp_soi_station_containment_candidates.json").read_text(encoding="utf-8"))
    assert set(candidates["states_included"]) == ACTIVE_STATES
    assert candidates["candidate_station_count"] == 1729
    assert len(candidates["boundary_archives"]) == 9
    assert all("datum/CRS is undocumented" in entry["coordinate_interpretation"] for entry in candidates["stations"])
    assert all(entry["verified"] is False and entry["operational_eligibility"] is False for entry in candidates["stations"])


def test_priority_station_hits_are_evidence_candidates_not_verified_assignments():
    candidates = json.loads((ROOT / "data/derived/nwdp_soi_station_containment_candidates.json").read_text(encoding="utf-8"))
    by_name = {entry["station_name"]: entry for entry in candidates["stations"]}
    expected = {
        "ChocftraPz": "blk_karnal_assandh",
        "Bapi_Pz_1": "blk_dausa_main",
        "TIGARIA_1": "blk_jaipur_govindgarh",
    }
    for station_name, block_id in expected.items():
        entry = by_name[station_name]
        assert entry["verified"] is False
        assert any(block_id == candidate["block_id"]
                   for hit in entry["boundary_hits"]
                   for candidate in hit["canonical_candidates"])
    uthandi = by_name["UTHANDI_1"]
    assert uthandi["verified"] is False
    assert uthandi["mapping_status"] != "spatial_candidate_exact_name_crosswalk_coordinate_crs_unverified"


def test_active_readiness_remains_fail_closed_for_all_43_blocks():
    readiness = json.loads((ROOT / "audit/global_model_block_readiness.json").read_text(encoding="utf-8"))
    blocks = readiness["blocks"]
    assert len(blocks) == 43
    assert all(block["operational_eligibility"] is False for block in blocks)
    assert readiness["freshness_policy"]["max_observation_age_days"] == 400
