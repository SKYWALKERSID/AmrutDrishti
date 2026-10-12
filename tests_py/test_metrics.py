"""
Regression tests for metrics and scientific indicators.
Verifies MAE, RMSE, Bias, NSE, Pinball Loss, Coverage, and edge cases.
"""
import unittest
import numpy as np
from ml.validation import (
    mae,
    rmse,
    bias,
    nse,
    pinball,
    interval_coverage,
    rmse_improvement_pct,
    quantile_crossings,
    order_quantiles,
    summarize,
)
from ml.baselines import calculate_hydrological_metrics


class TestMetrics(unittest.TestCase):
    def test_hand_calculated_standard_metrics(self):
        # True: [10.0, 12.0, 14.0], Pred: [11.0, 11.0, 15.0]
        # Errors (pred - true): [+1.0, -1.0, +1.0]
        # Absolute errors: [1.0, 1.0, 1.0] -> MAE = 1.0
        # Squared errors: [1.0, 1.0, 1.0] -> RMSE = 1.0
        # Bias (pred - true): (1.0 - 1.0 + 1.0) / 3 = 0.333333...
        y = np.array([10.0, 12.0, 14.0])
        p = np.array([11.0, 11.0, 15.0])

        self.assertAlmostEqual(mae(y, p), 1.0, places=5)
        self.assertAlmostEqual(rmse(y, p), 1.0, places=5)
        self.assertAlmostEqual(bias(y, p), 1.0 / 3.0, places=5)

    def test_nse_calculation(self):
        # Perfect predictions: NSE = 1.0
        y = np.array([2.0, 4.0, 6.0, 8.0])
        p_perfect = np.array([2.0, 4.0, 6.0, 8.0])
        self.assertAlmostEqual(nse(y, p_perfect), 1.0, places=5)

        # Baseline mean prediction: p = mean(y) = 5.0 -> NSE = 0.0
        p_mean = np.array([5.0, 5.0, 5.0, 5.0])
        self.assertAlmostEqual(nse(y, p_mean), 0.0, places=5)

        # Worse than mean: sum((y-p)^2) = (2-10)^2 + (4-10)^2 + (6-10)^2 + (8-10)^2 = 64 + 36 + 16 + 4 = 120
        # den = sum((y-mean)^2) = 9 + 1 + 1 + 9 = 20
        # NSE = 1 - 120/20 = -5.0
        p_bad = np.array([10.0, 10.0, 10.0, 10.0])
        self.assertAlmostEqual(nse(y, p_bad), -5.0, places=5)

    def test_nse_edge_cases(self):
        # Constant true values: denominator is 0 -> nse should be None (undefined, never invent 1.0)
        y_const = np.array([5.0, 5.0, 5.0])
        p = np.array([5.0, 5.0, 5.0])
        self.assertIsNone(nse(y_const, p))

        # Fewer than 2 points -> None
        self.assertIsNone(nse(np.array([5.0]), np.array([5.0])))

    def test_empty_and_nan_handling(self):
        # Empty arrays -> None
        self.assertIsNone(mae(np.array([]), np.array([])))
        self.assertIsNone(rmse(np.array([]), np.array([])))
        self.assertIsNone(bias(np.array([]), np.array([])))
        self.assertIsNone(nse(np.array([]), np.array([])))
        self.assertIsNone(pinball(np.array([]), np.array([]), 0.5))
        self.assertIsNone(interval_coverage(np.array([]), np.array([]), np.array([])))

        # NaNs filtered properly
        y_nan = np.array([10.0, np.nan, 14.0])
        p_nan = np.array([11.0, 12.0, 15.0])
        self.assertAlmostEqual(mae(y_nan, p_nan), 1.0, places=5)
        self.assertAlmostEqual(rmse(y_nan, p_nan), 1.0, places=5)

    def test_pinball_loss(self):
        # Pinball loss formula: mean(max(q * (y - p), (q - 1) * (y - p)))
        # For q = 0.5: 0.5 * |y - p|
        y = np.array([10.0, 14.0])
        p = np.array([8.0, 16.0])
        # Diff: [2.0, -2.0]
        # At q=0.5: max(0.5*2, -0.5*2) = 1.0, max(0.5*-2, -0.5*-2) = 1.0 -> mean = 1.0
        self.assertAlmostEqual(pinball(y, p, 0.5), 1.0, places=5)

        # At q = 0.1:
        # For d = 2 (under-prediction: y > p): max(0.1*2, -0.9*2) = 0.2
        # For d = -2 (over-prediction: y < p): max(0.1*-2, -0.9*-2) = 1.8
        # mean = (0.2 + 1.8) / 2 = 1.0
        self.assertAlmostEqual(pinball(y, p, 0.1), 1.0, places=5)

    def test_interval_coverage(self):
        y = np.array([5.0, 10.0, 15.0, 20.0])
        lo = np.array([4.0, 9.0, 16.0, 19.0])  # point 3 (15.0 < 16.0) is outside
        hi = np.array([6.0, 11.0, 18.0, 21.0])
        # Points inside: 1st (5 in [4,6]), 2nd (10 in [9,11]), 4th (20 in [19,21]) -> 3/4 = 0.75
        self.assertAlmostEqual(interval_coverage(y, lo, hi), 0.75, places=5)

    def test_rmse_improvement_pct(self):
        self.assertAlmostEqual(rmse_improvement_pct(1.0, 2.0), 50.0, places=5)
        self.assertAlmostEqual(rmse_improvement_pct(2.0, 1.0), -100.0, places=5)
        self.assertIsNone(rmse_improvement_pct(None, 2.0))
        self.assertIsNone(rmse_improvement_pct(1.0, 0.0))

    def test_baselines_calculate_hydrological_metrics(self):
        res = calculate_hydrological_metrics(np.array([1.0, 2.0, 3.0]), np.array([1.0, 2.0, 3.0]))
        self.assertEqual(res["rmse"], 0.0)
        self.assertEqual(res["mae"], 0.0)
        self.assertEqual(res["nse"], 1.0)

        # Empty returns NaN
        empty_res = calculate_hydrological_metrics(np.array([]), np.array([]))
        self.assertTrue(np.isnan(empty_res["rmse"]))


if __name__ == "__main__":
    unittest.main()
