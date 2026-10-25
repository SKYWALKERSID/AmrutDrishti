import json

with open("data/derived/verified_cgwb_block_series.json", "r", encoding="utf-8") as f:
    vcgwb = json.load(f)

with open("audit/global_model_block_readiness.json", "r", encoding="utf-8") as f:
    r = json.load(f)

all_56 = [b["block_id"] for b in r["blocks"]]
unmapped_22 = [bid for bid in all_56 if bid not in vcgwb]

print(f"Total Canonical: {len(all_56)}")
print(f"CGWB-Mapped: {len(vcgwb)}")
print(f"Unmapped: {len(unmapped_22)}\n")

blocks_dict = {b["block_id"]: b for b in r["blocks"]}
by_state = {}
for bid in unmapped_22:
    b = blocks_dict[bid]
    st = b["state"]
    by_state.setdefault(st, []).append((bid, b["district"], b["block_name"]))

for st, items in sorted(by_state.items()):
    print(f"=== {st} ({len(items)} blocks) ===")
    for bid, dist, name in items:
        print(f"  - {bid:35} | {dist:20} | {name}")
