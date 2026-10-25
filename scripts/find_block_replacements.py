import os
import glob
import pandas as pd
from collections import defaultdict

# Load the 22 unmapped blocks
from audit_22_unmapped_states import unmapped_22, blocks_dict

print(f"Auditing available stations for the {len(unmapped_22)} unmapped blocks...")

# Scan all CGWB manual files
files = glob.glob("data/sources/**/*.csv", recursive=True)
manual_files = [f for f in files if "telemetry" not in f.lower() and "clean" not in f.lower()]

# Build an index of available blocks in manual datasets by state
state_blocks = defaultdict(lambda: defaultdict(list))

for fpath in manual_files:
    try:
        df = pd.read_csv(fpath, usecols=lambda c: c in ["State", "District", "Block", "Station", "Data Acquisition Time", "Groundwater Level Quarterly Manual (meter)"])
        if "Block" not in df.columns or "State" not in df.columns:
            continue
        df = df.dropna(subset=["Block", "Groundwater Level Quarterly Manual (meter)"])
        for _, row in df.iterrows():
            st = str(row["State"]).strip().title()
            dist = str(row.get("District", "")).strip().title()
            blk = str(row["Block"]).strip().title()
            stn = str(row.get("Station", "")).strip()
            if blk and blk != "-" and blk != "Nan":
                state_blocks[st][dist].append((blk, stn, fpath))
    except Exception as e:
        pass

print("\n--- Summary of available blocks per unmapped state ---")
unmapped_states = set(blocks_dict[bid]["state"] for bid in unmapped_22)

for st in sorted(unmapped_states):
    dists = state_blocks[st.title()]
    print(f"\nState: {st} (Known districts in manual files: {len(dists)})")
    # For each unmapped block in this state, check if its district or block has matches
    for bid in sorted(unmapped_22):
        b = blocks_dict[bid]
        if b["state"] == st:
            target_dist = b["district"].title()
            target_blk = b["block_name"].title()
            available_blks = set(x[0] for x in dists.get(target_dist, []))
            print(f"  Target: {bid} (Dist: {target_dist}, Block: {target_blk})")
            print(f"    Available blocks in {target_dist}: {sorted(list(available_blks))[:8]}")
