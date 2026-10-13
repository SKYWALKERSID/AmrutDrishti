import json

with open('scripts/all_48_contrast_real_stats.json', 'r', encoding='utf-8') as f:
    stats = json.load(f)

# Coordinates for blocks (either calculated from stations or accurate centroids)
coords_map = {
    # Punjab
    'Punjab::Ludhiana::Khanna': [30.6897, 76.1947],
    'Punjab::Jalandhar::Phillaur': [31.0471, 75.8044],
    'Punjab::Amritsar::Majitha': [31.7491, 75.0161],
    'Punjab::Patiala::Patran': [29.9567, 76.0567],

    # Rajasthan
    'Rajasthan::Dausa::Lalsot': [26.5645, 76.3268],
    'Rajasthan::Dausa::Bandikui': [27.1295, 76.6850],
    'Rajasthan::Dausa::Sikrai': [26.9189, 76.6912],
    'Rajasthan::Dausa::Mahuwa': [26.9327, 76.9991],
    'Rajasthan::Sawai Madhopur::Bonli': [26.3167, 76.3330],
    'Rajasthan::Sawai Madhopur::Khandar': [25.9770, 76.5503],
    'Rajasthan::Sawai Madhopur::Chauth Ka Barwara': [26.0465, 76.1602],
    'Rajasthan::Jodhpur::Mandore': [26.3267, 73.0136],
    'Rajasthan::Jodhpur::Osian': [26.7752, 73.1748],
    'Rajasthan::Jaisalmer::Sam': [27.2203, 70.5154],
    'Rajasthan::Jaipur::Amer': [27.0346, 75.7827],
    'Rajasthan::Jaipur::Govindgarh': [27.2502, 75.6303],
    'Rajasthan::Jaipur::Sanganer': [26.8291, 75.7131],

    # Haryana
    'Haryana::Kurukshetra::Pehowa': [30.0092, 76.5810],
    'Haryana::Kaithal::Rajound': [29.6038, 76.4150],
    'Haryana::Karnal::Assandh': [29.5643, 76.6447],
    'Haryana::Mahendragarh::Kanina': [28.3176, 76.1344],

    # Arunachal Pradesh
    'Arunachal Pradesh::Papum Pare::Yupia': [27.1432, 93.6841],
    'Arunachal Pradesh::Papum Pare::Doimukh': [27.1415, 93.7505],
    'Arunachal Pradesh::Papum Pare::Sagalee': [27.2415, 93.4215],
    'Arunachal Pradesh::Changlang::Miao': [27.4792, 96.1208],
    'Arunachal Pradesh::Changlang::Jairampur': [27.3512, 96.0124],
    'Arunachal Pradesh::Changlang::Bordumsa': [27.5310, 95.8712],
    'Arunachal Pradesh::Lower Subansiri::Ziro': [27.6107, 94.2345],
    'Arunachal Pradesh::Lower Subansiri::Yachuli': [27.5012, 93.7845],

    # Sikkim (Springshed mountain systems)
    'Sikkim::Gangtok::Rakdong-Tintek': [27.3521, 88.5812],
    'Sikkim::Gangtok::Khamdong': [27.2845, 88.5412],
    'Sikkim::Gangtok::Duga': [27.2114, 88.5718],
    'Sikkim::Namchi::Ravangla': [27.3068, 88.3629],
    'Sikkim::Namchi::Sikkip': [27.1425, 88.3142],
    'Sikkim::Namchi::Jorethang': [27.1332, 88.2987],
    'Sikkim::Gyalshing::Dentam': [27.2512, 88.1345],
    'Sikkim::Gyalshing::Chumbong': [27.1952, 88.2418],

    # Assam
    'Assam::Kamrup::Boko': [25.9604, 91.1831],
    'Assam::Kamrup::Chaygaon': [26.0389, 91.3546],
    'Assam::Kamrup::Hajo': [26.2377, 91.5725],
    'Assam::Dibrugarh::Barbaruah': [27.3821, 94.8812],
    'Assam::Dibrugarh::Tingkhong': [27.2145, 95.1215],
    'Assam::Dibrugarh::Joypur': [27.2550, 95.2381],
    'Assam::Sonitpur::Balipara': [26.8509, 92.7897],
    'Assam::Sonitpur::Gabharu': [26.6812, 92.8124],
    'Assam::Sonitpur::Dhekiajuli': [26.6553, 92.4289],
    'Assam::Cachar::Lakhipur': [24.7912, 93.0125],
    'Assam::Cachar::Sonai': [24.6833, 92.8728]
}

print("Loaded coords map for", len(coords_map), "blocks.")
