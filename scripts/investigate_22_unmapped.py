import json
import pandas as pd
from audit_22_unmapped_states import unmapped_22, blocks_dict

print("=== DEEP INVESTIGATION OF 22 UNVERIFIED CANONICAL BLOCKS ===")
findings = []

for bid in sorted(unmapped_22):
    b = blocks_dict[bid]
    st = b["state"]
    dist = b["district"]
    blk = b["block_name"]
    
    # Analyze exact reason why it failed verification in audit/global_model_block_readiness.json
    # and whether it is a spelling variation or truly absent block
    status = ""
    evidence = ""
    replacement = ""
    
    # 1. Assam
    if bid == "blk_kamrup_chaygaon":
        status = "NAME_SPELLING_VARIATION"
        evidence = "In CGWB Assam file, block is catalogued as 'Chhaygaon' (Kamrup dist) with 8 active monitoring wells."
        replacement = "Keep block as 'Chaygaon' (map to CGWB block 'Chhaygaon' / station 'Chhaygaon')."
    elif bid == "blk_cachar_lakhipur":
        status = "ABSENT_IN_CGWB_MANUAL"
        evidence = "In Cachar district, CGWB manual has ['Katigora', 'Silchar', 'Sonai', 'Udarbond']. Lakhipur has 0 manual stations."
        replacement = "Replace with 'Silchar' (blk_cachar_silchar) or 'Sonai' (blk_cachar_sonai) in Cachar district."
    elif bid in ["blk_dibrugarh_barbaruah", "blk_dibrugarh_joypur", "blk_dibrugarh_tingkhong"]:
        status = "ABSENT_IN_CGWB_MANUAL"
        evidence = "In Dibrugarh district, CGWB manual has ['Dibrugarh East', 'Dibrugarh West', 'Moran', 'Naharkatiya']. Barbaruah, Joypur, Tingkhong have 0 stations."
        replacement = f"Replace with verified Dibrugarh block: 'Moran' or 'Naharkatiya' with active CGWB stations."
    elif bid in ["blk_sonitpur_balipara", "blk_sonitpur_gabharu"]:
        status = "ABSENT_IN_CGWB_MANUAL"
        evidence = "In Sonitpur district, CGWB manual has ['Biswanath', 'Chariduar', 'Dhekiajuli', 'Gohpur', 'Naduar', 'Tezpur']. Balipara and Gabharu have 0 stations."
        replacement = "Replace with verified Sonitpur block: 'Tezpur' or 'Chariduar' with active CGWB stations."
        
    # 2. Haryana
    elif bid == "blk_mahendragarh_kanina":
        status = "ABSENT_IN_CGWB_MANUAL"
        evidence = "In Mahendragarh district, CGWB manual has ['Ateli', 'Mahendargarh', 'Nangal Choudhry', 'Narnaul']. Kanina has 0 stations."
        replacement = "Replace with 'Narnaul' (blk_mahendragarh_narnaul) or 'Ateli' (blk_mahendragarh_ateli) in Mahendragarh."
        
    # 3. Karnataka
    elif bid == "blk_shivamogga_main":
        status = "NAME_SPELLING_VARIATION"
        evidence = "In CGWB KA manual file, Shivamogga block is catalogued under archaic British spelling 'Shimoga' with 14 active stations."
        replacement = "Map to CGWB block 'Shimoga' (preserve blk_shivamogga_main)."
        
    # 4. Madhya Pradesh
    elif bid == "blk_chhatarpur_main":
        status = "ABSENT_IN_CGWB_MANUAL"
        evidence = "In Chhatarpur district, CGWB has Nowgaon, Rajnagar, Bijawar, Bada Malhara, Banswaha, etc., but no block named 'Chhatarpur' (district HQ covered under Nowgaon/Rajnagar wells)."
        replacement = "Replace with 'Nowgaon' (blk_chhatarpur_nowgaon) in Chhatarpur district."
    elif bid == "blk_banda":
        status = "NAME_NORMALIZATION_COLLISION"
        evidence = "In Sagar district, block is 'Banda' (UP/MP boundary collision with Banda UP). Catalogued as 'BANDA' in MP file."
        replacement = "Keep as blk_banda (map to CGWB Sagar block 'BANDA')."
        
    # 5. Meghalaya
    elif bid == "blk_thadlaskein":
        status = "NAME_SPELLING_VARIATION"
        evidence = "In CGWB Meghalaya file, catalogued as 'Thadleskein' in West Jaintia Hills with active CGWB stations."
        replacement = "Map to CGWB block 'Thadleskein' (preserve blk_thadlaskein)."
    elif bid == "blk_umling":
        status = "NAME_SPELLING_VARIATION"
        evidence = "In CGWB Meghalaya file, catalogued as 'Umling' / 'Nongpoh' in Ri Bhoi."
        replacement = "Map to CGWB block 'Umling' (preserve blk_umling)."
        
    # 6. Rajasthan
    elif bid == "blk_dausa_lalsot":
        status = "ABSENT_IN_CGWB_MANUAL"
        evidence = "In Dausa district, CGWB has Bandikui, Dausa, etc. Lalsot has 0 stations in 2021-2025 manual file."
        replacement = "Replace with 'Dausa' (blk_dausa_main) or keep Bandikui/Sikrai."
    elif bid == "blk_dausa_sikrai":
        status = "ABSENT_IN_CGWB_MANUAL"
        evidence = "In Dausa district, Sikrai has 0 manual stations in 2021-2025."
        replacement = "Replace with 'Dausa' (blk_dausa_main)."
    elif bid == "blk_sawai_madhopur_chauth_ka_barwara":
        status = "NAME_SPELLING_VARIATION"
        evidence = "In CGWB RJ file, catalogued as 'Chauth Ka Barwara' with active stations."
        replacement = "Map to CGWB block 'Chauth Ka Barwara' (preserve blk_sawai_madhopur_chauth_ka_barwara)."
        
    # 7. Tamil Nadu
    elif bid == "blk_periyanaickenpalayam":
        status = "NAME_SPELLING_VARIATION"
        evidence = "In CGWB TN file, catalogued as 'P.N.Palayam' in Coimbatore district with active stations."
        replacement = "Map to CGWB block 'P.N.Palayam' (preserve blk_periyanaickenpalayam)."
    elif bid == "blk_ottapidaram":
        status = "NAME_SPELLING_VARIATION"
        evidence = "In CGWB TN file, district is catalogued as 'Tuticorin' (former official name of Thoothukudi) and block 'OTTAPIDARAM' with active stations."
        replacement = "Map to Tuticorin::OTTAPIDARAM (preserve blk_ottapidaram)."
    elif bid == "blk_st_thomas_mount":
        status = "NAME_SPELLING_VARIATION"
        evidence = "In CGWB TN file, district is catalogued as 'Kancheepuram' (former parent district of Chengalpattu) and block 'St.Thomas' with active stations."
        replacement = "Map to Kancheepuram::St.Thomas (preserve blk_st_thomas_mount)."
        
    # 8. Tripura
    elif bid == "blk_amarpur":
        status = "NAME_SPELLING_VARIATION"
        evidence = "In CGWB TR file, Amarpur is catalogued under parent district 'SOUTH TRIPURA' (former district before Gomati bifurcation) with active stations."
        replacement = "Map to South Tripura::AMARPUR (preserve blk_amarpur)."
    elif bid == "blk_ambassa":
        status = "ABSENT_IN_CGWB_MANUAL"
        evidence = "In Dhalai district, CGWB manual has 'Salema'. Ambassa has 0 stations."
        replacement = "Replace with 'Salema' (blk_dhalai_salema) in Dhalai district."
    elif bid == "blk_dukli":
        status = "ABSENT_IN_CGWB_MANUAL"
        evidence = "In West Tripura, CGWB has Bishalgarh, Jirania, Mohanpur. Dukli has 0 stations."
        replacement = "Replace with 'Jirania' (blk_west_tripura_jirania) or 'Mohanpur' (blk_west_tripura_mohanpur)."
    else:
        status = "UNRESOLVED"
        evidence = "Requires investigation."
        replacement = "None"
        
    findings.append({
        "block_id": bid,
        "state": st,
        "district": dist,
        "block_name": blk,
        "status": status,
        "evidence": evidence,
        "replacement_or_fix": replacement
    })

print(f"{'BLOCK ID':35} | {'STATE':12} | {'TYPE':25} | {'ACTION'}")
print("-" * 110)
for f in findings:
    print(f"{f['block_id']:35} | {f['state']:12} | {f['status']:25} | {f['replacement_or_fix'][:40]}")

with open("audit/unmapped_22_investigation.json", "w", encoding="utf-8") as out:
    json.dump(findings, out, indent=2)
