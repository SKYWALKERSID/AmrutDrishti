import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGeodesicPolygonAreaSqKm,
  clipPolygonWithBbox,
  calculateAreaWeightedRainfall,
  type GridCell
} from '../src/lib/services/spatialAggregationService.ts';

test('Spatial Aggregation: Geodesic area calculation is accurate for spherical polygons', () => {
  // A 0.25 deg x 0.25 deg box at 24.75N to 25.00N, 78.75E to 79.00E
  const box = [
    [78.75, 24.75],
    [79.00, 24.75],
    [79.00, 25.00],
    [78.75, 25.00],
    [78.75, 24.75]
  ];
  const area = calculateGeodesicPolygonAreaSqKm(box);
  // ~701 sq km
  assert.ok(area > 690 && area < 715, `Expected area ~701 sq km, got ${area}`);
});

test('Spatial Aggregation: Sutherland-Hodgman polygon clipping clips polygon with grid cell bounding box', () => {
  // Triangle spanning [78.5, 24.5] to [79.5, 24.5] to [79.0, 25.5]
  const triangle = [
    [78.5, 24.5],
    [79.5, 24.5],
    [79.0, 25.5],
    [78.5, 24.5]
  ];
  // Clip with box [78.75, 79.25, 24.75, 25.25]
  const clipped = clipPolygonWithBbox(triangle, {
    lonMin: 78.75,
    lonMax: 79.25,
    latMin: 24.75,
    latMax: 25.25
  });
  assert.ok(clipped.length >= 3, 'Clipped polygon should have at least 3 vertices');
  for (const pt of clipped) {
    assert.ok(pt[0] >= 78.749 && pt[0] <= 79.251, `Lon ${pt[0]} out of clip bounds`);
    assert.ok(pt[1] >= 24.749 && pt[1] <= 25.251, `Lat ${pt[1]} out of clip bounds`);
  }
});

test('Spatial Aggregation: Area-weighted precipitation aggregates multi-cell block accurately', () => {
  // Block polygon spanning 2 grid cells evenly:
  // Lon: 78.75 to 79.25 (crosses boundary at 79.00), Lat: 24.75 to 25.00
  const blockPolygon = [
    [78.75, 24.75],
    [79.25, 24.75],
    [79.25, 25.00],
    [78.75, 25.00],
    [78.75, 24.75]
  ];

  const gridCells: GridCell[] = [
    {
      cellId: 'cell_west',
      lonMin: 78.75,
      lonMax: 79.00,
      latMin: 24.75,
      latMax: 25.00,
      centerLon: 78.875,
      centerLat: 24.875,
      rainfallMm: 20.0
    },
    {
      cellId: 'cell_east',
      lonMin: 79.00,
      lonMax: 79.25,
      latMin: 24.75,
      latMax: 25.00,
      centerLon: 79.125,
      centerLat: 24.875,
      rainfallMm: 40.0
    }
  ];

  const res = calculateAreaWeightedRainfall('4032', 'Tikamgarh', blockPolygon, gridCells);
  assert.equal(res.status, 'valid');
  assert.equal(res.intersectingCellsCount, 2);
  // Equal areas -> mean should be exactly 30.0 mm
  assert.equal(res.areaWeightedMeanRainfallMm, 30.0);
  assert.ok(res.validRainfallCoverageRatio >= 0.99);
});

test('Spatial Aggregation: Handles missing cells safely with partial coverage flag', () => {
  // Same block, but eastern cell rainfall is null
  const blockPolygon = [
    [78.75, 24.75],
    [79.25, 24.75],
    [79.25, 25.00],
    [78.75, 25.00],
    [78.75, 24.75]
  ];

  const gridCells: GridCell[] = [
    {
      cellId: 'cell_west',
      lonMin: 78.75,
      lonMax: 79.00,
      latMin: 24.75,
      latMax: 25.00,
      centerLon: 78.875,
      centerLat: 24.875,
      rainfallMm: 20.0
    },
    {
      cellId: 'cell_east',
      lonMin: 79.00,
      lonMax: 79.25,
      latMin: 24.75,
      latMax: 25.00,
      centerLon: 79.125,
      centerLat: 24.875,
      rainfallMm: null // missing
    }
  ];

  const res = calculateAreaWeightedRainfall('4032', 'Tikamgarh', blockPolygon, gridCells, 0.70);
  // Valid rainfall coverage is only 50%, below 70% threshold
  assert.equal(res.status, 'partial_coverage');
  assert.equal(res.areaWeightedMeanRainfallMm, null);
  assert.match(res.explanation, /Insufficient valid rainfall coverage/);
});
