"""
Automated Regression Tests for Python Spatial Aggregation & Rainfall Feature Pipeline.
Validates geodesic polygon area calculation, Sutherland-Hodgman bounding box clipping,
area-weighted rainfall averaging, and leak-free antecedent window filtering.
"""

import pytest
import numpy as np
import pandas as pd
from ml.spatial_aggregation import (
    calculate_geodesic_polygon_area_sqkm,
    clip_polygon_with_bbox,
    calculate_area_weighted_rainfall,
    compute_antecedent_rainfall_features
)

class TestSpatialAggregation:

    def test_geodesic_area_calculation(self):
        # 0.25 deg x 0.25 deg box at 24.75N to 25.00N, 78.75E to 79.00E
        box = [
            [78.75, 24.75],
            [79.00, 24.75],
            [79.00, 25.00],
            [78.75, 25.00],
            [78.75, 24.75]
        ]
        area = calculate_geodesic_polygon_area_sqkm(box)
        assert 690.0 < area < 715.0, f"Expected ~701 sq km, got {area}"

    def test_sutherland_hodgman_clipping(self):
        # Triangle spanning [78.5, 24.5] to [79.5, 24.5] to [79.0, 25.5]
        triangle = [
            [78.5, 24.5],
            [79.5, 24.5],
            [79.0, 25.5],
            [78.5, 24.5]
        ]
        bbox = {
            'lon_min': 78.75,
            'lon_max': 79.25,
            'lat_min': 24.75,
            'lat_max': 25.25
        }
        clipped = clip_polygon_with_bbox(triangle, bbox)
        assert len(clipped) >= 3, "Clipped polygon must have at least 3 vertices"
        for pt in clipped:
            assert 78.749 <= pt[0] <= 79.251, f"Lon {pt[0]} out of clip bounds"
            assert 24.749 <= pt[1] <= 25.251, f"Lat {pt[1]} out of clip bounds"

    def test_area_weighted_rainfall_aggregation(self):
        # Polygon spanning two 0.25° cells evenly
        block_polygon = [
            [78.75, 24.75],
            [79.25, 24.75],
            [79.25, 25.00],
            [78.75, 25.00],
            [78.75, 24.75]
        ]
        grid_cells = [
            {
                'cell_id': 'cell_w',
                'lon_min': 78.75,
                'lon_max': 79.00,
                'lat_min': 24.75,
                'lat_max': 25.00,
                'rainfall_mm': 10.0
            },
            {
                'cell_id': 'cell_e',
                'lon_min': 79.00,
                'lon_max': 79.25,
                'lat_min': 24.75,
                'lat_max': 25.00,
                'rainfall_mm': 20.0
            }
        ]
        res = calculate_area_weighted_rainfall(block_polygon, grid_cells)
        assert res['status'] == 'valid'
        assert abs(res['weighted_rainfall_mm'] - 15.0) < 0.2, f"Expected 15.0 mm, got {res['weighted_rainfall_mm']}"
        assert abs(res['coverage_ratio'] - 1.0) < 0.05

    def test_missing_cells_handling(self):
        block_polygon = [
            [78.75, 24.75],
            [79.25, 24.75],
            [79.25, 25.00],
            [78.75, 25.00],
            [78.75, 24.75]
        ]
        grid_cells = [
            {
                'cell_id': 'cell_w',
                'lon_min': 78.75,
                'lon_max': 79.00,
                'lat_min': 24.75,
                'lat_max': 25.00,
                'rainfall_mm': 10.0
            },
            {
                'cell_id': 'cell_e',
                'lon_min': 79.00,
                'lon_max': 79.25,
                'lat_min': 24.75,
                'lat_max': 25.00,
                'rainfall_mm': None  # Missing observation
            }
        ]
        res = calculate_area_weighted_rainfall(block_polygon, grid_cells)
        assert res['status'] == 'partial_coverage'
        assert res['coverage_ratio'] < 0.60
        assert res['weighted_rainfall_mm'] == 10.0

    def test_antecedent_rainfall_zero_leakage(self):
        dates = pd.date_range('2023-01-01', '2023-06-30')
        series = pd.DataFrame({
            'date': dates,
            'rainfall_mm': np.ones(len(dates)) * 5.0
        })
        
        origin = pd.Timestamp('2023-04-01')
        feats = compute_antecedent_rainfall_features(series, origin, windows=[7, 30])
        
        # 7 days before 2023-04-01: 7 * 5.0 = 35.0
        assert abs(feats['rain_cum_7d'] - 35.0) < 1.0
        # 30 days before 2023-04-01: 30 * 5.0 = 150.0
        assert abs(feats['rain_cum_30d'] - 150.0) < 1.0
        
        # Verify future date changes do not affect past features
        series.loc[series['date'] > origin, 'rainfall_mm'] = 999.0
        feats_after = compute_antecedent_rainfall_features(series, origin, windows=[7, 30])
        assert feats['rain_cum_7d'] == feats_after['rain_cum_7d'], "Future rainfall leaked into origin features!"
