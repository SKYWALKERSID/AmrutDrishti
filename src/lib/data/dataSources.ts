import type { DataSourceStatus } from '../types.ts';

export const DATA_SOURCES: DataSourceStatus[] = [
  {
    id: 'src_grace_fo',
    name: 'GRACE / GRACE-FO Terrestrial Water Storage Anomaly (TWSA)',
    provider: 'NASA / JPL / GFZ Potsdam',
    spatialResolution: '1.0° × 1.0° (approx 100km × 100km spatial grid)',
    temporalCadence: 'Monthly (~30-45 day ingestion lag)',
    lastSuccessfulIngestion: '2026-09-15 04:30 UTC',
    latestObservationDate: '2026-08-31',
    status: 'healthy',
    missingDataRatePct: 2.1,
    licenseTerms: 'Public Domain / Open Data Policy (NASA Earth Science Data)',
    provenanceDetails: 'RL06.1 Liquid Water Equivalent thickness anomaly relative to 2004-2010 baseline. Coarse spatial support — provides regional mass anomaly, not village-scale depth.'
  },
  {
    id: 'src_imd_rainfall',
    name: 'IMD High-Resolution Gridded Precipitation',
    provider: 'India Meteorological Department (IMD Pune)',
    spatialResolution: '0.25° × 0.25° (approx 25km × 25km grid)',
    temporalCadence: 'Daily (24-hour update lag)',
    lastSuccessfulIngestion: '2026-10-20 13:17 UTC',
    latestObservationDate: '2026-10-15',
    status: 'healthy',
    missingDataRatePct: 0.4,
    licenseTerms: 'Government of India Data Sharing & Accessibility Policy (NDSAP)',
    provenanceDetails: 'Interpolated daily rainfall totals (mm) & calculated SPI (Standardized Precipitation Index) against 30-year long-period average (1991-2020). CMPG endpoint verified; high-res stream verified through October 15, 2026.'
  },
  {
    id: 'src_sentinel2_sr',
    name: 'Sentinel-2 MSI Surface Reflectance (NDVI & NDWI)',
    provider: 'European Space Agency (ESA) / Copernicus',
    spatialResolution: '10m - 20m spatial resolution',
    temporalCadence: '5-day revisit cadence',
    lastSuccessfulIngestion: '2026-10-05 14:00 UTC',
    latestObservationDate: '2026-09-28',
    status: 'healthy',
    missingDataRatePct: 8.5,
    licenseTerms: 'Copernicus Open Access License (Free & Open Access)',
    provenanceDetails: 'Cloud-masked band ratios (B8 - B4)/(B8 + B4) for NDVI and (B3 - B8)/(B3 + B8) for NDWI. Screened for monsoonal cloud cover.'
  },
  {
    id: 'src_smap_sm',
    name: 'SMAP L3 Radiometer Surface Soil Moisture',
    provider: 'NASA Goddard / NSIDC',
    spatialResolution: '9km × 9km equal-area grid',
    temporalCadence: 'Daily / 3-day composite',
    lastSuccessfulIngestion: '2026-10-07 11:20 UTC',
    latestObservationDate: '2026-10-06',
    status: 'healthy',
    missingDataRatePct: 3.2,
    licenseTerms: 'NASA Earth Data Policy',
    provenanceDetails: 'Top 5cm surface volumetric soil moisture (m³/m³). Indicates topsoil moisture retention, not deep aquifer storage.'
  },
  {
    id: 'src_cgwb_wells',
    name: 'CGWB & NWIC National Groundwater Well Monitoring Network',
    provider: 'Central Ground Water Board (CGWB) & National Water Informatics Centre (NWIC)',
    spatialResolution: 'Point Observations (Piezometers & Dug Wells across monitored blocks)',
    temporalCadence: 'Quarterly Telemetric Hydrograph (DWLR) & Seasonal Field Monitoring (Pre/Post-Monsoon)',
    lastSuccessfulIngestion: '2026-10-20 13:18 UTC',
    latestObservationDate: '2025-12-31',
    status: 'healthy',
    missingDataRatePct: 3.8,
    licenseTerms: 'India-WRIS / CGWB National Hydrograph Network Terms',
    provenanceDetails: 'Direct depth to water level below ground level (m bgl) measured in DWLR piezometers, telemetry networks, and dug wells across the ten target states in four project regions: South India (Karnataka, Telangana, Tamil Nadu), Central India (Madhya Pradesh), North India (Rajasthan, Haryana, Punjab), and Northeast India (Meghalaya, Assam, Tripura). Historical research records for Uttar Pradesh, Sikkim, and Arunachal Pradesh are retained as out-of-scope reference baselines.'
  },
  {
    id: 'src_meghalaya_gwd',
    name: 'Meghalaya Ground Water Department Monitoring Network',
    provider: 'Meghalaya Ground Water Department & NWIC',
    spatialResolution: 'Station-level monitoring points (West Jaintia Hills, Ri Bhoi, East Jaintia Hills, West Khasi Hills, East Khasi Hills)',
    temporalCadence: 'Quarterly Manual Monitoring & Telemetry Archive',
    lastSuccessfulIngestion: '2026-10-20 13:18 UTC',
    latestObservationDate: '2023-04-10',
    status: 'healthy',
    missingDataRatePct: 0.0,
    licenseTerms: 'NWIC / State Department Open Data Access',
    provenanceDetails: 'Official manual quarterly groundwater depth observations (m bgl) fetched directly from NWIC CKAN portal (75 valid observations, 0 rejected). Quadridaily telemetry archive covers Latyrke and Zikzak stations.'
  },
  {
    id: 'src_isro_bhuvan',
    name: 'ISRO Bhuvan Hydrogeology & Aquifer Maps',
    provider: 'ISRO / National Remote Sensing Centre (NRSC)',
    spatialResolution: '1:50,000 scale administrative boundary & hydrogeology maps',
    temporalCadence: 'Static / Annual update',
    lastSuccessfulIngestion: '2026-06-01 00:00 UTC',
    latestObservationDate: '2026-05-15',
    status: 'healthy',
    missingDataRatePct: 0.0,
    licenseTerms: 'ISRO Open Data Policy / Government Public Map Portal',
    provenanceDetails: 'Approved administrative block & district boundaries, lithological boundaries, fracture zone hydro-prospect layers.'
  },
  {
    id: 'src_cgwb_ingres',
    name: 'CGWB Dynamic Ground Water Resource Assessment (IN-GRES)',
    provider: 'Ministry of Jal Shakti / CGWB',
    spatialResolution: 'Assessment Unit (Block / Taluka / Tehsil) Level',
    temporalCadence: 'Annual Official Assessment',
    lastSuccessfulIngestion: '2026-08-10 12:00 UTC',
    latestObservationDate: '2025-12-31',
    status: 'healthy',
    missingDataRatePct: 0.0,
    licenseTerms: 'Government of India Open Access / CGWB Assessment Reports',
    provenanceDetails: 'Official Stage of Ground Water Extraction (SOE %), categorized into Over-Exploited (>100%), Critical (90-100%), Semi-Critical (70-90%), and Safe (<70%) across pilot and national contrast benchmark states.'
  }
];
