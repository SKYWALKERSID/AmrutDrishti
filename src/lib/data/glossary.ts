/**
 * AMRUT DRISHTI — Plain Language Terminology & Public Information Glossary
 *
 * Designed to make groundwater observations, satellite estimates, and risk signals
 * immediately understandable to farmers, students, citizens, and village/district officers
 * without specialized training in hydrology, GIS, or machine learning.
 */

export interface GlossaryEntry {
  id: string;
  category: 'measurement' | 'satellite' | 'risk_score' | 'forecast' | 'scheme' | 'status';
  nameEn: string;
  nameHi: string;
  shortSummaryEn: string;
  shortSummaryHi: string;
  whatItMeansEn: string;
  whatItMeansHi: string;
  whyItMattersEn: string;
  whyItMattersHi: string;
  unitsEn?: string;
  unitsHi?: string;
  farmerTipEn?: string;
  farmerTipHi?: string;
}

export const PLAIN_LANGUAGE_GLOSSARY: Record<string, GlossaryEntry> = {
  well_depth: {
    id: 'well_depth',
    category: 'measurement',
    nameEn: 'Groundwater Depth (Water Table)',
    nameHi: 'भूजल गहराई (कुएं का जल स्तर)',
    shortSummaryEn: 'How deep you must dig or drill to reach water.',
    shortSummaryHi: 'पानी तक पहुँचने के लिए ज़मीन में कितनी गहराई तक खुदाई करनी होगी।',
    whatItMeansEn: 'Measured directly in government monitoring wells. A depth of 15 meters means water begins 15 meters underneath the soil surface.',
    whatItMeansHi: 'सरकारी अवलोकन कुओं से सीधे मापा जाता है। 15 मीटर का मतलब है कि ज़मीनी सतह से 15 मीटर नीचे पानी शुरू होता है।',
    whyItMattersEn: 'Larger numbers mean water is dropping deeper, making it harder and more expensive to pump for drinking and irrigation.',
    whyItMattersHi: 'बड़ा अंक मतलब पानी नीचे जा रहा है, जिससे बोरवेल और सिंचाई का खर्च बढ़ जाता है।',
    unitsEn: 'm bgl (meters below ground level)',
    unitsHi: 'मीटर bgl (ज़मीनी सतह से नीचे)',
    farmerTipEn: 'Think of this like lowering a rope in a village well: the longer the rope needed, the deeper the water table.',
    farmerTipHi: 'जैसे कुएं में बाल्टी की रस्सी लंबी करनी पड़े, तो समझें पानी गहरा चला गया है।'
  },
  satellite_water_storage: {
    id: 'satellite_water_storage',
    category: 'satellite',
    nameEn: 'Satellite Water Storage (GRACE)',
    nameHi: 'उपग्रह जल भंडारण अनुमान (GRACE)',
    shortSummaryEn: 'Regional water gain or loss measured from space.',
    shortSummaryHi: 'अंतरिक्ष से मापा गया इलाके का कुल जल भंडारण (कमी या बढ़त)।',
    whatItMeansEn: 'Twin NASA satellites detect changes in Earth\'s gravity caused by moving water mass across wide regions (~100 km). A negative number means less water is stored underground and on the surface than normal.',
    whatItMeansHi: 'नासा के उपग्रह अंतरिक्ष से ज़मीन में मौजूद कुल पानी के वजन में बदलाव मापते हैं। माइनस का मतलब सामान्य से कम पानी है।',
    whyItMattersEn: 'Shows whether the entire region is gaining water after rain or losing water across multiple seasons.',
    whyItMattersHi: 'यह पूरे इलाके में कई सालों में पानी के कुल खजाने में आ रही कमी को दर्शाता है।',
    unitsEn: 'cm of equivalent water layer',
    unitsHi: 'सेंटीमीटर (तुल्य जल परत)',
    farmerTipEn: 'This measures water across an entire district or region, not just one farm or village.',
    farmerTipHi: 'यह किसी एक खेत का नहीं, बल्कि पूरे ज़िले और इलाके के भूजल का व्यापक पैमाना है।'
  },
  rainfall_anomaly: {
    id: 'rainfall_anomaly',
    category: 'measurement',
    nameEn: 'Rainfall Compared to Normal',
    nameHi: 'सामान्य से वर्षा में अंतर (वर्षा विचलन)',
    shortSummaryEn: 'How much more or less rain fell compared to the long-term average.',
    shortSummaryHi: 'इस मौसम में सामान्य से कितनी अधिक या कम बारिश हुई।',
    whatItMeansEn: 'Calculated from official IMD rain gauges. If normal monsoon rain is 800 mm and 600 mm fell, the difference is -200 mm (a deficit of 200 millimeters).',
    whatItMeansHi: 'मौसम विभाग के वर्षामापकों द्वारा मापा जाता है। अगर सामान्य से कम बारिश हुई है तो मान ऋणात्मक (माइनस) में आता है।',
    whyItMattersEn: 'Monsoon rains are the main source that refills underground aquifers. A deficit means wells will get less recharge.',
    whyItMattersHi: 'मानसून की बारिश ही ज़मीन के पानी का मुख्य स्रोत है। कम बारिश का मतलब कुएं कम भरेंगे।',
    unitsEn: 'mm (millimeters of rain)',
    unitsHi: 'मिमी (मिलीमीटर बारिश)',
    farmerTipEn: 'A negative number means rain was below average this season; extra water conservation will be needed.',
    farmerTipHi: 'माइनस संख्या का मतलब सूखा या कम बारिश है; पानी बचाने के विशेष उपाय करने होंगे।'
  },
  crop_greenness_ndvi: {
    id: 'crop_greenness_ndvi',
    category: 'satellite',
    nameEn: 'Crop & Vegetation Greenness (NDVI)',
    nameHi: 'फसल एवं वनस्पति हरियाली सूचकांक (NDVI)',
    shortSummaryEn: 'How green and healthy crops appear from satellite images.',
    shortSummaryHi: 'उपग्रह से ली गई तस्वीरों में फसलें और पेड़-पौधे कितने हरे और स्वस्थ हैं।',
    whatItMeansEn: 'A score from 0.0 to 1.0 calculated from light reflected by plant leaves. Healthy, watered crops usually score between 0.50 and 0.85.',
    whatItMeansHi: '0.0 से 1.0 तक का पैमाना। स्वस्थ और सिंचित फसलें आम तौर पर 0.50 से 0.85 के बीच होती हैं।',
    whyItMattersEn: 'Sudden drops in greenness can indicate crops drying out from lack of soil moisture or irrigation water.',
    whyItMattersHi: 'हरियाली में गिरावट फसल में पानी की कमी या सूखे का शुरुआती संकेत हो सकती है।',
    unitsEn: 'Index score (0.0 to 1.0)',
    unitsHi: 'सूचकांक (0.0 से 1.0)',
    farmerTipEn: 'Higher numbers mean flourishing green crops; low numbers mean dry ground or post-harvest fields.',
    farmerTipHi: 'अधिक मान हरी-भरी फसल को दिखाता है; कम मान सूखी ज़मीन या कटाई के बाद के खेत को दर्शाता है।'
  },
  surface_water_ndwi: {
    id: 'surface_water_ndwi',
    category: 'satellite',
    nameEn: 'Surface Water & Pond Index (NDWI)',
    nameHi: 'सतही जल व तालाब सूचकांक (NDWI)',
    shortSummaryEn: 'Detects open water in ponds, village tanks, and reservoirs.',
    shortSummaryHi: 'गाँव के तालाबों, पोखरों और जलाशयों में पानी की मौजूदगी को पहचानता है।',
    whatItMeansEn: 'A satellite index that highlights surface water bodies. Positive values show open surface water.',
    whatItMeansHi: 'उपग्रह सूचकांक जो सतह पर मौजूद पानी के स्रोतों को अलग से पहचानता है।',
    whyItMattersEn: 'Shows whether traditional village ponds and check dams are holding water or drying up prematurely.',
    whyItMattersHi: 'दिखाता है कि गाँव के तालाब और चेकडैम पानी रोक रहे हैं या समय से पहले सूख रहे हैं।',
    unitsEn: 'Index score (-1.0 to +1.0)',
    unitsHi: 'सूचकांक (-1.0 से +1.0)'
  },
  soil_moisture: {
    id: 'soil_moisture',
    category: 'satellite',
    nameEn: 'Topsoil Moisture (SMAP)',
    nameHi: 'ऊपरी मिट्टी की नमी (SMAP)',
    shortSummaryEn: 'How damp the top 5 cm of soil is for planting and seeds.',
    shortSummaryHi: 'बुवाई और बीजों के लिए ज़मीन की ऊपरी 5 सेमी मिट्टी में नमी।',
    whatItMeansEn: 'Measured by microwave satellite sensors. Indicates volumetric water content in topsoil.',
    whatItMeansHi: 'उपग्रह द्वारा मापा गया मिट्टी में मौजूद नमी का अनुपात।',
    whyItMattersEn: 'Crucial for seed germination and knowing when crops need their first irrigation watering.',
    whyItMattersHi: 'बीज अंकुरण और सिंचाई का सही समय तय करने के लिए बहुत उपयोगी है।',
    unitsEn: 'm³/m³ (moisture fraction)',
    unitsHi: 'घन मीटर प्रति घन मीटर'
  },
  groundwater_stress_score: {
    id: 'groundwater_stress_score',
    category: 'risk_score',
    nameEn: 'Water Stress Check (0 to 100 Guide)',
    nameHi: 'जल तनाव जाँच सूचकांक (0 से 100 मार्गदर्शिका)',
    shortSummaryEn: 'An overall 0-100 guide showing where water stress needs investigation.',
    shortSummaryHi: '0 से 100 का एक मार्गदर्शक अंक जो बताता है कि कहाँ तुरंत जाँच की ज़रूरत है।',
    whatItMeansEn: 'A decision-support checklist combining well depth, rainfall difference, and satellite indicators. 0 to 39 is Normal, 40 to 69 is Watch, and 70 to 100 is High Concern.',
    whatItMeansHi: 'कुओं की गहराई, बारिश और उपग्रह संकेतों को मिलाकर बनाया गया सरल सूचकांक। 0-39 सामान्य, 40-69 निगरानी, 70-100 उच्च संकट।',
    whyItMattersEn: 'Helps district and block officers decide where to send ground survey teams first to prevent water crises.',
    whyItMattersHi: 'अधिकारियों को यह तय करने में मदद करता है कि पानी का संकट रोकने के लिए सबसे पहले किस गाँव में टीम भेजें।',
    unitsEn: 'Points (0 to 100)',
    unitsHi: 'अंक (0 से 100)',
    farmerTipEn: 'This is a planning guide, not an official emergency declaration. Ground officers must always inspect the location in person.',
    farmerTipHi: 'यह योजना बनाने का एक मार्गदर्शक है। कोई भी बड़ा काम शुरू करने से पहले मौके पर जाँच ज़रूरी है।'
  },
  groundwater_forecast: {
    id: 'groundwater_forecast',
    category: 'forecast',
    nameEn: '3 to 12 Month Water Depth Forecast',
    nameHi: '3 से 12 महीने का संभावित जल स्तर अनुमान',
    shortSummaryEn: 'An experimental estimate of future well depths.',
    shortSummaryHi: 'आने वाले महीनों में कुओं के जल स्तर का वैज्ञानिक शोध अनुमान।',
    whatItMeansEn: 'A computer research model trained on years of historical readings and rainfall patterns to estimate where water levels will be in 3, 6, 9, or 12 months.',
    whatItMeansHi: 'पुराने रिकॉर्ड और बारिश के आधार पर कंप्यूटर मॉडल द्वारा तैयार किया गया भविष्य का अनुमान।',
    whyItMattersEn: 'Allows communities and farmers to prepare months in advance before summer shortages occur.',
    whyItMattersHi: 'गर्मी के मौसम में पानी की किल्लत आने से कई महीने पहले तैयारी करने का अवसर देता है।',
    unitsEn: 'm bgl with uncertainty range',
    unitsHi: 'मीटर bgl (संभावित सीमा सहित)',
    farmerTipEn: 'Always treat forecasts as estimates, not guarantees. Nature and weather can change.',
    farmerTipHi: 'अनुमान को एक संभावना समझें, सौ प्रतिशत पक्की गारंटी नहीं। मौसम बदल भी सकता है।'
  },
  uncertainty_range: {
    id: 'uncertainty_range',
    category: 'forecast',
    nameEn: 'Estimate Range (Likely Spread)',
    nameHi: 'अनुमान की संभावित सीमा (अनिश्चितता दायरा)',
    shortSummaryEn: 'The low-to-high band within which water depth is expected to fall.',
    shortSummaryHi: 'वह कम से ज्यादा का दायरा जिसके बीच जल स्तर रहने की सबसे अधिक संभावना है।',
    whatItMeansEn: 'Because weather and pumping vary, the model gives an 80% range (from P10 to P90) rather than a single fixed guess.',
    whatItMeansHi: 'मौसम और पानी निकालने की मात्रा के कारण एक निश्चित अंक के बजाय एक दायरा (रेंज) दिया जाता है।',
    whyItMattersEn: 'Gives decision-makers an honest view of best-case and worst-case possibilities for water planning.',
    whyItMattersHi: 'योजना बनाते समय अधिकारियों को अच्छे और बुरे दोनों हालातों के लिए तैयार रखता है।',
    unitsEn: 'm bgl (e.g., 14.2 to 17.5 m)',
    unitsHi: 'मीटर bgl (उदा. 14.2 से 17.5 मीटर)'
  },
  baseline_persistence: {
    id: 'baseline_persistence',
    category: 'forecast',
    nameEn: 'Last Reading Comparison (No-Change Benchmark)',
    nameHi: 'पिछली रीडिंग से तुलना (यथास्थिति तुलना)',
    shortSummaryEn: 'What would happen if water level simply stayed the same as the last reading.',
    shortSummaryHi: 'यदि जल स्तर में कोई बदलाव न आए और वह पिछली बार जैसा ही रहे।',
    whatItMeansEn: 'A common-sense baseline check. If a complex forecast cannot predict better than simply assuming "water stays at the last measured depth", we know the model needs improvement.',
    whatItMeansHi: 'एक साधारण तुलना यह देखने के लिए कि कंप्यूटर मॉडल साधारण अनुमान से बेहतर काम कर रहा है या नहीं।',
    whyItMattersEn: 'Ensures scientific honesty by comparing smart models against simple common sense.',
    whyItMattersHi: 'वैज्ञानिक ईमानदारी बनाए रखने के लिए ज़रूरी है कि मॉडल की तुलना सीधे साधारण अनुमान से की जाए।'
  },
  atal_bhujal_yojana: {
    id: 'atal_bhujal_yojana',
    category: 'scheme',
    nameEn: 'Atal Bhujal Yojana (Village Water Security)',
    nameHi: 'अटल भूजल योजना (गाँव जल सुरक्षा)',
    shortSummaryEn: 'Government program for community water budgeting and recharge.',
    shortSummaryHi: 'गाँव में पानी का बजट बनाने और भूजल पुनर्भरण की सरकारी योजना।',
    whatItMeansEn: 'A central government scheme helping water-stressed gram panchayats map their water, stop waste, and build recharge structures.',
    whatItMeansHi: 'पानी की कमी वाले गांवों में जल प्रबंधन और पुनर्भरण के लिए केंद्र सरकार की प्रमुख योजना।',
    whyItMattersEn: 'Provides funds and guidance directly to village communities to recharge underground water.',
    whyItMattersHi: 'गाँवों को सीधे धन और तकनीकी मदद देकर ज़मीन के पानी को फिर से भरने में मदद करती है।'
  },
  jal_jeevan_mission: {
    id: 'jal_jeevan_mission',
    category: 'scheme',
    nameEn: 'Jal Jeevan Mission (Har Ghar Jal)',
    nameHi: 'जल जीवन मिशन (हर घर जल)',
    shortSummaryEn: 'Clean piped tap water to every rural household.',
    shortSummaryHi: 'हर ग्रामीण घर तक नल से स्वच्छ पेयजल पहुँचाने की योजना।',
    whatItMeansEn: 'National program to deliver 55 liters per person per day of potable water through functional household taps.',
    whatItMeansHi: 'प्रत्येक ग्रामीण व्यक्ति को प्रतिदिन 55 लीटर सुरक्षित पीने का पानी उपलब्ध कराने का राष्ट्रीय कार्यक्रम।',
    whyItMattersEn: 'Requires reliable, long-lasting groundwater sources so village taps do not run dry in summer.',
    whyItMattersHi: 'इसके लिए ज़रूरी है कि जिस कुएं या बोरवेल से पानी आ रहा है, वह गर्मियों में सूखे नहीं।'
  },
  mgnrega_water: {
    id: 'mgnrega_water',
    category: 'scheme',
    nameEn: 'MGNREGA Natural Resource Management',
    nameHi: 'मनरेगा जल संरक्षण एवं प्राकृतिक संसाधन प्रबंधन',
    shortSummaryEn: 'Village employment for digging ponds, trenches, and check dams.',
    shortSummaryHi: 'तालाबों की खुदाई, चेकडैम और जल संचयन के लिए ग्रामीण रोज़गार योजना।',
    whatItMeansEn: 'Employs local job-card workers to build check dams, desilt canals, and dig recharge trenches before the monsoon.',
    whatItMeansHi: 'मानसून से पहले स्थानीय ग्रामीणों को रोज़गार देकर तालाबों की गाद निकालने और मेड़बंदी का काम।',
    whyItMattersEn: 'Combines guaranteed rural employment with immediate soil and water conservation.',
    whyItMattersHi: 'ग्रामीणों को रोज़गार भी मिलता है और गाँव का पानी गाँव में ही रुकता है।'
  },
  amrit_sarovar: {
    id: 'amrit_sarovar',
    category: 'scheme',
    nameEn: 'Mission Amrit Sarovar (Pond Revival)',
    nameHi: 'मिशन अमृत सरोवर (तालाबों का पुनरुद्धार)',
    shortSummaryEn: 'Reviving at least 75 traditional water bodies in every district.',
    shortSummaryHi: 'प्रत्येक ज़िले में कम से कम 75 पारंपरिक तालाबों का कायाकल्प।',
    whatItMeansEn: 'A special mission to restore traditional village ponds to hold at least 10,000 cubic meters of rainwater.',
    whatItMeansHi: 'पारंपरिक गाँव के तालाबों को गहरा और साफ करके बारिश का पानी सहेजने की विशेष योजना।',
    whyItMattersEn: 'Restores village cooling, livestock water, and continuous natural groundwater recharge.',
    whyItMattersHi: 'गाँव के पशुओं, हरियाली और भूजल को रिचार्ज करने का सबसे पारंपरिक व टिकाऊ तरीका है।'
  }
};

