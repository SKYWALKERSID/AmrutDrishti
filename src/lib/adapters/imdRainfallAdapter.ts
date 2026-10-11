import {
  calculateFileChecksum,
  isValidDateIso,
  calculateRainfallAnomaly,
  calculateSpi3
} from '../services/rainfallCalculationService.ts';
import type {
  ImdDailyGridPoint,
  MonthlyPrecipitation
} from '../services/rainfallCalculationService.ts';

export interface ImdManifestMetadata {
  datasetName: string;
  provider: string;
  version: string;
  spatialResolution: string;
  coordinateReferenceSystem: string;
  baselinePeriod: string;
  retrievalDate: string;
  checksumSha256: string;
  licensingTerms: string;
}

export interface StagedImdFileHeader {
  manifest: ImdManifestMetadata;
  recordsCount: number;
}

export interface StagedImdValidationResult {
  isValid: boolean;
  manifest: ImdManifestMetadata | null;
  validRecords: ImdDailyGridPoint[];
  rejectedRecordsCount: number;
  errors: string[];
  warnings: string[];
  summary: {
    datesCount: number;
    startDate: string | null;
    endDate: string | null;
    gridPointsCount: number;
    nullRainfallCount: number;
    extremeRainfallCount: number;
  };
}

export interface NetCDFValidationResult {
  isValid: boolean;
  format: string | null;
  year: number | null;
  dimensions: {
    time: number;
    lat: number;
    lon: number;
  };
  coordinateBounds: {
    latMin: number;
    latMax: number;
    lonMin: number;
    lonMax: number;
  };
  coversPilotDistricts: boolean;
  variables: string[];
  rainfallUnits: string | null;
  fillValue: number | null;
  totalDataPoints: number;
  validRainfallPoints: number;
  missingDataPoints: number;
  records: ImdDailyGridPoint[];
  errors: string[];
  warnings: string[];
}

/**
 * Validates and parses a staged IMD CSV/Text file.
 *
 * Expected format:
 * - Line 1: Manifest JSON header comment `# MANIFEST: {...}`
 * - Line 2+: CSV headers `date,latitude,longitude,rainfall_mm,quality_flag`
 */
