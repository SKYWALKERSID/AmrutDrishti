import json
from pathlib import Path

from scripts.refresh_nwdp_readiness_report import (
    api_evidence_status,
    build_evidence_status,
    exclusive_categories_reconcile,
    source_artifacts_are_synchronized,
)

ROOT = Path(__file__).resolve().parents[1]


def test_typescript_or_dev_server_evidence_does_not_claim_production_build():
    source_at = "2026-10-25T00:00:00Z"
    assert build_evidence_status({"command": "npx tsc --noEmit", "exit_code": 0, "output_excerpt": "TypeScript passed"}, source_at) == "UNVERIFIED"
    assert build_evidence_status({"command": "npm run dev", "exit_code": 0, "output_excerpt": "Ready"}, source_at) == "UNVERIFIED"
    assert build_evidence_status({"command": "npm run build", "exit_code": 1, "finished_at": "2026-10-25T01:00:00Z", "output_excerpt": "Compiled successfully"}, source_at) == "UNVERIFIED"
    successful = {"command": "npm run build", "exit_code": 0, "finished_at": "2026-10-25T01:00:00Z", "output_excerpt": "Compiled successfully; /api/historical-observations"}
    assert build_evidence_status(successful, source_at) == "VERIFIED"
    assert build_evidence_status({**successful, "finished_at": "2026-10-24T23:59:59Z"}, source_at) == "UNVERIFIED"


def test_api_requires_captured_http_status_and_request_url():
    source_at = "2026-10-25T00:00:00Z"
    build_at = "2026-10-25T00:30:00Z"
    assert api_evidence_status({"captured_http": True, "requests": []}, source_at, build_at) == "UNVERIFIED"
    assert api_evidence_status({"captured_http": True, "captured_at": "2026-10-25T01:00:00Z", "requests": [{"request_url": "/api/x"}]}, source_at, build_at) == "UNVERIFIED"
    assert api_evidence_status({"captured_http": True, "captured_at": "2026-10-25T01:00:00Z", "requests": [{"request_url": "/api/x", "status": 200, "source": "historical_database", "observation_count": 0}]}, source_at, build_at) == "UNVERIFIED"
    assert api_evidence_status({"captured_http": True, "captured_at": "2026-10-25T01:00:00Z", "requests": [{"request_url": "/api/historical-observations?block=x", "status": 503, "source": "historical_database", "observation_count": 0, "response_body": {"source": "historical_database", "observations": []}}]}, source_at, build_at) == "UNVERIFIED"
    row = {"request_url": "/api/historical-observations?block=x", "status": 200, "source": "historical_database", "observation_count": 0, "response_body": {"source": "historical_database", "observations": []}}
    assert api_evidence_status({"captured_http": True, "captured_at": "2026-10-25T01:00:00Z", "requests": [row]}, source_at, build_at) == "VERIFIED"
    assert api_evidence_status({"captured_http": True, "captured_at": "2026-10-25T00:15:00Z", "requests": [row]}, source_at, build_at) == "UNVERIFIED"


def test_exclusive_classification_reconciles_without_count_literals():
    counts = {
        "source_rows": 20, "negative_readings": 10, "zero_readings": 1,
        "exact_one_readings": 2, "positive_candidate_undocumented_datum": 4,
        "sentinel_pattern_retained_pending_station_qc": 1,
        "outside_unreviewed_0_to_150_candidate_range": 2,
    }
    assert exclusive_categories_reconcile(counts)
    counts["positive_candidate_undocumented_datum"] += 1
    assert not exclusive_categories_reconcile(counts)


def test_old_mapping_or_canonical_artifact_cannot_be_used_as_current():
    manifest = {"generated_at": "current-run"}
    assert source_artifacts_are_synchronized(manifest, {"generated_at": "current-run"}, {"generated_at": "current-run"})
    assert not source_artifacts_are_synchronized(manifest, {"generated_at": "old-run"}, {"generated_at": "current-run"})
    assert not source_artifacts_are_synchronized(manifest, {"generated_at": "current-run"}, {"generated_at": "old-run"})


