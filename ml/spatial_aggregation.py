"""
JAL DRISHTI — Python Spatial Aggregation & Antecedent Rainfall Feature Pipeline
Implements mathematically rigorous spherical geodesic area calculations,
Sutherland-Hodgman polygon clipping against 0.25° IMD grid cells,
and leak-free antecedent rainfall feature engineering for groundwater assessment units.
"""

import math
import numpy as np
import pandas as pd

EARTH_RADIUS_KM = 6371.0

def calculate_geodesic_polygon_area_sqkm(ring):
    """
    Calculates geodesic area of a spherical polygon ring in square kilometers.
    Ring coordinates are [lon, lat] in degrees.
    Uses Girard's theorem / spherical excess formula.
    """
    if len(ring) < 4:
        return 0.0
    
    # Ensure closed ring
    pts = list(ring)
    if pts[0] != pts[-1]:
        pts.append(pts[0])
        
    n = len(pts) - 1
    if n < 3:
        return 0.0
        
    total_excess = 0.0
    for i in range(n):
        p1 = pts[i]
        p2 = pts[i + 1]
        lon1 = math.radians(p1[0])
        lat1 = math.radians(p1[1])
        lon2 = math.radians(p2[0])
        lat2 = math.radians(p2[1])
        
        d_lon = lon2 - lon1
        # Spherical trapezoid area formula
        total_excess += d_lon * (2.0 + math.sin(lat1) + math.sin(lat2))
        
    area = abs(total_excess) * (EARTH_RADIUS_KM ** 2) / 2.0
    return float(area)

def clip_polygon_with_bbox(polygon, bbox):
    """
    Clips a polygon against a 0.25° bounding box {lon_min, lon_max, lat_min, lat_max}
    using the Sutherland-Hodgman convex polygon clipping algorithm.
    """
    lon_min = bbox['lon_min']
    lon_max = bbox['lon_max']
    lat_min = bbox['lat_min']
    lat_max = bbox['lat_max']
    
    output_list = list(polygon)
    
    # Define 4 clipping edges: left, right, bottom, top
    edges = [
        ('left', lambda p: p[0] >= lon_min, lambda p1, p2: [lon_min, p1[1] + (p2[1] - p1[1]) * (lon_min - p1[0]) / (p2[0] - p1[0]) if p2[0] != p1[0] else p1[1]]),
        ('right', lambda p: p[0] <= lon_max, lambda p1, p2: [lon_max, p1[1] + (p2[1] - p1[1]) * (lon_max - p1[0]) / (p2[0] - p1[0]) if p2[0] != p1[0] else p1[1]]),
        ('bottom', lambda p: p[1] >= lat_min, lambda p1, p2: [p1[0] + (p2[0] - p1[0]) * (lat_min - p1[1]) / (p2[1] - p1[1]) if p2[1] != p1[1] else p1[0], lat_min]),
        ('top', lambda p: p[1] <= lat_max, lambda p1, p2: [p1[0] + (p2[0] - p1[0]) * (lat_max - p1[1]) / (p2[1] - p1[1]) if p2[1] != p1[1] else p1[0], lat_max])
    ]
    
    for name, inside, intersect in edges:
        input_list = output_list
        output_list = []
        if not input_list:
            break
        s = input_list[-1]
        for p in input_list:
            if inside(p):
                if inside(s):
                    output_list.append(p)
                else:
                    output_list.append(intersect(s, p))
                    output_list.append(p)
            elif inside(s):
                output_list.append(intersect(s, p))
            s = p
            
    return output_list

def calculate_area_weighted_rainfall(block_polygon, grid_cells):
    """
    Computes area-weighted mean daily rainfall across intersecting IMD grid cells.
    Preserves missing values and returns explicit status.
    """
    total_block_area = calculate_geodesic_polygon_area_sqkm(block_polygon)
    if total_block_area <= 0:
        return {'weighted_rainfall_mm': None, 'coverage_ratio': 0.0, 'status': 'zero_area'}
        
    weighted_sum = 0.0
    valid_area = 0.0
    total_intersecting_area = 0.0
    
    for cell in grid_cells:
        bbox = {
            'lon_min': cell['lon_min'],
            'lon_max': cell['lon_max'],
            'lat_min': cell['lat_min'],
            'lat_max': cell['lat_max']
        }
        clipped = clip_polygon_with_bbox(block_polygon, bbox)
        cell_area = calculate_geodesic_polygon_area_sqkm(clipped)
        
        if cell_area > 0:
            total_intersecting_area += cell_area
            val = cell.get('rainfall_mm')
            if val is not None and np.isfinite(val):
                weighted_sum += val * cell_area
                valid_area += cell_area
                
    if valid_area <= 0:
        return {'weighted_rainfall_mm': None, 'coverage_ratio': 0.0, 'status': 'missing_data'}
        
    area_ratio = valid_area / total_block_area
    mean_val = weighted_sum / valid_area
    status = 'valid' if area_ratio >= 0.80 else 'partial_coverage'
    
    return {
        'weighted_rainfall_mm': round(float(mean_val), 2),
        'coverage_ratio': round(float(area_ratio), 3),
        'status': status
    }

def compute_antecedent_rainfall_features(daily_series, origin_date, windows=[7, 30, 90, 180]):
    """
    Computes antecedent cumulative rainfall features ending strictly at or before origin_date.
    Never uses future observations beyond origin_date.
    """
    # Filter strictly past
    df_past = daily_series[daily_series['date'] <= origin_date].sort_values('date')
    if len(df_past) == 0:
        return {f'rain_cum_{w}d': np.nan for w in windows}
        
    features = {}
    origin_ts = pd.Timestamp(origin_date)
    
    for w in windows:
        cutoff = origin_ts - pd.Timedelta(days=w)
        window_df = df_past[df_past['date'] > cutoff]
        
        # Require at least 70% valid non-null days in the window
        valid_days = window_df['rainfall_mm'].dropna()
        if len(valid_days) >= (w * 0.70):
            features[f'rain_cum_{w}d'] = round(float(valid_days.sum()), 2)
            features[f'rain_mean_{w}d'] = round(float(valid_days.mean()), 2)
        else:
            features[f'rain_cum_{w}d'] = np.nan
            features[f'rain_mean_{w}d'] = np.nan
            
    return features
