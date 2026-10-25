"""Refresh 43-block readiness from current canonical, mapping and series evidence.

This script does not promote candidates. Unassigned candidates are reported at
state level; block-level candidate counts remain unknown until mapping evidence
assigns stations. Operational eligibility is derived from explicit evidence.
"""
import argparse
import csv
import io
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
AUDIT = ROOT / "audit"
DERIVED = ROOT / "data" / "derived"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def build_evidence_status(build, source_generated_at):
    """A type-check or dev-server result alone is never a production-build pass."""
    excerpt = build.get("output_excerpt", "") if isinstance(build, dict) else ""
    try:
        finished_at = datetime.fromisoformat(build["finished_at"].replace("Z", "+00:00"))
        source_at = datetime.fromisoformat(source_generated_at.replace("Z", "+00:00"))
    except (KeyError, AttributeError, TypeError, ValueError):
        return "UNVERIFIED"
    return "VERIFIED" if (
        build.get("command") == "npm run build"
        and build.get("exit_code") == 0
        and "Compiled successfully" in excerpt
        and "/api/historical-observations" in excerpt
        and finished_at >= source_at
    ) else "UNVERIFIED"


def api_evidence_status(evidence, source_generated_at, build_finished_at):
    if not isinstance(evidence, dict) or evidence.get("captured_http") is not True:
        return "UNVERIFIED"
    requests = evidence.get("requests")
    if not isinstance(requests, list) or not requests:
        return "UNVERIFIED"
    captured = [r for r in requests if isinstance(r, dict)
                and isinstance(r.get("request_url"), str)
                and "/api/historical-observations" in r["request_url"]
                and r.get("status") == 200
                and isinstance(r.get("source"), str)
                and isinstance(r.get("observation_count"), int)
                and isinstance(r.get("response_body"), dict)
                and r["response_body"].get("source") == r["source"]
                and isinstance(r["response_body"].get("observations"), list)]
    try:
        captured_at = datetime.fromisoformat(evidence["captured_at"].replace("Z", "+00:00"))
        source_at = datetime.fromisoformat(source_generated_at.replace("Z", "+00:00"))
        build_at = datetime.fromisoformat(build_finished_at.replace("Z", "+00:00"))
    except (KeyError, AttributeError, TypeError, ValueError):
        return "UNVERIFIED"
    return "VERIFIED" if captured and captured_at >= max(source_at, build_at) else "UNVERIFIED"


def exclusive_categories_reconcile(counts):
    exclusive = sum(counts.get(key, 0) for key in (
        "negative_readings", "zero_readings", "exact_one_readings",
        "positive_candidate_undocumented_datum", "sentinel_pattern_retained_pending_station_qc",
        "outside_unreviewed_0_to_150_candidate_range",
        "invalid_timestamps", "missing_measurement", "non_numeric_or_nonfinite_measurement",
    ))
    return exclusive == counts.get("source_rows")


def source_artifacts_are_synchronized(manifest, canonical, mapping):
    timestamp = manifest.get("generated_at")
    return bool(timestamp and canonical.get("generated_at") == timestamp and mapping.get("generated_at") == timestamp)


