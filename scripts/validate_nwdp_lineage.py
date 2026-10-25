"""Verify source file hashes and row-level NWDP lineage against retained inputs."""
import csv
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate():
    source_root = ROOT / "data" / "sources" / "nwdp_telemetry_raw"
    derived = ROOT / "data" / "derived"
    source_manifest = json.loads((source_root / "nwdp_telemetry_download_manifest.json").read_text(encoding="utf-8"))
    ingest_manifest = json.loads((derived / "nwdp_telemetry_ingestion_manifest.json").read_text(encoding="utf-8"))
    approved = {item["filename"]: item for item in source_manifest["resources"] if item.get("validation_outcome") == "PASSED"}
    ingested = {item["filename"]: item for item in ingest_manifest["input_resources"]}
    if len(approved) != 18 or set(approved) != set(ingested):
        raise ValueError("Approved raw input set differs from the 18-file ingestion manifest")
    for filename, item in approved.items():
        actual = sha256_file(source_root / filename)
        if actual != item["sha256"] or actual != ingested[filename]["sha256"]:
            raise ValueError(f"SHA-256 mismatch for {filename}")

    per_file = Counter()
    validation_statuses = Counter()
    validation_reasons = Counter()
    previous_line = {}
    row_count = 0
    lineage_path = derived / "nwdp_telemetry_record_lineage.csv.gz"
    with gzip.open(lineage_path, "rt", encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        required = {"source_record_id", "source_file", "source_sha256", "source_line", "validation_status", "mapping_status", "aggregation_status"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError("Lineage ledger omits required identity or disposition fields")
        for row in reader:
            filename = row["source_file"]
            if filename not in approved:
                raise ValueError(f"Lineage references unapproved source file: {filename}")
            source_hash = approved[filename]["sha256"]
            try:
                source_line = int(row["source_line"])
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid physical line number for {filename}") from exc
            expected_id = f"sha256:{source_hash}:line:{source_line}"
            if row["source_sha256"] != source_hash or row["source_record_id"] != expected_id:
                raise ValueError(f"Lineage identity/hash mismatch at {filename}:{source_line}")
            if source_line <= previous_line.get(filename, 1):
                raise ValueError(f"Duplicate or out-of-order source line in {filename}")
            previous_line[filename] = source_line
            per_file[filename] += 1
            validation_statuses[row["validation_status"]] += 1
            validation_reasons[row["validation_reason"]] += 1
            row_count += 1

    for filename, counts in ingest_manifest["per_file"].items():
        if per_file[filename] != counts["source_rows"]:
            raise ValueError(f"Lineage row count mismatch for {filename}: {per_file[filename]} != {counts['source_rows']}")
    if row_count != ingest_manifest["counts"]["source_rows"]:
        raise ValueError("Lineage total does not reconcile with ingestion source_rows")
    counts = ingest_manifest["counts"]
    if validation_statuses["candidate_not_verified"] != counts["candidate_not_verified"]:
        raise ValueError("Candidate status count in lineage differs from ingestion manifest")
    if validation_statuses["quarantined"] != counts["quarantined"]:
        raise ValueError("Quarantine status count in lineage differs from ingestion manifest")
    for reason, count in validation_reasons.items():
        if counts.get(reason, 0) != count:
            raise ValueError(f"Validation reason count differs from ingestion manifest: {reason}")
    return {"status": "VERIFIED", "files": len(approved), "lineage_rows": row_count, "input_rows": counts["source_rows"], "hashes_match": True, "row_ids_match": True, "validation_counts_match": True, "validation_statuses": dict(validation_statuses)}


if __name__ == "__main__":
    print(json.dumps(validate(), indent=2))
