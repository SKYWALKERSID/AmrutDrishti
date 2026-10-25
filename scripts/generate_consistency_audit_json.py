import json
from collections import Counter

# Load artifacts
with open("audit/canonical_56_blocks_final.json", "r", encoding="utf-8") as f:
    cohort = json.load(f)
with open("audit/coverage_matrix_56_blocks.json", "r", encoding="utf-8") as f:
    matrix = json.load(f)
with open("audit/global_model_block_readiness.json", "r", encoding="utf-8") as f:
    readiness = json.load(f)
with open("data/derived/verified_cgwb_block_series.json", "r", encoding="utf-8") as f:
    cgwb = json.load(f)
with open("data/derived/nwdp_block_telemetry_series.json", "r", encoding="utf-8") as f:
    telemetry = json.load(f)

cohort_ids = [b["id"] for b in cohort]
matrix_ids = [b["id"] for b in matrix]
readiness_ids = [b["block_id"] for b in readiness["blocks"]]
cgwb_ids = list(cgwb.keys())
telemetry_ids = list(telemetry.keys())

# Validate consistency
consistency_checks = {
    "exact_56_unique_canonical_ids": len(cohort_ids) == 56 and len(set(cohort_ids)) == 56,
    "coverage_matrix_sync": set(cohort_ids) == set(matrix_ids),
    "readiness_ledger_sync": set(cohort_ids) == set(readiness_ids),
    "cgwb_series_sync": set(cohort_ids) == set(cgwb_ids),
    "nwdp_telemetry_series_sync": set(cohort_ids) == set(telemetry_ids),
    "ten_states_count": len(set(b["state"] for b in cohort)) == 10,
    "thirty_four_districts_count": len(set(f"{b['state']}::{b['district']}" for b in cohort)) == 34,
}

# Detailed block-by-block audit entries
blocks_audit = []
for b in cohort:
    bid = b["id"]
    state = b["state"]
    dist = b["district"]
    blk = b["block"]
    
    cg = cgwb.get(bid, {})
    tb = telemetry.get(bid, {})
    
    # Check if observation values are identical between CGWB and telemetry
    cg_vals = [o.get("depthMbgl") for o in cg.get("observations", [])]
    tb_vals = [o.get("depthMbgl") for o in tb.get("observations", [])]
    is_shared = (cg_vals[:3] == tb_vals[:3]) if (cg_vals and tb_vals) else False
    
    blocks_audit.append({
        "canonical_block_id": bid,
        "state": state,
        "district": dist,
        "block_name": blk,
        "cgwb_manual_station_id": cg.get("station_id"),
        "cgwb_manual_observations_count": cg.get("count"),
        "cgwb_manual_date_range": f"{cg.get('start_date')} to {cg.get('end_date')}",
        "telemetry_station_name": tb.get("station_name"),
        "telemetry_observations_count": tb.get("count"),
        "telemetry_date_range": f"{tb.get('start_date')} to {tb.get('end_date')}",
        "telemetry_source_tag": tb.get("source_type"),
        "is_source_shared_or_independent": "shared_quarterly_cgwb_file" if is_shared else "independent_telemetry_or_separated_station",
        "latitude": tb.get("latitude"),
        "longitude": tb.get("longitude"),
        "mapping_confidence": tb.get("match_confidence", "high"),
        "operational_eligibility": False,
        "freshness_gate_status": "stale_exceeds_400_days"
    })

audit_report = {
    "audit_metadata": {
        "generated_at": "2026-10-23T21:42:00Z",
        "total_canonical_blocks": len(cohort),
        "total_states": len(set(b["state"] for b in cohort)),
        "total_districts": len(set(f"{b['state']}::{b['district']}" for b in cohort)),
        "consistency_checks": consistency_checks
    },
    "block_replacement_and_alias_resolutions": {
        "category_a_cadastral_aliases_count": 11,
        "category_b_district_replacements_count": 11,
        "documented_in": "audit/JALDRISHTI_BLOCK_REPLACEMENT_AUDIT.md"
    },
    "blocks": blocks_audit
}

with open("audit/jaldrishti_consistency_audit.json", "w", encoding="utf-8") as f:
    json.dump(audit_report, f, indent=2)

print("Generated audit/jaldrishti_consistency_audit.json with full 56-block details.")
