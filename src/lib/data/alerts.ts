import type { AlertTemplate, NotificationRecord } from '../types.ts';
import { ADVISORY_DISCLAIMER_EN, ADVISORY_DISCLAIMER_HI } from '../demo/demoPolicy.ts';

export const ALERT_TEMPLATES: AlertTemplate[] = [
  {
    id: 'tmpl_severe_drought_hi',
    title: 'Severe Groundwater Stress Early Warning',
    hindiText: 'जलदृष्टि सतर्कता: {{block_name}} ({{district_name}}) में भूजल स्तर {{well_depth}}m bgl तक गिर गया है। वर्षा घाटा {{rainfall_anomaly}}mm दर्ज हुआ है। जल समिति एवं ग्राम पंचायत जल प्रबंधन समीक्षा करें। (सूचना स्रोत: CGWB / IMD / NASA GRACE | निर्णय-सहायता चेतावनी)',
    englishText: 'JalDrishti Advisory: High groundwater stress in {{block_name}} ({{district_name}}). Well depth reached {{well_depth}}m bgl with {{rainfall_anomaly}}mm rainfall deficit. Water committee & Gram Panchayat review recommended. (Source: CGWB/IMD/GRACE)',
    targetRole: 'bdo',
    severity: 'severe'
  },
  {
    id: 'tmpl_watch_advisory_hi',
    title: 'Moderate Stress Seasonal Advisory',
    hindiText: 'जलदृष्टि सूचना: {{block_name}} ({{district_name}}) में पिछले 3 महीनों में मृदा नमी में गिरावट देखी गई है। रबी फसल बुवाई हेतु सिंचाई जल बजट की योजना बनाएं।',
    englishText: 'JalDrishti Notice: Soil moisture decline observed in {{block_name}} ({{district_name}}). Plan irrigation water budgeting for upcoming Rabi crop cycle.',
    targetRole: 'gram_pradhan',
    severity: 'watch'
  }
];

/**
 * Demonstration log entries. NO message was ever sent for any of these records:
 * every entry is `simulated`, and the numbers quoted are demonstration fixture values,
 * not verified groundwater measurements.
 */
export const INITIAL_NOTIFICATIONS: NotificationRecord[] = [
  {
    id: 'notif_001',
    recipientName: 'District Collector Office',
    recipientRole: 'district_collector',
    recipientPhone: '+91 94251 *****',
    districtName: 'Tikamgarh',
    blockName: 'Tikamgarh',
    severity: 'severe',
    channel: 'WhatsApp',
    messageHindi: `[सिम्युलेटेड - भेजा नहीं गया] जलदृष्टि प्रदर्शन सूचना: टीकमगढ़ ब्लॉक - "गंभीर तनाव" संकेत श्रेणी। प्रदर्शन (फ़िक्स्चर) मान, सत्यापित माप नहीं: कुआँ गहराई 14.8 m bgl, वर्षा विचलन -235 mm। ${ADVISORY_DISCLAIMER_HI}`,
    messageEnglish: `[SIMULATED - NOT SENT] JalDrishti demonstration advisory: "Severe stress" signal category for Tikamgarh block. Demonstration fixture values, not verified measurements: well depth 14.8 m bgl, rainfall anomaly -235 mm. ${ADVISORY_DISCLAIMER_EN}`,
    sentTimestamp: '2026-10-08 09:30 IST (simulated log entry)',
    deliveryStatus: 'simulated',
    confidenceScore: null,
    dataFreshnessDate: '2026-09-28'
  },
  {
    id: 'notif_002',
    recipientName: 'R. K. Sharma (BDO)',
    recipientRole: 'bdo',
    recipientPhone: '+91 98263 *****',
    districtName: 'Tikamgarh',
    blockName: 'Jatara',
    severity: 'severe',
    channel: 'SMS',
    messageHindi: `[सिम्युलेटेड - भेजा नहीं गया] जलदृष्टि प्रदर्शन सूचना: जतारा ब्लॉक - "गंभीर तनाव" संकेत श्रेणी। प्रदर्शन (फ़िक्स्चर) मान, सत्यापित माप नहीं: कुआँ गहराई 16.2 m bgl। ${ADVISORY_DISCLAIMER_HI}`,
    messageEnglish: `[SIMULATED - NOT SENT] JalDrishti demonstration advisory: "Severe stress" signal category for Jatara block. Demonstration fixture value, not a verified measurement: well depth 16.2 m bgl. ${ADVISORY_DISCLAIMER_EN}`,
    sentTimestamp: '2026-10-08 09:32 IST (simulated log entry)',
    deliveryStatus: 'simulated',
    confidenceScore: null,
    dataFreshnessDate: '2026-09-28'
  },
  {
    id: 'notif_003',
    recipientName: 'Suresh Kumar Patel (Jal Samiti)',
    recipientRole: 'jal_samiti',
    recipientPhone: '+91 97542 *****',
    districtName: 'Chhatarpur',
    blockName: 'Chhatarpur',
    severity: 'severe',
    channel: 'WhatsApp',
    messageHindi: `[सिम्युलेटेड - भेजा नहीं गया] जलदृष्टि प्रदर्शन सूचना: छतरपुर ब्लॉक - "गंभीर तनाव" संकेत श्रेणी। प्रदर्शन (फ़िक्स्चर) डेमो स्कोर 84/100 (गणना या सत्यापन नहीं की गई)। ${ADVISORY_DISCLAIMER_HI}`,
    messageEnglish: `[SIMULATED - NOT SENT] JalDrishti demonstration advisory: "Severe stress" signal category for Chhatarpur block. Demonstration fixture score 84/100 (not computed or validated). ${ADVISORY_DISCLAIMER_EN}`,
    sentTimestamp: '2026-10-07 14:15 IST (simulated log entry)',
    deliveryStatus: 'simulated',
    confidenceScore: null,
    dataFreshnessDate: '2026-09-28'
  }
];
