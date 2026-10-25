"""Rebuild the NWDP-only, fail-closed telemetry evidence set.

The 18 CSV resources in data/sources/nwdp_telemetry_raw are the sole input.
This deliberately produces no trusted block series until official station-to-
block containment evidence is supplied in the mapping registry.
"""
import csv
import gzip
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "sources" / "nwdp_telemetry_raw"
DERIVED = ROOT / "data" / "derived"
AUDIT = ROOT / "audit"
MANIFEST = RAW / "nwdp_telemetry_download_manifest.json"
CANONICAL = ROOT / "src" / "lib" / "data" / "canonical43Blocks.json"
LINEAGE = DERIVED / "nwdp_telemetry_record_lineage.csv.gz"
LINEAGE_TMP = DERIVED / "nwdp_telemetry_record_lineage.csv.gz.tmp"

TIMESTAMP_FORMATS = ("%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d-%m-%Y", "%Y-%m-%d")
SENTINELS = {99.0, 99.99, 999.0, 999.99}

def parse_timestamp(value):
    for fmt in TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(value.strip(), fmt)
        except (ValueError, AttributeError):
            pass
    return None

def header_indices(header):
    result = {}
    for idx, column in enumerate(x.strip().lower() for x in header):
        if "station" in column and ("code" not in column or "station" not in result): result["station"] = idx
        elif column == "state": result["state"] = idx
        elif column == "district": result["district"] = idx
        elif column == "block": result["block"] = idx
        elif column == "latitude": result["latitude"] = idx
        elif column == "longitude": result["longitude"] = idx
        elif "acquisition time" in column: result["timestamp"] = idx
        elif "groundwater level telemetry" in column: result["value"] = idx
    required = {"station", "state", "district", "timestamp", "value"}
    if not required.issubset(result): raise ValueError(f"Unsupported NWDP header; missing {required - set(result)}")
    return result

def get(row, indices, name):
    index = indices.get(name)
    return row[index].strip() if index is not None and index < len(row) else ""

def safe_float(value):
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) else None
    except (TypeError, ValueError):
        return None

def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def outcome(value, timestamp):
    if timestamp is None: return "quarantined", "invalid_timestamp"
    if not value or value == "-": return "quarantined", "missing_measurement"
    parsed = safe_float(value)
    if parsed is None: return "quarantined", "non_numeric_or_nonfinite_measurement"
    if parsed < 0: return "quarantined", "negative_unconverted_undocumented_datum"
    if parsed in SENTINELS: return "candidate_not_verified", "sentinel_pattern_retained_pending_station_qc"
    if parsed > 150: return "quarantined", "outside_unreviewed_0_to_150_candidate_range"
    # 0/1 are retained: no station-specific source evidence establishes a sentinel.
    return "candidate_not_verified", "zero_or_one_retained_pending_station_qc" if parsed in (0, 1) else "positive_candidate_undocumented_datum"

