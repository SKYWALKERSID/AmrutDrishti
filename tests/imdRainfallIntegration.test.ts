import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calculateFileChecksum,
  isValidDateIso,
  calculateRainfallAnomaly,
  calculateSpi3,
  interpretSpi
} from '../src/lib/services/rainfallCalculationService.ts';
import {
  parseAndValidateStagedImdFile,
  aggregateDailyGridToMonthly
} from '../src/lib/adapters/imdRainfallAdapter.ts';

test('Rainfall Calculations: ISO Date validation works strictly', () => {
  assert.equal(isValidDateIso('2023-06-15'), true);
  assert.equal(isValidDateIso('2023-02-29'), false); // 2023 not a leap year
  assert.equal(isValidDateIso('2024-02-29'), true); // 2024 leap year
  assert.equal(isValidDateIso('2023-13-01'), false);
  assert.equal(isValidDateIso('2023/06/15'), false);
  assert.equal(isValidDateIso('invalid'), false);
});

test('Rainfall Calculations: Rainfall Anomaly calculates millimeter and percentage correctly', () => {
  // Normal comparison
  const res = calculateRainfallAnomaly(680.0, 800.0, '1991-2020');
  assert.equal(res.isDataGap, false);
  assert.equal(res.observedMm, 680.0);
  assert.equal(res.climatologicalMeanMm, 800.0);
  assert.equal(res.anomalyMm, -120.0);
  assert.equal(res.anomalyPercentage, -15.0); // -120 / 800 = -15%
  assert.match(res.explanation, /-120 mm \(-15%\)/);
});

test('Rainfall Calculations: Rainfall Anomaly preserves nulls and rejects negative inputs', () => {
  const nullObs = calculateRainfallAnomaly(null, 800.0);
  assert.equal(nullObs.isDataGap, true);
  assert.equal(nullObs.anomalyMm, null);
  assert.equal(nullObs.anomalyPercentage, null);

  const nullBase = calculateRainfallAnomaly(680.0, null);
  assert.equal(nullBase.isDataGap, true);
  assert.equal(nullBase.anomalyMm, null);

  const negObs = calculateRainfallAnomaly(-50.0, 800.0);
  assert.equal(negObs.isDataGap, true);
  assert.equal(negObs.anomalyMm, null);
});

test('Rainfall Calculations: SPI-3 flags insufficient historical baseline (<20 years)', () => {
  const shortHistorical = [600, 750, 800, 650, 700]; // only 5 years
  const res = calculateSpi3(550, shortHistorical);
  assert.equal(res.isDataGap, true);
  assert.equal(res.spi, null);
  assert.equal(res.status, 'insufficient_baseline');
  assert.match(res.explanation, /minimum 20 required/i);
});

test('Rainfall Calculations: SPI-3 handles missing current observation safely', () => {
  const historical30 = Array.from({ length: 30 }, (_, i) => 600 + (i * 10));
  const res = calculateSpi3(null, historical30);
  assert.equal(res.isDataGap, true);
  assert.equal(res.spi, null);
  assert.equal(res.status, 'missing_current_data');
});

test('Rainfall Calculations: SPI-3 computes valid standard normal deviate against 30-year baseline', () => {
  // Synthesize 30-year monsoon total series with mean ~700mm, variance
  const historical30 = [
    650, 720, 580, 810, 690, 740, 520, 890, 670, 730,
    610, 780, 590, 820, 710, 750, 540, 880, 660, 720,
    630, 770, 600, 830, 700, 760, 530, 870, 680, 710
  ];

  // Current year is severe deficit (450mm vs mean ~700mm)
  const droughtYear = calculateSpi3(450, historical30);
  assert.equal(droughtYear.isDataGap, false);
  assert.equal(droughtYear.status, 'valid');
  assert.ok(droughtYear.spi !== null);
  assert.ok(droughtYear.spi < -1.5, `Expected severe deficit SPI < -1.5, got ${droughtYear.spi}`);

  // Current year is near normal (710mm vs mean ~700mm)
  const normalYear = calculateSpi3(710, historical30);
  assert.equal(normalYear.isDataGap, false);
  assert.ok(normalYear.spi !== null);
  assert.ok(Math.abs(normalYear.spi) < 0.5, `Expected near-zero SPI for mean year, got ${normalYear.spi}`);
});

