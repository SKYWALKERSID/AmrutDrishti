/**
 * JAL DRISHTI — Authoritative Official Groundwater Source Registry
 * ===============================================================
 * The 27 approved official dataset URLs for the 9 retained states.
 * Exactly three official URLs per state:
 * - 2021–2025: NWDP/NWIC 6-hourly telemetry resource
 * - 2026–2030: NWDP/NWIC 6-hourly telemetry resource
 * - State department catalogue: Official State Ground Water Department repository
 */

import nwdpSourceRegistry from '../../../data/sources/nwdp_telemetry_raw/nwdp_telemetry_source_registry.json' with { type: 'json' };

export interface OfficialStateSourceEntry {
  state: string;
  period: '2021-2025' | '2026-2030' | 'state_catalogue';
  sourceCategory: 'nwdp_telemetry_6_hourly' | 'state_department_catalogue';
  url: string;
  sourceOrganization: string;
  accessMethod: 'direct_csv_download' | 'ckan_catalogue_metadata';
  expectedUnits: 'source_reported_meter_datum_unverified' | 'metadata_catalogue';
}

// Retained, hash-verified raw inputs used by the active NWDP pipeline.
export const RETAINED_NWDP_RAW_RESOURCES = nwdpSourceRegistry.resources;

export const AUTHORITATIVE_OFFICIAL_SOURCES: OfficialStateSourceEntry[] = [
  // 1. Karnataka
  {
    state: 'Karnataka',
    period: '2021-2025',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/cd3f04e8-966a-41d3-9c18-f0122a2f3a50/download/gwl_tel_6_hourly_cgwb_ka_2021_2025.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Karnataka',
    period: '2026-2030',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/b9a76d29-078e-4551-8092-e22f0e60bb45/download/gwl_tel_6_hourly_cgwb_ka_2026_2030.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Karnataka',
    period: 'state_catalogue',
    sourceCategory: 'state_department_catalogue',
    url: 'http://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-hourly-karnataka-ground-water-department',
    sourceOrganization: 'Karnataka Ground Water Department',
    accessMethod: 'ckan_catalogue_metadata',
    expectedUnits: 'metadata_catalogue',
  },

  // 2. Telangana
  {
    state: 'Telangana',
    period: '2021-2025',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/bc5a9d1c-1f3b-4629-9cfb-0d1ccc9ac81f/download/gwl_tel_6_hourly_cgwb_ts_2021_2025.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Telangana',
    period: '2026-2030',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/137d0a1c-8fe0-4bb1-97a8-983c28ec96db/download/gwl_tel_6_hourly_cgwb_ts_2026_2030.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Telangana',
    period: 'state_catalogue',
    sourceCategory: 'state_department_catalogue',
    url: 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-telangana-gw',
    sourceOrganization: 'Telangana Ground Water Department',
    accessMethod: 'ckan_catalogue_metadata',
    expectedUnits: 'metadata_catalogue',
  },

  // 3. Tamil Nadu
  {
    state: 'Tamil Nadu',
    period: '2021-2025',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/e68634e0-07e7-4f64-9c08-0808dba2c445/download/gwl_tel_6_hourly_cgwb_tn_2021_2025.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Tamil Nadu',
    period: '2026-2030',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/3bd0c6d5-dd9b-4c07-9c60-6410c1c6bd56/download/gwl_tel_6_hourly_cgwb_tn_2026_2030.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Tamil Nadu',
    period: 'state_catalogue',
    sourceCategory: 'state_department_catalogue',
    url: 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-tamil-nadu-sw-gw',
    sourceOrganization: 'Tamil Nadu Surface Water and Ground Water Departments',
    accessMethod: 'ckan_catalogue_metadata',
    expectedUnits: 'metadata_catalogue',
  },

  // 4. Madhya Pradesh
  {
    state: 'Madhya Pradesh',
    period: '2021-2025',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/acb2cc5c-4182-4aa9-8f47-7cd0bb63fc57/download/gwl_tel_6_hourly_cgwb_mp_2021_2025.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Madhya Pradesh',
    period: '2026-2030',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/ad5b97a5-9c42-443b-8069-e1c33875239c/download/gwl_tel_6_hourly_cgwb_mp_2026_2030.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Madhya Pradesh',
    period: 'state_catalogue',
    sourceCategory: 'state_department_catalogue',
    url: 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-madhya-pradesh-gw',
    sourceOrganization: 'Madhya Pradesh Ground Water Department',
    accessMethod: 'ckan_catalogue_metadata',
    expectedUnits: 'metadata_catalogue',
  },

  // 5. Rajasthan
  {
    state: 'Rajasthan',
    period: '2021-2025',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/467fe983-e1f0-4428-91b7-0ade87b39f6d/download/gwl_tel_6_hourly_cgwb_rj_2021_2025.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Rajasthan',
    period: '2026-2030',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/931ff862-f13e-4754-83f9-55e0dc894f2d/download/gwl_tel_6_hourly_cgwb_rj_2026_2030.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Rajasthan',
    period: 'state_catalogue',
    sourceCategory: 'state_department_catalogue',
    url: 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-hourly-rajasthan-ground-water-department',
    sourceOrganization: 'Rajasthan Ground Water Department',
    accessMethod: 'ckan_catalogue_metadata',
    expectedUnits: 'metadata_catalogue',
  },

  // 6. Punjab
  {
    state: 'Punjab',
    period: '2021-2025',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/2b3bfc59-e5ca-419b-b3c8-6133da16f2f7/download/gwl_tel_6_hourly_cgwb_pb_2021_2025.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Punjab',
    period: '2026-2030',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/8d6526d8-e33d-4401-bea1-e34d259d7070/download/gwl_tel_6_hourly_cgwb_pb_2026_2030.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Punjab',
    period: 'state_catalogue',
    sourceCategory: 'state_department_catalogue',
    url: 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-hourly-punjab-ground-water-department',
    sourceOrganization: 'Punjab Ground Water Department',
    accessMethod: 'ckan_catalogue_metadata',
    expectedUnits: 'metadata_catalogue',
  },

  // 7. Haryana
  {
    state: 'Haryana',
    period: '2021-2025',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/fc883e0c-c594-4ef7-9fef-c3e0d0cc25c2/download/gwl_tel_6_hourly_cgwb_hr_2021_2025.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Haryana',
    period: '2026-2030',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/bfc07a76-e85b-4e35-89d6-f707fb3a3128/download/gwl_tel_6_hourly_cgwb_hr_2026_2030.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Haryana',
    period: 'state_catalogue',
    sourceCategory: 'state_department_catalogue',
    url: 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-haryana-gw',
    sourceOrganization: 'Haryana Ground Water Department',
    accessMethod: 'ckan_catalogue_metadata',
    expectedUnits: 'metadata_catalogue',
  },

  // 8. Meghalaya
  {
    state: 'Meghalaya',
    period: '2021-2025',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/82d41fe2-ef41-4dbd-8ee2-4323bf22c554/download/gwl_tel_6_hourly_cgwb_ml_2021_2025.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Meghalaya',
    period: '2026-2030',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/5839112c-afb1-472e-9326-6eaa23c9a12f/download/gwl_tel_6_hourly_cgwb_ml_2026_2030.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Meghalaya',
    period: 'state_catalogue',
    sourceCategory: 'state_department_catalogue',
    url: 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-meghalaya',
    sourceOrganization: 'Meghalaya Ground Water Department',
    accessMethod: 'ckan_catalogue_metadata',
    expectedUnits: 'metadata_catalogue',
  },

  // 9. Tripura
  {
    state: 'Tripura',
    period: '2021-2025',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/440d0737-a937-446b-843d-89acb6f23379/download/gwl_tel_6_hourly_cgwb_tr_2021_2025.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Tripura',
    period: '2026-2030',
    sourceCategory: 'nwdp_telemetry_6_hourly',
    url: 'https://nwdp.nwic.gov.in/dataset/3782ba15-9b12-46a8-ae44-410b1f84020e/resource/cd023229-a909-4b92-b5e0-5b2f5a34f850/download/gwl_tel_6_hourly_cgwb_tr_2026_2030.csv',
    sourceOrganization: 'Central Ground Water Board (CGWB) / NWIC',
    accessMethod: 'direct_csv_download',
    expectedUnits: 'source_reported_meter_datum_unverified',
  },
  {
    state: 'Tripura',
    period: 'state_catalogue',
    sourceCategory: 'state_department_catalogue',
    url: 'https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-daily-tripura',
    sourceOrganization: 'Tripura Water Resources Department',
    accessMethod: 'ckan_catalogue_metadata',
    expectedUnits: 'metadata_catalogue',
  },
];


