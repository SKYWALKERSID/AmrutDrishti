import json
import os

with open('scripts/all_48_contrast_real_stats.json', 'r', encoding='utf-8') as f:
    stats = json.load(f)

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

    # Sikkim
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

# Structure definition for generating code
structure = {
    'Punjab': {
        'category': 'high_stress',
        'cpiRank': 1,
        'summaryDescription': 'Extreme groundwater depletion driven by intensive paddy-wheat flood irrigation, deep submersible borewells, and over-allocation of the unconfined/semi-confined alluvium.',
        'geologicalContext': 'Quaternary Alluvial aquifer system (Indo-Gangetic Basin). Stage of groundwater extraction exceeds 164% statewide according to CGWB Dynamic Groundwater Assessments.',
        'districts': {
            'Ludhiana': {'coords': [30.9010, 75.8573], 'blocks': ['Khanna']},
            'Jalandhar': {'coords': [31.3260, 75.5762], 'blocks': ['Phillaur']},
            'Amritsar': {'coords': [31.6340, 74.8723], 'blocks': ['Majitha']},
            'Patiala': {'coords': [30.3398, 76.3869], 'blocks': ['Patran']}
        }
    },
    'Rajasthan': {
        'category': 'high_stress',
        'cpiRank': 2,
        'summaryDescription': 'Severe arid and semi-arid hydro-climatic stress with pervasive hard-rock and deep alluvial drawdown, high salinity, and stage of extraction reaching 151%.',
        'geologicalContext': 'Proterozoic Aravalli metamorphic hard-rocks, Vindhyan sandstones, and Thar desert Quaternary sand formations with low natural recharge and high evaporation (>2000 mm/yr).',
        'districts': {
            'Dausa': {'coords': [26.8926, 76.3377], 'blocks': ['Lalsot', 'Bandikui', 'Sikrai', 'Mahuwa']},
            'Sawai Madhopur': {'coords': [26.0224, 76.3533], 'blocks': ['Bonli', 'Khandar', 'Chauth Ka Barwara']},
            'Jodhpur': {'coords': [26.2389, 73.0243], 'blocks': ['Mandore', 'Osian']},
            'Jaisalmer': {'coords': [26.9157, 70.9083], 'blocks': ['Sam']},
            'Jaipur': {'coords': [26.9124, 75.7873], 'blocks': ['Amer', 'Govindgarh', 'Sanganer']}
        }
    },
    'Haryana': {
        'category': 'high_stress',
        'cpiRank': 3,
        'summaryDescription': 'Heavy sub-surface water deficit across the alluvial plains with multi-aquifer drawdown, declining freshwater lenses, and statewide extraction stage of ~134%.',
        'geologicalContext': 'Indo-Gangetic older and newer alluvium interfingering with Delhi Supergroup quartzites in southern districts (Mahendragarh).',
        'districts': {
            'Kurukshetra': {'coords': [29.9695, 76.8783], 'blocks': ['Pehowa']},
            'Kaithal': {'coords': [29.8015, 76.3998], 'blocks': ['Rajound']},
            'Karnal': {'coords': [29.6857, 76.9905], 'blocks': ['Assandh']},
            'Mahendragarh': {'coords': [28.2777, 76.1438], 'blocks': ['Kanina']}
        }
    },
    'Arunachal Pradesh': {
        'category': 'low_stress',
        'cpiRank': 1,
        'summaryDescription': 'Substantial surplus water security sustained by Eastern Himalayan orographic precipitation (>2,800 mm/yr), dense forest catchment cover, and minimal mechanical extraction.',
        'geologicalContext': 'Siwalik sedimentary belt and pre-Tertiary crystalline formations. Unconfined alluvial terraces along river valleys with near-surface water tables and stage of extraction < 0.5%.',
        'districts': {
            'Papum Pare': {'coords': [27.1432, 93.6841], 'blocks': ['Yupia', 'Doimukh', 'Sagalee']},
            'Changlang': {'coords': [27.3512, 96.0124], 'blocks': ['Miao', 'Jairampur', 'Bordumsa']},
            'Lower Subansiri': {'coords': [27.5510, 93.8415], 'blocks': ['Ziro', 'Yachuli']}
        }
    },
    'Sikkim': {
        'category': 'low_stress',
        'cpiRank': 2,
        'summaryDescription': 'Pristine mountain hydrology where rural water supply is 100% spring-fed (Dhara Vikas). CGWB categorizes 100% of assessment units as SAFE with extraction stage between 1% and 5.85%.',
        'geologicalContext': 'Complex Himalayan crystalline thrust belts (Daling and Darjeeling Groups). Recharge through snowmelt and heavy monsoonal rain; water table emerges as perennial gravity springs with 0 deep tubewells.',
        'districts': {
            'Gangtok': {'coords': [27.3389, 88.6065], 'blocks': ['Rakdong-Tintek', 'Khamdong', 'Duga']},
            'Namchi': {'coords': [27.1667, 88.3667], 'blocks': ['Ravangla', 'Sikkip', 'Jorethang']},
            'Gyalshing': {'coords': [27.2833, 88.2333], 'blocks': ['Dentam', 'Chumbong']}
        }
    },
    'Assam': {
        'category': 'low_stress',
        'cpiRank': 3,
        'summaryDescription': 'Massive freshwater abundance fed by the Brahmaputra and Barak river systems, high rainfall (>2,200 mm/yr), and shallow water levels (< 4m bgl). Stage of groundwater extraction is ~14%.',
        'geologicalContext': 'Extensive Quaternary Alluvium of the Brahmaputra Valley consisting of permeable sands, gravels, and silt with rapid annual monsoon recharge and perennial river effluent seepage.',
        'districts': {
            'Kamrup': {'coords': [26.3120, 91.5978], 'blocks': ['Boko', 'Chaygaon', 'Hajo']},
            'Dibrugarh': {'coords': [27.4728, 94.9120], 'blocks': ['Barbaruah', 'Tingkhong', 'Joypur']},
            'Sonitpur': {'coords': [26.6528, 92.7926], 'blocks': ['Balipara', 'Gabharu', 'Dhekiajuli']},
            'Cachar': {'coords': [24.8333, 92.7789], 'blocks': ['Lakhipur', 'Sonai']}
        }
    }
}

print("Loaded structure successfully.")
