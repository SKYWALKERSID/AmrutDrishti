"""
Regression Test Suite: Station Autonomy & Leak-Free Feature Pipeline
Verifies:
1. Zero cross-station lag contamination.
2. Zero cross-station target contamination.
3. Target horizon window adherence ([45, 135] days for h=1).
4. Prevention of zero-coercion for missing depth values.
5. Strict non-crossing quantile ordering on QuantileGroundwaterModel.
"""
import unittest
import numpy as np
import pandas as pd
from ml.feature_engineering import build_station_training_matrix, clean_and_harmonize_observations
from ml.models import QuantileGroundwaterModel


class TestStationAutonomy(unittest.TestCase):
    def setUp(self):
        # Create 2 stations with distinct depths and dates
        # Station A: depths 10.0 -> 12.0 -> 14.0 (cadence: 90 days apart)
        # Station B: depths 30.0 -> 32.0 -> 34.0 (cadence: 90 days apart, same dates as A)
        dates = pd.date_range("2022-01-01", periods=3, freq="90D")
        
        self.df = pd.DataFrame([
            {"station": "ST_A", "observation_date": dates[0], "water_level_mbgl": 10.0, "district_name": "Dist1", "block_name": "Blk1"},
            {"station": "ST_B", "observation_date": dates[0], "water_level_mbgl": 30.0, "district_name": "Dist1", "block_name": "Blk1"},
            {"station": "ST_A", "observation_date": dates[1], "water_level_mbgl": 12.0, "district_name": "Dist1", "block_name": "Blk1"},
            {"station": "ST_B", "observation_date": dates[1], "water_level_mbgl": 32.0, "district_name": "Dist1", "block_name": "Blk1"},
            {"station": "ST_A", "observation_date": dates[2], "water_level_mbgl": 14.0, "district_name": "Dist1", "block_name": "Blk1"},
            {"station": "ST_B", "observation_date": dates[2], "water_level_mbgl": 34.0, "district_name": "Dist1", "block_name": "Blk1"},
        ])

    def test_zero_cross_station_contamination(self):
        matrix = build_station_training_matrix(self.df)
        
        st_a_rows = matrix[matrix["station"] == "ST_A"]
        st_b_rows = matrix[matrix["station"] == "ST_B"]
        
        # Station A's origin and lags must be around 10-14m, NEVER 30-34m
        for _, r in st_a_rows.iterrows():
            self.assertIn(r["wl_origin"], [10.0, 12.0])
            if np.isfinite(r["wl_prev"]):
                self.assertEqual(r["wl_prev"], 10.0)
            self.assertIn(r["target_h1"], [12.0, 14.0])
            # Critical check: Station A must NEVER have Station B's values
            self.assertNotEqual(r["wl_prev"], 30.0)
            self.assertNotEqual(r["target_h1"], 32.0)
            
        # Station B's origin and lags must be around 30-34m, NEVER 10-14m
        for _, r in st_b_rows.iterrows():
            self.assertIn(r["wl_origin"], [30.0, 32.0])
            if np.isfinite(r["wl_prev"]):
                self.assertEqual(r["wl_prev"], 30.0)
            self.assertIn(r["target_h1"], [32.0, 34.0])
            self.assertNotEqual(r["wl_prev"], 10.0)
            self.assertNotEqual(r["target_h1"], 12.0)

    def test_target_horizon_window_adherence(self):
        # Station C has observation at t=0, and next at t=200 days (> 135 days)
        # Must NOT be paired as h=1 (1-quarter) target
        df_gap = pd.DataFrame([
            {"station": "ST_C", "observation_date": pd.Timestamp("2022-01-01"), "water_level_mbgl": 15.0},
            {"station": "ST_C", "observation_date": pd.Timestamp("2022-07-20"), "water_level_mbgl": 18.0}, # gap = 200 days (h2, not h1)
        ])
        mat_gap = build_station_training_matrix(df_gap)
        if not mat_gap.empty:
            r = mat_gap.iloc[0]
            self.assertTrue(np.isnan(r["target_h1"]), "200-day gap must NOT be assigned to target_h1")
            self.assertEqual(r["target_h2"], 18.0, "200-day gap must be assigned to target_h2")

    def test_zero_coercion_prevention(self):
        df_nulls = pd.DataFrame([
            {"station": "ST_D", "observation_date": "01-01-2022", "groundwater_level_quarterly_manual_(meter)": "NaN"},
            {"station": "ST_D", "observation_date": "01-04-2022", "groundwater_level_quarterly_manual_(meter)": "-999"},
            {"station": "ST_D", "observation_date": "01-07-2022", "groundwater_level_quarterly_manual_(meter)": "8.5"},
        ])
        cleaned = clean_and_harmonize_observations(df_nulls)
        vals = cleaned["water_level_mbgl"].tolist()
        self.assertTrue(np.isnan(vals[0]), "Missing depth must remain NaN, never zero")
        self.assertTrue(np.isnan(vals[1]), "Out-of-bounds depth (-999) must be NaN, never zero")
        self.assertEqual(vals[2], 8.5)

    def test_model_guarantees_non_crossing_quantiles(self):
        # Train model on small dataset
        X = pd.DataFrame({"feat1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]})
        y = pd.Series([2.0, 4.0, 3.5, 6.0, 5.8, 8.0, 7.5, 10.0, 9.2, 11.0])
        
        model = QuantileGroundwaterModel(quantiles=[0.10, 0.50, 0.90])
        model.fit(X, y)
        
        # Test on extreme out-of-distribution input where independent trees often cross
        X_test = pd.DataFrame({"feat1": [-50.0, 0.0, 50.0, 100.0, 500.0]})
        preds = model.predict(X_test, enforce_ordering=True)
        
        p10 = preds["p10"]
        p50 = preds["p50"]
        p90 = preds["p90"]
        
        # Verify strict ordering
        self.assertTrue(np.all(p10 <= p50), "P10 must be <= P50 for all predictions")
        self.assertTrue(np.all(p50 <= p90), "P50 must be <= P90 for all predictions")


if __name__ == "__main__":
    unittest.main()
