import json

with open("audit/global_model_block_readiness.json", "r", encoding="utf-8") as f:
    readiness = json.load(f)

blocks = readiness.get("blocks", [])
unverified = [b for b in blocks if b.get("mapping_verification") != "verified_station_mapping"]
verified = [b for b in blocks if b.get("mapping_verification") == "verified_station_mapping"]

print(f"Total canonical blocks audited: {len(blocks)}")
print(f"Verified blocks: {len(verified)}")
print(f"Unverified blocks: {len(unverified)}\n")

print("=== 22 UNVERIFIED BLOCKS BREAKDOWN ===")
for b in sorted(unverified, key=lambda x: (x.get("state", ""), x.get("district", ""), x.get("block_id", ""))):
    bid = b.get("block_id")
    st = b.get("state")
    dist = b.get("district")
    name = b.get("block_name")
    notes = b.get("verification_notes", "")
    print(f"{bid} | {st} | {dist} | {name} | {notes}")
