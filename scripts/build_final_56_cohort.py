import json
from collections import Counter

# Define the exact 56 verified blocks
EXACT_56_BLOCKS = [
    # 1. Madhya Pradesh (9 blocks)
    {"id": "blk_tikamgarh_main", "state": "Madhya Pradesh", "district": "Tikamgarh", "block": "Tikamgarh"},
    {"id": "blk_jatara", "state": "Madhya Pradesh", "district": "Tikamgarh", "block": "Jatara"},
    {"id": "blk_baldeogarh", "state": "Madhya Pradesh", "district": "Tikamgarh", "block": "Baldeogarh"},
    {"id": "blk_palera", "state": "Madhya Pradesh", "district": "Tikamgarh", "block": "Palera"},
    {"id": "blk_bijawar", "state": "Madhya Pradesh", "district": "Chhatarpur", "block": "Bijawar"},
    {"id": "blk_rajnagar", "state": "Madhya Pradesh", "district": "Chhatarpur", "block": "Rajnagar"},
    {"id": "blk_chhatarpur_nowgaon", "state": "Madhya Pradesh", "district": "Chhatarpur", "block": "Nowgaon"},
    {"id": "blk_banda", "state": "Madhya Pradesh", "district": "Sagar", "block": "Banda"},
    {"id": "blk_sagar_main", "state": "Madhya Pradesh", "district": "Sagar", "block": "Sagar"},
    
    # 2. Punjab (4 blocks)
    {"id": "blk_ludhiana_khanna", "state": "Punjab", "district": "Ludhiana", "block": "Khanna"},
    {"id": "blk_jalandhar_phillaur", "state": "Punjab", "district": "Jalandhar", "block": "Phillaur"},
    {"id": "blk_amritsar_majitha", "state": "Punjab", "district": "Amritsar", "block": "Majitha"},
    {"id": "blk_patiala_patran", "state": "Punjab", "district": "Patiala", "block": "Patran"},
    
    # 3. Haryana (4 blocks)
    {"id": "blk_kaithal_rajound", "state": "Haryana", "district": "Kaithal", "block": "Rajound"},
    {"id": "blk_karnal_assandh", "state": "Haryana", "district": "Karnal", "block": "Assandh"},
    {"id": "blk_kurukshetra_pehowa", "state": "Haryana", "district": "Kurukshetra", "block": "Pehowa"},
    {"id": "blk_mahendragarh_narnaul", "state": "Haryana", "district": "Mahendragarh", "block": "Narnaul"},
    
    # 4. Rajasthan (13 blocks)
    {"id": "blk_jaipur_amer", "state": "Rajasthan", "district": "Jaipur", "block": "Amer"},
    {"id": "blk_jaipur_govindgarh", "state": "Rajasthan", "district": "Jaipur", "block": "Govindgarh"},
    {"id": "blk_jaipur_sanganer", "state": "Rajasthan", "district": "Jaipur", "block": "Sanganer"},
    {"id": "blk_jaipur_bassi", "state": "Rajasthan", "district": "Jaipur", "block": "Bassi"},
    {"id": "blk_dausa_bandikui", "state": "Rajasthan", "district": "Dausa", "block": "Bandikui"},
    {"id": "blk_dausa_mahuwa", "state": "Rajasthan", "district": "Dausa", "block": "Mahuwa"},
    {"id": "blk_dausa_main", "state": "Rajasthan", "district": "Dausa", "block": "Dausa"},
    {"id": "blk_jodhpur_mandore", "state": "Rajasthan", "district": "Jodhpur", "block": "Mandore"},
    {"id": "blk_jodhpur_osian", "state": "Rajasthan", "district": "Jodhpur", "block": "Osian"},
    {"id": "blk_jaisalmer_sam", "state": "Rajasthan", "district": "Jaisalmer", "block": "Sam"},
    {"id": "blk_sawai_madhopur_bonli", "state": "Rajasthan", "district": "Sawai Madhopur", "block": "Bonli"},
    {"id": "blk_sawai_madhopur_khandar", "state": "Rajasthan", "district": "Sawai Madhopur", "block": "Khandar"},
    {"id": "blk_sawai_madhopur_bamanwas", "state": "Rajasthan", "district": "Sawai Madhopur", "block": "Bamanwas"},
    
    # 5. Karnataka (3 blocks)
    {"id": "blk_davanagere_main", "state": "Karnataka", "district": "Davanagere", "block": "Davanagere"},
    {"id": "blk_bhadravati", "state": "Karnataka", "district": "Shivamogga", "block": "Bhadravati"},
    {"id": "blk_shivamogga_main", "state": "Karnataka", "district": "Shivamogga", "block": "Shimoga"},
    
    # 6. Telangana (3 blocks)
    {"id": "blk_adilabad_main", "state": "Telangana", "district": "Adilabad", "block": "Adilabad"},
    {"id": "blk_nandipet", "state": "Telangana", "district": "Nizamabad", "block": "Nandipet"},
    {"id": "blk_rajendranagar", "state": "Telangana", "district": "Ranga Reddy", "block": "Rajendranagar"},
    
    # 7. Tamil Nadu (3 blocks)
    {"id": "blk_periyanaickenpalayam", "state": "Tamil Nadu", "district": "Coimbatore", "block": "P.N.Palayam"},
    {"id": "blk_ottapidaram", "state": "Tamil Nadu", "district": "Tuticorin", "block": "Ottapidaram"},
    {"id": "blk_st_thomas_mount", "state": "Tamil Nadu", "district": "Kancheepuram", "block": "St.Thomas"},
    
    # 8. Meghalaya (3 blocks)
    {"id": "blk_mylliem", "state": "Meghalaya", "district": "East Khasi Hills", "block": "Mylliem"},
    {"id": "blk_umling", "state": "Meghalaya", "district": "Ri Bhoi", "block": "Nongpoh"},
    {"id": "blk_thadlaskein", "state": "Meghalaya", "district": "East Jaintia Hills", "block": "Thadlaskein"},
    
    # 9. Assam (11 blocks)
    {"id": "blk_kamrup_boko", "state": "Assam", "district": "Kamrup", "block": "Boko"},
    {"id": "blk_kamrup_hajo", "state": "Assam", "district": "Kamrup", "block": "Hajo"},
    {"id": "blk_kamrup_chaygaon", "state": "Assam", "district": "Kamrup", "block": "Chhaygaon"},
    {"id": "blk_sonitpur_dhekiajuli", "state": "Assam", "district": "Sonitpur", "block": "Dhekiajuli"},
    {"id": "blk_sonitpur_tezpur", "state": "Assam", "district": "Sonitpur", "block": "Tezpur"},
    {"id": "blk_sonitpur_chariduar", "state": "Assam", "district": "Sonitpur", "block": "Chariduar"},
    {"id": "blk_dibrugarh_moran", "state": "Assam", "district": "Dibrugarh", "block": "Moran"},
    {"id": "blk_dibrugarh_naharkatiya", "state": "Assam", "district": "Dibrugarh", "block": "Naharkatiya"},
    {"id": "blk_dibrugarh_east", "state": "Assam", "district": "Dibrugarh", "block": "Dibrugarh East"},
    {"id": "blk_cachar_sonai", "state": "Assam", "district": "Cachar", "block": "Sonai"},
    {"id": "blk_cachar_silchar", "state": "Assam", "district": "Cachar", "block": "Silchar"},
    
    # 10. Tripura (3 blocks)
    {"id": "blk_amarpur", "state": "Tripura", "district": "South Tripura", "block": "Amarpur"},
    {"id": "blk_dhalai_salema", "state": "Tripura", "district": "Dhalai", "block": "Salema"},
    {"id": "blk_west_tripura_jirania", "state": "Tripura", "district": "West Tripura", "block": "Jirania"},
]

print(f"Total blocks in cohort: {len(EXACT_56_BLOCKS)}")
assert len(EXACT_56_BLOCKS) == 56, f"Expected 56, got {len(EXACT_56_BLOCKS)}"

# Check unique IDs
ids = [b["id"] for b in EXACT_56_BLOCKS]
assert len(set(ids)) == 56, f"Duplicate IDs detected: {[k for k, v in Counter(ids).items() if v > 1]}"

# Check state distribution
state_counts = Counter(b["state"] for b in EXACT_56_BLOCKS)
print("State distribution (10 states):")
for st, cnt in sorted(state_counts.items()):
    print(f"  {st:20}: {cnt}")
assert len(state_counts) == 10, "Must be exactly 10 states"

# Check distinct districts
dist_counts = Counter(f"{b['state']}::{b['district']}" for b in EXACT_56_BLOCKS)
print(f"\nTotal distinct districts: {len(dist_counts)}")

with open("audit/canonical_56_blocks_final.json", "w", encoding="utf-8") as f:
    json.dump(EXACT_56_BLOCKS, f, indent=2)

print("\nSaved canonical cohort to audit/canonical_56_blocks_final.json")
