/**
 * Spatial Aggregation Service
 *
 * Implements pure, mathematically rigorous area-weighted polygon and grid intersection
 * algorithms for aggregating gridded meteorological datasets (e.g., IMD 0.25° daily rainfall)
 * to administrative block boundaries.
 *
 * Scientific Principles:
 * - Uses spherical/geodesic polygon area calculations (in square kilometers) rather than
 *   raw degree arithmetic, preventing projection-dependent distortion.
 * - Handles intersecting grid cell polygons via Sutherland-Hodgman convex clipping.
 * - Preserves missing values (nulls) and tracks intersection coverage percentages.
 */

export interface GeoCoordinate {
  lon: number;
  lat: number;
}

export interface GridCell {
  cellId: string;
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
  centerLon: number;
  centerLat: number;
  rainfallMm: number | null;
}

export interface BlockIntersectionWeight {
  cellId: string;
  centerLon: number;
  centerLat: number;
  intersectionAreaSqKm: number;
  fractionOfBlockArea: number;
  rainfallMm: number | null;
}

export interface BlockAggregationResult {
  blockId: string | number;
  blockName: string;
  totalBlockAreaSqKm: number;
  intersectingCellsCount: number;
  validAreaCoverageRatio: number; // sum of intersecting cell areas / block area
  validRainfallCoverageRatio: number; // area with non-null rainfall / block area
  areaWeightedMeanRainfallMm: number | null;
  cellWeights: BlockIntersectionWeight[];
  status: 'valid' | 'partial_coverage' | 'missing_data' | 'zero_area';
  explanation: string;
}

const EARTH_RADIUS_KM = 6371.0;

/**
 * Calculates geodesic area of a spherical polygon in square kilometers.
 * Coordinates are passed as [lon, lat] in degrees.
 * Uses the spherical excess formula (L'Huilier / Girard equivalent for polygon loops).
 */
export function calculateGeodesicPolygonAreaSqKm(ring: number[][]): number {
  if (!ring || ring.length < 3) return 0;

  // Remove closing vertex if duplicated
  const points = [...ring];
  if (
    points.length > 3 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
  ) {
    points.pop();
  }

  if (points.length < 3) return 0;

  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const lambda1 = (p1[0] * Math.PI) / 180;
    const phi1 = (p1[1] * Math.PI) / 180;
    const lambda2 = (p2[0] * Math.PI) / 180;
    const phi2 = (p2[1] * Math.PI) / 180;
    total += (lambda2 - lambda1) * (2 + Math.sin(phi1) + Math.sin(phi2));
  }

  const area = Math.abs((total * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2);
  return Number(area.toFixed(4));
}

/**
 * Computes the intersection of a subject polygon with an axis-aligned bounding box (grid cell)
 * using the Sutherland-Hodgman polygon clipping algorithm.
 */
export function clipPolygonWithBbox(
  subjectPolygon: number[][],
  bbox: { lonMin: number; lonMax: number; latMin: number; latMax: number }
): number[][] {
  let outputList = [...subjectPolygon];
  if (
    outputList.length > 3 &&
    outputList[0][0] === outputList[outputList.length - 1][0] &&
    outputList[0][1] === outputList[outputList.length - 1][1]
  ) {
    outputList.pop();
  }

  // Four clipping edges: left (lonMin), right (lonMax), bottom (latMin), top (latMax)
  const edges = [
    { isInside: (p: number[]) => p[0] >= bbox.lonMin, intersect: (p1: number[], p2: number[]) => [bbox.lonMin, p1[1] + ((bbox.lonMin - p1[0]) * (p2[1] - p1[1])) / (p2[0] - p1[0])] },
    { isInside: (p: number[]) => p[0] <= bbox.lonMax, intersect: (p1: number[], p2: number[]) => [bbox.lonMax, p1[1] + ((bbox.lonMax - p1[0]) * (p2[1] - p1[1])) / (p2[0] - p1[0])] },
    { isInside: (p: number[]) => p[1] >= bbox.latMin, intersect: (p1: number[], p2: number[]) => [p1[0] + ((bbox.latMin - p1[1]) * (p2[0] - p1[0])) / (p2[1] - p1[1]), bbox.latMin] },
    { isInside: (p: number[]) => p[1] <= bbox.latMax, intersect: (p1: number[], p2: number[]) => [p1[0] + ((bbox.latMax - p1[1]) * (p2[0] - p1[0])) / (p2[1] - p1[1]), bbox.latMax] }
  ];

  for (const edge of edges) {
    const inputList = outputList;
    outputList = [];
    if (inputList.length === 0) break;

    let s = inputList[inputList.length - 1];
    for (const p of inputList) {
      if (edge.isInside(p)) {
        if (!edge.isInside(s)) {
          outputList.push(edge.intersect(s, p));
        }
        outputList.push(p);
      } else if (edge.isInside(s)) {
        outputList.push(edge.intersect(s, p));
      }
      s = p;
    }
  }

  return outputList;
}

