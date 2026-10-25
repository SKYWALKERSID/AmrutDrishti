"""Single freshness-aware entry point for NWDP rebuild, validation, and consumers."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.nwdp_pipeline_freshness import execute_freshness_pipeline, sha256_file

RAW = ROOT / "data" / "sources" / "nwdp_telemetry_raw"
DERIVED = ROOT / "data" / "derived"
MARKER = DERIVED / "nwdp_pipeline_completion.json"
LOCK = DERIVED / ".nwdp_pipeline.lock"
OUTPUTS = [
    "data/sources/nwdp_telemetry_raw/nwdp_telemetry_source_registry.json",
    "data/derived/nwdp_telemetry_validation_report.json",
    "data/derived/nwdp_telemetry_ingestion_manifest.json",
    "data/derived/nwdp_telemetry_normalized.json",
    "data/derived/nwdp_telemetry_quarantine.json",
    "data/derived/nwdp_telemetry_record_lineage.csv.gz",
    "data/derived/nwdp_station_block_mapping_evidence.json",
    "data/derived/nwdp_block_telemetry_series.json",
    "audit/canonical_43_blocks_active.json",
]
ACTIVE_STATES = {
    "Madhya Pradesh", "Rajasthan", "Punjab", "Haryana", "Karnataka",
    "Telangana", "Tamil Nadu", "Meghalaya", "Tripura",
}


def source_fingerprint(root: Path = ROOT) -> tuple[str, dict[str, str]]:
    raw_root = root / "data" / "sources" / "nwdp_telemetry_raw"
    manifest_path = raw_root / "nwdp_telemetry_download_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    resources = [item for item in manifest.get("resources", []) if item.get("validation_outcome") == "PASSED"]
    if len(resources) != 18 or {item.get("state") for item in resources} != ACTIVE_STATES:
        raise ValueError("expected_exactly_18_resources_across_approved_nine_states")
    if any(item.get("state", "").casefold() == "assam" for item in resources):
        raise ValueError("assam_in_active_nwdp_resources")
    periods: dict[str, set[str]] = {}
    for item in resources:
        periods.setdefault(item["state"], set()).add(item.get("period", ""))
    if any(periods.get(state) != {"2021-2025", "2026-2030"} for state in ACTIVE_STATES):
        raise ValueError("each_approved_state_requires_exactly_two_retained_periods")
    hashes: dict[str, str] = {}
    for item in sorted(resources, key=lambda value: value["filename"]):
        path = raw_root / item["filename"]
        if not path.is_file() or path.stat().st_size != item.get("byte_count"):
            raise ValueError(f"raw_source_size_mismatch:{item['filename']}")
        digest = sha256_file(path)
        if digest != item.get("sha256"):
            raise ValueError(f"raw_source_sha256_mismatch:{item['filename']}")
        hashes[item["filename"]] = digest
    rebuild_path = root / "scripts" / "rebuild_nwdp_authoritative.py"
    validator_path = root / "scripts" / "validate_nwdp_lineage.py"
    payload = {
        "pipeline_version": "nwdp-pipeline-v1",
        "manifest_sha256": sha256_file(manifest_path),
        "raw_file_hashes": hashes,
        "processing_code_sha256": {
            rebuild_path.name: sha256_file(rebuild_path),
            validator_path.name: sha256_file(validator_path),
        },
        "validation_rules_version": "nwdp-raw-quality-v2",
        "source_scope": sorted(ACTIVE_STATES),
    }
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return fingerprint, hashes


def ensure_current() -> dict[str, Any]:
    fingerprint, _ = source_fingerprint()

    def rebuild():
        from scripts.rebuild_nwdp_authoritative import rebuild_raw_outputs

        return rebuild_raw_outputs()

    def validate():
        from scripts.validate_nwdp_lineage import validate

        return validate()

    def outputs_are_compatible():
        try:
            registry = json.loads((RAW / "nwdp_telemetry_source_registry.json").read_text(encoding="utf-8"))
            report = json.loads((DERIVED / "nwdp_telemetry_validation_report.json").read_text(encoding="utf-8"))
            ingestion = json.loads((DERIVED / "nwdp_telemetry_ingestion_manifest.json").read_text(encoding="utf-8"))
            expected_rows = sum(item["row_count"] for item in registry.get("resources", []))
            return (
                registry.get("registry_version") == "1.0.0"
                and all(item.get("parser_version") == "nwdp-authoritative-rebuild-v2" for item in registry.get("resources", []))
                and report.get("source_registry") == "data/sources/nwdp_telemetry_raw/nwdp_telemetry_source_registry.json"
                and report.get("source_rows", {}).get("source_rows") == expected_rows
                and ingestion.get("counts", {}).get("source_rows") == expected_rows
                and len(registry.get("resources", [])) == 18
            )
        except (OSError, json.JSONDecodeError, AttributeError):
            return False

    return execute_freshness_pipeline(
        root=ROOT,
        marker_path=MARKER,
        lock_path=LOCK,
        fingerprint=fingerprint,
        outputs=OUTPUTS,
        rebuild=rebuild,
        validate=validate,
        adopt_existing_if=outputs_are_compatible,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", action="store_true", help="train station models after verified data preparation")
    parser.add_argument("--refresh-readiness", action="store_true", help="regenerate readiness/audit outputs after verification")
    parser.add_argument("--as-of", default=None, help="readiness date (YYYY-MM-DD)")
    args = parser.parse_args(argv)
    result = ensure_current()
    downstream: dict[str, Any] = {}
    if args.train:
        from ml.nwdp_training import train

        downstream["training"] = train(ensure_outputs=False)
    if args.refresh_readiness:
        from scripts.refresh_nwdp_readiness_report import main as refresh_readiness

        refresh_args = ["--as-of", args.as_of] if args.as_of else []
        refresh_readiness(refresh_args, ensure_outputs=False)
        downstream["readiness"] = "refreshed"
    print(json.dumps({
        "status": "current" if not result["rebuilt"] else "rebuilt_and_verified",
        "input_fingerprint": result["input_fingerprint"],
        "rebuilt": result["rebuilt"],
        "validation": result["validation"],
        "downstream": downstream,
    }, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
