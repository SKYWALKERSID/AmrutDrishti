"""
Regression tests for SeasonalPersistenceBaseline and benchmark functionality.
"""
import unittest
import numpy as np
import pandas as pd
from ml.baselines import SeasonalPersistenceBaseline


class TestSeasonalPersistenceBaseline(unittest.TestCase):
    def setUp(self):
        # Synthetic quarterly data: 2 years, 4 quarters each
        # Year 1 (quarters 0,1,2,3), Year 2 (quarters 0,1,2,3)
        rows = [
            {"station": "ST1", "season_code": 0, "water_level_mbgl": 5.0, "water_level_lag_1": np.nan, "water_level_lag_4": np.nan},
            {"station": "ST1", "season_code": 1, "water_level_mbgl": 7.0, "water_level_lag_1": 5.0, "water_level_lag_4": np.nan},
            {"station": "ST1", "season_code": 2, "water_level_mbgl": 6.0, "water_level_lag_1": 7.0, "water_level_lag_4": np.nan},
            {"station": "ST1", "season_code": 3, "water_level_mbgl": 4.0, "water_level_lag_1": 6.0, "water_level_lag_4": np.nan},
            {"station": "ST1", "season_code": 0, "water_level_mbgl": 5.5, "water_level_lag_1": 4.0, "water_level_lag_4": 5.0},
            {"station": "ST1", "season_code": 1, "water_level_mbgl": 7.5, "water_level_lag_1": 5.5, "water_level_lag_4": 7.0},
            {"station": "ST1", "season_code": 2, "water_level_mbgl": 6.5, "water_level_lag_1": 7.5, "water_level_lag_4": 6.0},
            {"station": "ST1", "season_code": 3, "water_level_mbgl": 4.5, "water_level_lag_1": 6.5, "water_level_lag_4": 4.0},
        ]
        self.df = pd.DataFrame(rows)

    def test_fit_and_seasonal_deltas(self):
        baseline = SeasonalPersistenceBaseline()
        baseline.fit(self.df)

        # For Year 2: water_level - lag_4 is +0.5 for all seasons (0, 1, 2, 3)
        for season in range(4):
            self.assertIn(season, baseline.seasonal_deltas_)
            self.assertAlmostEqual(baseline.seasonal_deltas_[season], 0.5, places=5)

    def test_predict_with_lag4(self):
        baseline = SeasonalPersistenceBaseline()
        baseline.fit(self.df)

        # Test prediction on a future quarter 1 observation where lag_4 is 8.0
        test_df = pd.DataFrame([
            {"season_code": 1, "water_level_lag_4": 8.0, "water_level_lag_1": 6.0}
        ])
        preds = baseline.predict(test_df)
        # Expected: lag_4 (8.0) + delta (0.5) = 8.5
        self.assertEqual(len(preds), 1)
        self.assertAlmostEqual(preds[0], 8.5, places=5)

    def test_predict_fallback_to_lag1(self):
        baseline = SeasonalPersistenceBaseline()
        baseline.fit(self.df)

        # Test prediction where lag_4 is NaN, should fall back to lag_1
        test_df = pd.DataFrame([
            {"season_code": 2, "water_level_lag_4": np.nan, "water_level_lag_1": 6.0}
        ])
        preds = baseline.predict(test_df)
        # Expected: lag_1 (6.0) + delta (0.5) = 6.5
        self.assertEqual(len(preds), 1)
        self.assertAlmostEqual(preds[0], 6.5, places=5)

    def test_predict_both_lags_nan(self):
        baseline = SeasonalPersistenceBaseline()
        baseline.fit(self.df)

        test_df = pd.DataFrame([
            {"season_code": 0, "water_level_lag_4": np.nan, "water_level_lag_1": np.nan}
        ])
        preds = baseline.predict(test_df)
        self.assertEqual(len(preds), 1)
        self.assertTrue(np.isnan(preds[0]))


if __name__ == "__main__":
    unittest.main()
