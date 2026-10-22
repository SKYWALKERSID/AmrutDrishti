/**
 * JAL DRISHTI — Reusable Data Freshness & Provenance Model
 * 
 * Defines standard freshness statuses, source metadata structures,
 * and calculation helpers based on verified observation dates and reporting intervals.
 */

export type FreshnessStatus =
  | 'LIVE'           // Functioning live source with real observation period
  | 'RECENT'         // Verified recent source update within documented lag
  | 'HISTORICAL'     // Valid historical data with its real coverage period
  | 'RESEARCH_ONLY'  // Experimental model or indicator not approved for statutory decisions
  | 'DEMO'           // Explicitly identified demonstration data
  | 'STALE'          // Data exceeds documented freshness threshold
  | 'UNAVAILABLE'    // Data cannot currently be retrieved or does not exist for area
  | 'ERROR';         // Request or processing operation failed

export interface FreshnessMetadata {
  status: FreshnessStatus;
  sourceName: string;
  provider: string;
  sourceUrl?: string;
  lastObservedDate: string | null;
  lastIngestionDate: string | null;
  retrievedAt: string;
  temporalCadence: string;
  geographicScope: string;
  units?: string;
  limitations?: string;
}

/**
 * Standard registry of configured data providers with authoritative links and cadence metadata.
 */
export const SOURCE_CATALOG = {
  cgwb_dwlr: {
    name: 'CGWB & NWIC Telemetry Network',
    provider: 'Central Ground Water Board / NWIC',
    url: 'https://nwic.gov.in',
    cadence: 'Daily telemetry / Quarterly manual',
    typicalLagDays: 30,
    scope: '10 Active States (Karnataka, Telangana, Tamil Nadu, MP, Rajasthan, Haryana, Punjab, Meghalaya, Assam, Tripura)',
    limitations: 'Station density varies by hydrogeological setting; irregular observation intervals preserved.',
  },
  grace_fo: {
    name: 'GRACE-FO Terrestrial Water Storage Anomaly',
    provider: 'NASA JPL / GFZ Potsdam',
    url: 'https://grace.jpl.nasa.gov',
    cadence: 'Monthly (~30-45 day lag)',
    typicalLagDays: 45,
    scope: 'Nationwide 1.0° × 1.0° (~100 km grid)',
    limitations: 'Regional mass changes only; cannot measure village or well-level groundwater depth directly.',
  },
  imd_rainfall: {
    name: 'IMD High-Resolution Gridded Precipitation',
    provider: 'India Meteorological Department (IMD Pune)',
    url: 'https://imdpune.gov.in',
    cadence: 'Daily gridded (0.25° × 0.25°)',
    typicalLagDays: 2,
    scope: 'All India 0.25° grid polygon aggregation',
    limitations: 'Spatial aggregation across block polygons inherits gridded interpolation uncertainty.',
  },
  sentinel2: {
    name: 'Sentinel-2 MSI Surface Reflectance',
    provider: 'ESA / Copernicus via Google Earth Engine',
    url: 'https://dataspace.copernicus.eu',
    cadence: '5-Day Revisit',
    typicalLagDays: 10,
    scope: '10m - 20m spatial resolution',
    limitations: 'Screened for monsoonal cloud cover; surface vegetation index reflects soil-canopy interaction.',
  },
  smap: {
    name: 'SMAP L3 Radiometer Soil Moisture',
    provider: 'NASA Goddard / NSIDC',
    url: 'https://smap.jpl.nasa.gov',
    cadence: 'Daily / 3-Day composite (9 km)',
    typicalLagDays: 5,
    scope: '9 km grid',
    limitations: 'Top 5cm surface soil moisture only; does not directly reflect deep confined aquifer storage.',
  },
  quantile_model: {
    name: 'QuantileGB-v2.0 Forecast Model',
    provider: 'JalDrishti Research Engine',
    cadence: 'Quarterly Horizon (1 to 4 quarters ahead)',
    scope: 'Monitored stations with validated historical telemetry',
    limitations: 'Statistical research prototype; uncalibrated intervals; not approved for disaster declaration.',
  },
  gss_composite: {
    name: 'Descriptive Groundwater Stress Score (GSS)',
    provider: 'JalDrishti Scientific Engine',
    cadence: 'Dynamic calculation on indicator update',
    scope: 'Monitored administrative blocks',
    limitations: 'Heuristic weighted index (0-100); requires independent validation before statutory use.',
  },
};