test('Rainfall Calculations: SPI categories match WMO guidelines', () => {
  assert.equal(interpretSpi(2.2), 'Extremely Wet');
  assert.equal(interpretSpi(1.6), 'Very Wet');
  assert.equal(interpretSpi(1.1), 'Moderately Wet');
  assert.equal(interpretSpi(0.2), 'Near Normal');
  assert.equal(interpretSpi(-1.2), 'Moderate Drought');
  assert.equal(interpretSpi(-1.7), 'Severe Drought');
  assert.equal(interpretSpi(-2.4), 'Extreme Drought');
});

test('IMD Adapter: Validates staged sample file correctly', () => {
  const samplePath = 'data/sources/imd_rainfall_staged_sample.csv';
  const content = fs.readFileSync(samplePath, 'utf8');
  const checksum = calculateFileChecksum(content);
  assert.ok(checksum.length === 64);

  const res = parseAndValidateStagedImdFile(content);
  assert.equal(res.isValid, true);
  assert.ok(res.manifest !== null);
  assert.equal(res.manifest?.provider, 'India Meteorological Department (IMD Pune)');
  assert.equal(res.validRecords.length, 20);
  assert.equal(res.summary.gridPointsCount, 4); // 4 grid intersections
  assert.equal(res.summary.nullRainfallCount, 1); // 1 null row preserved
  assert.equal(res.summary.datesCount, 5); // 5 days: June 1 to 5
});

test('IMD Adapter: Rejects malformed rows and out-of-bound coordinates', () => {
  const malformedCsv = `
# MANIFEST: {"datasetName":"Test","provider":"Test","version":"1"}
date,latitude,longitude,rainfall_mm
2023-06-01,99.0000,78.7500,10.0
2023-06-02,24.7500,78.7500,-5.0
2023-99-99,24.7500,78.7500,15.0
2023-06-03,24.7500,78.7500,12.5
`;
  const res = parseAndValidateStagedImdFile(malformedCsv);
  assert.equal(res.isValid, true);
  assert.equal(res.validRecords.length, 1); // Only the valid row accepted
  assert.equal(res.rejectedRecordsCount, 3);
});

test('IMD Adapter: Monthly aggregation handles missing daily observations', () => {
  const samplePath = 'data/sources/imd_rainfall_staged_sample.csv';
  const content = fs.readFileSync(samplePath, 'utf8');
  const parsed = parseAndValidateStagedImdFile(content);
  const monthly = aggregateDailyGridToMonthly(parsed.validRecords);

  assert.equal(monthly.size, 4);
  const gridKey = Array.from(monthly.keys())[0];
  const gridMonths = monthly.get(gridKey)!;
  assert.equal(gridMonths.length, 1);
  assert.equal(gridMonths[0].year, 2023);
  assert.equal(gridMonths[0].month, 6);
  assert.ok(gridMonths[0].validDays > 0);
});