/**
 * Format a groundwater depth reading with clear plain-language explanation
 */
export function formatDepthPlain(
  depthMbgl: number | null | undefined,
  lang: 'en' | 'hi' = 'en'
): { formatted: string; plainMeaning: string; statusClass: string } {
  if (depthMbgl === null || depthMbgl === undefined || !Number.isFinite(depthMbgl)) {
    return {
      formatted: lang === 'hi' ? 'रीडिंग उपलब्ध नहीं' : 'No Reading Available',
      plainMeaning: lang === 'hi' 
        ? 'इस स्थान पर हाल की कोई कुआँ रीडिंग दर्ज नहीं है।' 
        : 'No recent well reading is recorded for this location yet.',
      statusClass: 'text-text-muted'
    };
  }

  const depth = Number(depthMbgl.toFixed(1));
  const unit = lang === 'hi' ? 'मीटर bgl' : 'm bgl';
  const formatted = `${depth} ${unit}`;

  if (depth < 5.0) {
    return {
      formatted,
      plainMeaning: lang === 'hi'
        ? `पानी सतह के बहुत करीब है (${depth} मीटर)। पानी निकालना आसान है।`
        : `Water is close to the surface (${depth} meters deep). Easy to access.`,
      statusClass: 'text-emerald-700'
    };
  } else if (depth <= 12.0) {
    return {
      formatted,
      plainMeaning: lang === 'hi'
        ? `मध्यम गहराई (${depth} मीटर)। जल स्तर सामान्य सीमा में है।`
        : `Moderate depth (${depth} meters deep). Normal water table range.`,
      statusClass: 'text-text-main'
    };
  } else if (depth <= 20.0) {
    return {
      formatted,
      plainMeaning: lang === 'hi'
        ? `पानी गहरा है (${depth} मीटर)। अतिरिक्त जल संरक्षण की आवश्यकता है।`
        : `Water is running deep (${depth} meters). Conservation measures needed.`,
      statusClass: 'text-amber-800'
    };
  } else {
    return {
      formatted,
      plainMeaning: lang === 'hi'
        ? `गंभीर गहराई (${depth} मीटर)। पानी बहुत नीचे चला गया है, तुरंत ध्यान दें।`
        : `Very deep (${depth} meters). Severe depletion; urgent recharge required.`,
      statusClass: 'text-rose-800 font-bold'
    };
  }
}