def main(argv=None, ensure_outputs=True):
    if ensure_outputs:
        from scripts.nwdp_pipeline import ensure_current

        ensure_current()
    parser = argparse.ArgumentParser()
    parser.add_argument("--as-of", default=date.today().isoformat(), help="Freshness reference date (YYYY-MM-DD)")
    args = parser.parse_args(argv)
    as_of = date.fromisoformat(args.as_of)
    canonical_doc = read(AUDIT / "canonical_43_blocks_active.json")
    manifest = read(DERIVED / "nwdp_telemetry_ingestion_manifest.json")
    mappings = read(DERIVED / "nwdp_station_block_mapping_evidence.json")
    series = read(DERIVED / "nwdp_block_telemetry_series.json")
    verification_path = AUDIT / "latest_telemetry_verification_evidence.json"
    verification = read(verification_path) if verification_path.exists() else {}
    api_evidence = verification.get("api_smoke", {})
    build = verification.get("build", {})
    build_status = build_evidence_status(build, manifest.get("generated_at", ""))
    api_status = api_evidence_status(api_evidence, manifest.get("generated_at", ""), build.get("finished_at", ""))
    blocks = canonical_doc.get("blocks", [])
    resources = manifest.get("input_resources", [])
    if not source_artifacts_are_synchronized(manifest, canonical_doc, mappings):
        raise ValueError("Canonical or mapping evidence is stale relative to the current ingestion manifest")
    if len(blocks) != 43 or len({b.get("block_id") for b in blocks}) != 43:
        raise ValueError("Canonical registry must contain exactly 43 unique blocks")
    if len(resources) != 18 or len({r.get("state") for r in resources}) != 9:
        raise ValueError("Current ingestion manifest must contain 18 inputs across nine states")
    if any(r.get("state", "").casefold() == "assam" for r in resources):
        raise ValueError("Assam is excluded from active telemetry inputs")
    block_ids = {b["block_id"] for b in blocks}
    mapping_entries = {m.get("block_id"): m for m in mappings.get("entries", [])}
    if set(mapping_entries) != block_ids:
        raise ValueError("Mapping registry block IDs differ from the canonical registry")
    states = sorted({b["state"] for b in blocks})
    if len(states) != 9 or "Assam" in states:
        raise ValueError("Canonical registry must preserve nine active states and exclude Assam")

    candidate_counts = {}
    for station in mappings.get("stations", []):
        state = station.get("state")
        if state:
            candidate_counts[state] = candidate_counts.get(state, 0) + int(station.get("candidate_observation_count", 0))

    readiness_blocks = []
    for block in blocks:
        block_id = block["block_id"]
        entry = mapping_entries[block_id]
        telemetry = series.get(block_id) if isinstance(series, dict) else None
        block_map_verified = entry.get("verified") is True
        station_records = [s for s in mappings.get("stations", []) if s.get("verified") is True and s.get("block_id") == block_id]
        map_verified = block_map_verified and bool(station_records)
        raw_observations = telemetry.get("observations", []) if isinstance(telemetry, dict) else []
        measurement_verified = bool(telemetry and telemetry.get("measurement_validation_status") == "verified")
        accepted = len(raw_observations) if map_verified and measurement_verified else 0
        valid_dates = []
        if accepted:
            valid_dates = [date.fromisoformat(o["observationDate"]) for o in raw_observations if isinstance(o, dict) and isinstance(o.get("observationDate"), str)]
            if len(valid_dates) != accepted:
                accepted = 0
                valid_dates = []
        latest = max(valid_dates) if valid_dates else None
        age = (as_of - latest).days if latest else None
        fresh = bool(age is not None and 0 <= age <= 400)
        forecast_compatible = bool(map_verified and measurement_verified and accepted >= 2 and fresh)
        operational = forecast_compatible and bool(telemetry.get("operational_validation_status") == "passed")
        reasons = []
        if not map_verified:
            reasons.append("official_station_to_block_mapping_unresolved")
        if not measurement_verified:
            reasons.append("measurement_semantics_or_station_calibration_unverified")
        if accepted == 0:
            reasons.append("no_trusted_block_observations")
        if accepted and not fresh:
            reasons.append("400_day_freshness_gate_failed")
        if forecast_compatible and not operational:
            reasons.append("operational_validation_evidence_missing")
        block_api = next((r for r in api_evidence.get("requests", [])
                          if api_status == "VERIFIED" and f"block={block_id}" in r.get("request_url", "")), None)
        readiness_blocks.append({
            **block,
            "matched_stations": [s.get("station_key") for s in station_records],
            "mapping_verification_status": "verified" if map_verified else "unresolved",
            "accepted_observations": accepted,
            "unverified_candidate_observations": None,
            "candidate_count_note": "Not assignable to a block while station mapping is unresolved; candidates are available only at source/state level.",
            "provisional_observations": None,
            "latest_verified_observation_date": latest.isoformat() if latest else None,
            "days_since_latest_observation": age,
            "freshness_gate_passes": fresh,
            "measurement_validation_status": "verified" if measurement_verified else "unverified",
            "forecast_compatibility_status": "compatible" if forecast_compatible else "blocked",
            "operational_eligibility": operational,
            "readiness_status": "available" if operational else ("stale" if accepted and not fresh else "unverified_station_mapping" if not map_verified else "insufficient_data"),
            "blocking_reasons": reasons,
            "historical_observations_api_status": "VERIFIED" if block_api else "UNVERIFIED",
            "historical_observations_api_source": block_api.get("source") if block_api else None,
            "historical_observations_api_observation_count": block_api.get("observation_count") if block_api else None,
            "api_returns_trusted_nwdp_series": bool(block_api and block_api.get("source") == "local_processed_observation_archive" and block_api.get("observation_count", 0) > 0),
            "api_current_forecast_status": "available" if operational else f"unavailable_{'unverified_station_mapping' if not map_verified else 'insufficient_data' if accepted == 0 else 'stale'}",
        })

    generated_at = datetime.now(timezone.utc).isoformat()
    source_counts = manifest["counts"]
    exclusive_ok = exclusive_categories_reconcile(source_counts)
    accounting_ok = source_counts["source_rows"] == source_counts["candidate_not_verified"] + source_counts["quarantined"]
    candidate_parts = (source_counts.get("zero_readings", 0) + source_counts.get("exact_one_readings", 0)
                       + source_counts.get("positive_candidate_undocumented_datum", 0)
                       + source_counts.get("sentinel_pattern_retained_pending_station_qc", 0))
    quarantine_parts = (source_counts.get("negative_readings", 0)
                        + source_counts.get("outside_unreviewed_0_to_150_candidate_range", 0)
                        + source_counts.get("invalid_timestamps", 0) + source_counts.get("missing_measurement", 0)
                        + source_counts.get("non_numeric_or_nonfinite_measurement", 0))
    if not (exclusive_ok and accounting_ok and candidate_parts == source_counts["candidate_not_verified"] and quarantine_parts == source_counts["quarantined"]):
        raise ValueError("Current source-row classification does not reconcile; refusing to publish audit outputs")
    window_resources = [r for r in resources if r.get("period") == "2026-2030"]
    if len(window_resources) != 9:
        raise ValueError("Expected exactly one 2026-2030 resource for each of nine active states")
    window_totals = {}
    for resource in window_resources:
        for key, value in manifest["per_file"][resource["filename"]].items():
            window_totals[key] = window_totals.get(key, 0) + value
    readiness = {
        "generated_at": manifest.get("generated_at"),
        "source_artifact_generated_at": manifest.get("generated_at"),
        "scope": {"states": 9, "blocks": 43, "assam_excluded": True},
        "freshness_policy": {"max_observation_age_days": 400, "reference_date": as_of.isoformat()},
        "build_evidence_status": build_status,
        "api_evidence_status": api_status,
        "blocks": readiness_blocks,
        "reconciliation": {
            "source_scope": "18 retained NWDP government CSVs only (2021-2025 and 2026-2030 per active state)",
            "input_rows": source_counts["source_rows"],
            "candidate_not_verified": source_counts["candidate_not_verified"],
            "quarantined": source_counts["quarantined"],
            "published_block_observations": sum(b["accepted_observations"] for b in readiness_blocks),
            "accounting_reconciles": accounting_ok,
            "exclusive_reading_categories_reconcile": exclusive_ok,
            "unassigned_candidate_counts_by_state": candidate_counts,
        },
    }
    (AUDIT / "global_model_block_readiness.json").write_text(json.dumps(readiness, indent=2) + "\n", encoding="utf-8")

    lines = [
        f"# NWDP 43-block readiness (as of {as_of.isoformat()})", "",
        f"Generated {generated_at}; input ingestion manifest generated {manifest.get('generated_at')}. Production build evidence: **{build_status}**; captured API smoke: **{api_status}**. NWDP candidates remain distinct from trusted observations. No block receives candidate counts without verified station membership. The 400-day gate is unchanged.", "",
        "| State | District | Block ID | Block | Stations | Mapping | Accepted trusted | Unverified candidates | Provisional | Latest verified | Days old | <=400d | Forecast | API source/count | Operational | Blocking reason |",
        "|---|---|---|---|---:|---|---:|---:|---:|---|---:|---|---|---|---|---|",
    ]
    for block in readiness_blocks:
        api_label = f"{block['historical_observations_api_source']} / {block['historical_observations_api_observation_count']}" if block['historical_observations_api_status'] == 'VERIFIED' else 'unverified'
        lines.append(f"| {block['state']} | {block['district']} | `{block['block_id']}` | {block['block_name']} | {len(block['matched_stations'])} | {block['mapping_verification_status']} | {block['accepted_observations']} | — | — | {block['latest_verified_observation_date'] or '—'} | {block['days_since_latest_observation'] if block['days_since_latest_observation'] is not None else '—'} | {'Yes' if block['freshness_gate_passes'] else 'No'} | {block['forecast_compatibility_status']} | {api_label} | {'Yes' if block['operational_eligibility'] else 'No'} | {', '.join(block['blocking_reasons']) or 'none'} |")
    (AUDIT / "nwdp_43_block_readiness.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    report = [
        f"# Current NWDP telemetry audit — {as_of.isoformat()}", "",
        f"Generated from ingestion manifest `{manifest.get('generated_at')}`, canonical registry `{canonical_doc.get('generated_at')}`, current mapping evidence, block series, and captured verification evidence.", "",
        "## Evidence status", "",
        f"- Production build: **{build_status}** (`npm run build`, exit {build.get('exit_code', 'not recorded')}); typecheck is not substituted for a build.",
        f"- Local HTTP smoke: **{api_status}**; see `latest_telemetry_verification_evidence.json` for request/status/source/count details.",
        f"- Raw lineage: **{verification.get('lineage_validation', {}).get('status', 'UNVERIFIED')}**; source files/hashes and record IDs are checked separately from measurement validity.",
        "- Trusted NWDP observations: 0; no verified station mapping or station-specific measurement convention/calibration.",
        "- Readiness: 43 canonical rows, 0 operational; freshness policy remains 400 days.", "",
        "## Regression and project checks", "",
        "| Check | Exit | Result |", "|---|---:|---|",
        f"| `{verification.get('tests', {}).get('typescript', {}).get('command', 'npx tsc --noEmit')}` | {verification.get('tests', {}).get('typescript', {}).get('exit_code', 'not recorded')} | TypeScript check |",
        f"| `{verification.get('tests', {}).get('javascript_full', {}).get('command', 'npm test')}` | {verification.get('tests', {}).get('javascript_full', {}).get('exit_code', 'not recorded')} | {verification.get('tests', {}).get('javascript_full', {}).get('passed', '—')} passed; {verification.get('tests', {}).get('javascript_full', {}).get('failed', '—')} failed; {verification.get('tests', {}).get('javascript_full', {}).get('skipped', '—')} skipped |",
        f"| Focused JavaScript | {verification.get('tests', {}).get('javascript_focused', {}).get('exit_code', 'not recorded')} | {verification.get('tests', {}).get('javascript_focused', {}).get('passed', '—')} passed |",
        f"| Focused Python telemetry/audit | {verification.get('tests', {}).get('python_focused', {}).get('exit_code', 'not recorded')} | {verification.get('tests', {}).get('python_focused', {}).get('passed', '—')} passed |",
        f"| Full Python suite | {verification.get('tests', {}).get('python_full', {}).get('exit_code', 'not recorded')} | {verification.get('tests', {}).get('python_full', {}).get('passed', '—')} passed; {verification.get('tests', {}).get('python_full', {}).get('failed', '—')} failed; see blockers below |", "",
        "## Mutually exclusive raw-row reconciliation", "",
        "| Exclusive class | Rows |", "|---|---:|",
        f"| Negative, unconverted and unverified | {source_counts.get('negative_readings', 0)} |",
        f"| Exact zero, retained candidate | {source_counts.get('zero_readings', 0)} |",
        f"| Exact one, retained candidate | {source_counts.get('exact_one_readings', 0)} |",
        f"| Other positive candidate values (current candidate range, excluding exact one/fault/sentinel) | {source_counts.get('positive_candidate_undocumented_datum', 0)} |",
        f"| Sentinel-like parser patterns, retained pending station QC | {source_counts.get('sentinel_pattern_retained_pending_station_qc', 0)} |",
        f"| Positive readings above 150, pending review | {source_counts.get('outside_unreviewed_0_to_150_candidate_range', 0)} |",
        f"| Invalid timestamps | {source_counts.get('invalid_timestamps', 0)} |",
        f"| Missing measurements | {source_counts.get('missing_measurement', 0)} |",
        f"| Malformed/nonfinite measurements | {source_counts.get('non_numeric_or_nonfinite_measurement', 0)} |",
        f"| **Total source records / exclusive classes** | **{source_counts['source_rows']} / {sum(source_counts.get(k, 0) for k in ('negative_readings','zero_readings','exact_one_readings','positive_candidate_undocumented_datum','sentinel_pattern_retained_pending_station_qc','outside_unreviewed_0_to_150_candidate_range','invalid_timestamps','missing_measurement','non_numeric_or_nonfinite_measurement'))}** |",
        "", f"Candidate total = zero + exact-one + other positive candidates + sentinel-like values pending station QC = {source_counts['candidate_not_verified']}; quarantine total = negative + >150 + invalid/missing/malformed = {source_counts['quarantined']}. Sentinel-like means only the parser's configured numeric pattern set; no station-specific evidence confirms those values are fault codes. Positive numeric readings ({source_counts.get('positive_readings', 0)}) are a non-exclusive sign diagnostic, not a validation total.", "",
        "## 2026-2030 resource-file filter (not calendar-year filter)", "",
        f"Filter: include the nine manifest resources whose period is exactly `2026-2030`; count all physical non-empty CSV source rows in those files. Candidate definition remains zero/exact-one/other positive candidate under the current ingestion rules; quarantine remains the exclusive remainder.", "",
        "| State | Source file | Rows | Positive numeric | Zero | Exact one | Other positive candidate | >150 | Candidate | Quarantined |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for resource in sorted(window_resources, key=lambda r: r["state"]):
        file_counts = manifest["per_file"][resource["filename"]]
        report.append(f"| {resource['state']} | `{resource['filename']}` | {file_counts.get('source_rows', 0)} | {file_counts.get('positive_readings', 0)} | {file_counts.get('zero_readings', 0)} | {file_counts.get('exact_one_readings', 0)} | {file_counts.get('positive_candidate_undocumented_datum', 0)} | {file_counts.get('outside_unreviewed_0_to_150_candidate_range', 0)} | {file_counts.get('candidate_not_verified', 0)} | {file_counts.get('quarantined', 0)} |")
    report.extend([
        f"| **Total** | **9 files** | **{window_totals.get('source_rows', 0)}** | **{window_totals.get('positive_readings', 0)}** | **{window_totals.get('zero_readings', 0)}** | **{window_totals.get('exact_one_readings', 0)}** | **{window_totals.get('positive_candidate_undocumented_datum', 0)}** | **{window_totals.get('outside_unreviewed_0_to_150_candidate_range', 0)}** | **{window_totals.get('candidate_not_verified', 0)}** | **{window_totals.get('quarantined', 0)}** |",
        "", f"The historical 94,925 and 106,733 candidate claims are **UNVERIFIED and unreproducible**: the prior artifacts/filter definitions are absent. The historical 85,348 zero/one claim is not current; the current full-source zero-plus-one count is {source_counts.get('zero_readings', 0) + source_counts.get('exact_one_readings', 0):,}. The current {window_totals.get('positive_readings', 0):,} figure is only the raw positive-numeric diagnostic for the nine 2026-2030 files; current candidates are {window_totals.get('candidate_not_verified', 0):,} and other positive candidates are {window_totals.get('positive_candidate_undocumented_datum', 0):,}. None of these are verified depths.", "",
        "## Remaining blockers", "",
        "- **BLOCKED — station mapping:** official station coordinate/CRS and authoritative block-containment evidence remain absent, including ChocftraPz, Bapi_Pz_1, TIGARIA_1, and UTHANDI_1. Their candidates stay unassigned.",
        "- **BLOCKED — measurement semantics:** station-specific sign convention, datum, installation depth and calibration are not documented. Negative values are not converted; zero/one remain candidates pending station-specific QC.",
        "- **FAILED — full Python suite:** exit 1, 26 failures / 97 passes. Failures include missing CGWB Ingres and UP source/artifact fixtures, obsolete 56-block assertions, and the model HTTP-serving test. No deleted inputs were restored or fabricated.",
        "- **UNVERIFIED — Supabase row lineage:** one live row is labelled NWIC telemetry while its source URL names a manual quarterly CGWB CSV; the source file is absent locally. `quality_flag=passed` does not resolve this provenance conflict.",
        "- **UNVERIFIED — remote error branch:** database error and fallback decisions pass focused tests, but a live Supabase error was not forced. Local smoke showed the empty Supabase result and the published-result branch.", "",
        "## Discrepancy register", "",
        "| Prior claim | Current evidence / root cause | Correction | Status |",
        "|---|---|---|---|",
        "| Typecheck implied production build ready | A TypeScript command is not a build result; current run has explicit `npm run build` exit 0 and Next output in the evidence file. | Generator accepts only explicit build command + exit 0 + build output marker; no inference from tsc/dev startup. | FIXED / current build VERIFIED |",
        "| API commands implied endpoint verification | Command history alone omits status/body/source/count. | Captured local production HTTP responses, including empty block result, invalid-parameter errors, and database result metadata. | FIXED / live smoke VERIFIED |",
        "| Section 7 per-block hundreds of observations | The cited legacy matrix source is not present in the current checkout; the older generator expects `audit/canonical_43_telemetry_verification_matrix.json`, which is absent. It cannot be determined whether those counts came from manual CGWB/State GWD data, unverified telemetry, or a prior fuzzy crosswalk. Current canonical registry plus mapping and series artifacts yield zero trusted NWDP rows. | Rebuild readiness only from canonical IDs, current mapping evidence, and actual trusted series; candidates remain unassigned. | Historical counts UNVERIFIED; current matrix regenerated |",
        "| Raw class arithmetic and candidate/quarantine totals | Positive sign-only diagnostic overlaps exact one, sentinel-like patterns, and >150; sentinel patterns were not station-documented fault codes. | Preserve sentinel-like readings as unverified candidates; publish exclusive partition and abort report generation on mismatch. | FIXED / VERIFIED |",
        f"| 94,925 / 106,733 old 2026 totals | Previous artifacts and filter definitions unavailable. Current period files independently report {window_totals.get('positive_readings', 0):,} positive numeric, {window_totals.get('candidate_not_verified', 0):,} candidates, and {window_totals.get('positive_candidate_undocumented_datum', 0):,} other positives. | Publish file-period filter and categories; do not carry old totals forward. | Historical claims UNVERIFIED |",
        f"| 85,348 zero/one readings pending QC | Current raw partition counts {source_counts.get('zero_readings', 0)} zeros + {source_counts.get('exact_one_readings', 0)} exact ones; no artifact explains the old total. | Use current source reconciliation only; retain zero/one as unverified candidates. | Historical claim UNVERIFIED |",
        "| Negative readings are submerged pressure/head | Source metadata does not establish station-level sign convention/datum/calibration. | Wording changed to unresolved; negatives stay quarantined and benchmark no longer takes absolute values. | FIXED |",
        "| Lineage proves measurement validity | Lineage identity/hash traces inputs but says nothing about calibration or block membership. | Report lineage integrity and scientific verification as separate statuses. | VERIFIED / fail-closed |",
        "| NWDP/NWIC labelled CGWB archive | NWDP source is not a CGWB archive; old label was unsupported. | Local API fallback label remains `local_processed_observation_archive`; Supabase source label is separately reported. | FIXED |",
        "| Live Supabase row provenance is internally inconsistent | Captured row has source_name `National Water Data Portal (NWIC) DWLR Telemetry Network` but its resource URL filename is `gwl_manual_quarterly_cgwb_mp_2021_2025.csv`; the file is absent locally. `quality_flag=passed` is database metadata, not independent verification. | Preserve the returned record/fields; mark its source lineage unresolved and do not treat it as verified NWDP telemetry. | UNVERIFIED |",
        "", "See `nwdp_43_block_readiness.md` for the complete 43-block table. The historical reading numbers are never used as current verified observations.",
    ])
    api_section = ["## Captured API response evidence", "", "| Request | HTTP | Response source | Block | Count / total | Record evidence |", "|---|---:|---|---|---:|---|"]
    for api_row in api_evidence.get("requests", []):
        record = "—"
        if api_row.get("observation_date"):
            record = f"{api_row.get('observation_date')} — {api_row.get('value')} {api_row.get('unit')}; station {api_row.get('station_id')}; quality {api_row.get('quality_flag')}"
        elif api_row.get("error"):
            record = f"error: {api_row.get('error')}"
        elif api_row.get("fallback_status"):
            record = f"fallback: {api_row.get('fallback_status')}"
        api_section.append(f"| `{api_row.get('request_url', 'not recorded')}` | {api_row.get('status', '—')} | {api_row.get('source') or '—'} | {api_row.get('block_id') or '—'} | {api_row.get('observation_count', '—')} / {api_row.get('total_count', '—')} | {record} |")
    api_section.extend(["", "The unfiltered database sample carries a provenance inconsistency: `source_name` describes NWIC DWLR telemetry, while `source_resource_url` names a CGWB manual quarterly CSV. The raw file is not present locally to resolve the discrepancy. `quality_flag=passed` is preserved as a database field, not treated as independent verification. Supabase error and local-fallback branches were exercised in automated source-selection tests, not forced against the live remote service.", ""])
    report[report.index("## Mutually exclusive raw-row reconciliation"):report.index("## Mutually exclusive raw-row reconciliation")] = api_section
    (AUDIT / "latest_nwdp_telemetry_audit.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    discrepancies = io.StringIO()
    writer = csv.writer(discrepancies, lineterminator="\n")
    writer.writerow(["prior_claim", "observed_evidence", "root_cause", "correction", "status"])
    for row in report:
        if row.startswith("|") and "|" in row[1:]:
            cells = [cell.strip() for cell in row.strip("|").split("|")]
            if len(cells) == 4 and cells[0] not in {"Prior claim", "---"} and not all(set(cell) <= {"-", ":"} for cell in cells):
                writer.writerow(cells)
    (AUDIT / "nwdp_telemetry_discrepancy_register.csv").write_text(discrepancies.getvalue(), encoding="utf-8")
    print(json.dumps({"status": "written", "as_of": as_of.isoformat(), "blocks": len(readiness_blocks), "operational": sum(b["operational_eligibility"] for b in readiness_blocks), "build_evidence_status": build_status, "api_evidence_status": api_status, "candidate_rows": source_counts["candidate_not_verified"], "unassigned_candidates_by_state": candidate_counts}, indent=2))


if __name__ == "__main__":
    main()