test('IMD Adapter: Validates NetCDF binary format and coordinates accurately', async () => {
  const { IOBuffer } = await import('iobuffer');
  const { parseAndValidateImdNetCDF } = await import('../src/lib/adapters/imdRainfallAdapter.ts');

  // Construct a minimal valid NetCDF-3 classic file matching IMD specifications
  const b = new IOBuffer();
  b.setBigEndian();
  b.writeChars('CDF');
  b.writeByte(1); // classic format
  b.writeUint32(2); // 2 time records

  // Dimensions: time=0 (unlimited), lat=2, lon=2
  b.writeUint32(10); // NC_DIMENSION
  b.writeUint32(3);
  writeString(b, 'time');
  b.writeUint32(0);
  writeString(b, 'lat');
  b.writeUint32(2);
  writeString(b, 'lon');
  b.writeUint32(2);

  // Global attributes: title, Conventions
  b.writeUint32(12); // NC_ATTRIBUTE
  b.writeUint32(2);
  writeString(b, 'title');
  b.writeUint32(2);
  writeString(b, 'IMD Daily Gridded Rainfall 0.25deg');
  writeString(b, 'Conventions');
  b.writeUint32(2);
  writeString(b, 'CF-1.6');

  // Variables: lat, lon, time, rainfall
  b.writeUint32(11); // NC_VARIABLE
  b.writeUint32(4);

  // lat
  writeString(b, 'lat');
  b.writeUint32(1);
  b.writeUint32(1); // dim 1
  b.writeUint32(12);
  b.writeUint32(1);
  writeString(b, 'units');
  b.writeUint32(2);
  writeString(b, 'degrees_north');
  b.writeUint32(5); // FLOAT
  b.writeUint32(8); // vsize
  const latOffsetPos = b.offset;
  b.writeUint32(0);

  // lon
  writeString(b, 'lon');
  b.writeUint32(1);
  b.writeUint32(2); // dim 2
  b.writeUint32(12);
  b.writeUint32(1);
  writeString(b, 'units');
  b.writeUint32(2);
  writeString(b, 'degrees_east');
  b.writeUint32(5);
  b.writeUint32(8);
  const lonOffsetPos = b.offset;
  b.writeUint32(0);

  // time
  writeString(b, 'time');
  b.writeUint32(1);
  b.writeUint32(0); // dim 0
  b.writeUint32(12);
  b.writeUint32(1);
  writeString(b, 'units');
  b.writeUint32(2);
  writeString(b, 'days since 2023-01-01');
  b.writeUint32(5);
  b.writeUint32(4);
  const timeOffsetPos = b.offset;
  b.writeUint32(0);

  // rainfall
  writeString(b, 'rainfall');
  b.writeUint32(3);
  b.writeUint32(0);
  b.writeUint32(1);
  b.writeUint32(2);
  b.writeUint32(12);
  b.writeUint32(2);
  writeString(b, 'units');
  b.writeUint32(2);
  writeString(b, 'mm');
  writeString(b, '_FillValue');
  b.writeUint32(5);
  b.writeUint32(1);
  b.writeFloat32(-999.0);
  writePadding(b, 4);
  b.writeUint32(5);
  b.writeUint32(16);
  const rainOffsetPos = b.offset;
  b.writeUint32(0);

  // Non-record data: lat, lon
  const latOffset = b.offset;
  b.writeFloat32(24.75);
  b.writeFloat32(25.00);

  const lonOffset = b.offset;
  b.writeFloat32(78.75);
  b.writeFloat32(79.00);

  // Record data
  const recordOffset = b.offset;
  // Day 0
  b.writeFloat32(0.0);
  b.writeFloat32(0.0);
  b.writeFloat32(14.5);
  b.writeFloat32(-999.0);
  b.writeFloat32(6.2);
  // Day 1
  b.writeFloat32(1.0);
  b.writeFloat32(10.0);
  b.writeFloat32(0.0);
  b.writeFloat32(4.5);
  b.writeFloat32(0.0);

  // Backpatch offsets
  b.offset = latOffsetPos;
  b.writeUint32(latOffset);
  b.offset = lonOffsetPos;
  b.writeUint32(lonOffset);
  b.offset = timeOffsetPos;
  b.writeUint32(recordOffset);
  b.offset = rainOffsetPos;
  b.writeUint32(recordOffset + 4);

  const ncBuffer = b.toArray();
  const res = await parseAndValidateImdNetCDF(ncBuffer);

  assert.equal(res.isValid, true);
  assert.equal(res.year, 2023);
  assert.equal(res.dimensions.time, 2);
  assert.equal(res.dimensions.lat, 2);
  assert.equal(res.dimensions.lon, 2);
  assert.equal(res.rainfallUnits, 'mm');
  assert.equal(res.fillValue, -999.0);
  assert.equal(res.totalDataPoints, 8);
  assert.equal(res.missingDataPoints, 1);
  assert.equal(res.validRainfallPoints, 7);
  assert.equal(res.records.length, 8);

  function writeString(buffer: any, str: string) {
    buffer.writeUint32(str.length);
    buffer.writeChars(str);
    writePadding(buffer, str.length);
  }

  function writePadding(buffer: any, len: number) {
    const pad = (4 - (len % 4)) % 4;
    for (let i = 0; i < pad; i++) buffer.writeUint8(0);
  }
});