/**
 * Format rainfall anomaly with simple, self-explanatory English and Hindi text
 */
export function formatRainfallPlain(
  anomalyMm: number | null | undefined,
  lang: 'en' | 'hi' = 'en'
): { formatted: string; plainMeaning: string; statusClass: string } {
  if (anomalyMm === null || anomalyMm === undefined || !Number.isFinite(anomalyMm)) {
    return {
      formatted: lang === 'hi' ? 'जानकारी उपलब्ध नहीं' : 'No Data',
      plainMeaning: lang === 'hi' ? 'वर्षा माप उपलब्ध नहीं है।' : 'Rainfall measurement not available.',
      statusClass: 'text-text-muted'
    };
  }

  const rounded = Math.round(anomalyMm);
  const sign = rounded > 0 ? '+' : '';
  const formatted = `${sign}${rounded} mm`;

  if (rounded >= 50) {
    return {
      formatted,
      plainMeaning: lang === 'hi'
        ? `सामान्य से ${rounded} मिमी अधिक बारिश हुई (अच्छा मानसून)।`
        : `Received ${rounded} mm more rain than normal (good surplus).`,
      statusClass: 'text-emerald-700'
    };
  } else if (rounded >= -50) {
    return {
      formatted,
      plainMeaning: lang === 'hi'
        ? 'बारिश सामान्य औसत के आसपास रही।'
        : 'Rainfall was close to normal average.',
      statusClass: 'text-text-main'
    };
  } else if (rounded >= -150) {
    return {
      formatted,
      plainMeaning: lang === 'hi'
        ? `सामान्य से ${Math.abs(rounded)} मिमी कम बारिश (हल्की कमी)।`
        : `Received ${Math.abs(rounded)} mm less rain than usual (mild deficit).`,
      statusClass: 'text-amber-800'
    };
  } else {
    return {
      formatted,
      plainMeaning: lang === 'hi'
        ? `सामान्य से ${Math.abs(rounded)} मिमी कम बारिश (भारी कमी/सूखा)।`
        : `Received ${Math.abs(rounded)} mm less rain than usual (severe dry spell).`,
      statusClass: 'text-rose-800 font-bold'
    };
  }
}