export function parseAndValidateStagedImdFile(fileContent: string): StagedImdValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validRecords: ImdDailyGridPoint[] = [];

  if (!fileContent || typeof fileContent !== 'string' || fileContent.trim().length === 0) {
    return {
      isValid: false,
      manifest: null,
      validRecords: [],
      rejectedRecordsCount: 0,
      errors: ['File content is empty or invalid string.'],
      warnings: [],
      summary: { datesCount: 0, startDate: null, endDate: null, gridPointsCount: 0, nullRainfallCount: 0, extremeRainfallCount: 0 }
    };
  }

  const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // 1. Parse Manifest Header
  let manifest: ImdManifestMetadata | null = null;
  let headerIndex = 0;

  if (lines[0].startsWith('# MANIFEST:')) {
    try {
      const jsonStr = lines[0].replace('# MANIFEST:', '').trim();
      manifest = JSON.parse(jsonStr) as ImdManifestMetadata;
      headerIndex = 1;

      // Validate required manifest fields
      if (!manifest.datasetName || !manifest.provider || !manifest.version) {
        errors.push('Manifest missing required metadata fields: datasetName, provider, or version.');
      }
    } catch {
      errors.push('Malformed manifest JSON header comment.');
    }
  } else {
    warnings.push('File missing leading `# MANIFEST:` comment header. Data lineage tracking requires manifest.');
  }

  if (lines.length <= headerIndex) {
    errors.push('File contains manifest but no data rows or CSV header.');
    return {
      isValid: false,
      manifest,
      validRecords: [],
      rejectedRecordsCount: 0,
      errors,
      warnings,
      summary: { datesCount: 0, startDate: null, endDate: null, gridPointsCount: 0, nullRainfallCount: 0, extremeRainfallCount: 0 }
    };
  }

  // 2. CSV Column Headers
  const csvHeader = lines[headerIndex].toLowerCase().split(',').map(h => h.trim());
  const colDate = csvHeader.indexOf('date');
  const colLat = csvHeader.indexOf('latitude');
  const colLon = csvHeader.indexOf('longitude');
  const colRain = csvHeader.indexOf('rainfall_mm');
  const colFlag = csvHeader.indexOf('quality_flag');

  if (colDate === -1 || colLat === -1 || colLon === -1 || colRain === -1) {
    errors.push(`Missing required CSV columns. Required: date, latitude, longitude, rainfall_mm. Found: ${lines[headerIndex]}`);
    return {
      isValid: false,
      manifest,
      validRecords: [],
      rejectedRecordsCount: 0,
      errors,
      warnings,
      summary: { datesCount: 0, startDate: null, endDate: null, gridPointsCount: 0, nullRainfallCount: 0, extremeRainfallCount: 0 }
    };
  }

  // 3. Process Data Rows
  let rejectedCount = 0;
  let nullCount = 0;
  let extremeCount = 0;
  const uniqueDates = new Set<string>();
  const uniqueGridCoords = new Set<string>();
  const seenDateCoordPairs = new Set<string>();

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.startsWith('#')) continue; // skip comments
    const parts = row.split(',').map(p => p.trim());

    if (parts.length <= Math.max(colDate, colLat, colLon, colRain)) {
      rejectedCount++;
      warnings.push(`Line ${i + 1}: Malformed row has fewer columns than header.`);
      continue;
    }

    const dateStr = parts[colDate];
    const latStr = parts[colLat];
    const lonStr = parts[colLon];
    const rainStr = parts[colRain];
    const flagStr = colFlag !== -1 && parts[colFlag] ? parts[colFlag].toLowerCase() : 'passed';

    // Validate date format
    if (!isValidDateIso(dateStr)) {
      rejectedCount++;
      warnings.push(`Line ${i + 1}: Invalid ISO date '${dateStr}'. Expected YYYY-MM-DD.`);
      continue;
    }

    // Validate coordinates
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (isNaN(lat) || isNaN(lon) || lat < 8.0 || lat > 38.0 || lon < 68.0 || lon > 98.0) {
      rejectedCount++;
      warnings.push(`Line ${i + 1}: Coordinates [${latStr}, ${lonStr}] out of bounds for Indian subcontinent.`);
      continue;
    }

    // Deduplication check
    const pairKey = `${dateStr}::${lat.toFixed(4)}::${lon.toFixed(4)}`;
    if (seenDateCoordPairs.has(pairKey)) {
      rejectedCount++;
      warnings.push(`Line ${i + 1}: Duplicate grid reading for date ${dateStr} at [${lat}, ${lon}].`);
      continue;
    }
    seenDateCoordPairs.add(pairKey);

    // Validate rainfall value
    let rainfallMm: number | null = null;
    if (rainStr === '' || rainStr.toLowerCase() === 'null' || rainStr.toLowerCase() === 'nan' || rainStr === '-999' || rainStr === '-999.0') {
      rainfallMm = null;
      nullCount++;
    } else {
      const parsedRain = Number(rainStr);
      if (isNaN(parsedRain) || parsedRain < 0) {
        rejectedCount++;
        warnings.push(`Line ${i + 1}: Invalid non-numeric or negative rainfall '${rainStr}'.`);
        continue;
      }
      if (parsedRain > 800) {
        extremeCount++;
        warnings.push(`Line ${i + 1}: Extreme rainfall reading ${parsedRain} mm exceeds typical 24h limit.`);
      }
      rainfallMm = parsedRain;
    }

    uniqueDates.add(dateStr);
    uniqueGridCoords.add(`${lat.toFixed(2)}_${lon.toFixed(2)}`);

    validRecords.push({
      date: dateStr,
      latitude: Number(lat.toFixed(4)),
      longitude: Number(lon.toFixed(4)),
      rainfallMm,
      qualityFlag: flagStr === 'suspect' ? 'suspect' : (rainfallMm === null ? 'missing' : 'passed')
    });
  }

  const sortedDates = Array.from(uniqueDates).sort();

  return {
    isValid: errors.length === 0,
    manifest,
    validRecords,
    rejectedRecordsCount: rejectedCount,
    errors,
    warnings,
    summary: {
      datesCount: sortedDates.length,
      startDate: sortedDates.length > 0 ? sortedDates[0] : null,
      endDate: sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null,
      gridPointsCount: uniqueGridCoords.size,
      nullRainfallCount: nullCount,
      extremeRainfallCount: extremeCount
    }
  };
}

/**
 * Aggregate daily grid points into monthly sums for each grid coordinate.
 */
