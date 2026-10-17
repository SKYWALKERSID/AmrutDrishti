import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  lccToWgs84,
  wgs84ToLcc,
  calculateGeodesicRingAreaKm2,
  extractSoiPilotSubdistricts,
} from '../src/lib/services/boundaryValidationService.ts';

describe('Survey of India Boundary Validation & Reprojection Tests', () => {
  it('should accurately reproject between LCC and WGS84 with roundtrip precision', () => {
    // Known points in Central India (MP): (79.5°E, 24.5°N)
    const testLon = 79.5;
    const testLat = 24.5;

    const [lccX, lccY] = wgs84ToLcc(testLon, testLat);
    assert.ok(lccX > 3000000 && lccX < 5000000, `LCC X should be near 4,000,000m: ${lccX}`);
    assert.ok(lccY > 3000000 && lccY < 5000000, `LCC Y should be near 4,000,000m: ${lccY}`);

    const [rtLon, rtLat] = lccToWgs84(lccX, lccY);
    assert.ok(Math.abs(rtLon - testLon) < 1e-5, `Roundtrip Lon mismatch: ${rtLon} vs ${testLon}`);
    assert.ok(Math.abs(rtLat - testLat) < 1e-5, `Roundtrip Lat mismatch: ${rtLat} vs ${testLat}`);
  });

  it('should accurately compute geodesic ring area for known test polygons', () => {
    // 0.25° x 0.25° box at 24.0°N to 24.25°N, 79.0°E to 79.25°E
    // Spherical area is ~709.8 km²
    const box = [
      [79.0, 24.0],
      [79.25, 24.0],
      [79.25, 24.25],
      [79.0, 24.25],
      [79.0, 24.0],
    ];
    const area = calculateGeodesicRingAreaKm2(box);
    assert.ok(area > 700 && area < 720, `Area should be ~710 km², got ${area}`);
  });

  it('should parse the Survey of India shapefiles and extract exactly 6 matching revenue sub-districts', () => {
    const baseDir = 'data/sources/admin-boundaries/File_980834_8632b2cced0f4413908d7753885cb21f/23';
    if (!fs.existsSync(baseDir)) {
      console.warn('Skipping test: downloaded shapefiles not present in directory');
      return;
    }

    const { records, geojson } = extractSoiPilotSubdistricts(baseDir);

    assert.strictEqual(records.length, 6, 'Should match exactly 6 sub-districts');
    assert.strictEqual(geojson.features.length, 6, 'GeoJSON should contain 6 features');

    const expectedTehsils = [
      { name: 'BIJAWAR', dist: 'CHHATARPUR', lgd: '3433' },
      { name: 'RAJNAGAR', dist: 'CHHATARPUR', lgd: '3430' },
      { name: 'BALDEOGARH', dist: 'TIKAMGARH', lgd: '3421' },
      { name: 'JATARA', dist: 'TIKAMGARH', lgd: '3418' },
      { name: 'PALERA', dist: 'TIKAMGARH', lgd: '3420' },
      { name: 'TIKAMGARH', dist: 'TIKAMGARH', lgd: '3423' },
    ];

    for (const exp of expectedTehsils) {
      const rec = records.find((r) => r.subdistrict === exp.name && r.district === exp.dist);
      assert.ok(rec, `Subdistrict ${exp.name} in ${exp.dist} must exist`);
      assert.strictEqual(rec.subdistrictLgd, exp.lgd, `Subdistrict LGD must be tehsil code ${exp.lgd}`);
      assert.strictEqual(rec.partsCount, 1, 'Feature should be a single part polygon');
      assert.ok(rec.pointsCount > 5000, `Feature should have dense boundary vertices (> 5000), got ${rec.pointsCount}`);
      assert.ok(rec.geodesicAreaKm2 > 200, `Area must be plausible (> 200 km²), got ${rec.geodesicAreaKm2}`);

      // Verify ring closure
      const ring = rec.coordinates[0];
      assert.deepStrictEqual(ring[0], ring[ring.length - 1], 'Ring must be closed');
    }
  });

  it('should explicitly verify that SoI LGD codes are Tehsil codes, NOT Development Block codes', () => {
    const baseDir = 'data/sources/admin-boundaries/File_980834_8632b2cced0f4413908d7753885cb21f/23';
    if (!fs.existsSync(baseDir)) return;

    const { records } = extractSoiPilotSubdistricts(baseDir);

    // Development Block LGD codes from LGD / PRD:
    // Bijawar: 3783, Rajnagar: 3788, Baldeogarh: 4027, Jatara: 4028, Palera: 4030, Tikamgarh: 4032
    const blockCodes = ['3783', '3788', '4027', '4028', '4030', '4032'];

    for (const rec of records) {
      assert.ok(
        !blockCodes.includes(rec.subdistrictLgd),
        `SoI subdistrict ${rec.subdistrict} LGD code (${rec.subdistrictLgd}) must NOT match Block LGD codes`
      );
    }
  });
});
