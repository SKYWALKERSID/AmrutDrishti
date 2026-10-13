/**
 * Canonical List of all Indian States and Union Territories.
 * Used for nationwide administrative exploration.
 * States with telemetry / CGWB database records or contrast monitoring are marked hasData: true.
 * Other states are cleanly marked hasData: false (rendered as disabled/grayed out in UI).
 */

export interface IndianStateMeta {
  code: string;
  name: string;
  hasData: boolean;
  statusLabel?: string;
  districtsCount?: number;
}

export const ALL_INDIAN_STATES: IndianStateMeta[] = [
  // Active states with data
  { code: 'MP', name: 'Madhya Pradesh', hasData: true, statusLabel: 'Live / Empirical Data Available' },
  { code: 'UP', name: 'Uttar Pradesh', hasData: true, statusLabel: 'Bundelkhand Pilot Observation Network' },
  { code: 'PB', name: 'Punjab', hasData: true, statusLabel: 'Over-Exploited Red Zone (CGWB / NWIC)' },
  { code: 'RJ', name: 'Rajasthan', hasData: true, statusLabel: 'Critical Arid Red Zone (CGWB / NWIC)' },
  { code: 'HR', name: 'Haryana', hasData: true, statusLabel: 'High Extraction Zone (CGWB / NWIC)' },
  { code: 'AR', name: 'Arunachal Pradesh', hasData: true, statusLabel: 'Surplus Basin Benchmark (CGWB / NWIC)' },
  { code: 'SK', name: 'Sikkim', hasData: true, statusLabel: 'Pristine Springshed Benchmark (CGWB / NWIC)' },
  { code: 'AS', name: 'Assam', hasData: true, statusLabel: 'Brahmaputra Valley Benchmark (CGWB / NWIC)' },

  // Remaining States & UTs (A-Z) - Unwired / Data Pending (Grayed out)
  { code: 'AN', name: 'Andaman and Nicobar Islands', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'AP', name: 'Andhra Pradesh', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'BR', name: 'Bihar', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'CH', name: 'Chandigarh', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'CT', name: 'Chhattisgarh', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'DH', name: 'Dadra and Nagar Haveli and Daman and Diu', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'DL', name: 'Delhi', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'GA', name: 'Goa', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'GJ', name: 'Gujarat', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'HP', name: 'Himachal Pradesh', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'JK', name: 'Jammu and Kashmir', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'JH', name: 'Jharkhand', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'KA', name: 'Karnataka', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'KL', name: 'Kerala', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'LA', name: 'Ladakh', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'LD', name: 'Lakshadweep', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'MH', name: 'Maharashtra', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'MN', name: 'Manipur', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'ML', name: 'Meghalaya', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'MZ', name: 'Mizoram', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'NL', name: 'Nagaland', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'OR', name: 'Odisha', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'PY', name: 'Puducherry', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'TN', name: 'Tamil Nadu', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'TG', name: 'Telangana', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'TR', name: 'Tripura', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'UT', name: 'Uttarakhand', hasData: false, statusLabel: 'Telemetry Ingestion Pending' },
  { code: 'WB', name: 'West Bengal', hasData: false, statusLabel: 'Telemetry Ingestion Pending' }
];