export function aggregateDailyGridToMonthly(
  records: ImdDailyGridPoint[]
): Map<string, MonthlyPrecipitation[]> {
  const coordMap = new Map<string, Map<string, { total: number; validDays: number; totalDays: number; hasNull: boolean }>>();

  for (const r of records) {
    const key = `${r.latitude.toFixed(2)}_${r.longitude.toFixed(2)}`;
    if (!coordMap.has(key)) coordMap.set(key, new Map());

    const monthKey = r.date.substring(0, 7); // YYYY-MM
    const monthStats = coordMap.get(key)!;
    if (!monthStats.has(monthKey)) {
      monthStats.set(monthKey, { total: 0, validDays: 0, totalDays: 0, hasNull: false });
    }

    const cur = monthStats.get(monthKey)!;
    cur.totalDays++;
    if (r.rainfallMm !== null) {
      cur.total += r.rainfallMm;
      cur.validDays++;
    } else {
      cur.hasNull = true;
    }
  }

  const result = new Map<string, MonthlyPrecipitation[]>();
  for (const [coord, months] of coordMap.entries()) {
    const list: MonthlyPrecipitation[] = [];
    for (const [mStr, stats] of months.entries()) {
      const [y, m] = mStr.split('-').map(Number);
      // If missing more than 5 days in a month, mark monthly total as null
      const totalMm = stats.validDays >= (stats.totalDays - 5) ? Number(stats.total.toFixed(2)) : null;
      list.push({
        year: y,
        month: m,
        totalMm,
        validDays: stats.validDays,
        totalDays: stats.totalDays
      });
    }
    result.set(coord, list);
  }

  return result;
}

/**
 * Validates and parses an official IMD NetCDF (v3) gridded rainfall file.
 *
 * Official IMD 0.25° NetCDF specifications (Pai et al., 2014):
 * - Grid: 135 (longitude) x 129 (latitude) or similar bounding box over India
 * - Latitude: ~6.5°N to 38.5°N (0.25° spacing)
 * - Longitude: ~66.5°E to 100.0°E (0.25° spacing)
 * - Variables: 'rain' or 'rainfall', 'lat' / 'latitude', 'lon' / 'longitude', 'time'
 * - Units: mm
 * - Missing value / FillValue: -999.0 or NaN
 */