def rebuild_raw_outputs():
    DERIVED.mkdir(parents=True, exist_ok=True); AUDIT.mkdir(parents=True, exist_ok=True)
    if LINEAGE_TMP.exists():
        LINEAGE_TMP.unlink()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    resources = {entry["filename"]: entry for entry in manifest["resources"] if entry.get("validation_outcome") == "PASSED"}
    if len(resources) != 18: raise RuntimeError(f"Expected exactly 18 verified NWDP resources, found {len(resources)}")
    canonical = json.loads(CANONICAL.read_text(encoding="utf-8"))
    if len(canonical) != 43: raise RuntimeError(f"Expected exactly 43 canonical blocks, found {len(canonical)}")
    generated_at = datetime.now(timezone.utc).isoformat()
    totals, per_file, stations, registry_resources = Counter(), {}, {}, []

    with gzip.open(LINEAGE_TMP, "wt", encoding="utf-8", newline="", compresslevel=1) as lineage:
        writer = csv.writer(lineage)
        writer.writerow(["source_record_id", "source_file", "source_resource_url", "source_sha256", "source_line", "station_key", "source_station_name", "state", "district", "source_block", "latitude_source", "longitude_source", "original_timestamp", "normalized_timestamp", "original_measurement", "parsed_measurement_m", "validation_status", "validation_reason", "mapping_status", "aggregation_status"])
        for filename, resource in sorted(resources.items()):
            path = RAW / filename
            if not path.is_file() or path.stat().st_size != resource.get("byte_count"):
                raise RuntimeError(f"Raw source size mismatch: {filename}")
            source_sha = sha256_file(path)
            if source_sha != resource.get("sha256"):
                raise RuntimeError(f"Raw source SHA-256 mismatch: {filename}")
            file_counts = Counter()
            actual_min_timestamp, actual_max_timestamp = None, None
            with path.open("r", encoding="utf-8", newline="") as stream:
                reader = csv.reader(stream); indices = header_indices(next(reader))
                for row in reader:
                    # csv.reader.line_num counts physical source lines (including
                    # embedded newlines), unlike a logical-record enumerate index.
                    line_number = reader.line_num
                    if not row: continue
                    timestamp = parse_timestamp(get(row, indices, "timestamp"))
                    if timestamp:
                        day = timestamp.strftime("%Y-%m-%d")
                        actual_min_timestamp = min(actual_min_timestamp, day) if actual_min_timestamp else day
                        actual_max_timestamp = max(actual_max_timestamp, day) if actual_max_timestamp else day
                    raw_value = get(row, indices, "value")
                    status, reason = outcome(raw_value, timestamp)
                    value = safe_float(raw_value)
                    station = get(row, indices, "station")
                    state, district = get(row, indices, "state"), get(row, indices, "district")
                    station_key = f"{state}::{district}::{station}"
                    normalized_timestamp = timestamp.strftime("%Y-%m-%d %H:%M:%S") if timestamp else ""
                    writer.writerow([f"sha256:{source_sha}:line:{line_number}", filename, resource["url"], source_sha, line_number, station_key, station, state, district, get(row, indices, "block"), get(row, indices, "latitude"), get(row, indices, "longitude"), get(row, indices, "timestamp"), normalized_timestamp, raw_value, "" if value is None else value, status, reason, "unmapped_no_official_boundary_evidence", "not_published"])
                    totals["source_rows"] += 1; totals[status] += 1; totals[reason] += 1
                    file_counts["source_rows"] += 1; file_counts[status] += 1; file_counts[reason] += 1
                    stages = ["valid_timestamps" if timestamp else "invalid_timestamps", "parsed_numeric_measurements" if value is not None else "malformed_or_missing_measurements"]
                    if value is not None:
                        stages.append("positive_readings" if value > 0 else "zero_readings" if value == 0 else "negative_readings")
                        if value == 1: stages.append("exact_one_readings")
                    for stage in stages:
                        totals[stage] += 1; file_counts[stage] += 1
                    if status == "candidate_not_verified":
                        entry = stations.setdefault(station_key, {"station_key": station_key, "source_station_name": station, "state": state, "district": district, "source_block": get(row, indices, "block") or None, "latitude_source": get(row, indices, "latitude") or None, "longitude_source": get(row, indices, "longitude") or None, "candidate_observation_count": 0, "latest_candidate_timestamp": None, "source_files": set()})
                        entry["candidate_observation_count"] += 1; entry["source_files"].add(filename)
                        if not entry["latest_candidate_timestamp"] or normalized_timestamp > entry["latest_candidate_timestamp"]: entry["latest_candidate_timestamp"] = normalized_timestamp
            per_file[filename] = dict(file_counts)
            registry_resources.append({
                "relative_path": path.relative_to(ROOT).as_posix(),
                "filename": filename,
                "state": resource["state"],
                "dataset_period_label": resource["period"],
                "source_url": resource.get("url"),
                "issuing_authority": resource.get("issuing_authority") or resource.get("agency") or "Not specified in retained download manifest",
                "retrieved_at": resource.get("download_timestamp"),
                "byte_count": path.stat().st_size,
                "sha256": source_sha,
                "encoding": "UTF-8 (strict decode succeeded)",
                "schema": resource.get("header", []),
                "row_count": file_counts["source_rows"],
                "observed_timestamp_min": actual_min_timestamp,
                "observed_timestamp_max": actual_max_timestamp,
                "parser_version": "nwdp-authoritative-rebuild-v2",
                "validation_version": "nwdp-raw-quality-v2",
                "data_quality_status": "raw_integrity_valid; candidate telemetry not verified groundwater depth",
                "source_lineage": "source_record_id = sha256:<file_sha256>:line:<physical_csv_line>; see data/derived/nwdp_telemetry_record_lineage.csv.gz",
                "processing_lineage": "scripts/rebuild_nwdp_authoritative.py; scripts/validate_nwdp_lineage.py",
                "row_validation_counts": dict(file_counts),
            })

    # Do not expose a partial record ledger if a run is interrupted.
    LINEAGE_TMP.replace(LINEAGE)

    source_registry = {
        "generated_at": generated_at,
        "registry_version": "1.0.0",
        "authority_scope": "These 18 retained NWDP resources are the sole raw telemetry inputs for the active NWDP pipeline.",
        "active_scope": {"states": 9, "assam_excluded": True, "resources": 18},
        "source_manifest": "data/sources/nwdp_telemetry_raw/nwdp_telemetry_download_manifest.json",
        "validation_report": "data/derived/nwdp_telemetry_validation_report.json",
        "resources": sorted(registry_resources, key=lambda item: item["filename"]),
        "limitations": [
            "Dataset period labels are copied from catalogue metadata; actual observed timestamp coverage is separately recomputed.",
            "The retained manifest does not provide station-specific CRS, datum, installation depth, calibration, or sign convention.",
            "Issuing authority is reported only when the retained resource metadata contains it; otherwise explicitly unspecified.",
            "Hash/encoding/header integrity does not establish measurement validity or station-to-block membership."
        ]
    }
    (RAW / "nwdp_telemetry_source_registry.json").write_text(json.dumps(source_registry, indent=2), encoding="utf-8")
    (DERIVED / "nwdp_telemetry_validation_report.json").write_text(json.dumps({
        "generated_at": generated_at,
        "source_registry": "data/sources/nwdp_telemetry_raw/nwdp_telemetry_source_registry.json",
        "source_rows": dict(totals),
        "quality_policy": {
            "negative": "quarantined unconverted; no sign or datum conversion",
            "zero_one": "retained as candidates pending station-specific QC",
            "sentinel_patterns": "unresolved candidate pending station-specific evidence",
            "missing_malformed_timestamp": "quarantined",
            "verified_groundwater_depth_rows": 0,
            "block_mapped_station_rows": 0
        },
        "per_file": {name: {**counts, "timestamp_min": next((item["observed_timestamp_min"] for item in registry_resources if item["filename"] == name), None), "timestamp_max": next((item["observed_timestamp_max"] for item in registry_resources if item["filename"] == name), None)} for name, counts in per_file.items()},
        "reconciles": sum(item["row_count"] for item in registry_resources) == totals["source_rows"]
    }, indent=2), encoding="utf-8")

    canonical_out = [{"block_id": b["id"], "state": b["state"], "district": b["districtName"], "block_name": b["name"], "coordinates_wgs84": b.get("coordinates")} for b in canonical]
    (AUDIT / "canonical_43_blocks_active.json").write_text(json.dumps({"generated_at": generated_at, "scope": {"states": 9, "blocks": 43, "assam_excluded": True}, "blocks": canonical_out}, indent=2), encoding="utf-8")
    registry = {"registry_type": "nwdp_station_block_mapping_evidence", "registry_version": "1.0.0", "generated_at": generated_at, "policy": "Only an official station-to-block record or point-in-authoritative-block-boundary result in a documented CRS can set verified=true. Station-specific measurement semantics must be separately verified before publishing as groundwater depth.", "entries": [{"block_id": b["block_id"], "state": b["state"], "district": b["district"], "block_name": b["block_name"], "mapping_status": "unresolved", "verified": False, "measurement_semantics_verified": False, "mapping_method": None, "evidence": None, "blocking_reason": "No official station-to-block record or authoritative block polygon containment evidence is retained locally."} for b in canonical_out], "stations": [{**{k: v for k, v in value.items() if k != "source_files"}, "source_files": sorted(value["source_files"]), "mapping_status": "unresolved", "block_id": None, "verified": False, "measurement_semantics_verified": False, "evidence_source": None, "evidence_identifier": None, "retrieval_date": None, "boundary_dataset_version": None, "mapping_method": None, "measurement_evidence": None, "blocking_reason": "No official station metadata, authoritative block containment evidence, or station-specific measurement convention is retained locally."} for value in stations.values()]}
    (DERIVED / "nwdp_station_block_mapping_evidence.json").write_text(json.dumps(registry, indent=2), encoding="utf-8")
    normalized_stations = [{**{k: v for k, v in value.items() if k != "source_files"}, "source_files": sorted(value["source_files"]), "mapping_status": "unmapped_no_official_boundary_evidence"} for value in stations.values()]
    (DERIVED / "nwdp_telemetry_normalized.json").write_text(json.dumps({"generated_at": generated_at, "input_scope": "18 NWDP resources only; no regional/manual/legacy files", "record_lineage": str(LINEAGE.relative_to(ROOT)).replace("\\", "/"), "counts": dict(totals), "stations": normalized_stations}, indent=2), encoding="utf-8")
    (DERIVED / "nwdp_telemetry_ingestion_manifest.json").write_text(json.dumps({"generated_at": generated_at, "input_resources": [{"filename": n, "state": r["state"], "period": r["period"], "sha256": r["sha256"], "url": r["url"]} for n, r in sorted(resources.items())], "counts": dict(totals), "per_file": per_file, "lineage_file": str(LINEAGE.relative_to(ROOT)).replace("\\", "/")}, indent=2), encoding="utf-8")
    (DERIVED / "nwdp_telemetry_quarantine.json").write_text(json.dumps({"generated_at": generated_at, "lineage_file": str(LINEAGE.relative_to(ROOT)).replace("\\", "/"), "quarantine_counts": {key: value for key, value in totals.items() if key.startswith("quarantined") or key in {"invalid_timestamp", "missing_measurement", "non_numeric_or_nonfinite_measurement", "negative_unconverted_undocumented_datum", "documented_sensor_fault_code", "outside_unreviewed_0_to_150_candidate_range"}}, "note": "Use the record lineage file for individual quarantined records."}, indent=2), encoding="utf-8")
    # Nothing is published until the evidence registry contains reviewed proof.
    (DERIVED / "nwdp_block_telemetry_series.json").write_text("{}\n", encoding="utf-8")
    readiness = {"generated_at": generated_at, "scope": {"states": 9, "blocks": 43, "assam_excluded": True}, "freshness_policy": {"max_observation_age_days": 400, "reference_date": "2026-10-25"}, "blocks": [{**b, "mapping_status": "unresolved", "accepted_observations": 0, "latest_verified_observation_date": None, "freshness_gate_passes": False, "operational_eligibility": False, "readiness_status": "unverified_station_mapping", "blocking_reason": "No official station-to-block mapping evidence; NWDP candidate records are excluded from trusted block output."} for b in canonical_out]}
    (AUDIT / "global_model_block_readiness.json").write_text(json.dumps(readiness, indent=2), encoding="utf-8")
    return {"resources": len(resources), "canonical_blocks": len(canonical), "counts": dict(totals), "lineage": str(LINEAGE)}

def main():
    # Direct invocation is routed through the freshness-aware orchestrator.
    from scripts.nwdp_pipeline import main as pipeline_main

    return pipeline_main()

if __name__ == "__main__":
    raise SystemExit(main())
