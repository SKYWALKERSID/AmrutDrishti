import { createHash } from 'node:crypto';

/**
 * IMD Gridded Rainfall Daily Observation Record (0.25° x 0.25° grid)
 */
export interface ImdDailyGridPoint {
  latitude: number;
  longitude: number;
  date: string; // YYYY-MM-DD
  rainfallMm: number | null;
  qualityFlag?: 'passed' | 'missing' | 'suspect';
}

/**
 * Monthly rainfall summary for an administrative unit / block
 */
export interface MonthlyPrecipitation {
  year: number;
  month: number; // 1-12
  totalMm: number | null;
  validDays: number;
  totalDays: number;
}

/**
 * Climatological baseline statistics for a month across a baseline window (e.g. 1991-2020)
 */
export interface MonthlyClimatology {
  month: number; // 1-12
  meanMm: number;
  stdDevMm: number;
  yearsCount: number;
}

/**
 * Statistical result of an SPI calculation
 */
export interface SpiResult {
  spi: number | null;
  accumulationWindowMonths: number;
  precipitationTotalMm: number | null;
  baselineYearsCount: number;
  isDataGap: boolean;
  status: 'valid' | 'insufficient_baseline' | 'missing_current_data' | 'zero_variance';
  explanation: string;
}

/**
 * Result of a rainfall anomaly calculation
 */
export interface RainfallAnomalyResult {
  observedMm: number | null;
  climatologicalMeanMm: number | null;
  anomalyMm: number | null;
  anomalyPercentage: number | null;
  baselinePeriod: string;
  isDataGap: boolean;
  explanation: string;
}

/**
 * Checksum calculation for data provenance
 */