/**
 * Computes the data freshness status given the source type, observation date, and operational state.
 */
export function deriveFreshnessStatus(
  options: {
    isLiveSource?: boolean;
    isDemoData?: boolean;
    isResearchOnly?: boolean;
    hasError?: boolean;
    isUnavailable?: boolean;
    lastObservedDate?: string | null;
    typicalLagDays?: number;
    referenceDate?: Date;
  }
): FreshnessStatus {
  if (options.hasError) return 'ERROR';
  if (options.isUnavailable || !options.lastObservedDate) return 'UNAVAILABLE';
  if (options.isDemoData) return 'DEMO';
  if (options.isResearchOnly) return 'RESEARCH_ONLY';

  if (!options.isLiveSource && options.lastObservedDate) {
    const obsYear = parseInt(options.lastObservedDate.split('-')[0], 10);
    const currentYear = (options.referenceDate || new Date()).getFullYear();
    if (currentYear - obsYear >= 2) {
      return 'HISTORICAL';
    }
  }

  if (options.lastObservedDate) {
    const obsTime = new Date(options.lastObservedDate).getTime();
    const now = (options.referenceDate || new Date()).getTime();
    const diffDays = Math.floor((now - obsTime) / (1000 * 60 * 60 * 24));
    const maxLag = (options.typicalLagDays || 30) * 2; // threshold for stale

    if (diffDays > maxLag) {
      return 'STALE';
    }
    if (diffDays <= (options.typicalLagDays || 30) && options.isLiveSource) {
      return 'LIVE';
    }
    return 'RECENT';
  }

  return 'RECENT';
}

/**
 * Styling attributes (badge color, border, label) for each FreshnessStatus.
 *
 * All colours come from design tokens in src/app/globals.css (registered in tailwind.config.js).
 * Do not add hex values here. Each state keeps its own colour family and its own label, so
 * state is never conveyed by colour alone.
 */
export const FRESHNESS_STYLES: Record<
  FreshnessStatus,
  { label: string; bg: string; text: string; border: string; dot: string; description: string }
> = {
  LIVE: {
    label: 'LIVE',
    bg: 'bg-status-successBg',
    text: 'text-status-successText',
    border: 'border-status-success',
    dot: 'bg-status-success',
    description: 'Data is dynamically synchronized from a functioning live database or telemetry source.',
  },
  RECENT: {
    label: 'RECENT',
    bg: 'bg-primary-light',
    text: 'text-primary',
    border: 'border-border-accent',
    dot: 'bg-primary',
    description: 'Verified recent source update within documented reporting interval.',
  },
  HISTORICAL: {
    label: 'HISTORICAL',
    bg: 'bg-status-infoBg',
    text: 'text-status-infoText',
    border: 'border-status-info',
    dot: 'bg-status-infoText',
    description: 'Authentic empirical historical baseline records with verified temporal coverage.',
  },
  RESEARCH_ONLY: {
    label: 'RESEARCH ONLY',
    bg: 'bg-status-researchBg',
    text: 'text-status-researchText',
    border: 'border-status-researchBorder',
    dot: 'bg-status-researchText',
    description: 'Experimental research model or indicator; not validated for statutory or financial sanction.',
  },
  DEMO: {
    label: 'DEMO SANDBOX',
    bg: 'bg-status-demoBg',
    text: 'text-status-demoText',
    border: 'border-status-demoBorder',
    dot: 'bg-status-demoText',
    description: 'Controlled demonstration fixture; not a live operational measurement or real message.',
  },
  STALE: {
    label: 'STALE DATA',
    bg: 'bg-status-warningBg',
    text: 'text-status-warningText',
    border: 'border-status-warning',
    dot: 'bg-status-warningText',
    description: 'Observation age exceeds expected provider reporting cadence.',
  },
  UNAVAILABLE: {
    label: 'UNAVAILABLE',
    bg: 'bg-subtle',
    text: 'text-text-muted',
    border: 'border-border',
    dot: 'bg-status-gap',
    description: 'No verified observations or calibrated records exist for this administrative unit.',
  },
  ERROR: {
    label: 'FETCH ERROR',
    bg: 'bg-status-errorBg',
    text: 'text-status-errorText',
    border: 'border-status-error',
    dot: 'bg-status-error',
    description: 'Failed to retrieve records from the upstream provider or database.',
  },
};
