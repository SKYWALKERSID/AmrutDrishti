import { DataSourceStatus } from '../types';

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
    lastSuccessfulIngestion: '2026-10-08 08:15 UTC',
    latestObservationDate: '2026-10-07',
    status: 'healthy',
    missingDataRatePct: 0.4,
    licenseTerms: 'Government of India Data Sharing & Accessibility Policy (NDSAP)',
    provenanceDetails: 'Interpolated daily rainfall totals (mm) & calculated SPI (Standardized Precipitation Index) against 30-year long-period average (1991-2020).'
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
    name: 'CGWB & State Observation Well Monitoring Network',
    provider: 'Central Ground Water Board (CGWB) & MP Water Resources Dept',
    spatialResolution: 'Point Observations (approx 1 well per 15-25 km² in pilot blocks)',
    temporalCadence: 'Quarterly Telemetric Hydrograph & Manual Monitoring (Pre/Post-Monsoon)',
    lastSuccessfulIngestion: '2026-09-30 06:00 UTC',
    latestObservationDate: '2026-09-28',
    status: 'healthy',
    missingDataRatePct: 5.8,
    licenseTerms: 'India-WRIS / CGWB National Hydrograph Network Terms',
    provenanceDetails: 'Direct depth to water level below ground level (m bgl) measured in piezometers & open dug wells across priority state monitoring networks (covering crystalline hard-rock and alluvial aquifer zones).'
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
  }
];
