import { AlertTemplate, NotificationRecord } from '../types';

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
    messageHindi: 'जलदृष्टि सतर्कता: टीकमगढ़ ब्लॉक में भूजल स्तर 14.8m bgl तक गिर गया है। वर्षा घाटा -235mm दर्ज हुआ है। जल समिति एवं ग्राम पंचायत जल प्रबंधन समीक्षा करें।',
    messageEnglish: 'JalDrishti Advisory: High groundwater stress in Tikamgarh block. Well depth 14.8m bgl with -235mm rainfall deficit. Human verification advised.',
    sentTimestamp: '2026-10-08 09:30 IST',
    deliveryStatus: 'delivered',
    confidenceScore: 0.88,
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
    messageHindi: 'जलदृष्टि सतर्कता: जतारा ब्लॉक में भूजल स्तर 16.2m bgl तक गिर गया है। अटल भूजल योजना प्राथमिकता समीक्षा करें।',
    messageEnglish: 'JalDrishti Advisory: Well depth 16.2m bgl in Jatara block. Atal Bhujal Yojana priority review advised.',
    sentTimestamp: '2026-10-08 09:32 IST',
    deliveryStatus: 'delivered',
    confidenceScore: 0.84,
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
    messageHindi: 'जलदृष्टि सतर्कता: छतरपुर ब्लॉक में भूजल तनाव सूचकांक 84/100 दर्ज हुआ है। कुओं एवं जलाशयों का भौतिक निरीक्षण करें।',
    messageEnglish: 'JalDrishti Advisory: Stress score 84/100 in Chhatarpur block. Physical inspection of observation wells recommended.',
    sentTimestamp: '2026-10-07 14:15 IST',
    deliveryStatus: 'simulated',
    confidenceScore: 0.91,
    dataFreshnessDate: '2026-09-28'
  }
];
