"""
JAL DRISHTI — Sikkim Springshed Discharge Forecasting Engine
Component Scope: Mountain Springshed Hydrology (Dhara Vikas Network)
Target: Spring Discharge Rate in Litres per Minute (L/min or LPM)
Authoritative Scope: Himalayan Unconfined Fractured Rock Springs (East, West, North, South Sikkim)

Scientific Principles:
- Springshed discharge is governed by unconfined fracture permeability and epikarst storage,
  fundamentally distinct from pore-pressure depth-to-water in alluvial aquifers (mbgl).
- Recession behavior in the lean post-monsoon period (Oct–May) follows Maillet / Boussinesq
  exponential baseflow decay: Q(t) = Q_0 * exp(-alpha * t).
- Peak monsoon discharge (Jun–Sep) responds rapidly to storm event infiltration.
"""

import math
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor

class SpringBaseflowRecessionModel:
    """
    Analytical exponential baseflow recession model for lean-season discharge.
    Q(t) = Q_0 * exp(-alpha * dt)
    where alpha is the calibrated aquifer depletion coefficient (1/days).
    """
    def __init__(self, default_alpha=0.015):
        self.default_alpha = default_alpha
        self.alpha_map = {}
        
    def fit(self, df):
        """
        Calibrates alpha per spring using historical recession pairs.
        """
        for sp, g in df.groupby('spring_id'):
            g_sorted = g.sort_values('date')
            alphas = []
            d_vals = g_sorted['date'].values
            q_vals = g_sorted['discharge_lpm'].values
            for i in range(len(q_vals) - 1):
                dt = (pd.Timestamp(d_vals[i+1]) - pd.Timestamp(d_vals[i])).days
                if dt > 0 and q_vals[i] > 0 and q_vals[i+1] > 0 and q_vals[i+1] <= q_vals[i]:
                    a = -math.log(q_vals[i+1] / q_vals[i]) / dt
                    if 0.001 <= a <= 0.10:
                        alphas.append(a)
            self.alpha_map[sp] = float(np.median(alphas)) if alphas else self.default_alpha
        return self
        
    def predict(self, df):
        preds = []
        for _, row in df.iterrows():
            sp = row['spring_id']
            q0 = row['discharge_origin_lpm']
            dt = row['elapsed_days']
            a = self.alpha_map.get(sp, self.default_alpha)
            pred_q = max(0.0, q0 * math.exp(-a * dt))
            preds.append(round(pred_q, 2))
        return np.array(preds)

class SpringDischargePersistenceBaseline:
    """
    Last-observation persistence baseline for spring discharge.
    Q_pred = Q(t_0)
    """
    def predict(self, df):
        return df['discharge_origin_lpm'].values

class SpringDischargeSeasonalBaseline:
    """
    Seasonal median discharge baseline matching the target calendar month.
    """
    def __init__(self):
        self.seasonal_medians = {}
        
    def fit(self, df):
        for (sp, m), g in df.groupby(['spring_id', 'target_month']):
            self.seasonal_medians[(sp, m)] = float(g['discharge_lpm'].median())
        return self
        
    def predict(self, df):
        preds = []
        overall_med = float(df['discharge_origin_lpm'].median()) if len(df) > 0 else 10.0
        for _, row in df.iterrows():
            key = (row['spring_id'], row['target_month'])
            val = self.seasonal_medians.get(key, row['discharge_origin_lpm'])
            preds.append(round(val, 2))
        return np.array(preds)

class SpringDischargeQuantileGB:
    """
    Quantile Gradient Boosting regressor for multi-horizon spring discharge forecasting (L/min).
    Estimates P10, P50, and P90 conditional quantiles with monotonic ordering safeguards.
    """
    def __init__(self, quantiles=[0.10, 0.50, 0.90]):
        self.quantiles = quantiles
        self.models = {}
        
    def fit(self, X, y):
        for q in self.quantiles:
            reg = GradientBoostingRegressor(loss='quantile', alpha=q, n_estimators=60, max_depth=3, random_state=42)
            reg.fit(X, y)
            self.models[q] = reg
        return self
        
    def predict(self, X, enforce_ordering=True):
        raw = {q: self.models[q].predict(X) for q in self.quantiles}
        p10 = raw[0.10]
        p50 = raw[0.50]
        p90 = raw[0.90]
        
        if enforce_ordering:
            p10_ordered = np.minimum(p10, p50)
            p90_ordered = np.maximum(p90, p50)
            # Discharge cannot be negative
            p10_ordered = np.maximum(0.0, p10_ordered)
            p50_ordered = np.maximum(0.0, p50)
            p90_ordered = np.maximum(0.0, p90_ordered)
            return {'p10': p10_ordered, 'p50': p50_ordered, 'p90': p90_ordered}
            
        return {'p10': np.maximum(0.0, p10), 'p50': np.maximum(0.0, p50), 'p90': np.maximum(0.0, p90)}

def evaluate_spring_forecast_metrics(y_true, y_pred):
    m = np.isfinite(y_true) & np.isfinite(y_pred)
    yt, yp = y_true[m], y_pred[m]
    if len(yt) < 2:
        return {'rmse_lpm': np.nan, 'mae_lpm': np.nan, 'nse': np.nan, 'n': len(yt)}
    r = float(np.sqrt(np.mean((yt - yp) ** 2)))
    a = float(np.mean(np.abs(yt - yp)))
    denom = float(np.sum((yt - np.mean(yt)) ** 2))
    nse_val = float(1.0 - (np.sum((yt - yp) ** 2) / denom)) if denom > 1e-4 else np.nan
    return {'rmse_lpm': round(r, 2), 'mae_lpm': round(a, 2), 'nse': round(nse_val, 3) if not np.isnan(nse_val) else np.nan, 'n': len(yt)}