export async function parseAndValidateImdNetCDF(
  fileBuffer: ArrayBuffer | Buffer
): Promise<NetCDFValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Dynamic import of NetCDFReader to support universal environments
  let NetCDFReaderClass: any;
  try {
    const netcdfModule = await import('netcdfjs');
    NetCDFReaderClass = netcdfModule.NetCDFReader || (netcdfModule as any).default?.NetCDFReader;
  } catch (err: any) {
    return {
      isValid: false,
      format: null,
      year: null,
      dimensions: { time: 0, lat: 0, lon: 0 },
      coordinateBounds: { latMin: 0, latMax: 0, lonMin: 0, lonMax: 0 },
      coversPilotDistricts: false,
      variables: [],
      rainfallUnits: null,
      fillValue: null,
      totalDataPoints: 0,
      validRainfallPoints: 0,
      missingDataPoints: 0,
      records: [],
      errors: [`Failed to load netcdfjs reader: ${err?.message || err}`],
      warnings: []
    };
  }

  let reader: any;
  try {
    reader = new NetCDFReaderClass(fileBuffer);
  } catch (err: any) {
    return {
      isValid: false,
      format: null,
      year: null,
      dimensions: { time: 0, lat: 0, lon: 0 },
      coordinateBounds: { latMin: 0, latMax: 0, lonMin: 0, lonMax: 0 },
      coversPilotDistricts: false,
      variables: [],
      rainfallUnits: null,
      fillValue: null,
      totalDataPoints: 0,
      validRainfallPoints: 0,
      missingDataPoints: 0,
      records: [],
      errors: [`Malformed NetCDF file: ${err?.message || err}`],
      warnings: []
    };
  }

  const format = reader.version || 'classic format';
  const variableNames = reader.variables ? reader.variables.map((v: any) => v.name) : [];

  // Find lat, lon, time, rain variables
  const latVarName = variableNames.find((v: string) => /^(lat|latitude)$/i.test(v));
  const lonVarName = variableNames.find((v: string) => /^(lon|longitude)$/i.test(v));
  const timeVarName = variableNames.find((v: string) => /^(time)$/i.test(v));
  const rainVarName = variableNames.find((v: string) => /^(rain|rainfall|rf)$/i.test(v));

  if (!latVarName) errors.push('Missing latitude variable (expected "lat" or "latitude").');
  if (!lonVarName) errors.push('Missing longitude variable (expected "lon" or "longitude").');
  if (!timeVarName) errors.push('Missing time variable (expected "time").');
  if (!rainVarName) errors.push('Missing rainfall variable (expected "rain", "rainfall", or "rf").');

  if (errors.length > 0) {
    return {
      isValid: false,
      format,
      year: null,
      dimensions: { time: 0, lat: 0, lon: 0 },
      coordinateBounds: { latMin: 0, latMax: 0, lonMin: 0, lonMax: 0 },
      coversPilotDistricts: false,
      variables: variableNames,
      rainfallUnits: null,
      fillValue: null,
      totalDataPoints: 0,
      validRainfallPoints: 0,
      missingDataPoints: 0,
      records: [],
      errors,
      warnings
    };
  }

  const latData: number[] = Array.from(reader.getDataVariable(latVarName));
  const lonData: number[] = Array.from(reader.getDataVariable(lonVarName));
  const timeData: number[] = Array.from(reader.getDataVariable(timeVarName));
  const rainVarMeta = reader.variables.find((v: any) => v.name === rainVarName);

  // Extract units and fillValue
  let rainUnits: string | null = null;
  let fillValue: number | null = -999.0;
  if (rainVarMeta && rainVarMeta.attributes) {
    const uAttr = rainVarMeta.attributes.find((a: any) => a.name.toLowerCase() === 'units');
    if (uAttr) rainUnits = String(uAttr.value).trim();
    const fAttr = rainVarMeta.attributes.find((a: any) => /(_fillvalue|missing_value)/i.test(a.name));
    if (fAttr) fillValue = Number(fAttr.value);
  }

  const latMin = Math.min(...latData);
  const latMax = Math.max(...latData);
  const lonMin = Math.min(...lonData);
  const lonMax = Math.max(...lonData);

  // Check if grid covers Tikamgarh and Chhatarpur pilot block coordinates (24.0°N to 25.5°N, 78.5°E to 80.5°E)
  const coversPilotDistricts = (latMin <= 24.0 && latMax >= 25.5 && lonMin <= 78.5 && lonMax >= 80.5);
  if (!coversPilotDistricts) {
    warnings.push(`NetCDF spatial bounds [${latMin}°N-${latMax}°N, ${lonMin}°E-${lonMax}°E] do not fully cover Tikamgarh/Chhatarpur pilot area [24.0°-25.5°N, 78.5°-80.5°E].`);
  }

  // Parse time origin / year if present in time units (e.g. "days since 2023-01-01" or year in global attributes)
  let year: number | null = null;
  const timeVarMeta = reader.variables.find((v: any) => v.name === timeVarName);
  if (timeVarMeta && timeVarMeta.attributes) {
    const tUnits = timeVarMeta.attributes.find((a: any) => a.name.toLowerCase() === 'units');
    if (tUnits) {
      const match = String(tUnits.value).match(/(\d{4})-\d{2}-\d{2}/);
      if (match) year = Number(match[1]);
    }
  }

  const rawRainData = reader.getDataVariable(rainVarName);
  const records: ImdDailyGridPoint[] = [];
  let validRainfallPoints = 0;
  let missingDataPoints = 0;

  // Flatten and process data
  // Handle dimensions [time, lat, lon]
  const numTime = timeData.length;
  const numLat = latData.length;
  const numLon = lonData.length;
  const totalDataPoints = numTime * numLat * numLon;

  // Format base date if year is known
  const baseDate = year ? new Date(Date.UTC(year, 0, 1)) : new Date(Date.UTC(2023, 0, 1));

  for (let t = 0; t < numTime; t++) {
    const dayOffset = Number(timeData[t]);
    const currentDate = new Date(baseDate.getTime() + dayOffset * 86400000);
    const dateStr = currentDate.toISOString().substring(0, 10);

    const timeSlice = Array.isArray(rawRainData[t]) ? rawRainData[t] : null;

    for (let la = 0; la < numLat; la++) {
      const lat = Number(latData[la].toFixed(4));
      for (let lo = 0; lo < numLon; lo++) {
        const lon = Number(lonData[lo].toFixed(4));
        let val: number;

        if (timeSlice && Array.isArray(timeSlice)) {
          // 2D slice or flat 1D slice
          if (Array.isArray(timeSlice[la])) {
            val = timeSlice[la][lo];
          } else {
            val = timeSlice[la * numLon + lo];
          }
        } else if (Array.isArray(rawRainData)) {
          val = rawRainData[t * numLat * numLon + la * numLon + lo];
        } else {
          val = -999.0;
        }

        let rainfallMm: number | null = null;
        if (val === fillValue || isNaN(val) || val < 0) {
          rainfallMm = null;
          missingDataPoints++;
        } else {
          rainfallMm = Number(val.toFixed(2));
          validRainfallPoints++;
        }

        records.push({
          date: dateStr,
          latitude: lat,
          longitude: lon,
          rainfallMm,
          qualityFlag: rainfallMm === null ? 'missing' : 'passed'
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    format,
    year,
    dimensions: {
      time: numTime,
      lat: numLat,
      lon: numLon
    },
    coordinateBounds: {
      latMin: Number(latMin.toFixed(4)),
      latMax: Number(latMax.toFixed(4)),
      lonMin: Number(lonMin.toFixed(4)),
      lonMax: Number(lonMax.toFixed(4))
    },
    coversPilotDistricts,
    variables: variableNames,
    rainfallUnits: rainUnits,
    fillValue,
    totalDataPoints,
    validRainfallPoints,
    missingDataPoints,
    records,
    errors,
    warnings
  };
}
