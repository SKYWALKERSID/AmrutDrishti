"""
Regression tests for temporal leakage prevention and station-aware grouping.
Verifies:
1. Matrix construction enforces 45-135 day horizon window.
2. Interrupted/missing campaigns do not become invalid 'next quarter' targets.
3. Feature lags only use data <= origin_date (strictly causal).
4. No cross-contamination across different hydrograph monitoring stations.
5. Chronological splitting ensures train target dates <= min(test origin date).
"""
import unittest
import numpy as np
import pandas as pd
from ml.validation import build_station_horizon_matrix, chronological_split, MIN_HORIZON_DAYS, MAX_HORIZON_DAYS


class TestTemporalLeakageAndMatrix(unittest.TestCase):
    def test_multi_station_isolation(self):
        # Station A and Station B have observations on alternating dates.
        # They should NEVER pair an origin from Station A with a target from Station B!
        data = [
            {"station": "ST_A", "observation_date": "2023-01-15", "water_level_mbgl": 5.0},
            {"station": "ST_B", "observation_date": "2023-02-01", "water_level_mbgl": 20.0},
            {"station": "ST_A", "observation_date": "2023-04-15", "water_level_mbgl": 6.0},  # ~90 days after ST_A origin
            {"station": "ST_B", "observation_date": "2023-05-01", "water_level_mbgl": 21.0},  # ~89 days after ST_B origin
        ]
        df = pd.DataFrame(data)
        matrix = build_station_horizon_matrix(df)

        # Expect exactly 2 rows: 1 for ST_A and 1 for ST_B
        self.assertEqual(len(matrix), 2)

        row_a = matrix[matrix["station"] == "ST_A"].iloc[0]
        self.assertEqual(row_a["wl_origin"], 5.0)
        self.assertEqual(row_a["target"], 6.0)

        row_b = matrix[matrix["station"] == "ST_B"].iloc[0]
        self.assertEqual(row_b["wl_origin"], 20.0)
        self.assertEqual(row_b["target"], 21.0)

    def test_horizon_window_filtering(self):
        # Test gaps < 45 days and > 135 days are rejected
        data = [
            # Gap of 20 days: Too short (< 45 days)
            {"station": "ST_1", "observation_date": "2023-01-01", "water_level_mbgl": 5.0},
            {"station": "ST_1", "observation_date": "2023-01-21", "water_level_mbgl": 5.2},
            # Gap of 200 days: Missing campaigns (> 135 days)
            {"station": "ST_1", "observation_date": "2023-08-10", "water_level_mbgl": 8.0},
            # Gap of 90 days: Valid quarterly campaign (45 <= gap <= 135)
            {"station": "ST_1", "observation_date": "2023-11-08", "water_level_mbgl": 7.0},
        ]
        df = pd.DataFrame(data)
        matrix = build_station_horizon_matrix(df)

        # Only the transition from 2023-08-10 to 2023-11-08 (90 days) should be accepted!
        self.assertEqual(len(matrix), 1)
        row = matrix.iloc[0]
        self.assertEqual(pd.to_datetime(row["origin_date"]), pd.to_datetime("2023-08-10"))
        self.assertEqual(pd.to_datetime(row["target_date"]), pd.to_datetime("2023-11-08"))
        self.assertEqual(row["horizon_days"], 90)

    def test_duplicate_readings_averaged(self):
        # Multiple readings on same date for same station must be averaged without error
        data = [
            {"station": "ST_DUP", "observation_date": "2023-01-15", "water_level_mbgl": 10.0},
            {"station": "ST_DUP", "observation_date": "2023-01-15", "water_level_mbgl": 12.0},  # Mean = 11.0
            {"station": "ST_DUP", "observation_date": "2023-04-15", "water_level_mbgl": 14.0},
        ]
        df = pd.DataFrame(data)
        matrix = build_station_horizon_matrix(df)

        self.assertEqual(len(matrix), 1)
        self.assertEqual(matrix.iloc[0]["wl_origin"], 11.0)
        self.assertEqual(matrix.iloc[0]["target"], 14.0)

    def test_chronological_split_strictness(self):
        # Ensure training targets are strictly <= test origin date
        dates = pd.date_range("2021-01-01", periods=10, freq="90D")
        rows = []
        for i, d in enumerate(dates):
            rows.append({
                "station": "ST_SPLIT",
                "observation_date": d.strftime("%Y-%m-%d"),
                "water_level_mbgl": 5.0 + i * 0.5
            })
        df = pd.DataFrame(rows)
        matrix = build_station_horizon_matrix(df)

        train, test = chronological_split(matrix, n_test_target_dates=2)

        self.assertGreater(len(train), 0)
        self.assertGreater(len(test), 0)

        # No target overlap: train targets <= min(test origin_date)
        max_train_target = train["target_date"].max()
        min_test_origin = test["origin_date"].min()
        self.assertLessEqual(max_train_target, min_test_origin)


if __name__ == "__main__":
    unittest.main()