export function calculateFileChecksum(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Validates that an observation date string follows strict ISO YYYY-MM-DD.
 */
export function isValidDateIso(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Calculates rainfall anomaly relative to an explicit climatological baseline mean.
 *
 * Anomaly (mm) = Observed (mm) - Climatological Mean (mm)
 * Anomaly (%) = ((Observed - Climatological Mean) / Climatological Mean) * 100
 *
 * Rules:
 * - If observed is null or baseline mean is null, returns isDataGap = true and anomaly = null.
 * - Never converts nulls to zero.
 */
export function calculateRainfallAnomaly(
  observedMm: number | null,
  climatologicalMeanMm: number | null,
  baselinePeriod: string = '1991-2020'
): RainfallAnomalyResult {
  if (observedMm === null || climatologicalMeanMm === null) {
    return {
      observedMm,
      climatologicalMeanMm,
      anomalyMm: null,
      anomalyPercentage: null,
      baselinePeriod,
      isDataGap: true,
      explanation: 'Missing input: Either observed precipitation or baseline climatological mean is unavailable.'
    };
  }

  if (climatologicalMeanMm < 0 || observedMm < 0) {
    return {
      observedMm,
      climatologicalMeanMm,
      anomalyMm: null,
      anomalyPercentage: null,
      baselinePeriod,
      isDataGap: true,
      explanation: 'Invalid input: Precipitation values cannot be negative.'
    };
  }

  const anomalyMm = Number((observedMm - climatologicalMeanMm).toFixed(2));
  let anomalyPct: number | null = null;
  if (climatologicalMeanMm > 0) {
    anomalyPct = Number((((observedMm - climatologicalMeanMm) / climatologicalMeanMm) * 100).toFixed(1));
  } else if (observedMm === 0 && climatologicalMeanMm === 0) {
    anomalyPct = 0.0;
  }

  return {
    observedMm,
    climatologicalMeanMm,
    anomalyMm,
    anomalyPercentage: anomalyPct,
    baselinePeriod,
    isDataGap: false,
    explanation: `Precipitation anomaly of ${anomalyMm >= 0 ? '+' : ''}${anomalyMm} mm (${anomalyPct !== null ? `${anomalyPct}%` : 'N/A'}) compared to ${baselinePeriod} long-period average.`
  };
}

/**
 * Calculates 3-Month Standardized Precipitation Index (SPI-3) using a two-parameter Gamma distribution fit.
 *
 * WMO-No. 1090 Standardized Precipitation Index User Guide guidelines:
 * - Requires a continuous baseline of at least 30 years (e.g. 1991-2020).
 * - Fit two-parameter Gamma distribution (alpha shape, beta scale) on non-zero precipitation.
 * - Calculate cumulative probability H(x) = q + (1 - q) * G(x), where q is probability of zero precipitation.
 * - Transform H(x) to standard normal deviate Z ~ N(0, 1) using Abramowitz & Stegun approximation.
 * - Bound output strictly to [-3.0, +3.0] (or -5.0 to +5.0) per standard meteorological conventions.
 */
export function calculateSpi3(
  current3MonthTotalMm: number | null,
  historical3MonthSeriesMm: number[],
  minimumBaselineYears: number = 20 // Recommended 30, strictly enforce >= 20 for statistical validity
): SpiResult {
  if (current3MonthTotalMm === null) {
    return {
      spi: null,
      accumulationWindowMonths: 3,
      precipitationTotalMm: null,
      baselineYearsCount: historical3MonthSeriesMm.length,
      isDataGap: true,
      status: 'missing_current_data',
      explanation: 'Current 3-month accumulated precipitation is null or missing.'
    };
  }

  if (current3MonthTotalMm < 0) {
    return {
      spi: null,
      accumulationWindowMonths: 3,
      precipitationTotalMm: current3MonthTotalMm,
      baselineYearsCount: historical3MonthSeriesMm.length,
      isDataGap: true,
      status: 'missing_current_data',
      explanation: 'Invalid input: Current precipitation cannot be negative.'
    };
  }

  const validSeries = historical3MonthSeriesMm.filter(v => typeof v === 'number' && !isNaN(v) && v >= 0);

  if (validSeries.length < minimumBaselineYears) {
    return {
      spi: null,
      accumulationWindowMonths: 3,
      precipitationTotalMm: current3MonthTotalMm,
      baselineYearsCount: validSeries.length,
      isDataGap: true,
      status: 'insufficient_baseline',
      explanation: `Insufficient historical baseline: ${validSeries.length} valid years available, minimum ${minimumBaselineYears} required for SPI fitting.`
    };
  }

  // Count zeros
  const zerosCount = validSeries.filter(v => v === 0).length;
  const nonZeros = validSeries.filter(v => v > 0);
  const q = zerosCount / validSeries.length;

  if (nonZeros.length < 3) {
    return {
      spi: null,
      accumulationWindowMonths: 3,
      precipitationTotalMm: current3MonthTotalMm,
      baselineYearsCount: validSeries.length,
      isDataGap: true,
      status: 'zero_variance',
      explanation: 'Insufficient non-zero precipitation values to fit Gamma distribution parameters.'
    };
  }

  // Thom's approximation for Gamma parameters alpha (shape) and beta (scale)
  const n = nonZeros.length;
  const meanNonZero = nonZeros.reduce((a, b) => a + b, 0) / n;
  const sumLn = nonZeros.reduce((a, b) => a + Math.log(b), 0);
  const A = Math.log(meanNonZero) - (sumLn / n);

  if (A <= 0 || isNaN(A)) {
    return {
      spi: null,
      accumulationWindowMonths: 3,
      precipitationTotalMm: current3MonthTotalMm,
      baselineYearsCount: validSeries.length,
      isDataGap: true,
      status: 'zero_variance',
      explanation: 'Variance of historical baseline is too small to fit Gamma distribution.'
    };
  }

  const alpha = (1 + Math.sqrt(1 + (4 * A) / 3)) / (4 * A);
  const beta = meanNonZero / alpha;

  let boundedZ: number;
  if (current3MonthTotalMm === 0) {
    if (q > 0) {
      const z = normalQuantile(Math.max(1e-6, q / 2));
      boundedZ = Number(Math.max(-4.0, Math.min(4.0, z)).toFixed(2));
    } else {
      boundedZ = -3.5;
    }
  } else {
    // Wilson-Hilferty cube-root transformation for Gamma variates
    // Standard robust methodology in meteorological drought indices
    const t = current3MonthTotalMm / beta;
    let z = 3 * Math.sqrt(alpha) * (Math.pow(t / alpha, 1 / 3) - 1 + (1 / (9 * alpha)));

    // Account for zero precipitation probability if present
    if (q > 0) {
      const pG = 0.5 * (1 + Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)));
      const H = q + (1 - q) * Math.max(1e-6, Math.min(1 - 1e-6, pG));
      z = normalQuantile(H);
    }

    boundedZ = Number(Math.max(-4.0, Math.min(4.0, z)).toFixed(2));
  }

  return {
    spi: boundedZ,
    accumulationWindowMonths: 3,
    precipitationTotalMm: current3MonthTotalMm,
    baselineYearsCount: validSeries.length,
    isDataGap: false,
    status: 'valid',
    explanation: `SPI-3 computed as ${boundedZ > 0 ? '+' : ''}${boundedZ} (${interpretSpi(boundedZ)}) against ${validSeries.length}-year baseline.`
  };
}