def test_current_readiness_is_bound_to_canonical_scope_and_fails_closed():
    canonical = json.loads((ROOT / "audit/canonical_43_blocks_active.json").read_text())
    readiness = json.loads((ROOT / "audit/global_model_block_readiness.json").read_text())
    manifest = json.loads((ROOT / "data/derived/nwdp_telemetry_ingestion_manifest.json").read_text())
    evidence = json.loads((ROOT / "audit/latest_telemetry_verification_evidence.json").read_text())
    canonical_ids = {block["block_id"] for block in canonical["blocks"]}
    readiness_ids = {block["block_id"] for block in readiness["blocks"]}
    assert len(canonical_ids) == 43
    assert readiness_ids == canonical_ids
    assert readiness["source_artifact_generated_at"] == manifest["generated_at"]
    assert readiness["scope"] == {"states": 9, "blocks": 43, "assam_excluded": True}
    assert readiness["freshness_policy"]["max_observation_age_days"] == 400
    assert readiness["build_evidence_status"] == build_evidence_status(evidence.get("build", {}), manifest["generated_at"])
    assert readiness["api_evidence_status"] == api_evidence_status(evidence.get("api_smoke", {}), manifest["generated_at"], evidence.get("build", {}).get("finished_at", ""))
    assert all(block["operational_eligibility"] is False for block in readiness["blocks"])
    assert all(block["accepted_observations"] == 0 for block in readiness["blocks"])
    assert all(block["unverified_candidate_observations"] is None for block in readiness["blocks"])
    assert all(block["latest_verified_observation_date"] is None for block in readiness["blocks"])
    assert manifest["counts"]["candidate_not_verified"] != sum(block["accepted_observations"] for block in readiness["blocks"])
    assert exclusive_categories_reconcile(manifest["counts"])
    counts = manifest["counts"]
    assert counts["sentinel_pattern_retained_pending_station_qc"] > 0
    assert counts["candidate_not_verified"] == counts["zero_readings"] + counts["exact_one_readings"] + counts["positive_candidate_undocumented_datum"] + counts["sentinel_pattern_retained_pending_station_qc"]
    assert counts["quarantined"] == sum(counts.get(key, 0) for key in ("negative_readings", "outside_unreviewed_0_to_150_candidate_range", "invalid_timestamps", "missing_measurement", "non_numeric_or_nonfinite_measurement"))
    karnal = next(block for block in readiness["blocks"] if block["block_id"] == "blk_karnal_assandh")
    if readiness["api_evidence_status"] == "VERIFIED":
        assert karnal["historical_observations_api_source"] == "historical_database"
        assert karnal["historical_observations_api_observation_count"] == 0
    else:
        assert karnal["historical_observations_api_source"] is None
        assert karnal["historical_observations_api_observation_count"] is None
    assert karnal["api_returns_trusted_nwdp_series"] is False


def test_2026_filter_definition_is_from_current_manifest_periods():
    manifest = json.loads((ROOT / "data/derived/nwdp_telemetry_ingestion_manifest.json").read_text())
    period_files = [item for item in manifest["input_resources"] if item["period"] == "2026-2030"]
    assert len(period_files) == 9
    assert {item["state"] for item in period_files} == {item["state"] for item in manifest["input_resources"]}
    assert sum(manifest["per_file"][item["filename"]]["source_rows"] for item in period_files) > 0


def test_route_never_labels_nwdp_local_output_as_a_verified_cgwb_archive():
    source = (ROOT / "src/app/api/historical-observations/route.ts").read_text(encoding="utf-8")
    assert "local_verified_cgwb_archive" not in source
    assert "local_processed_observation_archive" in source


def test_legacy_56_block_generator_cannot_overwrite_active_43_block_ledger():
    source = (ROOT / "scripts/audit_global_model_block_readiness.py").read_text(encoding="utf-8")
    assert "global_model_block_readiness_56_legacy.json" in source
    assert "global_model_block_readiness.json\"" not in source
    old_matrix_generator = (ROOT / "scripts/generate_43_matrix_md.py").read_text(encoding="utf-8")
    assert "canonical_43_telemetry_verification_matrix.json" not in old_matrix_generator
    assert "refresh_nwdp_readiness_report" in old_matrix_generator


def test_legacy_mixed_ingestion_cannot_overwrite_authoritative_outputs():
    source = (ROOT / "scripts/ingest_all_nwdp_telemetry.py").read_text(encoding="utf-8")
    assert "Deprecated mixed-source ingestor is disabled" in source
    assert "self.unverified_candidate_count += 1" in source
    assert "negative_reading_unverified_sign_and_datum" in source
    benchmark = (ROOT / "scripts/benchmark_recent_up_holdout.py").read_text(encoding="utf-8")
    assert "BLOCKED: no authoritative station-specific measurement convention" in benchmark
    assert ".abs()" not in benchmark


def test_generated_audit_keeps_historical_claims_unverified_and_captures_api_provenance_conflict():
    report = (ROOT / "audit/latest_nwdp_telemetry_audit.md").read_text(encoding="utf-8")
    assert "2026-2030 resource-file filter (not calendar-year filter)" in report
    assert "94,925 and 106,733 candidate claims are **UNVERIFIED and unreproducible**" in report
    assert "132,117" in report and "None of these are verified depths" in report
    assert "2025-11-15 — 8.65 metre below ground level" in report
    assert "gwl_manual_quarterly_cgwb_mp_2021_2025.csv" in report
    assert "quality_flag=passed` is preserved as a database field, not treated as independent verification" in report
    assert "0 operational" in report