/**
 * Format water stress level in everyday words
 */
export function formatStressSeverityPlain(
  severity: string | null | undefined,
  lang: 'en' | 'hi' = 'en'
): { label: string; explanation: string; badgeClass: string } {
  const norm = (severity || '').toLowerCase();

  if (norm.includes('severe') || norm.includes('high') || norm === 'critical') {
    return {
      label: lang === 'hi' ? 'उच्च संकट (तुरंत जाँच)' : 'High Concern (Needs Inspection)',
      explanation: lang === 'hi'
        ? 'कुएं बहुत गहरे हैं और बारिश कम हुई है। स्थानीय अधिकारियों को मौके पर जाकर स्थिति देखनी चाहिए।'
        : 'Wells are deep and rainfall was low. Officers should inspect the area and prioritize water recharge.',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-300'
    };
  } else if (norm.includes('watch') || norm.includes('moderate') || norm === 'medium') {
    return {
      label: lang === 'hi' ? 'निगरानी रखें (सतर्क)' : 'Keep Watching (Monitor Closely)',
      explanation: lang === 'hi'
        ? 'जल स्तर में गिरावट के शुरुआती संकेत हैं। स्थिति पर नजर रखें ताकि संकट न बने।'
        : 'Early signs of declining water levels. Monitor weekly to prevent shortages before summer.',
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-300'
    };
  } else {
    return {
      label: lang === 'hi' ? 'सामान्य जल स्तर (सुरक्षित)' : 'Normal Water Level (Stable)',
      explanation: lang === 'hi'
        ? 'वर्तमान आंकड़ों में जल स्तर स्थिर है और कोई तत्काल चेतावनी नहीं है।'
        : 'Water levels are within normal historical ranges; no immediate alert.',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300'
    };
  }
}