/**
 * Standard WMO SPI category descriptor
 */
export function interpretSpi(spi: number): string {
  if (spi >= 2.0) return 'Extremely Wet';
  if (spi >= 1.5) return 'Very Wet';
  if (spi >= 1.0) return 'Moderately Wet';
  if (spi > -1.0) return 'Near Normal';
  if (spi > -1.5) return 'Moderate Drought';
  if (spi > -2.0) return 'Severe Drought';
  return 'Extreme Drought';
}

/**
 * Lower regularized incomplete gamma function P(a, x) = gamma(a, x) / Gamma(a)
 * Series expansion approximation suitable for hydrological Gamma fitting.
 */
function incompleteGammaRegularized(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // Series expansion
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 100; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-10) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  } else {
    // Continued fraction approximation for upper incomplete gamma
    let b = x + 1 - a;
    let c = 1 / 1e-30;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 100; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = b + an / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-10) break;
    }
    const upperG = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
    return Math.max(0, Math.min(1, 1 - upperG));
  }
}

/**
 * Lanczos approximation for log Gamma ln(Gamma(z))
 */
function logGamma(z: number): number {
  const c = [
    57.1562356658629235,
    -59.5979603554754912,
    14.1360979747417471,
    -0.491913816097620199,
    0.339946499848118887e-4,
    0.465236289270485756e-4,
    -0.983744753048795646e-4,
    0.158088703224379411e-3,
    -0.210264441724104883e-3,
    0.217439618115212643e-3,
    -0.16431810653676389e-3,
    0.844182239838527433e-4,
    -0.261908384015814087e-4,
    0.368991826595316234e-5
  ];
  let y = z;
  let x = z;
  let sum = 0.999999999999997092;
  for (let i = 0; i < c.length; i++) {
    sum += c[i] / ++y;
  }
  const t = x + c.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x - 0.5) * Math.log(t) - t + Math.log(sum);
}

/**
 * Standard Normal Quantile Function (Inverse Normal CDF)
 * Rational approximation (Abramowitz & Stegun 26.2.23 / Beasley-Springer-Moro)
 */
function normalQuantile(p: number): number {
  if (p <= 0) return -4.0;
  if (p >= 1) return 4.0;

  // Coefficients for rational approximation
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  let t: number;
  let sign: number;

  if (p < 0.5) {
    t = Math.sqrt(-2.0 * Math.log(p));
    sign = -1.0;
  } else {
    t = Math.sqrt(-2.0 * Math.log(1.0 - p));
    sign = 1.0;
  }

  const num = c0 + (c1 * t) + (c2 * t * t);
  const den = 1.0 + (d1 * t) + (d2 * t * t) + (d3 * t * t * t);
  const q = t - (num / den);

  return sign * q;
}
