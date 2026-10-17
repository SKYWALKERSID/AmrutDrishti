"""
Automated Unit Tests for Sikkim Springshed Discharge Forecasting Engine.
Uses clearly marked synthetic test fixtures to validate baseflow recession physics,
seasonal discharge baselines, quantile ordering safeguards, and non-negative discharge constraints.
"""

import pytest
import numpy as np
import pandas as pd
from ml.springshed_engine import (
    SpringBaseflowRecessionModel,
    SpringDischargePersistenceBaseline,
    SpringDischargeSeasonalBaseline,
    SpringDischargeQuantileGB,
    evaluate_spring_forecast_metrics
)

@pytest.fixture
def synthetic_spring_fixtures():
    """
    Clearly marked synthetic test fixture representing 3 Himalayan mountain springs
    over a 180-day post-monsoon baseflow recession period (Oct to March).
    Units: Litres per Minute (L/min).
    """
    records = []
    np.random.seed(42)
    for sp_id, base_q, alpha in [('SP_001', 30.0, 0.012), ('SP_002', 15.0, 0.018), ('SP_003', 50.0, 0.008)]:
        for day in [0, 30, 60, 90, 120, 150, 180]:
            noise = np.random.normal(0, 0.5)
            q = max(0.2, base_q * np.exp(-alpha * day) + noise)
            records.append({
                'spring_id': sp_id,
                'date': pd.Timestamp('2023-10-01') + pd.Timedelta(days=day),
                'elapsed_days': day,
                'target_month': ((10 + day // 30 - 1) % 12) + 1,
                'discharge_lpm': round(float(q), 2),
                'discharge_origin_lpm': base_q
            })
    return pd.DataFrame(records)

class TestSpringshedEngine:

    def test_persistence_baseline_preserves_lpm_units(self, synthetic_spring_fixtures):
        model = SpringDischargePersistenceBaseline()
        preds = model.predict(synthetic_spring_fixtures)
        assert len(preds) == len(synthetic_spring_fixtures)
        assert all(preds >= 0.0), "Spring discharge must never be negative"
        assert preds[0] == 30.0

    def test_baseflow_recession_model_exponential_decay(self, synthetic_spring_fixtures):
        model = SpringBaseflowRecessionModel(default_alpha=0.015)
        model.fit(synthetic_spring_fixtures)
        
        test_df = pd.DataFrame([
            {'spring_id': 'SP_001', 'discharge_origin_lpm': 30.0, 'elapsed_days': 60},
            {'spring_id': 'SP_001', 'discharge_origin_lpm': 30.0, 'elapsed_days': 120}
        ])
        preds = model.predict(test_df)
        assert len(preds) == 2
        # As elapsed time increases, discharge must decrease
        assert preds[0] > preds[1], f"Expected recession decay: {preds[0]} should be > {preds[1]}"
        assert preds[1] > 0.0, "Discharge should remain positive"

    def test_quantile_gb_enforces_monotonic_ordering(self):
        np.random.seed(42)
        X = np.random.uniform(5, 50, size=(100, 3))
        y = X[:, 0] * 0.8 + np.random.normal(0, 2, size=100)
        y = np.maximum(0.5, y)
        
        qgb = SpringDischargeQuantileGB(quantiles=[0.10, 0.50, 0.90])
        qgb.fit(X, y)
        
        X_test = np.random.uniform(5, 50, size=(20, 3))
        preds = qgb.predict(X_test, enforce_ordering=True)
        
        p10 = preds['p10']
        p50 = preds['p50']
        p90 = preds['p90']
        
        assert np.all(p10 <= p50 + 1e-6), "P10 must be <= P50"
        assert np.all(p50 <= p90 + 1e-6), "P50 must be <= P90"
        assert np.all(p10 >= 0.0), "Spring discharge P10 must be non-negative"

    def test_spring_forecast_metrics_evaluation(self):
        y_true = np.array([25.0, 20.0, 15.0, 10.0])
        y_pred = np.array([24.0, 21.0, 14.5, 10.5])
        
        m = evaluate_spring_forecast_metrics(y_true, y_pred)
        assert m['rmse_lpm'] < 1.0
        assert m['mae_lpm'] < 1.0
        assert m['nse'] > 0.95
        assert m['n'] == 4
        
        # Test constant series returns nan NSE
        m_const = evaluate_spring_forecast_metrics(np.array([10.0, 10.0]), np.array([10.0, 10.0]))
        assert np.isnan(m_const['nse']), "NSE on zero variance should be NaN"