/**
 * Calculates area-weighted rainfall average across intersecting grid cells for an administrative polygon.
 *
 * Formula:
 * P_block = sum(A_i * P_i) / sum(A_i)
 * where A_i is the geodesic intersection area between the block polygon and grid cell i.
 */
export function calculateAreaWeightedRainfall(
  blockId: string | number,
  blockName: string,
  polygonRing: number[][],
  gridCells: GridCell[],
  minimumValidCoverageRatio: number = 0.70 // Requires >= 70% of block area covered by non-null cells
): BlockAggregationResult {
  const totalBlockArea = calculateGeodesicPolygonAreaSqKm(polygonRing);

  if (totalBlockArea <= 0) {
    return {
      blockId,
      blockName,
      totalBlockAreaSqKm: 0,
      intersectingCellsCount: 0,
      validAreaCoverageRatio: 0,
      validRainfallCoverageRatio: 0,
      areaWeightedMeanRainfallMm: null,
      cellWeights: [],
      status: 'zero_area',
      explanation: 'Block polygon geometry is empty or has zero surface area.'
    };
  }

  const cellWeights: BlockIntersectionWeight[] = [];
  let totalIntersectionArea = 0;
  let validRainfallArea = 0;
  let weightedRainfallSum = 0;

  for (const cell of gridCells) {
    const clippedRing = clipPolygonWithBbox(polygonRing, {
      lonMin: cell.lonMin,
      lonMax: cell.lonMax,
      latMin: cell.latMin,
      latMax: cell.latMax
    });

    if (clippedRing.length >= 3) {
      const intersectionArea = calculateGeodesicPolygonAreaSqKm(clippedRing);
      if (intersectionArea > 0.001) {
        const fraction = Number((intersectionArea / totalBlockArea).toFixed(4));
        cellWeights.push({
          cellId: cell.cellId,
          centerLon: cell.centerLon,
          centerLat: cell.centerLat,
          intersectionAreaSqKm: intersectionArea,
          fractionOfBlockArea: fraction,
          rainfallMm: cell.rainfallMm
        });

        totalIntersectionArea += intersectionArea;
        if (cell.rainfallMm !== null) {
          validRainfallArea += intersectionArea;
          weightedRainfallSum += intersectionArea * cell.rainfallMm;
        }
      }
    }
  }

  const validAreaCoverageRatio = Number((totalIntersectionArea / totalBlockArea).toFixed(4));
  const validRainfallCoverageRatio = Number((validRainfallArea / totalBlockArea).toFixed(4));

  if (cellWeights.length === 0) {
    return {
      blockId,
      blockName,
      totalBlockAreaSqKm: totalBlockArea,
      intersectingCellsCount: 0,
      validAreaCoverageRatio: 0,
      validRainfallCoverageRatio: 0,
      areaWeightedMeanRainfallMm: null,
      cellWeights: [],
      status: 'missing_data',
      explanation: 'No grid cells intersect the block polygon.'
    };
  }

  if (validRainfallCoverageRatio < minimumValidCoverageRatio) {
    return {
      blockId,
      blockName,
      totalBlockAreaSqKm: totalBlockArea,
      intersectingCellsCount: cellWeights.length,
      validAreaCoverageRatio,
      validRainfallCoverageRatio,
      areaWeightedMeanRainfallMm: null,
      cellWeights,
      status: 'partial_coverage',
      explanation: `Insufficient valid rainfall coverage: ${(validRainfallCoverageRatio * 100).toFixed(1)}% valid, minimum ${(minimumValidCoverageRatio * 100).toFixed(0)}% required.`
    };
  }

  const areaWeightedMean = Number((weightedRainfallSum / validRainfallArea).toFixed(2));

  return {
    blockId,
    blockName,
    totalBlockAreaSqKm: totalBlockArea,
    intersectingCellsCount: cellWeights.length,
    validAreaCoverageRatio,
    validRainfallCoverageRatio,
    areaWeightedMeanRainfallMm: areaWeightedMean,
    cellWeights,
    status: 'valid',
    explanation: `Area-weighted mean rainfall computed as ${areaWeightedMean} mm across ${cellWeights.length} intersecting grid cells (${(validRainfallCoverageRatio * 100).toFixed(1)}% block area coverage).`
  };
}
