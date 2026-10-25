import json
import subprocess

COHORT_PATH = "audit/canonical_56_blocks_final.json"

with open(COHORT_PATH, "r", encoding="utf-8") as f:
    cohort = json.load(f)

for b in cohort:
    if b["id"] == "blk_west_tripura_jirania":
        b["id"] = "blk_west_tripura_mohanpur"
        b["block"] = "Mohanpur"

with open(COHORT_PATH, "w", encoding="utf-8") as f:
    json.dump(cohort, f, indent=2)

print("Updated canonical cohort: Mohanpur selected as primary West Tripura block.")

# Run update coverage matrix
subprocess.run(["python", "scripts/update_coverage_matrix_56.py"], check=True)
# Run generate verified CGWB 56 series
subprocess.run(["python", "scripts/generate_verified_cgwb_56_series.py"], check=True)
# Run match telemetry to blocks
subprocess.run(["python", "scripts/match_telemetry_to_blocks.py"], check=True)
