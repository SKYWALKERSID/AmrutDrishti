import json

with open("data/derived/nwdp_block_telemetry_series.json", "r", encoding="utf-8") as f:
    matched = json.load(f)

with open("audit/global_model_block_readiness.json", "r", encoding="utf-8") as f:
    r = json.load(f)

all_blocks = [b["block_id"] for b in r["blocks"]]
unmatched = [bid for bid in all_blocks if bid not in matched]

print(f"Total canonical blocks: {len(all_blocks)}")
print(f"Matched blocks: {len(matched)}")
print(f"Unmatched (unmapped) blocks: {len(unmatched)}\n")

blocks_dict = {b["block_id"]: b for b in r["blocks"]}
print(f"{'BLOCK ID':36} | {'STATE':15} | {'DISTRICT':20} | {'BLOCK NAME'}")
print("-" * 90)
for bid in sorted(unmatched):
    b = blocks_dict[bid]
    print(f"{bid:36} | {b['state']:15} | {b['district']:20} | {b['block_name']}")
